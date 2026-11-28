import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";


// =============================================================================
// API: Salvar configuração WhatsApp
// Endpoint: POST /api/whatsapp/config
// Body: { phone_number_id, waba_id, access_token, is_active, reminder_hours_before, expiry_reminder_days }
// =============================================================================

export async function POST(request: Request) {
  await connection();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 }
      );
    }

    // Autenticar usuário via cookie/token da sessão
    const authHeader = request.headers.get("authorization");
    const cookieHeader = request.headers.get("cookie");

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { ...(cookieHeader ? { cookie: cookieHeader } : {}), ...(authHeader ? { authorization: authHeader } : {}) } },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Buscar organização ativa do usuário
    const { data: membership } = await supabaseAuth
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    const body = await request.json();
    const { phone_number_id, waba_id, access_token, is_active, reminder_hours_before, expiry_reminder_days } = body as {
      phone_number_id?: string;
      waba_id?: string;
      access_token?: string;
      is_active?: boolean;
      reminder_hours_before?: number;
      expiry_reminder_days?: number;
    };

    if (!phone_number_id || !access_token) {
      return NextResponse.json(
        { error: "phone_number_id e access_token são obrigatórios" },
        { status: 400 }
      );
    }

    // Usar service role para upsert (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from("whatsapp_config").upsert({
      organization_id: membership.organization_id,
      phone_number_id,
      waba_id: waba_id ?? "",
      access_token_encrypted: access_token,
      is_active: is_active ?? true,
      reminder_hours_before: reminder_hours_before ?? 24,
      expiry_reminder_days: expiry_reminder_days ?? 3,
    });

    if (error) {
      console.error("[api/whatsapp/config] Upsert error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/whatsapp/config] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}