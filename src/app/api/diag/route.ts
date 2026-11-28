import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Rota de diagnóstico SEM autenticação — bypassa middleware e server components.
 * Testa diretamente: Supabase connection, env vars, e queries básicas.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check environment variables
  results.env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  // 2. Test Supabase anon client
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createSupabaseClient(url, key);

    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .limit(1);

    results.supabase_anon = {
      ok: !orgError,
      error: orgError?.message ?? null,
      orgs: orgs,
    };
  } catch (e: any) {
    results.supabase_anon = { ok: false, error: e.message };
  }

  // 3. Test Supabase admin client
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (key) {
      const admin = createSupabaseClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: profiles, error: profError } = await admin
        .from("profiles")
        .select("id, full_name")
        .limit(3);

      results.supabase_admin = {
        ok: !profError,
        error: profError?.message ?? null,
        profiles,
      };
    } else {
      results.supabase_admin = { ok: false, error: "SERVICE_ROLE_KEY not set" };
    }
  } catch (e: any) {
    results.supabase_admin = { ok: false, error: e.message };
  }

  // 4. Server info
  results.server = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
  };

  return NextResponse.json(results, { status: 200 });
}