"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import {
  appointmentStatusSchema,
  createAppointmentSchema,
  changeStatusSchema,
  rescheduleAppointmentSchema,
} from "./schemas";
import type {
  AppointmentStatus,
  AppointmentWithDetails,
  AppointmentStatusHistoryEntry,
} from "./schemas";
import type { z } from "zod";

// Re-export types for backward compatibility (pages import from actions)
export type { AppointmentStatus, AppointmentWithDetails, AppointmentStatusHistoryEntry };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// ---------------------------------------------------------------------------
// GET — Listar agendamentos com detalhes completos
// ---------------------------------------------------------------------------
export async function getAppointments(params?: {
  startDate?: string;
  endDate?: string;
  barberId?: string;
  status?: AppointmentStatus;
  limit?: number;
}): Promise<AppointmentWithDetails[]> {
  const supabase = await createClient();
  const org = await getOrg();

  // Tentar usar a RPC primeiro (mais eficiente, join no banco)
  const { data, error } = await supabase.rpc("get_appointments_with_details", {
    p_org_id: org.id,
    p_start_date: params?.startDate ?? null,
    p_end_date: params?.endDate ?? null,
    p_barber_id: params?.barberId ?? null,
    p_status: params?.status ?? null,
    p_limit: params?.limit ?? 200,
  });

  if (!error && data) {
    return data as AppointmentWithDetails[];
  }

  // Fallback: query direta caso a migration ainda não tenha sido aplicada
  let query = supabase
    .from("calendar_events")
    .select(
      `
      id,
      title,
      description,
      start_at,
      end_at,
      status,
      origin,
      total_price,
      notes,
      confirmed_at,
      cancelled_at,
      cancellation_reason,
      completed_at,
      assigned_barber_id,
      barber_service_id,
      customer_id,
      created_by
    `
    )
    .eq("organization_id", org.id)
    .order("start_at", { ascending: true })
    .limit(params?.limit ?? 200);

  if (params?.startDate) {
    query = query.gte("start_at", params.startDate);
  }
  if (params?.endDate) {
    query = query.lte("start_at", params.endDate);
  }
  if (params?.barberId) {
    query = query.eq("assigned_barber_id", params.barberId);
  }
  if (params?.status) {
    query = query.eq("status", params.status);
  }

  const { data: fallbackData, error: fallbackError } = await query;
  if (fallbackError) throw fallbackError;

  // Mapear para o formato esperado (sem joins — dados básicos)
  return (fallbackData ?? []).map((row: any) => ({
    event_id: row.id,
    title: row.title,
    description: row.description,
    start_at: row.start_at,
    end_at: row.end_at,
    status: row.status ?? "scheduled",
    origin: row.origin ?? "manual",
    total_price: row.total_price ? Number(row.total_price) : null,
    notes: row.notes,
    confirmed_at: row.confirmed_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    completed_at: row.completed_at,
    barber_name: null,
    barber_avatar: null,
    service_name: null,
    service_duration: null,
    customer_name: null,
    customer_phone: null,
    customer_email: null,
    creator_name: null,
  }));
}

// ---------------------------------------------------------------------------
// GET — Agendamento individual com detalhes
// ---------------------------------------------------------------------------
export async function getAppointmentById(
  eventId: string
): Promise<AppointmentWithDetails | null> {
  const results = await getAppointments({ limit: 1 });
  // Filtrar pelo ID específico (a RPC não tem filtro por ID, então usamos lista)
  // Para otimizar, fazemos query direta
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      `
      id,
      title,
      description,
      start_at,
      end_at,
      status,
      origin,
      total_price,
      notes,
      confirmed_at,
      cancelled_at,
      cancellation_reason,
      completed_at,
      assigned_barber_id,
      barber_service_id,
      customer_id,
      created_by,
      all_day,
      color,
      location,
      recurrence
    `
    )
    .eq("id", eventId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Buscar nomes relacionados
  let barberName: string | null = null;
  let barberAvatar: string | null = null;
  let serviceName: string | null = null;
  let serviceDuration: number | null = null;
  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let customerEmail: string | null = null;
  let creatorName: string | null = null;

  if (data.assigned_barber_id) {
    const { data: barber } = await supabase
      .from("memberships")
      .select("profiles:user_id(full_name, avatar_url)")
      .eq("id", data.assigned_barber_id)
      .maybeSingle();
    barberName = (barber as any)?.profiles?.full_name ?? null;
    barberAvatar = (barber as any)?.profiles?.avatar_url ?? null;
  }

  if (data.barber_service_id) {
    const { data: service } = await supabase
      .from("barber_services")
      .select("name, duration_minutes")
      .eq("id", data.barber_service_id)
      .maybeSingle();
    serviceName = service?.name ?? null;
    serviceDuration = service?.duration_minutes ?? null;
  }

  if (data.customer_id) {
    const { data: customer } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", data.customer_id)
      .maybeSingle();
    customerName = customer?.full_name ?? null;
    customerPhone = customer?.phone ?? null;
    customerEmail = customer?.email ?? null;
  }

  if (data.created_by) {
    const { data: creator } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", data.created_by)
      .maybeSingle();
    creatorName = creator?.full_name ?? null;
  }

  return {
    event_id: data.id,
    title: data.title,
    description: data.description,
    start_at: data.start_at,
    end_at: data.end_at,
    status: (data.status as AppointmentStatus) ?? "scheduled",
    origin: data.origin ?? "manual",
    total_price: data.total_price ? Number(data.total_price) : null,
    notes: data.notes,
    confirmed_at: data.confirmed_at,
    cancelled_at: data.cancelled_at,
    cancellation_reason: data.cancellation_reason,
    completed_at: data.completed_at,
    barber_name: barberName,
    barber_avatar: barberAvatar,
    service_name: serviceName,
    service_duration: serviceDuration,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    creator_name: creatorName,
  };
}

