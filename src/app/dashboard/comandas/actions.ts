"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import {
  createComandaSchema,
  addComandaItemSchema,
  updateComandaItemSchema,
  completeComandaSchema,
} from "./schemas";
import type {
  Comanda,
  ComandaItem,
  ComandaStats,
  CreateComandaInput,
  AddComandaItemInput,
  UpdateComandaItemInput,
  CompleteComandaInput,
} from "@/types/comanda";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// -----------------------------------------------------------------------------
// GET — Listar comandas
// -----------------------------------------------------------------------------
export async function getComandas(filters?: {
  status?: string;
  barber_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Comanda[]> {
  const supabase = await createClient();
  const org = await getOrg();

  let query = supabase
    .from("orders")
    .select(
      `
      *,
      customer:customer_id(full_name),
      barber:assigned_barber_id(full_name)
    `
    )
    .eq("organization_id", org.id)
    .order("issued_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.barber_id) {
    query = query.eq("assigned_barber_id", filters.barber_id);
  }
  if (filters?.date_from) {
    query = query.gte("issued_at", filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte("issued_at", filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    customer_name: row.customer?.full_name ?? null,
    barber_name: row.barber?.full_name ?? null,
  })) as Comanda[];
}

// -----------------------------------------------------------------------------
// GET — Buscar comanda por ID com itens
// -----------------------------------------------------------------------------
export async function getComandaById(orderId: string): Promise<Comanda | null> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customer:customer_id(full_name),
      barber:assigned_barber_id(full_name),
      items:order_items(*)
    `
    )
    .eq("id", orderId)
    .eq("organization_id", org.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return {
    ...data,
    customer_name: (data as any).customer?.full_name ?? null,
    barber_name: (data as any).barber?.full_name ?? null,
    items: ((data as any).items ?? []) as ComandaItem[],
  } as Comanda;
}

// -----------------------------------------------------------------------------
// CREATE — Abrir nova comanda
// -----------------------------------------------------------------------------
export async function createComanda(input: CreateComandaInput): Promise<string> {
  const parsed = createComandaSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar sessão de caixa aberta
  const { data: openSession } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("organization_id", org.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("orders")
    .insert({
      organization_id: org.id,
      customer_id: parsed.customer_id ?? null,
      assigned_barber_id: parsed.assigned_barber_id ?? null,
      appointment_id: parsed.appointment_id ?? null,
      cash_session_id: openSession?.id ?? null,
      status: "open",
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      notes: parsed.notes ?? null,
      issued_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "comanda_created",
    p_module: "comandas",
    p_resource_type: "order",
    p_resource_id: data.id,
    p_metadata: {
      barber_id: parsed.assigned_barber_id,
      customer_id: parsed.customer_id,
    },
  });

  return data.id;
}

// -----------------------------------------------------------------------------
// ADD ITEM — Adicionar serviço ou produto à comanda
// -----------------------------------------------------------------------------
export async function addComandaItem(input: AddComandaItemInput): Promise<void> {
  const parsed = addComandaItemSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();

  // Verificar se a comanda existe e está aberta
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, subtotal, total")
    .eq("id", parsed.order_id)
    .eq("organization_id", org.id)
    .single();

  if (!order) throw new Error("Comanda não encontrada");
  if (order.status !== "open" && order.status !== "in_progress") {
    throw new Error("Não é possível adicionar itens a uma comanda fechada");
  }

  const itemTotal = parsed.quantity * parsed.unit_price - parsed.discount;

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: parsed.order_id,
    product_id: parsed.product_id ?? null,
    description: parsed.description,
    quantity: parsed.quantity,
    unit_price: parsed.unit_price,
    discount: parsed.discount,
    total: itemTotal,
    notes: parsed.notes ?? null,
  });

  if (itemError) throw itemError;

  // Atualizar totais da comanda
  const newSubtotal = (order.subtotal ?? 0) + itemTotal;
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      subtotal: newSubtotal,
      total: newSubtotal - (order as any).discount + (order as any).tax,
      status: "in_progress",
    })
    .eq("id", parsed.order_id);

  if (orderError) throw orderError;
}

// -----------------------------------------------------------------------------
// UPDATE ITEM — Atualizar item da comanda
// -----------------------------------------------------------------------------
export async function updateComandaItem(
  itemId: string,
  input: UpdateComandaItemInput
): Promise<void> {
  const parsed = updateComandaItemSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();

  // Buscar item atual
  const { data: item } = await supabase
    .from("order_items")
    .select("*, orders!inner(organization_id)")
    .eq("id", itemId)
    .single();

  if (!item || (item as any).orders.organization_id !== org.id) {
    throw new Error("Item não encontrado");
  }

  const updates: Record<string, any> = {};
  if (parsed.quantity !== undefined) updates.quantity = parsed.quantity;
  if (parsed.unit_price !== undefined) updates.unit_price = parsed.unit_price;
  if (parsed.discount !== undefined) updates.discount = parsed.discount;
  if (parsed.notes !== undefined) updates.notes = parsed.notes;

  // Recalcular total do item
  const qty = parsed.quantity ?? item.quantity;
  const price = parsed.unit_price ?? item.unit_price;
  const disc = parsed.discount ?? item.discount;
  updates.total = qty * price - disc;

  const { error } = await supabase
    .from("order_items")
    .update(updates)
    .eq("id", itemId);

  if (error) throw error;

  // Recalcular totais da comanda
  await recalculateOrderTotals(item.order_id);
}

// -----------------------------------------------------------------------------
// REMOVE ITEM — Remover item da comanda
// -----------------------------------------------------------------------------
export async function removeComandaItem(itemId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data: item } = await supabase
    .from("order_items")
    .select("order_id, orders!inner(organization_id)")
    .eq("id", itemId)
    .single();

  if (!item || (item as any).orders.organization_id !== org.id) {
    throw new Error("Item não encontrado");
  }

  const { error } = await supabase.from("order_items").delete().eq("id", itemId);
  if (error) throw error;

  await recalculateOrderTotals(item.order_id);
}

// -----------------------------------------------------------------------------
// COMPLETE — Finalizar comanda com pagamento e comissão automática
// -----------------------------------------------------------------------------
export async function completeComanda(input: CompleteComandaInput): Promise<void> {
  const parsed = completeComandaSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", parsed.order_id)
    .eq("organization_id", org.id)
    .single();

  if (!order) throw new Error("Comanda não encontrada");
  if (order.status === "completed") throw new Error("Comanda já foi finalizada");

  // Atualizar desconto final e totais
  const finalDiscount = parsed.discount ?? 0;
  const finalTotal = Math.max(0, (order.subtotal ?? 0) - finalDiscount + (order.tax ?? 0));

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "completed",
      discount: finalDiscount,
      total: finalTotal,
      payment_method: parsed.payment_method,
      completed_at: new Date().toISOString(),
      notes: parsed.notes ?? order.notes,
    })
    .eq("id", parsed.order_id);

  if (updateError) throw updateError;

  // Calcular comissões automaticamente via RPC
  if (order.assigned_barber_id) {
    try {
      await supabase.rpc("calculate_order_commissions", {
        p_order_id: parsed.order_id,
      });
    } catch {
      // Comissão é best-effort; não bloqueia o fechamento
    }
  }

  // Registrar movimentação no caixa se houver sessão aberta
  if (order.cash_session_id && finalTotal > 0) {
    await supabase.from("cash_movements").insert({
      organization_id: org.id,
      cash_session_id: order.cash_session_id,
      movement_type: "sale",
      amount: finalTotal,
      description: `Comanda #${order.id.slice(0, 8)}`,
      reference_type: "order",
      reference_id: order.id,
      payment_method: parsed.payment_method,
      created_by: user.data.user!.id,
    });
  }

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "comanda_completed",
    p_module: "comandas",
    p_resource_type: "order",
    p_resource_id: parsed.order_id,
    p_metadata: {
      total: finalTotal,
      payment_method: parsed.payment_method,
      barber_id: order.assigned_barber_id,
    },
  });
}

