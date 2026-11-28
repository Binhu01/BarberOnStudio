import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import { DashboardShell } from "../shell";
import { OrganizationProvider } from "../organization-context";

/**
 * Server component that handles auth + org resolution for the dashboard.
 *
 * IMPORTANT: Uses ANON client for all queries because SUPABASE_SERVICE_ROLE_KEY
 * may be invalid or missing in production. Anon client works correctly with RLS
 * for authenticated users reading their own data.
 */
export async function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  // connection() signals to Next.js Cache Components that this route
  // depends on runtime state (cookies/auth) and must NOT be prerendered.
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
    redirect("/dashboard/onboarding");
  }

  // Fetch profile using ANON client (works with RLS for own profile)
  let userName: string | null = null;
  let userAvatar: string | null = null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  userName = profile?.full_name ?? null;
  userAvatar = profile?.avatar_url ?? null;

  return (
    <OrganizationProvider org={activeData.org} allOrgs={activeData.allOrgs}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-barber-dark">
            <p className="text-barber-muted">Carregando dashboard...</p>
          </div>
        }
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
      </Suspense>
    </OrganizationProvider>
  );
}