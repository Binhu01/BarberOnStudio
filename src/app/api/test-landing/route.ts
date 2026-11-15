import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function summarize(result: any) {
  return {
    success: !result.error,
    count: result.data?.length ?? 0,
    error: result.error
      ? {
          code: result.error.code ?? null,
          message: result.error.message,
          details: result.error.details ?? null,
          hint: result.error.hint ?? null,
        }
      : null,
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { success: false, step: "environment", message: "Variáveis do Supabase não configuradas." },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Organização
    const orgResult = await supabase
      .from("organizations")
      .select("id, name, slug")
      .limit(5);

    if (orgResult.error || !orgResult.data?.length) {
      return NextResponse.json({
        success: false,
        step: "organizations",
        ...summarize(orgResult),
      });
    }

    const org = orgResult.data[0];
    const orgId = org.id;

    // 2. Memberships
    const membersResult = await supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", orgId);

    const members = membersResult.data ?? [];
    const memberIds = [...new Set(members.map((m: any) => m.user_id))];

    // 3. Profiles — consulta BÁSICA (como /api/diag)
    const profilesBasic = memberIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
      : { data: [], error: null };

    // 4. Profiles — consulta EXATA da landing page (com avatar_url e order)
    const profilesExact = memberIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", memberIds)
          .order("full_name")
      : { data: [], error: null };

    // 5. Services — consulta BÁSICA (como /api/diag)
    const servicesBasic = await supabase
      .from("barber_services")
      .select("id, name, price, is_active, organization_id")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    // 6. Services — consulta EXATA da landing page (com description, duration, image, display_order)
    const servicesExact = await supabase
      .from("barber_services")
      .select("id, name, description, price, duration_minutes, image_url")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name");

    // 7. Services — consulta INTERMEDIÁRIA (sem display_order, com as outras colunas)
    const servicesNoOrder = await supabase
      .from("barber_services")
      .select("id, name, description, price, duration_minutes, image_url")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name");

    // 8. Products
    const productsResult = await supabase
      .from("products")
      .select("id, name, description, sale_price, image_url")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name")
      .limit(8);

    // 9. Settings
    const settingsResult = await supabase
      .from("barbershop_settings")
      .select("*")
      .eq("organization_id", orgId)
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        organization: { id: orgId, name: org.name, slug: org.slug },
        memberships: { ...summarize(membersResult), uniqueMemberIds: memberIds.length },
        profiles: {
          basic: summarize(profilesBasic),
          exact: summarize(profilesExact),
          profilesWithoutName: (profilesBasic.data ?? []).filter(
            (p: any) => !p.full_name?.trim()
          ).length,
        },
        services: {
          basic: summarize(servicesBasic),
          exact: summarize(servicesExact),
          noOrder: summarize(servicesNoOrder),
        },
        products: summarize(productsResult),
        settings: summarize(settingsResult),
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        step: "unexpected",
        message: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}