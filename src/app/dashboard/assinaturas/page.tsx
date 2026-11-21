// This page uses dynamic server data
export const instant = false;

import { Metadata } from "next";
import { DashboardShell } from "../shell";
import { getActiveOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SubscriptionManager } from "./_components/subscription-manager";
import { getSubscriptionPlans, getClientSubscriptions, getSubscriptionSummary, getExpiringSubscriptions } from "./actions";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

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

  const [plans, subscriptions, summary, expiringSubs] = await Promise.all([
    getSubscriptionPlans(),
    getClientSubscriptions(),
    getSubscriptionSummary(),
    getExpiringSubscriptions(3),
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

        {/* Expiring Subscriptions Alert */}
        {expiringSubs.length > 0 && (
          <div className="rounded-xl border border-barber-warning/30 bg-barber-warning/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-barber-warning" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-barber-warning">
                  ⚠️ {expiringSubs.length} assinatura{expiringSubs.length !== 1 ? "s" : ""} vencendo em até 3 dias
                </h3>
                <ul className="mt-2 space-y-1">
                  {expiringSubs.map((sub) => (
                    <li key={sub.id} className="text-sm text-barber-light">
                      <span className="font-medium text-barber-white">
                        {sub.customer_name ?? "Cliente"}
                      </span>{" "}
                      — {sub.plan_name ?? "Plano"}{" "}
                      <span className="text-barber-muted">
                        (vence em {sub.days_remaining} dia{sub.days_remaining !== 1 ? "s" : ""} —{" "}
                        {new Date(sub.current_period_end).toLocaleDateString("pt-BR")})
                      </span>
                      {!sub.auto_renew && (
                        <span className="ml-1 text-xs font-medium text-barber-error">
                          · Renovação automática desativada
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard/notificacoes"
                  className="mt-2 inline-block text-xs font-medium text-barber-gold hover:text-barber-copper"
                >
                  Ver notificações →
                </Link>
              </div>
            </div>
          </div>
        )}

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