// -----------------------------------------------------------------------------
// CANCEL — Cancelar comanda
// -----------------------------------------------------------------------------
export async function cancelComanda(orderId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "comanda_cancelled",
    p_module: "comandas",
    p_resource_type: "order",
    p_resource_id: orderId,
    p_metadata: {},
  });
}

// -----------------------------------------------------------------------------
// STATS — Estatísticas de comandas
// -----------------------------------------------------------------------------
export async function getComandaStats(): Promise<ComandaStats> {
  const supabase = await createClient();
  const org = await getOrg();

  const today = new Date().toISOString().slice(0, 10);

  const [openResult, completedTodayResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("orders")
      .select("total")
      .eq("organization_id", org.id)
      .eq("status", "completed")
      .gte("completed_at", `${today}T00:00:00`),
  ]);

  const totalOpen = openResult.count ?? 0;
  const completedToday = completedTodayResult.data ?? [];
  const revenueToday = completedToday.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const avgTicket =
    completedToday.length > 0 ? revenueToday / completedToday.length : 0;

  return {
    total_open: totalOpen,
    total_completed_today: completedToday.length,
    revenue_today: revenueToday,
    avg_ticket: avgTicket,
  };
}

// -----------------------------------------------------------------------------
// HELPER — Recalcular totais do pedido
// -----------------------------------------------------------------------------
async function recalculateOrderTotals(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("order_items")
    .select("total")
    .eq("order_id", orderId);

  const subtotal = (items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);

  const { data: order } = await supabase
    .from("orders")
    .select("discount, tax")
    .eq("id", orderId)
    .single();

  const discount = order?.discount ?? 0;
  const tax = order?.tax ?? 0;

  await supabase
    .from("orders")
    .update({
      subtotal,
      total: Math.max(0, subtotal - discount + tax),
    })
    .eq("id", orderId);
}