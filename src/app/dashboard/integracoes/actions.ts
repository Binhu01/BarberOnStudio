"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import { integrationConnectionSchema } from "./schemas";
import type { IntegrationConnection, WebhookEvent, DashboardKPIs } from "./schemas";
import type { z } from "zod";

// Re-export types for backward compatibility
export type { IntegrationConnection, WebhookEvent, DashboardKPIs };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// ---------------------------------------------------------------------------
// INTEGRATION CONNECTIONS — CRUD
// ---------------------------------------------------------------------------

export async function getIntegrationConnections(): Promise<IntegrationConnection[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, provider, name, status, last_sync_at, last_error, is_active, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return data ?? [];
}

export async function createIntegrationConnection(
  input: z.infer<typeof integrationConnectionSchema>
): Promise<{ id: string }> {
  const parsed = integrationConnectionSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("integration_connections")
    .insert({
      organization_id: org.id,
      provider: parsed.provider,
      name: parsed.name,
      config_encrypted: parsed.config, // Em produção, usar pgcrypto
      is_active: parsed.is_active,
      status: "connected",
      created_by: user.data.user!.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "integration_connected",
    p_module: "integrations",
    p_resource_type: "integration_connection",
    p_resource_id: data.id,
    p_metadata: { provider: parsed.provider },
  });

  return { id: data.id };
}

export async function disconnectIntegration(connectionId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("integration_connections")
    .update({ status: "disconnected", is_active: false, updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "integration_disconnected",
    p_module: "integrations",
    p_resource_type: "integration_connection",
    p_resource_id: connectionId,
  });
}

export async function testIntegrationConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("provider, status")
    .eq("id", connectionId)
    .eq("organization_id", org.id)
    .single();

  if (!conn) throw new Error("Integração não encontrada");

  // Simular teste de conexão (em produção, chamar API real do provider)
  const success = conn.status !== "error";

  await supabase
    .from("integration_connections")
    .update({
      status: success ? "connected" : "error",
      last_sync_at: new Date().toISOString(),
      last_error: success ? null : "Falha na conexão de teste",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return {
    success,
    message: success ? "Conexão estabelecida com sucesso" : "Falha ao conectar. Verifique as credenciais.",
  };
}

// ---------------------------------------------------------------------------
// WEBHOOK EVENTS — Consulta
// ---------------------------------------------------------------------------

export async function getWebhookEvents(filters?: {
  provider?: string;
  processed?: boolean;
  limit?: number;
}): Promise<WebhookEvent[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("webhook_events")
    .select("id, provider, event_type, processed, processing_error, received_at, processed_at")
    .eq("organization_id", org.id)
    .order("received_at", { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.provider && filters.provider !== "all") {
    query = query.eq("provider", filters.provider);
  }
  if (filters?.processed !== undefined) {
    query = query.eq("processed", filters.processed);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// DASHBOARD KPIs
// ---------------------------------------------------------------------------

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const supabase = createAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    p_org_id: org.id,
  });

  if (error) {
    if (error.message?.includes("does not exist")) {
      return {
        today_appointments: 0,
        week_appointments: 0,
        month_revenue: 0,
        month_new_customers: 0,
        pending_receivables: 0,
        overdue_receivables: 0,
        low_stock_products: 0,
        active_subscriptions: 0,
      };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      today_appointments: 0,
      week_appointments: 0,
      month_revenue: 0,
      month_new_customers: 0,
      pending_receivables: 0,
      overdue_receivables: 0,
      low_stock_products: 0,
      active_subscriptions: 0,
    };
  }

  return {
    today_appointments: Number((row as any).today_appointments ?? 0),
    week_appointments: Number((row as any).week_appointments ?? 0),
    month_revenue: Number((row as any).month_revenue ?? 0),
    month_new_customers: Number((row as any).month_new_customers ?? 0),
    pending_receivables: Number((row as any).pending_receivables ?? 0),
    overdue_receivables: Number((row as any).overdue_receivables ?? 0),
    low_stock_products: Number((row as any).low_stock_products ?? 0),
    active_subscriptions: Number((row as any).active_subscriptions ?? 0),
  };
}

// ---------------------------------------------------------------------------
// REPORTS — Dados das views de relatórios avançados
// ---------------------------------------------------------------------------

export async function getAppointmentsReport(period?: string): Promise<any[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("v_report_appointments_summary")
    .select("*")
    .eq("organization_id", org.id)
    .order("period", { ascending: false })
    .limit(12);

  if (period) {
    query = query.gte("period", period);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    total_revenue: Number(row.total_revenue ?? 0),
    avg_ticket: Number(row.avg_ticket ?? 0),
    completion_rate_pct: Number(row.completion_rate_pct ?? 0),
    no_show_rate_pct: Number(row.no_show_rate_pct ?? 0),
  }));
}

export async function getBarberRanking(period?: string): Promise<any[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("v_report_barber_ranking")
    .select("*")
    .eq("organization_id", org.id)
    .order("revenue_generated", { ascending: false })
    .limit(20);

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    revenue_generated: Number(row.revenue_generated ?? 0),
    avg_ticket: Number(row.avg_ticket ?? 0),
    completion_rate_pct: Number(row.completion_rate_pct ?? 0),
  }));
}

export async function getServicePopularity(period?: string): Promise<any[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("v_report_service_popularity")
    .select("*")
    .eq("organization_id", org.id)
    .order("total_revenue", { ascending: false })
    .limit(20);

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    total_revenue: Number(row.total_revenue ?? 0),
    avg_price: Number(row.avg_price ?? 0),
  }));
}

export async function getCustomerRetention(): Promise<any[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("v_report_customer_retention")
    .select("*")
    .eq("organization_id", org.id)
    .order("lifetime_value", { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    lifetime_value: Number(row.lifetime_value ?? 0),
    avg_ticket: Number(row.avg_ticket ?? 0),
    avg_days_between_visits: row.avg_days_between_visits ? Number(row.avg_days_between_visits) : null,
  }));
}

export async function getProductSalesReport(period?: string): Promise<any[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("v_report_product_sales")
    .select("*")
    .eq("organization_id", org.id)
    .order("total_revenue", { ascending: false })
    .limit(30);

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    total_revenue: Number(row.total_revenue ?? 0),
    avg_unit_price: Number(row.avg_unit_price ?? 0),
  }));
}