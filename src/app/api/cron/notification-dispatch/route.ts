import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processNotificationLog } from "@/lib/notifications/whatsapp-sender";

// This route uses dynamic server data
export const instant = false;

// =============================================================================
// CRON JOB: Processar fila de notification_logs e enviar mensagens
// Endpoint: /api/cron/notification-dispatch
// Método: GET ou POST
// Auth: Bearer token via CRON_SECRET env var
// Agenda: A cada 5 minutos (ver vercel.json)
// =============================================================================

async function verifyCronAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  await connection();
  return handleDispatch(request);
}

export async function POST(request: Request) {
  await connection();
  return handleDispatch(request);
}

async function handleDispatch(request: Request) {
  const isAuthorized = await verifyCronAuth(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Buscar notificações pendentes na fila (queued ou failed com retries restantes)
    const { data: pendingLogs, error: queryError } = await supabase
      .from("notification_logs")
      .select(
        `
        id,
        organization_id,
        channel,
        recipient_phone,
        recipient_email,
        metadata,
        retry_count,
        max_retries
      `
      )
      .in("status", ["queued", "failed"])
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(50); // Processar em lotes de 50 para evitar timeout

    if (queryError) throw queryError;

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const logEntry of pendingLogs ?? []) {
      // Rate limiting simples: aguardar 2s entre envios WhatsApp
      // para respeitar o limite de 30 msg/min da Meta
      if (logEntry.channel === "whatsapp" && sent > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const result = await processNotificationLog(supabase, logEntry as any);

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed_at: new Date().toISOString(),
      total_pending: pendingLogs?.length ?? 0,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("[cron/notification-dispatch] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}