"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import { automationRuleSchema, campaignSchema } from "./schemas";
import type { AutomationRule, Campaign, NotificationLogEntry, AutomationStats } from "./schemas";
import type { z } from "zod";

// Re-export types for backward compatibility
export type { AutomationRule, Campaign, NotificationLogEntry, AutomationStats };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// ---------------------------------------------------------------------------
// AUTOMATION RULES — CRUD
// ---------------------------------------------------------------------------

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    delay_minutes: Number(row.delay_minutes ?? 0),
    trigger_count: Number(row.trigger_count ?? 0),
  }));
}

export async function createAutomationRule(
  input: z.infer<typeof automationRuleSchema>
): Promise<{ id: string }> {
  const parsed = automationRuleSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      organization_id: org.id,
      name: parsed.name,
      description: parsed.description ?? null,
      event_type: parsed.event_type,
      channel: parsed.channel,
      template_id: parsed.template_id ?? null,
      is_active: parsed.is_active,
      delay_minutes: parsed.delay_minutes,
      max_per_day: parsed.max_per_day ?? null,
      created_by: user.data.user!.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "automation_rule_created",
    p_module: "automations",
    p_resource_type: "automation_rule",
    p_resource_id: data.id,
    p_metadata: { event_type: parsed.event_type, channel: parsed.channel },
  });

  return { id: data.id };
}

export async function updateAutomationRule(
  ruleId: string,
  input: Partial<z.infer<typeof automationRuleSchema>> & { is_active?: boolean }
): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();

  const updates: Record<string, any> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.event_type !== undefined) updates.event_type = input.event_type;
  if (input.channel !== undefined) updates.channel = input.channel;
  if (input.template_id !== undefined) updates.template_id = input.template_id;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.delay_minutes !== undefined) updates.delay_minutes = input.delay_minutes;
  if (input.max_per_day !== undefined) updates.max_per_day = input.max_per_day;

  const { error } = await supabase
    .from("automation_rules")
    .update(updates)
    .eq("id", ruleId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

export async function deleteAutomationRule(ruleId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// CAMPAIGNS — CRUD e execução
// ---------------------------------------------------------------------------

export async function getCampaigns(filters?: {
  status?: string;
  type?: string;
}): Promise<Campaign[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("campaigns")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.type && filters.type !== "all") {
    query = query.eq("campaign_type", filters.type);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    total_recipients: Number(row.total_recipients ?? 0),
    sent_count: Number(row.sent_count ?? 0),
    delivered_count: Number(row.delivered_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
  }));
}

export async function createCampaign(
  input: z.infer<typeof campaignSchema>
): Promise<{ id: string }> {
  const parsed = campaignSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      organization_id: org.id,
      name: parsed.name,
      description: parsed.description ?? null,
      campaign_type: parsed.campaign_type,
      channel: parsed.channel,
      template_id: parsed.template_id ?? null,
      custom_body: parsed.custom_body ?? null,
      custom_subject: parsed.custom_subject ?? null,
      target_filter: parsed.target_filter,
      status: parsed.scheduled_at ? "scheduled" : "draft",
      scheduled_at: parsed.scheduled_at ?? null,
      created_by: user.data.user!.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "campaign_created",
    p_module: "automations",
    p_resource_type: "campaign",
    p_resource_id: data.id,
    p_metadata: { type: parsed.campaign_type, channel: parsed.channel },
  });

  return { id: data.id };
}

export async function resolveCampaignRecipients(campaignId: string): Promise<number> {
  const supabase = await createClient();
  const org = await getOrg();

  // Verificar propriedade
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("organization_id", org.id)
    .single();

  if (!campaign) throw new Error("Campanha não encontrada");

  const { data, error } = await supabase.rpc("resolve_campaign_recipients", {
    p_campaign_id: campaignId,
  });

  if (error) throw error;

  return Number(data ?? 0);
}

export async function launchCampaign(campaignId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Verificar propriedade
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, total_recipients")
    .eq("id", campaignId)
    .eq("organization_id", org.id)
    .single();

  if (!campaign) throw new Error("Campanha não encontrada");
  if (campaign.status === "sending") throw new Error("Campanha já está em andamento");
  if ((campaign as any).total_recipients === 0) throw new Error("Campanha sem destinatários. Resolva os destinatários primeiro.");

  // Atualizar status para sending
  await supabase
    .from("campaigns")
    .update({
      status: "sending",
      started_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  // Buscar destinatários pendentes e criar notification_logs
  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, recipient_profile_id, recipient_phone, recipient_email, recipient_name")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  for (const recipient of recipients ?? []) {
    try {
      await supabase.from("notification_logs").insert({
        organization_id: org.id,
        channel: "whatsapp", // ou buscar da campanha
        recipient_type: "customer",
        recipient_id: recipient.recipient_profile_id,
        recipient_phone: recipient.recipient_phone,
        recipient_email: recipient.recipient_email,
        event_type: "campaign",
        event_reference_id: campaignId,
        status: "pending",
        campaign_id: campaignId,
        metadata: { recipient_name: recipient.recipient_name },
      });

      await supabase
        .from("campaign_recipients")
        .update({ status: "sent" })
        .eq("id", recipient.id);
    } catch {
      await supabase
        .from("campaign_recipients")
        .update({ status: "failed", error_message: "Erro ao criar notificação" })
        .eq("id", recipient.id);
    }
  }

  // Atualizar contadores
  const { count: sentCount } = await supabase
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "sent");

  await supabase
    .from("campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      sent_count: sentCount ?? 0,
    })
    .eq("id", campaignId);

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "campaign_launched",
    p_module: "automations",
    p_resource_type: "campaign",
    p_resource_id: campaignId,
    p_metadata: { sent: sentCount ?? 0 },
  });
}

