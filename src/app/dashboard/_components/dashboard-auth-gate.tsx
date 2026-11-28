import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import { DashboardShell } from "../shell";
import { OrganizationProvider } from "../organization-context";

/**
 * Server component that handles auth + org resolution for the dashboard.
 * Extracted from layout.tsx so Next.js can isolate the uncached
 * supabase.auth.getUser() call and stop showing the Insights overlay.
 *
 * connection() é OBRIGATÓRIO com cacheComponents: true — marca esta rota
 * como dinâmica e impede prerender estático durante o build.
 */
export async function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  // connection() sinaliza ao Next.js Cache Components que esta rota
  // depende de runtime state (cookies/auth) e NÃO deve ser pré-renderizada.
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeData = await getActiveOrganization();

  if (!activeData) {
    console.warn(
      "⚠️ DashboardAuthGate: usuário sem organização ativa, redirecionando para onboarding"
    );
    redirect("/dashboard/onboarding");
  }

  let userName: string | null = null;
  let userAvatar: string | null = null;

  // Buscar perfil — tenta admin primeiro, fallback para anon
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