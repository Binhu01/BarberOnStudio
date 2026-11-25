"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import { upsertBarberScheduleSchema, bulkUpsertBarberScheduleSchema } from "./schemas";
import type { BarberScheduleWithName, UpsertBarberScheduleInput } from "@/types/barber";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// -----------------------------------------------------------------------------
// GET — Listar expedientes de um profissional
// -----------------------------------------------------------------------------
export async function getBarberSchedules(
  membershipId: string
): Promise<BarberScheduleWithName[]> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  // Buscar nome do membro
  const { data: memberData } = await supabase
    .from("memberships")
    .select("profiles(full_name)")
    .eq("id", membershipId)
    .eq("organization_id", org.id)
    .single();

  const memberName = (memberData as any)?.profiles?.full_name ?? "Profissional";

  const { data, error } = await supabase
    .from("barber_schedules")
    .select("*")
    .eq("organization_id", org.id)
    .eq("membership_id", membershipId)
    .order("day_of_week", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    member_name: memberName,
  }));
}

// -----------------------------------------------------------------------------
// GET — Listar todos os profissionais disponíveis para configuração
// -----------------------------------------------------------------------------
export async function getAvailableBarbers(): Promise<
  Array<{ membership_id: string; name: string; role: string }>
> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("memberships")
    .select(
      `
      id,
      role,
      profiles:user_id(full_name)
    `
    )
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    membership_id: row.id,
    name: row.profiles?.full_name ?? "Sem nome",
    role: row.role,
  }));
}

// -----------------------------------------------------------------------------
// UPSERT — Criar ou atualizar expediente individual
// -----------------------------------------------------------------------------
export async function upsertBarberSchedule(
  input: UpsertBarberScheduleInput
): Promise<void> {
  const parsed = upsertBarberScheduleSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase.from("barber_schedules").upsert(
    {
      organization_id: org.id,
      membership_id: parsed.membership_id,
      day_of_week: parsed.day_of_week,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      lunch_start: parsed.lunch_start ?? null,
      lunch_end: parsed.lunch_end ?? null,
      is_working_day: parsed.is_working_day,
    },
    { onConflict: "membership_id,day_of_week" }
  );

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barber_schedule_upserted",
    p_module: "barber_schedules",
    p_resource_type: "barber_schedule",
    p_resource_id: null,
    p_metadata: {
      membership_id: parsed.membership_id,
      day_of_week: parsed.day_of_week,
      is_working_day: parsed.is_working_day,
    },
  });
}

// -----------------------------------------------------------------------------
// BULK UPSERT — Salvar semana completa de expediente
// -----------------------------------------------------------------------------
export async function bulkUpsertBarberSchedules(
  membershipId: string,
  schedules: Array<Omit<UpsertBarberScheduleInput, "membership_id">>
): Promise<void> {
  const parsed = bulkUpsertBarberScheduleSchema.parse({
    membership_id: membershipId,
    schedules,
  });
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const rows = parsed.schedules.map((s) => ({
    organization_id: org.id,
    membership_id: membershipId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    lunch_start: s.lunch_start ?? null,
    lunch_end: s.lunch_end ?? null,
    is_working_day: s.is_working_day,
  }));

  const { error } = await supabase.from("barber_schedules").upsert(rows, {
    onConflict: "membership_id,day_of_week",
  });

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barber_schedule_bulk_upserted",
    p_module: "barber_schedules",
    p_resource_type: "barber_schedule",
    p_resource_id: null,
    p_metadata: { membership_id: membershipId, days_count: rows.length },
  });
}

// -----------------------------------------------------------------------------
// DELETE — Remover expediente de um dia específico
// -----------------------------------------------------------------------------
export async function deleteBarberSchedule(
  membershipId: string,
  dayOfWeek: number
): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("barber_schedules")
    .delete()
    .eq("organization_id", org.id)
    .eq("membership_id", membershipId)
    .eq("day_of_week", dayOfWeek);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barber_schedule_deleted",
    p_module: "barber_schedules",
    p_resource_type: "barber_schedule",
    p_resource_id: null,
    p_metadata: { membership_id: membershipId, day_of_week: dayOfWeek },
  });
}