// ---------------------------------------------------------------------------
// NOTIFICATION LOGS — Consulta e gerenciamento
// ---------------------------------------------------------------------------

export async function getNotificationLogs(filters?: {
  status?: string;
  channel?: string;
  limit?: number;
}): Promise<NotificationLogEntry[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("notification_logs")
    .select("id, channel, recipient_phone, recipient_email, event_type, status, error_message, sent_at, delivered_at, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.channel && filters.channel !== "all") {
    query = query.eq("channel", filters.channel);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return data ?? [];
}

export async function retryFailedNotification(logId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("notification_logs")
    .update({
      status: "pending",
      error_message: null,
      retry_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// TEMPLATES — CRUD de modelos de mensagem
// ---------------------------------------------------------------------------

export async function getNotificationTemplates(category?: string): Promise<{
  id: string;
  name: string;
  category: string;
  channel: string;
  body: string;
  variables: any[];
  is_active: boolean;
}[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("notification_templates")
    .select("id, name, category, channel, body, variables, is_active")
    .eq("organization_id", org.id)
    .order("name");

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    variables: row.variables ?? [],
  }));
}

// ---------------------------------------------------------------------------
// STATS — Estatísticas de automação
// ---------------------------------------------------------------------------

export async function getAutomationStats(): Promise<AutomationStats> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("v_automation_stats")
    .select("*")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return {
        today_notifications: 0,
        today_sent: 0,
        today_delivered: 0,
        today_failed: 0,
        pending_queue: 0,
        active_rules_triggered: 0,
        completed_campaigns: 0,
        total_campaign_sends: 0,
      };
    }
    throw error;
  }

  if (!data) {
    return {
      today_notifications: 0,
      today_sent: 0,
      today_delivered: 0,
      today_failed: 0,
      pending_queue: 0,
      active_rules_triggered: 0,
      completed_campaigns: 0,
      total_campaign_sends: 0,
    };
  }

  return {
    today_notifications: Number((data as any).today_notifications ?? 0),
    today_sent: Number((data as any).today_sent ?? 0),
    today_delivered: Number((data as any).today_delivered ?? 0),
    today_failed: Number((data as any).today_failed ?? 0),
    pending_queue: Number((data as any).pending_queue ?? 0),
    active_rules_triggered: Number((data as any).active_rules_triggered ?? 0),
    completed_campaigns: Number((data as any).completed_campaigns ?? 0),
    total_campaign_sends: Number((data as any).total_campaign_sends ?? 0),
  };
}

// ---------------------------------------------------------------------------
// WHATSAPP CONFIG — Gerenciamento de configuração
// ---------------------------------------------------------------------------

export async function getWhatsappConfig(): Promise<{
  phone_number_id: string | null;
  waba_id: string | null;
  is_active: boolean;
  auto_reply_enabled: boolean;
  reminder_hours_before: number;
  expiry_reminder_days: number;
} | null> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("phone_number_id, waba_id, is_active, auto_reply_enabled, reminder_hours_before, expiry_reminder_days")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }

  if (!data) return null;

  return {
    phone_number_id: data.phone_number_id,
    waba_id: data.waba_id,
    is_active: data.is_active,
    auto_reply_enabled: data.auto_reply_enabled,
    reminder_hours_before: Number(data.reminder_hours_before ?? 24),
    expiry_reminder_days: Number(data.expiry_reminder_days ?? 3),
  };
}

export async function upsertWhatsappConfig(input: {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  is_active?: boolean;
  auto_reply_enabled?: boolean;
  reminder_hours_before?: number;
  expiry_reminder_days?: number;
}): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase.from("whatsapp_config").upsert({
    organization_id: org.id,
    phone_number_id: input.phone_number_id,
    waba_id: input.waba_id,
    access_token_encrypted: input.access_token, // Em produção, usar pgcrypto
    is_active: input.is_active ?? false,
    auto_reply_enabled: input.auto_reply_enabled ?? false,
    reminder_hours_before: input.reminder_hours_before ?? 24,
    expiry_reminder_days: input.expiry_reminder_days ?? 3,
  });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// PROCESS PENDING EVENTS — Processar eventos pendentes (chamado por cron)
// ---------------------------------------------------------------------------

export async function processPendingAutomationEvents(): Promise<{ queued: number }> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data: events, error } = await supabase.rpc("get_pending_automation_events", {
    p_org_id: org.id,
  });

  if (error) {
    if (error.message?.includes("does not exist")) return { queued: 0 };
    throw error;
  }

  let queued = 0;
  for (const event of (events ?? []) as any[]) {
    const result = await supabase.rpc("queue_automation_notification", {
      p_org_id: org.id,
      p_event_type: event.event_type,
      p_recipient_id: event.recipient_id,
      p_recipient_phone: event.recipient_phone,
      p_recipient_email: event.recipient_email,
      p_reference_id: event.reference_id,
      p_metadata: event.metadata,
    });

    if (!result.error) {
      queued += Number(result.data ?? 0);
    }
  }

  return { queued };
}