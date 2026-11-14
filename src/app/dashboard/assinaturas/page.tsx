// This page uses dynamic server data
export const instant = false;

import { Metadata } from "next";
import { DashboardShell } from "../shell";
import { getActiveOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SubscriptionManager } from "./_components/subscription-manager";
import { getSubscriptionPlans, getClientSubscriptions, getSubscriptionSummary } from "./actions";

export const metadata: Metadata = {
  title: "Assinaturas | Barber-On Studio",
  description: "Gerencie planos de assinatura e assinaturas de clientes",
};

export default async function AssinaturasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgResult = await getActiveOrganization();
  if (!orgResult) redirect("/onboarding");

  const [plans, subscriptions, summary] = await Promise.all([
    getSubscriptionPlans(),
    getClientSubscriptions(),
    getSubscriptionSummary(),
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
              Assinaturas
            </h1>
            <p className="mt-1 text-sm text-barber-muted">
              Gerencie planos mensais e assinaturas dos seus clientes
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Ativas
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-gold">
              {summary.total_active}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Receita Mensal
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-green">
              R$ {summary.monthly_revenue.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Renovações (7d)
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-copper">
              {summary.upcoming_renewals_7d}
            </p>
          </div>
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-barber-muted">
              Média Serviços/Período
            </p>
            <p className="mt-1 text-2xl font-bold text-barber-white">
              {summary.avg_services_used.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <SubscriptionManager
          plans={plans}
          subscriptions={subscriptions}
          summary={summary}
        />
      </div>
    </DashboardShell>
  );
}