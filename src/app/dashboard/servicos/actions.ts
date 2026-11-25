"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganization } from "@/lib/organizations";
import {
  createBarberServiceSchema,
  updateBarberServiceSchema,
} from "./schemas";
import type {
  BarberServiceWithCategory,
  CreateBarberServiceInput,
  UpdateBarberServiceInput,
} from "@/types/barber";

async function getOrg() {
  const result = await getActiveOrganization();
  if (!result) throw new Error("Organização não encontrada");
  return result.org;
}

// -----------------------------------------------------------------------------
// GET — Listar serviços
// -----------------------------------------------------------------------------
export async function getBarberServices(options?: {
  includeInactive?: boolean;
  categoryId?: string;
}): Promise<BarberServiceWithCategory[]> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  let query = supabase
    .from("barber_services")
    .select(
      `
      *,
      category:product_categories(name)
    `
    )
    .eq("organization_id", org.id)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (options?.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    price: Number(row.price),
    commission_value: Number(row.commission_value),
    category_name: row.category?.name ?? null,
  }));
}

// -----------------------------------------------------------------------------
// GET — Serviço por ID
// -----------------------------------------------------------------------------
export async function getBarberServiceById(
  id: string
): Promise<BarberServiceWithCategory | null> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("barber_services")
    .select(
      `
      *,
      category:product_categories(name)
    `
    )
    .eq("id", id)
    .eq("organization_id", org.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return {
    ...data,
    price: Number(data.price),
    commission_value: Number(data.commission_value),
    category_name: data.category?.name ?? null,
  };
}

// -----------------------------------------------------------------------------
// CREATE — Criar serviço
// -----------------------------------------------------------------------------
export async function createBarberService(
  input: CreateBarberServiceInput
): Promise<BarberServiceWithCategory> {
  const parsed = createBarberServiceSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("barber_services")
    .insert({
      organization_id: org.id,
      name: parsed.name,
      description: parsed.description ?? null,
      category_id: parsed.category_id ?? null,
      duration_minutes: parsed.duration_minutes,
      buffer_minutes: parsed.buffer_minutes,
      price: parsed.price,
      commission_type: parsed.commission_type,
      commission_value: parsed.commission_value,
      is_active: parsed.is_active,
      display_order: parsed.display_order,
    })
    .select(
      `
      *,
      category:product_categories(name)
    `
    )
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barber_service_created",
    p_module: "barber_services",
    p_resource_type: "barber_service",
    p_resource_id: data.id,
    p_metadata: { name: data.name, price: data.price },
  });

  return {
    ...data,
    price: Number(data.price),
    commission_value: Number(data.commission_value),
    category_name: data.category?.name ?? null,
  };
}

// -----------------------------------------------------------------------------
// UPDATE — Atualizar serviço
// -----------------------------------------------------------------------------
export async function updateBarberService(
  id: string,
  input: UpdateBarberServiceInput
): Promise<BarberServiceWithCategory> {
  const parsed = updateBarberServiceSchema.parse(input);
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const existing = await getBarberServiceById(id);
  if (!existing) {
    throw new Error("Serviço não encontrado");
  }

  const updateData: Record<string, any> = {};
  if (parsed.name !== undefined) updateData.name = parsed.name;
  if (parsed.description !== undefined)
    updateData.description = parsed.description;
  if (parsed.category_id !== undefined)
    updateData.category_id = parsed.category_id;
  if (parsed.duration_minutes !== undefined)
    updateData.duration_minutes = parsed.duration_minutes;
  if (parsed.buffer_minutes !== undefined)
    updateData.buffer_minutes = parsed.buffer_minutes;
  if (parsed.price !== undefined) updateData.price = parsed.price;
  if (parsed.commission_type !== undefined)
    updateData.commission_type = parsed.commission_type;
  if (parsed.commission_value !== undefined)
    updateData.commission_value = parsed.commission_value;
  if (parsed.is_active !== undefined) updateData.is_active = parsed.is_active;
  if (parsed.display_order !== undefined)
    updateData.display_order = parsed.display_order;

  const { data, error } = await supabase
    .from("barber_services")
    .update(updateData)
    .eq("id", id)
    .eq("organization_id", org.id)
    .select(
      `
      *,
      category:product_categories(name)
    `
    )
    .single();

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barber_service_updated",
    p_module: "barber_services",
    p_resource_type: "barber_service",
    p_resource_id: data.id,
    p_metadata: { changes: Object.keys(updateData) },
  });

  return {
    ...data,
    price: Number(data.price),
    commission_value: Number(data.commission_value),
    category_name: data.category?.name ?? null,
  };
}

// -----------------------------------------------------------------------------
// DELETE — Desativar serviço (soft delete)
// -----------------------------------------------------------------------------
export async function deactivateBarberService(id: string): Promise<void> {
  const supabase = await createClient();
  const org = await getOrg();
  const user = await supabase.auth.getUser();

  const { error } = await supabase
    .from("barber_services")
    .update({ is_active: false })
    .eq("id", id)
    .eq("organization_id", org.id);

  if (error) throw error;

  await supabase.rpc("log_audit", {
    p_org_id: org.id,
    p_actor: user.data.user!.id,
    p_action: "barber_service_deactivated",
    p_module: "barber_services",
    p_resource_type: "barber_service",
    p_resource_id: id,
  });
}

// -----------------------------------------------------------------------------
// STATS — Estatísticas de serviços
// -----------------------------------------------------------------------------
export async function getBarberServiceStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  avg_price: number;
  avg_duration: number;
}> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("barber_services")
    .select("is_active, price, duration_minutes")
    .eq("organization_id", org.id);

  if (error) throw error;

  const services = data ?? [];
  const active = services.filter((s: any) => s.is_active);

  return {
    total: services.length,
    active: active.length,
    inactive: services.length - active.length,
    avg_price:
      active.length > 0
        ? active.reduce((sum: number, s: any) => sum + Number(s.price), 0) / active.length
        : 0,
    avg_duration:
      active.length > 0
        ? Math.round(active.reduce((sum: number, s: any) => sum + s.duration_minutes, 0) / active.length)
        : 0,
  };
}

// -----------------------------------------------------------------------------
// CATEGORIES — Listar categorias de serviço
// -----------------------------------------------------------------------------
export async function getServiceCategories(): Promise<
  Array<{ id: string; name: string; description: string | null }>
> {
  const supabase = requireAdminClient();
  const org = await getOrg();

  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, description")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}