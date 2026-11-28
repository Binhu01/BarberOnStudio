import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import { DashboardShell } from "../shell";
import { OrganizationProvider } from "../organization-context";

/**
 * Server component that handles auth + org resolution for the dashboard.
 * Extracted from layout.tsx so Next.js can isolate the uncached
 * supabase.auth.getUser() call and stop showing the Insights overlay.
 */
export async function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  // connection() removido — pode causar erro silencioso em algumas versões do Next.js
  // O cache busting já é garantido pelo cacheComponents: true no next.config

  let supabase;
  try {
    supabase = await createClient();
  } catch (err: any) {
    console.error("[DashboardAuthGate] Falha ao criar Supabase client:", err);
    redirect("/login");
  }

  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err: any) {
    console.error("[DashboardAuthGate] Falha ao obter usuário:", err);
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  let activeData: Awaited<ReturnType<typeof getActiveOrganization>> = null;
  try {
    activeData = await getActiveOrganization();
  } catch (err: any) {
    console.error("[DashboardAuthGate] Falha ao obter organização:", err);
    // Não crashar — tentar continuar com dados mínimos
  }

  if (!activeData) {
    console.warn(
      "⚠️ DashboardAuthGate: usuário sem organização ativa, redirecionando para onboarding"
    );
    redirect("/dashboard/onboarding");
  }

  let userName: string | null = null;
  let userAvatar: string | null = null;

  try {
    const admin = createAdminClient();
    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      userName = profile?.full_name ?? null;
      userAvatar = profile?.avatar_url ?? null;
    }

    // Fallback via anon client se admin não disponível ou não encontrou
    if (!userName) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      userName = profile?.full_name ?? null;
      userAvatar = profile?.avatar_url ?? null;
    }
  } catch (err: any) {
    console.error("[DashboardAuthGate] Falha ao buscar perfil:", err);
    // Continuar sem nome/avatar — melhor que tela preta
  }

  return (
    <OrganizationProvider org={activeData.org} allOrgs={activeData.allOrgs}>
      <DashboardShell
        user={{
          id: user.id,
          name: userName,
          email: user.email ?? "",
          avatarUrl: userAvatar,
        }}
        activeOrg={{
          id: activeData.org.id,
          name: activeData.org.name,
          slug: activeData.org.slug,
          role: activeData.org.membership.role,
        }}
        allOrgs={activeData.allOrgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
        }))}
      >
        {children}
      </DashboardShell>
    </OrganizationProvider>
  );
}