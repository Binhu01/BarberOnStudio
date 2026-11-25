"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import {
  createLoyaltyProgramSchema,
  updateLoyaltyProgramSchema,
  createLoyaltyCardSchema,
  addPointsSchema,
  redeemPointsSchema,
} from "./schemas";
import type {
  LoyaltyProgram,
  LoyaltyCard,
  LoyaltyTransaction,
  LoyaltySummary,
  CreateLoyaltyProgramInput,
  UpdateLoyaltyProgramInput,
  CreateLoyaltyCardInput,
  AddPointsInput,
  RedeemPointsInput,
} from "@/types/loyalty";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// =============================================================================
// LOYALTY PROGRAMS
// =============================================================================

export async function getLoyaltyPrograms(): Promise<LoyaltyProgram[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LoyaltyProgram[];
}

export async function createLoyaltyProgram(
  input: CreateLoyaltyProgramInput
): Promise<string> {
  const parsed = createLoyaltyProgramSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("loyalty_programs")
    .insert({
      organization_id: org.id,
      name: parsed.name,
      description: parsed.description ?? null,
      points_per_real: parsed.points_per_real,
      points_per_visit: parsed.points_per_visit,
      redemption_threshold: parsed.redemption_threshold,
      reward_type: parsed.reward_type,
      reward_value: parsed.reward_value,
      reward_service_id: parsed.reward_service_id ?? null,
      expiry_days: parsed.expiry_days ?? null,
      is_active: parsed.is_active,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "loyalty_program_created",
    p_module: "loyalty",
    p_resource_type: "loyalty_program",
    p_resource_id: data.id,
    p_metadata: { name: parsed.name },
  });

  return data.id;
}

export async function updateLoyaltyProgram(
  programId: string,
  input: UpdateLoyaltyProgramInput
): Promise<void> {
  const parsed = updateLoyaltyProgramSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();

  const { error } = await supabase
    .from("loyalty_programs")
    .update(parsed)
    .eq("id", programId)
    .eq("organization_id", org.id);

  if (error) throw error;
}

export async function deleteLoyaltyProgram(programId: string): Promise<void> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  // Check for active cards (use admin client to bypass RLS)
  const { count } = await adminSupabase
    .from("loyalty_cards")
    .select("id", { count: "exact", head: true })
    .eq("loyalty_program_id", programId)
    .eq("card_status", "active");

  if ((count ?? 0) > 0) {
    throw new Error(
      "Não é possível excluir um programa com cartões ativos. Desative-o primeiro."
    );
  }

  const { error } = await supabase
    .from("loyalty_programs")
    .delete()
    .eq("id", programId)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "loyalty_program_deleted",
    p_module: "loyalty",
    p_resource_type: "loyalty_program",
    p_resource_id: programId,
    p_metadata: {},
  });
}

// =============================================================================
// LOYALTY CARDS
// =============================================================================

export async function getLoyaltyCards(filters?: {
  status?: string;
  customer_id?: string;
}): Promise<LoyaltyCard[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("loyalty_cards")
    .select(
      `
      *,
      customer:customer_profile_id(full_name),
      program:loyalty_program_id(name, redemption_threshold)
    `
    )
    .eq("organization_id", org.id)
    .order("updated_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("card_status", filters.status);
  }
  if (filters?.customer_id) {
    query = query.eq("customer_profile_id", filters.customer_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    customer_name: row.customer?.full_name ?? null,
    program_name: row.program?.name ?? null,
    redemption_threshold: row.program?.redemption_threshold ?? null,
  })) as LoyaltyCard[];
}

export async function createLoyaltyCard(
  input: CreateLoyaltyCardInput
): Promise<string> {
  const parsed = createLoyaltyCardSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("loyalty_cards")
    .insert({
      organization_id: org.id,
      customer_profile_id: parsed.customer_profile_id,
      loyalty_program_id: parsed.loyalty_program_id,
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "loyalty_card_created",
    p_module: "loyalty",
    p_resource_type: "loyalty_card",
    p_resource_id: data.id,
    p_metadata: { customer_id: parsed.customer_profile_id },
  });

  return data.id;
}

export async function addLoyaltyPoints(input: AddPointsInput): Promise<void> {
  const parsed = addPointsSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase.rpc("add_loyalty_points", {
    p_card_id: parsed.card_id,
    p_points: parsed.points,
    p_transaction_type: parsed.reference_type === "bonus" ? "earn_bonus" : "adjustment",
    p_description: parsed.description ?? null,
    p_reference_id: null,
    p_reference_type: parsed.reference_type,
  });

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "loyalty_points_added",
    p_module: "loyalty",
    p_resource_type: "loyalty_card",
    p_resource_id: parsed.card_id,
    p_metadata: { points: parsed.points },
  });
}

export async function redeemLoyaltyPoints(input: RedeemPointsInput): Promise<void> {
  const parsed = redeemPointsSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase.rpc("redeem_loyalty_points", {
    p_card_id: parsed.card_id,
    p_points: parsed.points,
    p_description: parsed.description ?? null,
    p_reference_id: null,
  });

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "loyalty_points_redeemed",
    p_module: "loyalty",
    p_resource_type: "loyalty_card",
    p_resource_id: parsed.card_id,
    p_metadata: { points: parsed.points },
  });
}

export async function getLoyaltyTransactions(
  cardId: string
): Promise<LoyaltyTransaction[]> {
  const supabase = createAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select(
      `
      *,
      creator:created_by(profiles(full_name))
    `
    )
    .eq("organization_id", org.id)
    .eq("loyalty_card_id", cardId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    created_by_name: row.creator?.profiles?.full_name ?? null,
  })) as LoyaltyTransaction[];
}

export async function getLoyaltySummary(): Promise<LoyaltySummary> {
  const supabase = createAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase.rpc("get_loyalty_summary", {
    p_org_id: org.id,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  return {
    total_programs: Number(row?.total_programs ?? 0),
    active_cards: Number(row?.active_cards ?? 0),
    total_points_issued: Number(row?.total_points_issued ?? 0),
    avg_points_per_card: Number(row?.avg_points_per_card ?? 0),
    redemptions_this_month: Number(row?.redemptions_this_month ?? 0),
  };
}