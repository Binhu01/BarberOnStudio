"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import { updateBarberProfileSchema } from "./schemas";
import type {
 BarberProfileWithUser,
 UpdateBarberProfileInput,
} from "@/types/barber";

async function getOrg() {
 const result = await getActiveOrganization();
 if (!result) throw new Error("Organização não encontrada");
 return result.org;
}

// -----------------------------------------------------------------------------
// GET — Listar profissionais
// -----------------------------------------------------------------------------
export async function getBarbers(): Promise<BarberProfileWithUser[]> {
 const supabase = await createClient();
 const org = await getOrg();

 const { data, error } = await supabase
 .from("employee_profiles")
 .select(
 `
 *,
 membership:memberships!inner(
 user_id,
 role,
 profiles:user_id(
 full_name,
 email,
 avatar_url
 )
 )
 `
 )
 .eq("organization_id", org.id)
 .order("created_at", { ascending: true });

 if (error) throw error;

 return (data ?? []).map((row: any) => ({
 ...row,
 commission_rate: Number(row.commission_rate ?? 0),
 full_name: row.membership?.profiles?.full_name ?? "Sem nome",
 email: row.membership?.profiles?.email ?? "",
 avatar_url: row.membership?.profiles?.avatar_url ?? null,
 role: row.membership?.role ?? "EMPLOYEE",
 }));
}

// -----------------------------------------------------------------------------
// GET — Profissional por ID
// -----------------------------------------------------------------------------
export async function getBarberById(
 id: string
): Promise<BarberProfileWithUser | null> {
 const supabase = await createClient();
 const org = await getOrg();

 const { data, error } = await supabase
 .from("employee_profiles")
 .select(
 `
 *,
 membership:memberships!inner(
 user_id,
 role,
 profiles:user_id(
 full_name,
 email,
 avatar_url
 )
 )
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
 commission_rate: Number(data.commission_rate ?? 0),
 full_name: data.membership?.profiles?.full_name ?? "Sem nome",
 email: data.membership?.profiles?.email ?? "",
 avatar_url: data.membership?.profiles?.avatar_url ?? null,
 role: data.membership?.role ?? "EMPLOYEE",
 };
}

// -----------------------------------------------------------------------------
// UPDATE — Atualizar perfil do profissional
// -----------------------------------------------------------------------------
export async function updateBarberProfile(
 id: string,
 input: UpdateBarberProfileInput
): Promise<BarberProfileWithUser> {
 const parsed = updateBarberProfileSchema.parse(input);
 const supabase = await createClient();
 const org = await getOrg();
 const user = await supabase.auth.getUser();

 const existing = await getBarberById(id);
 if (!existing) {
 throw new Error("Profissional não encontrado");
 }

 const updateData: Record<string, any> = {};
 if (parsed.specialties !== undefined)
 updateData.specialties = parsed.specialties;
 if (parsed.commission_type !== undefined)
 updateData.commission_type = parsed.commission_type;
 if (parsed.commission_rate !== undefined)
 updateData.commission_rate = parsed.commission_rate;
 if (parsed.bio !== undefined) updateData.bio = parsed.bio;
 if (parsed.is_available_for_booking !== undefined)
 updateData.is_available_for_booking = parsed.is_available_for_booking;
 if (parsed.job_title !== undefined)
 updateData.job_title = parsed.job_title;
 if (parsed.professional_phone !== undefined)
 updateData.professional_phone = parsed.professional_phone;

 const { data, error } = await supabase
 .from("employee_profiles")
 .update(updateData)
 .eq("id", id)
 .eq("organization_id", org.id)
 .select(
 `
 *,
 membership:memberships!inner(
 user_id,
 role,
 profiles:user_id(
 full_name,
 email,
 avatar_url
 )
 )
 `
 )
 .single();

 if (error) throw error;

 await supabase.rpc("log_audit", {
 p_org_id: org.id,
 p_actor: user.data.user!.id,
 p_action: "barber_profile_updated",
 p_module: "barber_services",
 p_resource_type: "employee_profile",
 p_resource_id: data.id,
 p_metadata: { changes: Object.keys(updateData) },
 });

 return {
 ...data,
 commission_rate: Number(data.commission_rate ?? 0),
 full_name: data.membership?.profiles?.full_name ?? "Sem nome",
 email: data.membership?.profiles?.email ?? "",
 avatar_url: data.membership?.profiles?.avatar_url ?? null,
 role: data.membership?.role ?? "EMPLOYEE",
 };
}

// -----------------------------------------------------------------------------
// STATS — Estatísticas dos profissionais
// -----------------------------------------------------------------------------
export async function getBarberStats(): Promise<{
 total: number;
 active: number;
 avg_commission: number;
}> {
 const supabase = await createClient();
 const org = await getOrg();

 const { data, error } = await supabase
 .from("employee_profiles")
 .select("is_available_for_booking, commission_rate")
 .eq("organization_id", org.id);

 if (error) throw error;

 const profiles = data ?? [];
 const active = profiles.filter((p: any) => p.is_available_for_booking);

 return {
 total: profiles.length,
 active: active.length,
 avg_commission:
 active.length > 0
 ? active.reduce(
 (sum: number, p: any) => sum + Number(p.commission_rate ?? 0),
 0
 ) / active.length
 : 0,
 };
}