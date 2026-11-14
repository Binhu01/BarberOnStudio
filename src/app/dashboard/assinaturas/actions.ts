"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  createClientSubscriptionSchema,
  updateClientSubscriptionSchema,
} from "./schemas";
import type {
  SubscriptionPlan,
  ClientSubscription,
  SubscriptionHistoryEntry,
  SubscriptionSummary,
  RenewalResult,
  CreateSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
  CreateClientSubscriptionInput,
  UpdateClientSubscriptionInput,
} from "@/types/subscription";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// =============================================================================
// SUBSCRIPTION PLANS
// =============================================================================

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("organization_id", org.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SubscriptionPlan[];
}

export async function getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SubscriptionPlan[];
}

export async function createSubscriptionPlan(
  input: CreateSubscriptionPlanInput
): Promise<string> {
  const parsed = createSubscriptionPlanSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("subscription_plans")
    .insert({
      organization_id: org.id,
      name: parsed.name,
      description: parsed.description ?? null,
      price: parsed.price,
      billing_cycle: parsed.billing_cycle,
      trial_days: parsed.trial_days,
      max_services_per_month: parsed.max_services_per_month ?? null,
      included_services: parsed.included_services ?? [],
      discount_percentage: parsed.discount_percentage,
      priority_booking: parsed.priority_booking,
      is_active: parsed.is_active,
      display_order: parsed.display_order,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "subscription_plan_created",
    p_module: "subscriptions",
    p_resource_type: "subscription_plan",
    p_resource_id: data.id,
    p_metadata: { name: parsed.name, price: parsed.price },
  });

  return data.id;
}

export async function updateSubscriptionPlan(
  planId: string,
  input: UpdateSubscriptionPlanInput
): Promise<void> {
  const parsed = updateSubscriptionPlanSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("subscription_plans")
    .update(parsed)
    .eq("id", planId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Verificar se há assinaturas ativas neste plano
  const { count } = await supabase
    .from("client_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("subscription_plan_id", planId)
    .in("status", ["active", "trial"]);

  if ((count ?? 0) > 0) {
    throw new Error(
      "Não é possível excluir um plano com assinaturas ativas. Desative-o primeiro."
    );
  }

  const { error } = await supabase
    .from("subscription_plans")
    .delete()
    .eq("id", planId)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "subscription_plan_deleted",
    p_module: "subscriptions",
    p_resource_type: "subscription_plan",
    p_resource_id: planId,
    p_metadata: {},
  });
}

// =============================================================================
// CLIENT SUBSCRIPTIONS
// =============================================================================

export async function getClientSubscriptions(filters?: {
  status?: string;
  customer_id?: string;
}): Promise<ClientSubscription[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("client_subscriptions")
    .select(
      `
      *,
      customer:customer_profile_id(full_name),
      plan:subscription_plan_id(name, price, billing_cycle, max_services_per_month)
    `
    )
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.customer_id) {
    query = query.eq("customer_profile_id", filters.customer_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    customer_name: row.customer?.full_name ?? null,
    plan_name: row.plan?.name ?? null,
    plan_price: row.plan?.price ?? null,
    plan_billing_cycle: row.plan?.billing_cycle ?? null,
    plan_max_services: row.plan?.max_services_per_month ?? null,
  })) as ClientSubscription[];
}