// ---------------------------------------------------------------------------
// CREATE — Criar agendamento
// ---------------------------------------------------------------------------
export async function createAppointment(
  input: z.infer<typeof createAppointmentSchema>
): Promise<{ id: string }> {
  const parsed = createAppointmentSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Verificar conflito se barbeiro foi atribuído
  if (parsed.assigned_barber_id) {
    try {
      const { data: conflict } = await supabase.rpc(
        "check_appointment_conflict",
        {
          p_org_id: org.id,
          p_barber_membership_id: parsed.assigned_barber_id,
          p_start_time: parsed.start_at,
          p_end_time: parsed.end_at,
          p_exclude_appointment_id: null,
        }
      );

      if (conflict && (conflict as any).has_conflict) {
        throw new Error(
          `Conflito de horário: ${(conflict as any).conflict_message || "o barbeiro já possui compromisso neste horário."}`
        );
      }
    } catch (e: any) {
      // Se a RPC não existir ainda, continuar sem verificação
      if (!e.message?.includes("does not exist")) {
        throw e;
      }
    }
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      organization_id: org.id,
      title: parsed.title,
      description: parsed.description ?? null,
      start_at: parsed.start_at,
      end_at: parsed.end_at,
      all_day: false,
      barber_service_id: parsed.barber_service_id ?? null,
      assigned_barber_id: parsed.assigned_barber_id ?? null,
      customer_id: parsed.customer_id ?? null,
      total_price: parsed.total_price ?? null,
      notes: parsed.notes ?? null,
      color: parsed.color ?? "#0866E8",
      status: "scheduled",
      origin: "manual",
      created_by: user.data.user!.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Registrar no histórico
  try {
    await supabase.from("appointment_status_history").insert({
      organization_id: org.id,
      calendar_event_id: data.id,
      previous_status: null,
      new_status: "scheduled",
      changed_by: user.data.user!.id,
      reason: "Agendamento criado manualmente",
    });
  } catch {
    // Tabela pode não existir se migration pendente
  }

  // Audit log
  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "appointment_created",
    p_module: "appointments",
    p_resource_type: "calendar_event",
    p_resource_id: data.id,
    p_metadata: {
      title: parsed.title,
      start_at: parsed.start_at,
      barber_service_id: parsed.barber_service_id,
      assigned_barber_id: parsed.assigned_barber_id,
    },
  });

  return { id: data.id };
}

// ---------------------------------------------------------------------------
// CHANGE STATUS — Alterar status do agendamento via RPC
// ---------------------------------------------------------------------------
export async function changeAppointmentStatus(
  input: z.infer<typeof changeStatusSchema>
): Promise<void> {
  const parsed = changeStatusSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Usar RPC que valida transições e registra histórico automaticamente
  const { error } = await supabase.rpc("change_appointment_status", {
    p_event_id: parsed.event_id,
    p_new_status: parsed.new_status,
    p_reason: parsed.reason ?? null,
    p_changed_by: user.data.user!.id,
  });

  if (error) {
    // Se a RPC não existir, fazer manualmente
    if (error.message?.includes("does not exist")) {
      const { error: updateError } = await supabase
        .from("calendar_events")
        .update({
          status: parsed.new_status,
          confirmed_at:
            parsed.new_status === "confirmed" ? new Date().toISOString() : undefined,
          cancelled_at:
            parsed.new_status === "cancelled" ? new Date().toISOString() : undefined,
          cancellation_reason:
            parsed.new_status === "cancelled" ? parsed.reason : undefined,
          completed_at:
            parsed.new_status === "completed" ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.event_id)
        .eq("organization_id", org.id);

      if (updateError) throw updateError;
    } else {
      throw new Error(error.message);
    }
  }

  // Audit log
  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "appointment_status_changed",
    p_module: "appointments",
    p_resource_type: "calendar_event",
    p_resource_id: parsed.event_id,
    p_metadata: {
      new_status: parsed.new_status,
      reason: parsed.reason,
    },
  });
}

