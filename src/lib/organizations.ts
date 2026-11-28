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

  // Fallback: usar server client (tem cookies de auth, RLS permite leitura própria)
  // NOTA: getAnonClient() cria client SEM cookies → RLS bloqueia. Usar supabase (server) instead.
  console.log("[getUserOrgs] admin failed or unavailable, falling back to server client with cookies");
  const { data: memberships, error: membersError } = await supabase
    .from("memberships")
    .select("id, organization_id, user_id, role, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "active");

  console.log("[getUserOrgs] server client memberships:", { count: memberships?.length, error: membersError?.message });

  // Se server client falhar (RLS bloqueia sem cookies válidos), usar fallback HTTP com service_role
  if (membersError || !memberships || memberships.length === 0) {
    console.log("[getUserOrgs] server client returned 0, trying service_role HTTP fallback");
    // Fallback HTTP com ANON key + JWT do usuário (mesmo padrão do middleware)
    // Service_role falha em dev (401). Usar anon key com Authorization bearer do token do usuário.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (anonKey && supabaseUrl) {
      try {
        // Extrair access_token diretamente do cookie sb-*-auth-token (mesmo token que o middleware usa)
        // getSession() pode retornar token stale; o cookie tem o token fresco da request
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const authCookie = allCookies.find(c => c.name.endsWith("-auth-token"));
        let accessToken: string | undefined;
        if (authCookie?.value) {
          try {
            // O cookie pode ter prefixo "base64-" seguido de JSON base64-encoded
            const rawValue = authCookie.value.startsWith("base64-")
              ? atob(authCookie.value.slice(7))
              : decodeURIComponent(authCookie.value);
            const parsed = JSON.parse(rawValue);
            accessToken = parsed.access_token;
          } catch {
            // Se parsing falhar, tentar como JSON direto
            try {
              const parsed = JSON.parse(authCookie.value);
              accessToken = parsed.access_token;
            } catch { /* ignore */ }
          }
        }
        console.log("[getUserOrgs] HTTP anon fallback, hasToken:", !!accessToken, "cookieName:", authCookie?.name);

        if (accessToken) {
          const url = `${supabaseUrl}/rest/v1/memberships?user_id=eq.${user.id}&status=eq.active&select=id,organization_id,user_id,role,status,created_at`;
          const response = await fetch(url, {
            method: "GET",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          });
          console.log("[getUserOrgs] HTTP anon fallback response:", { status: response.status, ok: response.ok });
          if (response.ok) {
            const httpMemberships = await response.json();
            console.log("[getUserOrgs] HTTP anon fallback memberships:", { count: httpMemberships?.length });
            if (httpMemberships && httpMemberships.length > 0) {
              const orgIds = httpMemberships.map((m: { organization_id: string }) => m.organization_id);
              const orgUrl = `${supabaseUrl}/rest/v1/organizations?id=in.(${orgIds.join(",")})&select=id,name,slug,created_by,created_at,updated_at`;
              const orgResponse = await fetch(orgUrl, {
                method: "GET",
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
              });
              if (orgResponse.ok) {
                const orgs = await orgResponse.json();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const orgMap = new Map(orgs.map((o: any) => [o.id, o]));
                return httpMemberships
                  .filter((m: { organization_id: string }) => orgMap.has(m.organization_id))
                  .map((m: { id: string; organization_id: string; user_id: string; role: string; status: string; created_at: string }) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const org = orgMap.get(m.organization_id) as any;
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
            }
          }
        }
      } catch (e) {
        console.error("[getUserOrgs] HTTP anon fallback error:", e);
      }
    }
    return [];
  }

  // Buscar dados das organizações separadamente
  const orgIds = memberships.map((m) => m.organization_id);
  const { data: orgs, error: orgsError } = await supabase
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