"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import {
  openCashSessionSchema,
  closeCashSessionSchema,
  createCashMovementSchema,
  markCommissionPaidSchema,
} from "./schemas";
import type {
  CashRegister,
  CashSession,
  CashMovement,
  DailyCashSummary,
  CommissionStats,
  BarberCommission,
  OpenCashSessionInput,
  CloseCashSessionInput,
  CreateCashMovementInput,
  MarkCommissionPaidInput,
} from "@/types/comanda";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// =============================================================================
// CASH REGISTERS
// =============================================================================

export async function getCashRegisters(): Promise<CashRegister[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as CashRegister[];
}

// =============================================================================
// CASH SESSIONS
// =============================================================================

export async function getOpenCashSession(): Promise<CashSession | null> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("cash_sessions")
    .select(
      `
      *,
      register:cash_register_id(name),
      opener:opened_by(profiles(full_name)),
      closer:closed_by(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    register_name: (data as any).register?.name ?? null,
    opened_by_name: (data as any).opener?.profiles?.full_name ?? null,
    closed_by_name: (data as any).closer?.profiles?.full_name ?? null,
  } as CashSession;
}

export async function getCashSessions(filters?: {
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<CashSession[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("cash_sessions")
    .select(
      `
      *,
      register:cash_register_id(name),
      opener:opened_by(profiles(full_name)),
      closer:closed_by(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .order("opened_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.date_from) {
    query = query.gte("opened_at", filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte("opened_at", filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    register_name: row.register?.name ?? null,
    opened_by_name: row.opener?.profiles?.full_name ?? null,
    closed_by_name: row.closer?.profiles?.full_name ?? null,
  })) as CashSession[];
}

export async function openCashSession(input: OpenCashSessionInput): Promise<string> {
  const parsed = openCashSessionSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Verificar se já existe sessão aberta neste caixa
  const { data: existing } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("organization_id", org.id)
    .eq("cash_register_id", parsed.cash_register_id)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    throw new Error("Já existe uma sessão de caixa aberta neste caixa");
  }

  // Buscar membership_id do usuário
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  if (!membership) throw new Error("Usuário não é membro desta organização");

  const { data, error } = await supabase
    .from("cash_sessions")
    .insert({
      organization_id: org.id,
      cash_register_id: parsed.cash_register_id,
      opened_by: membership.id,
      opening_amount: parsed.opening_amount,
      status: "open",
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "cash_session_opened",
    p_module: "cash_register",
    p_resource_type: "cash_session",
    p_resource_id: data.id,
    p_metadata: { opening_amount: parsed.opening_amount },
  });

  return data.id;
}

export async function closeCashSession(input: CloseCashSessionInput): Promise<void> {
  const parsed = closeCashSessionSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar sessão
  const { data: session } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("id", parsed.cash_session_id)
    .eq("organization_id", org.id)
    .single();

  if (!session) throw new Error("Sessão de caixa não encontrada");
  if (session.status !== "open") throw new Error("Sessão já está fechada");

  // Buscar membership_id do usuário que está fechando
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  if (!membership) throw new Error("Usuário não é membro desta organização");

  // Calcular diferença
  const expectedAmount = session.opening_amount; // Simplificado: em produção, somar movimentações
  const difference = parsed.closing_amount - expectedAmount;

  const { error } = await supabase
    .from("cash_sessions")
    .update({
      closed_by: membership.id,
      closed_at: new Date().toISOString(),
      closing_amount: parsed.closing_amount,
      expected_amount: expectedAmount,
      difference,
      status: "closed",
      notes: parsed.notes ?? session.notes,
    })
    .eq("id", parsed.cash_session_id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "cash_session_closed",
    p_module: "cash_register",
    p_resource_type: "cash_session",
    p_resource_id: parsed.cash_session_id,
    p_metadata: { closing_amount: parsed.closing_amount, difference },
  });
}

// =============================================================================
// CASH MOVEMENTS
// =============================================================================

