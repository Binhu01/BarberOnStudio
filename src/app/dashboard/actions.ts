"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdminClient } from "@/lib/supabase/admin";

export async function switchOrganization(organizationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Usuário não autenticado." };
  }

  // Verify membership — tenta admin client primeiro, fallback para anon
  let membership: { id: string } | null = null;

  const adminSupabase = createAdminClient();
  if (adminSupabase) {
    const { data } = await adminSupabase
      .from("memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    membership = data ?? null;
  }

  // Fallback: verificar via anon client (RLS permite leitura da própria membership)
  if (!membership) {
    const { data } = await supabase
      .from("memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    membership = data ?? null;
  }

  if (!membership) {
    return { error: "Você não tem acesso a esta organização." };
  }

  const cookieStore = await cookies();
  cookieStore.set("barber_active_org", organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return { success: true };
}