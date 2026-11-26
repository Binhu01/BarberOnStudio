import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Organization, Membership, UserRole } from "@/types/database";

export interface UserOrganization extends Organization {
 membership: Membership;
}

/**
 * Fetch all organizations the current user belongs to, along with their role.
 * Uses admin client to bypass RLS — authorization is handled by middleware.
 */
export async function getUserOrganizations(): Promise<UserOrganization[]> {
 // Get user ID from the regular client (auth doesn't need admin)
 const supabase = await createServerClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) return [];

 // Use admin client to bypass RLS for membership queries (graceful fallback)
 const admin = createAdminClient();
 if (!admin) return [];

 const { data: memberships, error } = await admin
 .from("memberships")
 .select(
 `
 id,
 organization_id,
 user_id,
 role,
 status,
 created_at,
 organizations (
 id,
 name,
 slug,
 created_by,
 created_at,
 updated_at
 )
 `
 )
 .eq("user_id", user.id)
 .eq("status", "active");

 if (error || !memberships || memberships.length === 0) return [];

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 return memberships.map((m: any) => ({
 id: m.organizations.id,
 name: m.organizations.name,
 slug: m.organizations.slug,
 created_by: m.organizations.created_by,
 created_at: m.organizations.created_at,
 updated_at: m.organizations.updated_at,
 membership: {
 id: m.id,
 organization_id: m.organization_id,
 user_id: m.user_id,
 role: m.role as UserRole,
 status: (m.status as "active" | "suspended") ?? "active",
 created_at: m.created_at,
 },
 }));
}

/**
 * Get the active organization for the current session.
 * Uses cookie-based selection, falling back to first org.
 */
export async function getActiveOrganization(): Promise<{
 org: UserOrganization;
 allOrgs: UserOrganization[];
} | null> {
 const allOrgs = await getUserOrganizations();

 if (allOrgs.length === 0) return null;

 // Tenta ler o cookie da org ativa; se não existir ou falhar, usa a primeira
 let activeOrgId: string | undefined;
 try {
 const cookieStore = await cookies();
 activeOrgId = cookieStore.get("barber_active_org")?.value;
 } catch {
 // Cookie indisponível — fallback seguro para a primeira organização
 }

 const active = activeOrgId
 ? allOrgs.find((o) => o.id === activeOrgId) ?? allOrgs[0]
 : allOrgs[0];

 return { org: active, allOrgs };
}

/**
 * Get member count for an organization.
 */
export async function getOrganizationMemberCount(
 organizationId: string
): Promise<number> {
 const admin = createAdminClient();
 if (!admin) return 0;

 const { count, error } = await admin
 .from("memberships")
 .select("*", { count: "exact", head: true })
 .eq("organization_id", organizationId);

 if (error) return 0;
 return count ?? 0;
}