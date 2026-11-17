"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// =============================================================================
// LANDING PAGE DATA — Dados dinâmicos do Supabase para a landing page
// Usa createClient direto (não SSR) para evitar problemas com cookies no Vercel
// =============================================================================

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }
  return createSupabaseClient(url, key);
}

export async function getLandingData() {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (e: any) {
    console.error("[getLandingData] Credenciais Supabase não configuradas:", e.message);
    return { barbers: [], services: [], products: [], settings: null };
  }

  // 1. Buscar organização
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .limit(1);

  if (orgError || !orgs || orgs.length === 0) {
    console.error("[getLandingData] Erro ao buscar organização:", orgError?.message);
    return { barbers: [], services: [], products: [], settings: null };
  }

  const org = orgs[0];

  // 2. Buscar membros da organização (apenas EMPLOYEE/MANAGER para a landing page)
  // OWNER e ADMIN ficam fora da lista pública de barbeiros
  const { data: activeMembers, error: membersError } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .in("role", ["EMPLOYEE", "MANAGER"]);

  if (membersError) {
    console.error("[getLandingData] Erro ao buscar membros:", membersError.message);
  }

  const memberIds = (activeMembers ?? []).map((m: any) => m.user_id);
  const memberRoles: Record<string, string> = {};
  for (const m of activeMembers ?? []) {
    memberRoles[m.user_id] = m.role;
  }

  // 3. Buscar dados em paralelo usando Promise.allSettled para resiliência
  const [barbersResult, servicesResult, productsResult, settingsResult] =
    await Promise.allSettled([
      // Profissionais
      memberIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", memberIds)
            .order("full_name")
        : Promise.resolve({ data: [], error: null }),

      // Serviços ativos
      supabase
        .from("barber_services")
        .select("id, name, description, price, duration_minutes")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name"),

      // Produtos ativos — coluna de preço é sale_price, não price
      supabase
        .from("products")
        .select("id, name, description, sale_price, image_url")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("name")
        .limit(8),

      // Configurações da barbearia
      supabase
        .from("barbershop_settings")
        .select("*")
        .eq("organization_id", org.id)
        .limit(1),
    ]);

  // Extrair dados dos resultados
  const barbersRes =
    barbersResult.status === "fulfilled"
      ? barbersResult.value
      : { data: [], error: { message: String(barbersResult.reason) } };
  const servicesRes =
    servicesResult.status === "fulfilled"
      ? servicesResult.value
      : { data: [], error: { message: String(servicesResult.reason) } };
  const productsRes =
    productsResult.status === "fulfilled"
      ? productsResult.value
      : { data: [], error: { message: String(productsResult.reason) } };
  const settingsRes =
    settingsResult.status === "fulfilled"
      ? settingsResult.value
      : { data: [], error: { message: String(settingsResult.reason) } };

  // Log errors for debugging
  if ((barbersRes as any).error)
    console.error("[getLandingData] Erro barbers:", (barbersRes as any).error.message);
  if ((servicesRes as any).error)
    console.error("[getLandingData] Erro services:", (servicesRes as any).error.message);
  if ((productsRes as any).error)
    console.error("[getLandingData] Erro products:", (productsRes as any).error.message);
  if ((settingsRes as any).error)
    console.error("[getLandingData] Erro settings:", (settingsRes as any).error.message);

  const settingsData = Array.isArray(settingsRes.data)
    ? settingsRes.data[0]
    : (settingsRes as any).data;

  return {
    barbers: ((barbersRes as any).data ?? []).map((b: any) => {
      // Mapear roles internos para labels amigáveis na landing page
      const roleMap: Record<string, string> = {
        EMPLOYEE: "Barbeiro",
        MANAGER: "Gerente",
        ADMIN: "Administrador",
        OWNER: "Proprietário",
      };
      return {
        id: b.id,
        full_name: b.full_name || "Profissional",
        avatar_url: b.avatar_url,
        phone: null,
        role: roleMap[memberRoles[b.id]] ?? memberRoles[b.id] ?? "Barbeiro",
        instagram: null,
      };
    }),
    services: ((servicesRes as any).data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      duration_minutes: s.duration_minutes,
      image_url: null,
    })),
    products: ((productsRes as any).data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.sale_price,
      image_url: p.image_url ?? null,
    })),
    settings: settingsData ?? null,
  };
}

