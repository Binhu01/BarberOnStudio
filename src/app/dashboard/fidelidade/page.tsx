// This page uses dynamic server data

import { Metadata } from "next";
import { DashboardShell } from "../shell";
import { getActiveOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoyaltyManager } from "./_components/loyalty-manager";
import { getLoyaltyPrograms, getLoyaltyCards, getLoyaltySummary } from "./actions";

export const metadata: Metadata = {
  title: "Fidelidade | Barber-On Studio",
  description: "Gerencie programas de fidelidade e cartões de clientes",
};

export default async function FidelidadePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgResult = await getActiveOrganization();
  if (!orgResult) redirect("/onboarding");

  // Buscar clientes para formulário de criação de cartão
  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .order("full_name");

  const [programs, cards, summary] = await Promise.all([
    getLoyaltyPrograms(),
    getLoyaltyCards(),
    getLoyaltySummary(),
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
              Fidelidade
            </h1>
            <p className="mt-1 text-sm text-barber-muted">
              Programas de pontos, cartões e recompensas para seus clientes
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Programas Ativos
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-gold">
              {summary.total_programs}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Cartões Ativos
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-white">
              {summary.active_cards}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Pontos Emitidos
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-copper">
              {summary.total_points_issued.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Média Pontos/Cartão
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-white">
              {summary.avg_points_per_card.toFixed(0)}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Resgates (mês)
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-green">
              {summary.redemptions_this_month}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <LoyaltyManager
          programs={programs}
          cards={cards}
          customers={customers ?? []}
          summary={summary}
        />
      </div>
    </DashboardShell>
  );
}