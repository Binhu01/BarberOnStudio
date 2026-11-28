import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";

/**
 * Diagnostic page — TEMPORARY, remove after debugging.
 * Tests each step of the dashboard auth gate independently
 * to identify where the black screen originates.
 */
export default async function DiagPage() {
  await connection();

  const results: Array<{ step: string; ok: boolean; detail: string }> = [];

  // Step 1: Supabase client creation
  let supabase: any = null;
  try {
    supabase = await createClient();
    results.push({ step: "createClient()", ok: true, detail: "OK" });
  } catch (e: any) {
    results.push({ step: "createClient()", ok: false, detail: e.message });
  }

  // Step 2: Auth user
  let user: any = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser();
      user = data?.user ?? null;
      results.push({
        step: "auth.getUser()",
        ok: !!user,
        detail: user
          ? `uid=${user.id}, email=${user.email}`
          : error?.message ?? "no user",
      });
    } catch (e: any) {
      results.push({ step: "auth.getUser()", ok: false, detail: e.message });
    }
  }

  // Step 3: Organization resolution
  let activeData: any = null;
  if (user) {
    try {
      activeData = await getActiveOrganization();
      results.push({
        step: "getActiveOrganization()",
        ok: !!activeData,
        detail: activeData
          ? `org=${activeData.org.name}, role=${activeData.org.membership.role}, allOrgs=${activeData.allOrgs.length}`
          : "null (no org)",
      });
    } catch (e: any) {
      results.push({
        step: "getActiveOrganization()",
        ok: false,
        detail: e.message,
      });
    }
  }

  // Step 4: Admin client
  try {
    const admin = createAdminClient();
    results.push({
      step: "createAdminClient()",
      ok: !!admin,
      detail: admin ? "available" : "null (SERVICE_ROLE_KEY missing)",
    });
  } catch (e: any) {
    results.push({
      step: "createAdminClient()",
      ok: false,
      detail: e.message,
    });
  }

  // Step 5: Profile lookup
  if (user) {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      results.push({
        step: "profiles lookup (anon)",
        ok: !!profile,
        detail: profile
          ? `name=${profile.full_name}, avatar=${profile.avatar_url ?? "none"}`
          : error?.message ?? "not found",
      });
    } catch (e: any) {
      results.push({
        step: "profiles lookup (anon)",
        ok: false,
        detail: e.message,
      });
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace", background: "#111", color: "#eee", minHeight: "100vh" }}>
      <h1 style={{ color: "#C9A96E" }}>Dashboard Diagnostic</h1>
      <p style={{ color: "#999" }}>
        This page tests each step of the dashboard auth pipeline.
        All steps should show ✅ for the dashboard to render correctly.
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", padding: "8px 12px" }}>Step</th>
            <th style={{ textAlign: "left", padding: "8px 12px" }}>Status</th>
            <th style={{ textAlign: "left", padding: "8px 12px" }}>Detail</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.step} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "8px 12px" }}>{r.step}</td>
              <td style={{ padding: "8px 12px", color: r.ok ? "#22c55e" : "#ef4444" }}>
                {r.ok ? "✅ PASS" : "❌ FAIL"}
              </td>
              <td style={{ padding: "8px 12px", color: "#aaa" }}>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.every((r) => r.ok) && (
        <div style={{ marginTop: 24, padding: 16, background: "#22c55e22", border: "1px solid #22c55e", borderRadius: 8 }}>
          <strong style={{ color: "#22c55e" }}>All checks passed!</strong> The server-side pipeline is working.
          If the dashboard still shows a black screen, the issue is client-side (JavaScript hydration error).
          Open browser DevTools → Console to check for errors.
        </div>
      )}
      {results.some((r) => !r.ok) && (
        <div style={{ marginTop: 24, padding: 16, background: "#ef444422", border: "1px solid #ef4444", borderRadius: 8 }}>
          <strong style={{ color: "#ef4444" }}>Failure detected!</strong> The failing step above explains why the dashboard shows a black screen.
        </div>
      )}
    </div>
  );
}