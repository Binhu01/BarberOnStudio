"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import {
  createReactivationCampaignSchema,
  updateReactivationCampaignSchema,
} from "../fidelidade/schemas";
import type {
  ReactivationCampaign,
  ReactivationRecipient,
  InactiveCustomer,
  CreateReactivationCampaignInput,
  UpdateReactivationCampaignInput,
} from "@/types/loyalty";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// =============================================================================
// REACTIVATION CAMPAIGNS
// =============================================================================

export async function getReactivationCampaigns(): Promise<ReactivationCampaign[]> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("reactivation_campaigns")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ReactivationCampaign[];
}

export async function createReactivationCampaign(
  input: CreateReactivationCampaignInput
): Promise<string> {
  const parsed = createReactivationCampaignSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar membership do usuário (admin client para evitar RLS 42501)
  const admin = requireAdminClient();
  const { data: membership } = await admin
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  const { data, error } = await supabase
    .from("reactivation_campaigns")
    .insert({
      organization_id: org.id,
      name: parsed.name,
      description: parsed.description ?? null,
      campaign_type: parsed.campaign_type,
      inactive_days_threshold: parsed.inactive_days_threshold,
      message_template: parsed.message_template,
      channel: parsed.channel,
      scheduled_at: parsed.scheduled_at ?? null,
      status: parsed.scheduled_at ? "scheduled" : "draft",
      created_by: membership?.id ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "reactivation_campaign_created",
    p_module: "reactivation",
    p_resource_type: "reactivation_campaign",
    p_resource_id: data.id,
    p_metadata: { name: parsed.name, type: parsed.campaign_type },
  });

  return data.id;
}

export async function updateReactivationCampaign(
  campaignId: string,
  input: UpdateReactivationCampaignInput
): Promise<void> {
  const parsed = updateReactivationCampaignSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("reactivation_campaigns")
    .update(parsed)
    .eq("id", campaignId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

export async function deleteReactivationCampaign(campaignId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("reactivation_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "reactivation_campaign_deleted",
    p_module: "reactivation",
    p_resource_type: "reactivation_campaign",
    p_resource_id: campaignId,
    p_metadata: {},
  });
}

// =============================================================================
// INACTIVE CUSTOMERS
// =============================================================================

export async function getInactiveCustomers(
  inactiveDays: number = 30
): Promise<InactiveCustomer[]> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase.rpc("get_inactive_customers", {
    p_org_id: org.id,
    p_inactive_days: inactiveDays,
  });

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    customer_id: row.customer_id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    last_visit_at: row.last_visit_at,
    days_inactive: Number(row.days_inactive ?? 0),
    total_visits: Number(row.total_visits ?? 0),
    total_spent: Number(row.total_spent ?? 0),
  }));
}

// =============================================================================
// CAMPAIGN RECIPIENTS
// =============================================================================

export async function getCampaignRecipients(
  campaignId: string
): Promise<ReactivationRecipient[]> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("reactivation_recipients")
    .select(
      `
      *,
      customer:customer_profile_id(full_name)
    `
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    customer_name: row.customer?.full_name ?? null,
  })) as ReactivationRecipient[];
}

export async function populateCampaignRecipients(
  campaignId: string
): Promise<number> {
  const supabase = await createClient();
  const adminSupabase = requireAdminClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar dados da campanha (admin client to bypass RLS on reads)
  const { data: campaign } = await adminSupabase
    .from("reactivation_campaigns")
    .select("inactive_days_threshold")
    .eq("id", campaignId)
    .eq("organization_id", org.id)
    .single();

  if (!campaign) throw new Error("Campanha não encontrada");

  // Buscar clientes inativos
  const inactiveCustomers = await getInactiveCustomers(campaign.inactive_days_threshold);

  if (inactiveCustomers.length === 0) return 0;

  // Inserir recipients
  const recipients = inactiveCustomers.map((c) => ({
    campaign_id: campaignId,
    customer_profile_id: c.customer_id,
    phone: c.phone,
    email: c.email,
    last_visit_at: c.last_visit_at,
    days_inactive: c.days_inactive,
    status: "pending" as const,
  }));

  // Batch insert (Supabase handles up to ~1000 rows per call)
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const { error } = await supabase.from("reactivation_recipients").insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }

  // Atualizar target_count na campanha
  await supabase
    .from("reactivation_campaigns")
    .update({ target_count: inserted })
    .eq("id", campaignId);

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "reactivation_recipients_populated",
    p_module: "reactivation",
    p_resource_type: "reactivation_campaign",
    p_resource_id: campaignId,
    p_metadata: { count: inserted },
  });

  return inserted;
}