export async function createClientSubscription(
  input: CreateClientSubscriptionInput
): Promise<string> {
  const parsed = createClientSubscriptionSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar dados do plano
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("price, billing_cycle, trial_days")
    .eq("id", parsed.subscription_plan_id)
    .eq("organization_id", org.id)
    .single();

  if (!plan) throw new Error("Plano não encontrado");

  // Calcular período
  const startDate = parsed.start_date
    ? new Date(parsed.start_date)
    : new Date();

  let endDate: Date;
  if (plan.trial_days > 0) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.trial_days);
  } else {
    endDate = new Date(startDate);
    switch (plan.billing_cycle) {
      case "quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case "annual":
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }
    endDate.setDate(endDate.getDate() - 1);
  }

  const status = plan.trial_days > 0 ? "trial" : "active";

  const { data, error } = await supabase
    .from("client_subscriptions")
    .insert({
      organization_id: org.id,
      customer_profile_id: parsed.customer_profile_id,
      subscription_plan_id: parsed.subscription_plan_id,
      status,
      current_period_start: startDate.toISOString().slice(0, 10),
      current_period_end: endDate.toISOString().slice(0, 10),
      services_used_this_period: 0,
      auto_renew: parsed.auto_renew,
      payment_method: parsed.payment_method ?? null,
      next_billing_date: endDate.toISOString().slice(0, 10),
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Registrar no histórico
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  await supabase.from("subscription_history").insert({
    organization_id: org.id,
    client_subscription_id: data.id,
    event_type: "created",
    amount: plan.price,
    payment_method: parsed.payment_method ?? null,
    period_start: startDate.toISOString().slice(0, 10),
    period_end: endDate.toISOString().slice(0, 10),
    notes: plan.trial_days > 0 ? `Trial de ${plan.trial_days} dias` : null,
    created_by: membership?.id ?? null,
  });

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "client_subscription_created",
    p_module: "subscriptions",
    p_resource_type: "client_subscription",
    p_resource_id: data.id,
    p_metadata: {
      customer_id: parsed.customer_profile_id,
      plan_id: parsed.subscription_plan_id,
    },
  });

  return data.id;
}

export async function updateClientSubscription(
  subscriptionId: string,
  input: UpdateClientSubscriptionInput
): Promise<void> {
  const parsed = updateClientSubscriptionSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const updates: Record<string, any> = { ...parsed };
  if (parsed.status === "cancelled") {
    updates.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("client_subscriptions")
    .update(updates)
    .eq("id", subscriptionId)
    .eq("organization_id", org.id);

  if (error) throw error;

  // Registrar evento no histórico
  let eventType: string = "plan_changed";
  if (parsed.status === "paused") eventType = "paused";
  else if (parsed.status === "active") eventType = "resumed";
  else if (parsed.status === "cancelled") eventType = "cancelled";

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  await supabase.from("subscription_history").insert({
    organization_id: org.id,
    client_subscription_id: subscriptionId,
    event_type: eventType,
    notes: parsed.cancellation_reason ?? parsed.notes ?? null,
    created_by: membership?.id ?? null,
  });

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "client_subscription_updated",
    p_module: "subscriptions",
    p_resource_type: "client_subscription",
    p_resource_id: subscriptionId,
    p_metadata: { fields: Object.keys(parsed) },
  });
}

// =============================================================================
// RENEWALS
// =============================================================================

export async function processRenewals(): Promise<RenewalResult> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("process_subscription_renewals");

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "subscription_renewals_processed",
    p_module: "subscriptions",
    p_resource_type: "client_subscription",
    p_resource_id: null,
    p_metadata: {
      renewed: row?.renewed_count ?? 0,
      expired: row?.expired_count ?? 0,
    },
  });

  return {
    renewed_count: Number(row?.renewed_count ?? 0),
    expired_count: Number(row?.expired_count ?? 0),
  };
}

// =============================================================================
// HISTORY & SUMMARY
// =============================================================================

