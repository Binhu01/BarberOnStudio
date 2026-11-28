// This page uses dynamic server data

import { Metadata } from "next";
import { DashboardShell } from "../shell";
import { getActiveOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReactivationManager } from "./_components/reactivation-manager";
import { getReactivationCampaigns, getInactiveCustomers } from "./actions";

export const metadata: Metadata = {
  title: "Reativar Clientes | Barber-On Studio",
  description: "Campanhas de reativação para clientes inativos",
};

export default async function ReativarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgResult = await getActiveOrganization();
  if (!orgResult) redirect("/onboarding");

  const [campaigns, inactiveCustomers] = await Promise.all([
    getReactivationCampaigns(),
    getInactiveCustomers(30),
  ]);

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
              Reativar Clientes
            </h1>
            <p className="mt-1 text-sm text-barber-muted">
              Crie campanhas para trazer de volta clientes que não visitam há algum tempo
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Clientes Inativos (30d)
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-copper">
              {inactiveCustomers.length}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Campanhas Criadas
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-white">
              {campaigns.length}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Campanhas Concluídas
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-green">
              {campaigns.filter((c) => c.status === "completed").length}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Total Enviado
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-gold">
              {campaigns.reduce((sum, c) => sum + c.sent_count, 0)}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <ReactivationManager
          campaigns={campaigns}
          inactiveCustomers={inactiveCustomers}
        />
      </div>
    </DashboardShell>
  );
}