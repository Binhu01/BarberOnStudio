"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicBookingSchema } from "./schemas";
import type { PublicBooking, AvailableSlot, BarbershopSettings } from "@/types/booking";
import crypto from "crypto";

// =============================================================================
// PUBLIC BOOKING ACTIONS — NO AUTH REQUIRED
// Estas ações são chamadas pela página pública /agendar/[slug]
// =============================================================================

/**
 * Busca configurações da barbearia por slug público
 */
export async function getBarbershopBySlug(
  slug: string
): Promise<BarbershopSettings | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("barbershop_settings")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data as BarbershopSettings | null;
}

/**
 * Lista serviços ativos disponíveis para agendamento público
 */
export async function getPublicServices(
  orgId: string
): Promise<Array<{ id: string; name: string; description: string | null; duration_minutes: number; price: number; category: string | null }>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("barber_services")
    .select("id, name, description, duration_minutes, price, category:product_categories(name)")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    duration_minutes: row.duration_minutes,
    price: Number(row.price),
    category: row.category?.name ?? null,
  }));
}

/**
 * Lista barbeiros disponíveis para seleção na página pública
 */
export async function getPublicBarbers(
  orgId: string
): Promise<Array<{ membership_id: string; name: string; bio: string | null; specialties: string[] | null }>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("public_api.get_public_barbers", { p_org_id: orgId });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    membership_id: row.membership_id,
    name: row.name ?? "Profissional",
    bio: row.bio ?? null,
    specialties: row.specialties ?? null,
  }));
}

/**
 * Obtém slots disponíveis para um serviço/barbeiro em uma data específica
 */
export async function getAvailableSlots(
  orgId: string,
  serviceId: string,
  barberId: string,
  date: string
): Promise<AvailableSlot[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_public_available_slots", {
    p_org_id: orgId,
    p_service_id: serviceId,
    p_barber_id: barberId,
    p_date: date,
  });

  if (error) throw error;
  return (data ?? []) as AvailableSlot[];
}

/**
 * Cria um agendamento público (sem autenticação)
 */
export async function createPublicBooking(
  orgId: string,
  input: {
    barber_service_id: string;
    assigned_barber_id?: string | null;
    customer_name: string;
    customer_phone: string;
    customer_email?: string | null;
    scheduled_at: string;
    notes?: string | null;
  }
): Promise<{ booking_id: string; confirmation_token: string }> {
  const parsed = createPublicBookingSchema.parse(input);
  const supabase = await createClient();

  // Buscar duração do serviço
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration_minutes")
    .eq("id", parsed.barber_service_id)
    .eq("organization_id", orgId)
    .single();

  if (!service) throw new Error("Serviço não encontrado");

  // Verificar disponibilidade se barbeiro foi selecionado
  if (parsed.assigned_barber_id) {
    const { data: available } = await supabase.rpc("check_public_availability", {
      p_org_id: orgId,
      p_barber_id: parsed.assigned_barber_id,
      p_scheduled_at: parsed.scheduled_at,
      p_duration_minutes: service.duration_minutes,
    });

    if (!available) {
      throw new Error("Horário indisponível. Por favor, escolha outro horário.");
    }
  }

  // Gerar token de confirmação
  const confirmationToken = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabase
    .from("public_bookings")
    .insert({
      organization_id: orgId,
      barber_service_id: parsed.barber_service_id,
      assigned_barber_id: parsed.assigned_barber_id ?? null,
      customer_name: parsed.customer_name,
      customer_phone: parsed.customer_phone,
      customer_email: parsed.customer_email ?? null,
      scheduled_at: parsed.scheduled_at,
      duration_minutes: service.duration_minutes,
      status: "pending",
      notes: parsed.notes ?? null,
      confirmation_token: confirmationToken,
    })
    .select("id")
    .single();

  if (error) throw error;

  // TODO: Enviar WhatsApp/e-mail de confirmação com link contendo o token
  // Por enquanto, o token é retornado para exibição na tela de sucesso

  return {
    booking_id: data.id,
    confirmation_token: confirmationToken,
  };
}

/**
 * Confirma um agendamento via token (link do WhatsApp/e-mail)
 */
export async function confirmPublicBooking(
  token: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("public_bookings")
    .select("id, status")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!booking) {
    return { success: false, message: "Agendamento não encontrado." };
  }

  if (booking.status !== "pending") {
    return { success: false, message: "Este agendamento já foi confirmado ou cancelado." };
  }

  const { error } = await supabase
    .from("public_bookings")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) throw error;

  return { success: true, message: "Agendamento confirmado com sucesso!" };
}

/**
 * Cancela um agendamento via token
 */
export async function cancelPublicBooking(
  token: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("public_bookings")
    .select("id, status")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!booking) {
    return { success: false, message: "Agendamento não encontrado." };
  }

  if (booking.status === "cancelled") {
    return { success: false, message: "Este agendamento já foi cancelado." };
  }

  const { error } = await supabase
    .from("public_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) throw error;

  return { success: true, message: "Agendamento cancelado com sucesso." };
}

/**
 * Lista bookings públicos para o dashboard (requer auth)
 */
export async function getPublicBookings(filters?: {
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<PublicBooking[]> {
  const supabase = createAdminClient();
  const result = await (await import("@/lib/organizations")).getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  const org = result.org;

  let query = supabase
    .from("public_bookings")
    .select(
      `
      *,
      service:barber_service_id(name),
      barber:assigned_barber_id(user_id(full_name))
    `
    )
    .eq("organization_id", org.id)
    .order("scheduled_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.date_from) {
    query = query.gte("scheduled_at", filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte("scheduled_at", filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    service_name: row.service?.name ?? null,
    barber_name: row.barber?.user_id?.full_name ?? null,
  })) as PublicBooking[];
}