// =============================================================================
// PUBLIC BOOKING — Agendamento público sem autenticação
// =============================================================================

export async function getAvailableSlotsForLanding(params: {
  serviceId: string;
  barberId?: string | null;
  date: string; // YYYY-MM-DD
}) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return { slots: [], error: "Serviço indisponível" };
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);

  if (!orgs || orgs.length === 0)
    return { slots: [], error: "Organização não encontrada" };
  const org = orgs[0];

  const { data: service } = await supabase
    .from("barber_services")
    .select("duration_minutes")
    .eq("id", params.serviceId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!service) return { slots: [], error: "Serviço não encontrado" };

  if (params.barberId) {
    const { data, error } = await supabase.rpc("get_public_available_slots", {
      p_org_id: org.id,
      p_barber_id: params.barberId,
      p_service_id: params.serviceId,
      p_date: params.date,
    });
    if (error) return { slots: [], error: error.message };
    return { slots: data ?? [], error: null };
  }

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", org.id);

  if (!members || members.length === 0)
    return { slots: [], error: "Nenhum profissional disponível" };

  for (const member of members) {
    const { data, error } = await supabase.rpc("get_public_available_slots", {
      p_org_id: org.id,
      p_barber_id: member.user_id,
      p_service_id: params.serviceId,
      p_date: params.date,
    });
    if (!error && data && data.length > 0) {
      return { slots: data, barberId: member.user_id, error: null };
    }
  }

  return { slots: [], error: "Nenhum horário disponível nesta data" };
}

export async function createPublicBookingFromLanding(input: {
  serviceId: string;
  barberId?: string | null;
  date: string;
  timeSlot: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
}) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    throw new Error("Serviço indisponível");
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .limit(1);

  if (!orgs || orgs.length === 0) throw new Error("Organização não encontrada");
  const org = orgs[0];

  const { data: service } = await supabase
    .from("barber_services")
    .select("id, name, duration_minutes, price")
    .eq("id", input.serviceId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!service) throw new Error("Serviço não encontrado");

  const scheduledAt = `${input.date}T${input.timeSlot}:00`;

  if (input.barberId) {
    const { data: availability } = await supabase.rpc(
      "check_public_availability",
      {
        p_org_id: org.id,
        p_barber_id: input.barberId,
        p_start_time: scheduledAt,
        p_duration_minutes: service.duration_minutes,
      }
    );
    if (!availability?.[0]?.is_available) {
      throw new Error(
        "Este horário não está mais disponível. Por favor, escolha outro."
      );
    }
  }

  const { data: booking, error } = await supabase
    .from("public_bookings")
    .insert({
      organization_id: org.id,
      barber_service_id: input.serviceId,
      assigned_barber_id: input.barberId ?? null,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail ?? null,
      scheduled_at: scheduledAt,
      duration_minutes: service.duration_minutes,
      status: "confirmed",
      notes: input.notes ?? null,
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Erro ao criar agendamento: ${error.message}`);

  try {
    await supabase.rpc("log_audit", {
      p_org_id: org.id,
      p_actor: null,
      p_action: "public_booking_created",
      p_module: "bookings",
      p_resource_type: "public_booking",
      p_resource_id: booking.id,
      p_metadata: {
        customer: input.customerName,
        service: service.name,
        date: scheduledAt,
      },
    });
  } catch {
    // Audit log failure should not block booking confirmation
  }

  return {
    bookingId: booking.id,
    serviceName: service.name,
    price: service.price,
    scheduledAt,
    durationMinutes: service.duration_minutes,
  };
}