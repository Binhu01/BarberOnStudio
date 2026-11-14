import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({
      error: "Variáveis de ambiente do Supabase não configuradas",
      hasUrl: !!url,
      hasAnonKey: !!anonKey,
    });
  }

  const supabase = createClient(url, anonKey);
  const results: Record<string, unknown> = {};

  // Test 1: organizations
  const orgs = await supabase.from("organizations").select("id, name, slug").limit(5);
  results.organizations = {
    count: orgs.data?.length ?? 0,
    data: orgs.data,
    error: orgs.error?.message ?? null,
  };

  // Test 2: barber_services
  const services = await supabase
    .from("barber_services")
    .select("id, name, price, is_active, organization_id")
    .limit(20);
  results.barber_services = {
    count: services.data?.length ?? 0,
    data: services.data,
    error: services.error?.message ?? null,
  };

  // Test 3: memberships
  const members = await supabase.from("memberships").select("user_id, role, organization_id").limit(10);
  results.memberships = {
    count: members.data?.length ?? 0,
    data: members.data,
    error: members.error?.message ?? null,
  };

  // Test 4: profiles
  const profiles = await supabase.from("profiles").select("id, full_name").limit(10);
  results.profiles = {
    count: profiles.data?.length ?? 0,
    data: profiles.data,
    error: profiles.error?.message ?? null,
  };

  // Test 5: barbershop_settings
  const settings = await supabase.from("barbershop_settings").select("*").limit(5);
  results.barbershop_settings = {
    count: settings.data?.length ?? 0,
    data: settings.data,
    error: settings.error?.message ?? null,
  };

  // Test 6: products
  const products = await supabase.from("products").select("id, name, price").limit(10);
  results.products = {
    count: products.data?.length ?? 0,
    data: products.data,
    error: products.error?.message ?? null,
  };

  return NextResponse.json(results);
}