// ---------------------------------------------------------------------------
// RESCHEDULE — Reagendar (cancela original + cria novo)
// ---------------------------------------------------------------------------
export async function rescheduleAppointment(
  input: z.infer<typeof rescheduleAppointmentSchema>
): Promise<{ new_event_id: string }> {
  const parsed = rescheduleAppointmentSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar agendamento original
  const { data: original, error: fetchError } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", parsed.event_id)
    .eq("organization_id", org.id)
    .single();

  if (fetchError || !original) {
    throw new Error("Agendamento não encontrado");
  }

  // Cancelar o original
  await changeAppointmentStatus({
    event_id: parsed.event_id,
    new_status: "cancelled",
    reason: parsed.reason ?? "Reagendado",
  });

  // Criar novo agendamento com os mesmos dados
  const { data: newEvent, error: createError } = await supabase
    .from("calendar_events")
    .insert({
      organization_id: org.id,
      title: original.title,
      description: original.description,
      start_at: parsed.new_start_at,
      end_at: parsed.new_end_at,
      all_day: original.all_day,
      barber_service_id: original.barber_service_id,
      assigned_barber_id: original.assigned_barber_id,
      customer_id: original.customer_id,
      total_price: original.total_price,
      notes: original.notes,
      color: original.color,
      status: "scheduled",
      origin: original.origin,
      created_by: user.data.user!.id,
    })
    .select("id")
    .single();

  if (createError) throw createError;

  // Registrar histórico de reagendamento
  try {
    await supabase.from("appointment_status_history").insert({
      organization_id: org.id,
      calendar_event_id: newEvent.id,
      previous_status: null,
      new_status: "scheduled",
      changed_by: user.data.user!.id,
      reason: `Reagendado de ${parsed.event_id}: ${parsed.reason ?? ""}`,
      metadata: { rescheduled_from: parsed.event_id },
    });
  } catch {
    // Tabela pode não existir
  }

  // Audit log
  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "appointment_rescheduled",
    p_module: "appointments",
    p_resource_type: "calendar_event",
    p_resource_id: parsed.event_id,
    p_metadata: {
      original_event_id: parsed.event_id,
      new_event_id: newEvent.id,
      new_start_at: parsed.new_start_at,
      reason: parsed.reason,
    },
  });

  return { new_event_id: newEvent.id };
}

// ---------------------------------------------------------------------------
// GET — Histórico de status do agendamento
// ---------------------------------------------------------------------------
export async function getAppointmentStatusHistory(
  eventId: string
): Promise<AppointmentStatusHistoryEntry[]> {
  const supabase = await createClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("appointment_status_history")
    .select(
      `
      id,
      previous_status,
      new_status,
      reason,
      created_at,
      changed_by,
      profiles:changed_by(full_name)
    `
    )
    .eq("organization_id", org.id)
    .eq("calendar_event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    // Tabela pode não existir se migration pendente
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    previous_status: row.previous_status,
    new_status: row.new_status,
    reason: row.reason,
    created_at: row.created_at,
    changed_by_name: row.profiles?.full_name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// GET — Estatísticas de agendamentos para dashboard
// ---------------------------------------------------------------------------
export async function getAppointmentStats(): Promise<{
  today: number;
  this_week: number;
  pending: number;
  completed_this_month: number;
  cancelled_this_month: number;
  no_show_this_month: number;
  revenue_this_month: number;
}> {
  const supabase = await createClient();
  const org = await getOrg();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Hoje
  const { count: todayCount } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .gte("start_at", todayStart)
    .lt("start_at", todayEnd)
    .neq("status", "cancelled");

  // Esta semana
  const { count: weekCount } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .gte("start_at", weekStart.toISOString())
    .lt("start_at", weekEnd.toISOString())
    .neq("status", "cancelled");

  // Pendentes
  const { count: pendingCount } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .in("status", ["scheduled", "confirmed"])
    .gte("start_at", now.toISOString());

  // Completados este mês
  const { count: completedCount } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "completed")
    .gte("completed_at", monthStart);

  // Cancelados este mês
  const { count: cancelledCount } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "cancelled")
    .gte("cancelled_at", monthStart);

  // No-show este mês
  const { count: noShowCount } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "no_show")
    .gte("start_at", monthStart);

  // Receita este mês (soma de total_price dos completados)
  const { data: revenueData } = await supabase
    .from("calendar_events")
    .select("total_price")
    .eq("organization_id", org.id)
    .eq("status", "completed")
    .gte("completed_at", monthStart);

  const revenueThisMonth = (revenueData ?? []).reduce(
    (sum, row) => sum + Number(row.total_price ?? 0),
    0
  );

  return {
    today: todayCount ?? 0,
    this_week: weekCount ?? 0,
    pending: pendingCount ?? 0,
    completed_this_month: completedCount ?? 0,
    cancelled_this_month: cancelledCount ?? 0,
    no_show_this_month: noShowCount ?? 0,
    revenue_this_month: revenueThisMonth,
  };
}