import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processNotificationLog } from "@/lib/notifications/whatsapp-sender";
import { createModuleLogger } from "@/lib/observability/logger";

const logger = createModuleLogger("cron:subscription-expiry");

// This route uses dynamic server data

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
        customer:customer_profile_id(full_name, phone, email),
        plan:subscription_plan_id(name, price)
      `
      )
      .in("status", ["active", "trial"])
      .gte("current_period_end", todayStr)
      .lte("current_period_end", thresholdStr);

    if (queryError) throw queryError;

    let adminNotificationsCreated = 0;
    let customerNotificationsCreated = 0;
    const processedOrgs = new Set<string>();

    for (const sub of expiringSubs ?? []) {
      const endDate = new Date(sub.current_period_end);
      endDate.setHours(0, 0, 0, 0);
      const diffMs = endDate.getTime() - today.getTime();
      const daysRemaining = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      );

      const customerData = sub.customer as any;
      const customerName = customerData?.full_name ?? "Cliente";
      const customerPhone = customerData?.phone ?? null;
      const customerEmail = customerData?.email ?? null;
      const planData = sub.plan as any;
      const planName = planData?.name ?? "Plano";
      const planPrice = planData?.price ?? 0;
      const dueDateFormatted = new Date(sub.current_period_end).toLocaleDateString("pt-BR");

      // =========================================================================
      // 1. NOTIFICAÇÃO AOS ADMINS (in-app via notifications table)
      // =========================================================================

      // Verificar se já existe notificação de vencimento para esta assinatura hoje
      const { data: existingAdminNotif } = await supabase
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

      if (!existingAdminNotif) {
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
              p_body: `A assinatura de **${customerName}** (${planName}) vence em ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""} (${dueDateFormatted}). ${sub.auto_renew ? "Renovação automática ativada." : "⚠️ Renovação automática DESATIVADA — contato necessário!"}`,
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
            adminNotificationsCreated++;
          }
        }
      }

      // =========================================================================
      // 2. NOTIFICAÇÃO AO CLIENTE (via notification_logs — WhatsApp/email)
      // =========================================================================

      // Verificar se já existe notification_log de expiry para esta assinatura hoje
      const { data: existingCustomerLog } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("organization_id", sub.organization_id)
        .eq("event_type", "subscription_expiring")
        .eq("event_reference_id", sub.id)
        .gte(
          "created_at",
          new Date(today.getTime()).toISOString()
        )
        .maybeSingle();

      if (!existingCustomerLog && (customerPhone || customerEmail)) {
        // Buscar template subscription_expiry da organização
        const { data: template } = await supabase
          .from("notification_templates")
          .select("id, body")
          .eq("organization_id", sub.organization_id)
          .eq("category", "subscription_expiry")
          .eq("is_active", true)
          .maybeSingle();

        // Formatar mensagem usando template ou fallback
        let messageBody: string;
        if (template?.body) {
          messageBody = template.body
            .replace(/\{\{customer_name\}\}/g, customerName)
            .replace(/\{\{plan_name\}\}/g, planName)
            .replace(/\{\{price\}\}/g, `R$ ${Number(planPrice).toFixed(2)}`)
            .replace(/\{\{due_date\}\}/g, dueDateFormatted);
        } else {
          messageBody = `Olá ${customerName}! 👋\n\nSeu plano ${planName} está próximo do vencimento.\n💰 Valor: R$ ${Number(planPrice).toFixed(2)}\n📅 Vencimento: ${dueDateFormatted}\n\nRenove para continuar aproveitando seus benefícios! 💈`;
        }

        // Determinar canal preferencial: whatsapp > email
        const channel = customerPhone ? "whatsapp" : "email";
        const recipientPhone = customerPhone ?? null;
        const recipientEmail = customerEmail ?? null;

        // Criar entrada em notification_logs (status: queued — aguardando envio)
        const { error: logError } = await supabase
          .from("notification_logs")
          .insert({
            organization_id: sub.organization_id,
            template_id: template?.id ?? null,
            channel,
            recipient_type: "customer",
            recipient_id: sub.customer_profile_id,
            recipient_phone: recipientPhone,
            recipient_email: recipientEmail,
            event_type: "subscription_expiring",
            event_reference_id: sub.id,
            status: "queued",
            scheduled_at: new Date().toISOString(),
            metadata: {
              subscription_id: sub.id,
              customer_name: customerName,
              plan_name: planName,
              plan_price: planPrice,
              days_remaining: daysRemaining,
              due_date: sub.current_period_end,
              auto_renew: sub.auto_renew,
              message_body: messageBody,
            },
          });

        if (!logError) {
          customerNotificationsCreated++;

          // Tentar envio imediato (best-effort — falhas são tratadas pelo cron de dispatch)
          const { data: newLog } = await supabase
            .from("notification_logs")
            .select("id, organization_id, channel, recipient_phone, recipient_email, metadata, retry_count, max_retries")
            .eq("event_reference_id", sub.id)
            .eq("event_type", "subscription_expiring")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (newLog) {
            try {
              await processNotificationLog(supabase, newLog as any);
            } catch (sendErr) {
              logger.error("Immediate send failed", { subscription_id: sub.id }, sendErr instanceof Error ? sendErr : new Error(String(sendErr)));
              // Não bloqueia — o cron de dispatch tentará novamente
            }
          }
        } else {
          logger.error("Failed to create notification_log", { subscription_id: sub.id, error: logError?.message });
        }
      }

      processedOrgs.add(sub.organization_id);
    }

    return NextResponse.json({
      success: true,
      checked_at: new Date().toISOString(),
      expiring_count: expiringSubs?.length ?? 0,
      organizations_affected: processedOrgs.size,
      admin_notifications_created: adminNotificationsCreated,
      customer_notifications_created: customerNotificationsCreated,
      date_range: { from: todayStr, to: thresholdStr },
    });
  } catch (error) {
    logger.fatal("Cron execution failed", error instanceof Error ? error : new Error(String(error)));
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