export async function getSubscriptionHistory(
  subscriptionId: string
): Promise<SubscriptionHistoryEntry[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("subscription_history")
    .select(
      `
      *,
      creator:created_by(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .eq("client_subscription_id", subscriptionId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    created_by_name: row.creator?.profiles?.full_name ?? null,
  })) as SubscriptionHistoryEntry[];
}

export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase.rpc("get_subscription_summary", {
    p_org_id: org.id,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  return {
    total_active: Number(row?.total_active ?? 0),
    total_paused: Number(row?.total_paused ?? 0),
    total_cancelled: Number(row?.total_cancelled ?? 0),
    monthly_revenue: Number(row?.monthly_revenue ?? 0),
    upcoming_renewals_7d: Number(row?.upcoming_renewals_7d ?? 0),
    avg_services_used: Number(row?.avg_services_used ?? 0),
  };
}

// =============================================================================
// PLAN BENEFITS — CRUD de benefícios por plano
// =============================================================================

export async function getPlanBenefits(planId: string): Promise<{
  id: string;
  benefit_type: string;
  benefit_value: Record<string, any>;
  description: string | null;
  is_active: boolean;
}[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("subscription_plan_benefits")
    .select("id, benefit_type, benefit_value, description, is_active")
    .eq("subscription_plan_id", planId)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    benefit_value: row.benefit_value ?? {},
  }));
}

export async function upsertPlanBenefit(input: {
  plan_id: string;
  benefit_type: "service" | "product_discount" | "free_product" | "priority_booking" | "custom";
  benefit_value: Record<string, any>;
  description?: string | null;
}): Promise<{ success: true }> {
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase.from("subscription_plan_benefits").upsert(
    {
      organization_id: org.id,
      subscription_plan_id: input.plan_id,
      benefit_type: input.benefit_type,
      benefit_value: input.benefit_value,
      description: input.description ?? null,
    },
    { onConflict: "subscription_plan_id,benefit_type" }
  );

  if (error) throw error;
  return { success: true };
}

export async function deletePlanBenefit(benefitId: string): Promise<{ success: true }> {
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("subscription_plan_benefits")
    .delete()
    .eq("id", benefitId)
    .eq("organization_id", org.id);

  if (error) throw error;
  return { success: true };
}

// =============================================================================
// SERVICE USAGE — Registro e consulta de serviços usados
// =============================================================================

export async function getSubscriptionServiceUsage(
  subscriptionId: string
): Promise<{
  id: string;
  service_name: string;
  used_at: string;
  calendar_event_id: string | null;
}[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("subscription_service_usage")
    .select("id, service_name, used_at, calendar_event_id")
    .eq("client_subscription_id", subscriptionId)
    .eq("organization_id", org.id)
    .order("used_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return data ?? [];
}

export async function getSubscriptionUsageSummary(
  subscriptionId: string
): Promise<{
  services_used: number;
  max_services: number | null;
  usage_percentage: number | null;
  remaining_services: number | null;
  period_start: string;
  period_end: string;
} | null> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("v_subscription_usage_summary")
    .select("*")
    .eq("client_subscription_id", subscriptionId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }

  if (!data) return null;

  return {
    services_used: Number(data.services_used_this_period ?? 0),
    max_services: data.max_services_per_month,
    usage_percentage: data.usage_percentage ? Number(data.usage_percentage) : null,
    remaining_services: data.remaining_services,
    period_start: data.current_period_start,
    period_end: data.current_period_end,
  };
}

// =============================================================================
// ENHANCED RENEWALS — Processar renovações com geração de recebíveis
// =============================================================================

export async function processEnhancedRenewals(): Promise<{
  renewed_count: number;
  expired_count: number;
  receivables_created: number;
}> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("process_subscription_renewals_enhanced");

  if (error) {
    // Fallback para RPC antiga se a nova não existir
    if (error.message?.includes("does not exist")) {
      const fallback = await processRenewals();
      return {
        renewed_count: fallback.renewed_count,
        expired_count: fallback.expired_count,
        receivables_created: 0,
      };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "subscription_renewals_processed_enhanced",
    p_module: "subscriptions",
    p_resource_type: "client_subscription",
    p_resource_id: null,
    p_metadata: {
      renewed: row?.renewed_count ?? 0,
      expired: row?.expired_count ?? 0,
      receivables: row?.receivables_created ?? 0,
    },
  });

  return {
    renewed_count: Number(row?.renewed_count ?? 0),
    expired_count: Number(row?.expired_count ?? 0),
    receivables_created: Number(row?.receivables_created ?? 0),
  };
}

// =============================================================================
// MANUAL RECEIVABLE — Gerar recebível para assinatura específica
// =============================================================================

export async function generateSubscriptionReceivable(
  subscriptionId: string
): Promise<{ success: true; receivable_id: string }> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase.rpc("generate_subscription_receivable", {
    p_subscription_id: subscriptionId,
  });

  if (error) throw error;

  return { success: true, receivable_id: data };
}