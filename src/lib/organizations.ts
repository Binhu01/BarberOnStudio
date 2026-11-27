import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Organization, Membership, UserRole } from "@/types/database";

export interface UserOrganization extends Organization {
  membership: Membership;
}

/**
 * Cliente Supabase anon para fallback quando SERVICE_ROLE_KEY não está disponível.
 * Usa ANON_KEY que está sempre disponível via NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

/**
 * Fetch all organizations the current user belongs to, along with their role.
 * Tenta admin client primeiro (bypass RLS), faz fallback para anon client + join.
 */
export async function getUserOrganizations(): Promise<UserOrganization[]> {
  // Get user ID from the regular client (auth doesn't need admin)
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Tentar admin client primeiro (bypass RLS)
  const admin = createAdminClient();
  if (admin) {
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

    if (!error && memberships && memberships.length > 0) {
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
  }

  // Fallback: usar cliente anon (RLS permite leitura de memberships ativas via migration 027)
  const anon = getAnonClient();
  if (!anon) return [];

  // Buscar memberships do usuário via anon (RLS permite select onde user_id = auth.uid())
  const { data: memberships, error: membersError } = await anon
    .from("memberships")
    .select("id, organization_id, user_id, role, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membersError || !memberships || memberships.length === 0) return [];

  // Buscar dados das organizações separadamente
  const orgIds = memberships.map((m) => m.organization_id);
  const { data: orgs, error: orgsError } = await anon
    .from("organizations")
    .select("id, name, slug, created_by, created_at, updated_at")
    .in("id", orgIds);

  if (orgsError || !orgs) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgMap = new Map(orgs.map((o: any) => [o.id, o]));

  return memberships
    .filter((m) => orgMap.has(m.organization_id))
    .map((m) => {
      const org = orgMap.get(m.organization_id)!;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        created_by: org.created_by,
        created_at: org.created_at,
        updated_at: org.updated_at,
        membership: {
          id: m.id,
          organization_id: m.organization_id,
          user_id: m.user_id,
          role: m.role as UserRole,
          status: (m.status as "active" | "suspended") ?? "active",
          created_at: m.created_at,
        },
      };
    });
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
  if (!admin) {
    // Fallback para anon client
    const anon = getAnonClient();
    if (!anon) return 0;
    const { count, error } = await anon
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if (error) return 0;
    return count ?? 0;
  }

  const { count, error } = await admin
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) return 0;
  return count ?? 0;
}