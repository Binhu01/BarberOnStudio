// @cache-bust: 2026-11-13T14-30-00 — redirect to onboarding REMOVED
// Required by cacheComponents: opts this segment out of instant validation
export const instant = false;

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import { DashboardShell } from "./shell";

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

 // No redirect to /dashboard/onboarding here — that causes NEXT_REDIRECT
 // during instant validation. The middleware handles that redirect instead.
 const activeData = await getActiveOrganization();

 let userName: string | null = null;
 let userAvatar: string | null = null;

 if (activeData) {
 const { data: profile } = await supabase
 .from("profiles")
 .select("full_name, avatar_url")
 .eq("id", user.id)
 .single();

 userName = profile?.full_name ?? null;
 userAvatar = profile?.avatar_url ?? null;
 }

 return (
 <DashboardShell
 user={{
 id: user.id,
 name: userName,
 email: user.email ?? "",
 avatarUrl: userAvatar,
 }}
 activeOrg={
 activeData
 ? {
 id: activeData.org.id,
 name: activeData.org.name,
 slug: activeData.org.slug,
 role: activeData.org.membership.role,
 }
 : null
 }
 allOrgs={
 activeData
 ? activeData.allOrgs.map((o) => ({
 id: o.id,
 name: o.name,
 slug: o.slug,
 }))
 : []
 }
 >
 {children}
 </DashboardShell>
 );
}