export async function getCashMovements(
  sessionId: string
): Promise<CashMovement[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("cash_movements")
    .select(
      `
      *,
      creator:created_by(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .eq("cash_session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    created_by_name: row.creator?.profiles?.full_name ?? null,
  })) as CashMovement[];
}

export async function createCashMovement(
  input: CreateCashMovementInput
): Promise<void> {
  const parsed = createCashMovementSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Verificar se a sessão está aberta
  const { data: session } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", parsed.cash_session_id)
    .eq("organization_id", org.id)
    .single();

  if (!session) throw new Error("Sessão de caixa não encontrada");
  if (session.status !== "open") throw new Error("Sessão de caixa está fechada");

  // Buscar membership_id
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  if (!membership) throw new Error("Usuário não é membro desta organização");

  const { error } = await supabase.from("cash_movements").insert({
    organization_id: org.id,
    cash_session_id: parsed.cash_session_id,
    movement_type: parsed.movement_type,
    amount: parsed.amount,
    description: parsed.description ?? null,
    payment_method: parsed.payment_method ?? null,
    reference_type: parsed.reference_type ?? null,
    reference_id: parsed.reference_id ?? null,
    created_by: membership.id,
  });

  if (error) throw error;
}

// =============================================================================
// DAILY CASH SUMMARY
// =============================================================================

export async function getDailyCashSummary(
  date?: string
): Promise<DailyCashSummary> {
  const supabase = await createClient();
  const org = await getOrg();

  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_daily_cash_summary", {
    p_org_id: org.id,
    p_date: targetDate,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  return {
    total_sales: Number(row?.total_sales ?? 0),
    total_refunds: Number(row?.total_refunds ?? 0),
    total_withdrawals: Number(row?.total_withdrawals ?? 0),
    total_deposits: Number(row?.total_deposits ?? 0),
    net_amount: Number(row?.net_amount ?? 0),
    orders_count: Number(row?.orders_count ?? 0),
    commissions_pending: Number(row?.commissions_pending ?? 0),
    commissions_paid: Number(row?.commissions_paid ?? 0),
  };
}

// =============================================================================
// COMMISSIONS
// =============================================================================

export async function getBarberCommissions(filters?: {
  status?: string;
  barber_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<BarberCommission[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("barber_commissions")
    .select(
      `
      *,
      barber:membership_id(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.barber_id) {
    query = query.eq("membership_id", filters.barber_id);
  }
  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    barber_name: row.barber?.profiles?.full_name ?? null,
  })) as BarberCommission[];
}

export async function markCommissionPaid(input: MarkCommissionPaidInput): Promise<void> {
  const parsed = markCommissionPaidSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("barber_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .in("id", parsed.commission_ids)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "commission_paid",
    p_module: "commissions",
    p_resource_type: "barber_commission",
    p_resource_id: null,
    p_metadata: { count: parsed.commission_ids.length },
  });
}

export async function getCommissionStats(): Promise<CommissionStats> {
  const supabase = await createClient();
  const org = await getOrg();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [pendingResult, paidResult] = await Promise.all([
    supabase
      .from("barber_commissions")
      .select("commission_amount")
      .eq("organization_id", org.id)
      .eq("status", "pending"),
    supabase
      .from("barber_commissions")
      .select("commission_amount, membership_id, barber:membership_id(profiles(full_name))")
      .eq("organization_id", org.id)
      .eq("status", "paid")
      .gte("paid_at", monthStart),
  ]);

  const pendingAmount = (pendingResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.commission_amount ?? 0),
    0
  );

  const paidThisMonth = (paidResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.commission_amount ?? 0),
    0
  );

  // Top barber por comissão paga no mês
  const barberTotals = new Map<string, { name: string; amount: number }>();
  for (const row of paidResult.data ?? []) {
    const id = row.membership_id;
    const amount = Number(row.commission_amount ?? 0);
    const name = (row as any).barber?.profiles?.full_name ?? "Desconhecido";
    const current = barberTotals.get(id);
    if (current) {
      current.amount += amount;
    } else {
      barberTotals.set(id, { name, amount });
    }
  }

  let topBarberName: string | null = null;
  let topBarberAmount = 0;
  for (const [, v] of barberTotals) {
    if (v.amount > topBarberAmount) {
      topBarberAmount = v.amount;
      topBarberName = v.name;
    }
  }

  return {
    total_pending: (pendingResult.data ?? []).length,
    total_pending_amount: pendingAmount,
    total_paid_this_month: paidThisMonth,
    top_barber_name: topBarberName,
    top_barber_amount: topBarberAmount,
  };
}