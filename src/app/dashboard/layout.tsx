// @cache-bust: 2026-11-24T14-00-00 — redirect to onboarding REMOVED
// Required by cacheComponents: opts this segment out of instant validation
export const instant = false;

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import { DashboardShell } from "./shell";
import { OrganizationProvider } from "./organization-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Confia diretamente no getActiveOrganization() que já tem fallback HTTP
  const activeData = await getActiveOrganization();

  // Se não há organização, o middleware deveria ter redirecionado para onboarding
  // Mas por segurança, verificamos aqui também
  if (!activeData) {
    console.warn('⚠️ Layout: usuário sem organização ativa, redirecionando para onboarding');
    redirect("/dashboard/onboarding");
  }

  let userName: string | null = null;
  let userAvatar: string | null = null;

  // Use admin client to bypass RLS for profile query
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  userName = profile?.full_name ?? null;
  userAvatar = profile?.avatar_url ?? null;

  return (
    <OrganizationProvider
      org={activeData.org}
      allOrgs={activeData.allOrgs}
    >
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