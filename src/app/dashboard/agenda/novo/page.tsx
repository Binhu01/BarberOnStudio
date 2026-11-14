// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "../_components/event-form";
import { getActiveMembers } from "../../tarefas/actions";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";

export default async function NovoAgendamentoPage() {
  await headers();

  const [members, services, customers] = await Promise.all([
    getActiveMembers(),
    (async () => {
      const supabase = await createClient();
      const result = await getActiveOrganization();
      if (!result) return [];
      const { data } = await supabase
        .from("barber_services")
        .select("id, name, duration_minutes, price")
        .eq("organization_id", result.org.id)
        .eq("is_active", true)
        .order("name");
      return (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: Number(s.price ?? 0),
      }));
    })(),
    (async () => {
      const supabase = await createClient();
      const result = await getActiveOrganization();
      if (!result) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name")
        .limit(200);
      return (data ?? []).map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        phone: c.phone ?? null,
      }));
    })(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/agenda"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para agenda
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Novo agendamento
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Crie um agendamento vinculando serviço, profissional e cliente.
        </p>
      </div>

      <EventForm members={members} services={services} customers={customers} />
    </div>
  );
}