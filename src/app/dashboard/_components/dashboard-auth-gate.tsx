import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "../shell";
import { OrganizationProvider, type ClientOrganization } from "../organization-context";

/**
 * Server component that handles auth + org resolution for the dashboard.
 *
 * IMPORTANT: Org data is passed from middleware via x-barber-org-data header
 * to avoid RLS/cookie issues in server components. The middleware already
 * verified the user has an active organization.
 */
export async function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read org data from middleware header instead of re-querying
  const headersList = await headers();
  const orgDataHeader = headersList.get("x-barber-org-data");

  let activeData: { org: ClientOrganization; allOrgs: ClientOrganization[] } | null = null;

  if (orgDataHeader) {
    try {
      const decoded = Buffer.from(orgDataHeader, "base64").toString("utf-8");
      activeData = JSON.parse(decoded);
    } catch (e) {
      console.error("[AuthGate] failed to parse org header:", e);
    }
  }

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

  // Force dynamic rendering — ensures RSC payload streams correctly
  await connection();

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
            role: activeData.org.membership.role as "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE",
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