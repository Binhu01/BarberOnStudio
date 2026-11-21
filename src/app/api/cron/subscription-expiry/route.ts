import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route uses dynamic server data
export const instant = false;

// =============================================================================
// CRON JOB: Verificar assinaturas próximas do vencimento (3 dias)
// Endpoint: /api/cron/subscription-expiry
// Método: GET ou POST
// Auth: Bearer token via CRON_SECRET env var
// =============================================================================

async function verifyCronAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // Se não houver CRON_SECRET configurado, permitir apenas em dev
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  await connection();
  return handleExpiryCheck(request);
}

export async function POST(request: Request) {
  await connection();
  return handleExpiryCheck(request);
}

async function handleExpiryCheck(request: Request) {
  // Verificar autenticação do cron
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
    // Calcular datas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() + 3);

    const todayStr = today.toISOString().slice(0, 10);
    const thresholdStr = thresholdDate.toISOString().slice(0, 10);

    // Buscar todas as organizações com assinaturas ativas próximas do vencimento
    const { data: expiringSubs, error: queryError } = await supabase
      .from("client_subscriptions")
      .select(
        `
        id,
        organization_id,
        customer_profile_id,
        current_period_end,
        auto_renew,
        subscription_plan_id,
        customer:customer_profile_id(full_name),
        plan:subscription_plan_id(name, price)
      `
      )
      .in("status", ["active", "trial"])
      .gte("current_period_end", todayStr)
      .lte("current_period_end", thresholdStr);

    if (queryError) throw queryError;

    let notificationsCreated = 0;
    const processedOrgs = new Set<string>();

    for (const sub of expiringSubs ?? []) {
      const endDate = new Date(sub.current_period_end);
      endDate.setHours(0, 0, 0, 0);
      const diffMs = endDate.getTime() - today.getTime();
      const daysRemaining = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      );

      const customerName =
        (sub.customer as any)?.full_name ?? "Cliente";
      const planName = (sub.plan as any)?.name ?? "Plano";

      // Verificar se já existe notificação de vencimento para esta assinatura hoje
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("organization_id", sub.organization_id)
        .eq("type", "payment_overdue")
        .ilike("body", `%${sub.id}%`)
        .gte(
          "created_at",
          new Date(today.getTime()).toISOString()
        )
        .maybeSingle();

      if (existingNotif) continue; // Já notificou hoje

      // Buscar membros da organização para notificar (OWNER e ADMIN)
      const { data: members } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", sub.organization_id)
        .eq("status", "active")
        .in("role", ["OWNER", "ADMIN"]);

      // Criar notificação para cada membro admin/owner
      for (const member of members ?? []) {
        const { error: notifError } = await supabase.rpc(
          "create_notification",
          {
            p_org_id: sub.organization_id,
            p_recipient_id: member.user_id,
            p_type: "payment_overdue",
            p_title: `⚠️ Assinatura vencendo em ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""}`,
            p_body: `A assinatura de **${customerName}** (${planName}) vence em ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""} (${new Date(sub.current_period_end).toLocaleDateString("pt-BR")}). ${sub.auto_renew ? "Renovação automática ativada." : "⚠️ Renovação automática DESATIVADA — contato necessário!"}`,
            p_link: "/dashboard/assinaturas",
            p_metadata: {
              subscription_id: sub.id,
              customer_name: customerName,
              plan_name: planName,
              days_remaining: daysRemaining,
              auto_renew: sub.auto_renew,
            },
          }
        );

        if (!notifError) {
          notificationsCreated++;
        }
      }

      processedOrgs.add(sub.organization_id);
    }

    return NextResponse.json({
      success: true,
      checked_at: new Date().toISOString(),
      expiring_count: expiringSubs?.length ?? 0,
      organizations_affected: processedOrgs.size,
      notifications_created: notificationsCreated,
      date_range: { from: todayStr, to: thresholdStr },
    });
  } catch (error) {
    console.error("[cron/subscription-expiry] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}