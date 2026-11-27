"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import {
  createScheduleBlockSchema,
  updateScheduleBlockSchema,
  updateBarbershopSettingsSchema,
} from "./schemas";
import type {
  ScheduleBlock,
  BarbershopSettings,
  CreateScheduleBlockInput,
  UpdateScheduleBlockInput,
  UpdateBarbershopSettingsInput,
} from "@/types/booking";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// =============================================================================
// SCHEDULE BLOCKS
// =============================================================================

export async function getScheduleBlocks(filters?: {
  membership_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<ScheduleBlock[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const org = await getOrg();

  let query = supabase
    .from("schedule_blocks")
    .select(
      `
      *,
      member:membership_id(profiles(full_name)),
      creator:created_by(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .order("start_at", { ascending: false });

  if (filters?.membership_id) {
    query = query.eq("membership_id", filters.membership_id);
  }
  if (filters?.date_from) {
    query = query.gte("start_at", filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte("start_at", filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    member_name: row.member?.profiles?.full_name ?? null,
    created_by_name: row.creator?.profiles?.full_name ?? null,
  })) as ScheduleBlock[];
}

export async function createScheduleBlock(
  input: CreateScheduleBlockInput
): Promise<string> {
  const parsed = createScheduleBlockSchema.parse(input);
  const supabase = await createClient();
  const adminSupabase = requireAdminClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Buscar membership_id do usuário (admin client para evitar RLS 42501)
  const { data: membership } = await adminSupabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.data.user!.id)
    .single();

  if (!membership) throw new Error("Usuário não é membro desta organização");

  const { data, error } = await supabase
    .from("schedule_blocks")
    .insert({
      organization_id: org.id,
      membership_id: parsed.membership_id ?? null,
      title: parsed.title,
      reason: parsed.reason ?? null,
      start_at: parsed.start_at,
      end_at: parsed.end_at,
      is_recurring: parsed.is_recurring ?? false,
      recurring_days: parsed.recurring_days ?? null,
      recurring_until: parsed.recurring_until ?? null,
      created_by: membership.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "schedule_block_created",
    p_module: "blocks",
    p_resource_type: "schedule_block",
    p_resource_id: data.id,
    p_metadata: { title: parsed.title, membership_id: parsed.membership_id },
  });

  return data.id;
}

export async function updateScheduleBlock(
  blockId: string,
  input: UpdateScheduleBlockInput
): Promise<void> {
  const parsed = updateScheduleBlockSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("schedule_blocks")
    .update(parsed)
    .eq("id", blockId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

export async function deleteScheduleBlock(blockId: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "schedule_block_deleted",
    p_module: "blocks",
    p_resource_type: "schedule_block",
    p_resource_id: blockId,
    p_metadata: {},
  });
}

// =============================================================================
// BARBERSHOP SETTINGS
// =============================================================================

export async function getBarbershopSettings(): Promise<BarbershopSettings | null> {
  const supabase = createAdminClient();
  if (!supabase) return null as any;
  const org = await getOrg();

  const { data, error } = await supabase
    .from("barbershop_settings")
    .select("*")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (error) throw error;
  return data as BarbershopSettings | null;
}

export async function upsertBarbershopSettings(
  input: UpdateBarbershopSettingsInput
): Promise<void> {
  const parsed = updateBarbershopSettingsSchema.parse(input);
  const supabase = await createClient();
  const adminSupabase = requireAdminClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Verificar se já existe settings (admin client para evitar RLS 42501)
  const { data: existing } = await adminSupabase
    .from("barbershop_settings")
    .select("id")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("barbershop_settings")
      .update(parsed)
      .eq("organization_id", org.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from("barbershop_settings").insert({
      organization_id: org.id,
      shop_name: parsed.shop_name ?? "Minha Barbearia",
      ...parsed,
    });

    if (error) throw error;
  }

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barbershop_settings_updated",
    p_module: "settings",
    p_resource_type: "barbershop_settings",
    p_resource_id: null,
    p_metadata: { fields: Object.keys(parsed) },
  });
}