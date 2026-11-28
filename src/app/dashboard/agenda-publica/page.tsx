// This page uses dynamic server data

import { Metadata } from "next";
import { DashboardShell } from "../shell";
import { getActiveOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PublicAgendaManager } from "./_components/public-agenda-manager";
import { getBarbershopSettings } from "../bloqueios/actions";

export const metadata: Metadata = {
  title: "Agenda Pública | Barber-On Studio",
  description: "Configure o agendamento online da sua barbearia",
};

export default async function AgendaPublicaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgResult = await getActiveOrganization();
  if (!orgResult) redirect("/onboarding");

  // Buscar serviços e profissionais ativos para exibição
  const [services, barbers] = await Promise.all([
    supabase
      .from("barber_services")
      .select("id, name, price, duration_minutes")
      .eq("organization_id", orgResult.org.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        (
          await supabase
            .from("memberships")
            .select("user_id")
            .eq("organization_id", orgResult.org.id)
        ).data?.map((m: any) => m.user_id) ?? []
      ),
  ]);

  const settings = await getBarbershopSettings();

  return (
    <DashboardShell
      user={{
        id: user.id,
        name: user.user_metadata?.full_name ?? null,
        email: user.email!,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }}
      activeOrg={{
        id: orgResult.org.id,
        name: orgResult.org.name,
        slug: orgResult.org.slug,
        role: (orgResult.org as any).role ?? "OWNER",
      }}
      allOrgs={orgResult.allOrgs}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-barber-white">
              Agenda Pública
            </h1>
            <p className="mt-1 text-sm text-barber-muted">
              Configure como os clientes agendam online pela sua página pública
            </p>
          </div>
          {settings?.booking_enabled && orgResult.org.slug && (
            <a
              href={`/agendar/${orgResult.org.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-barber-gold/30 px-4 py-2 text-sm font-medium text-barber-gold transition-colors hover:bg-barber-gold/10"
            >
              🔗 Ver página pública
            </a>
          )}
        </div>

        {/* Main Content */}
        <PublicAgendaManager
          settings={settings}
          services={services.data ?? []}
          barbers={barbers.data ?? []}
          orgSlug={orgResult.org.slug}
        />
      </div>
    </DashboardShell>
  );
}