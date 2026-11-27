// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMySubscription, getActivePlans } from "../actions";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function RenewSubscriptionPage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const [subscription, plans] = await Promise.all([
    getMySubscription().catch(() => null),
    getActivePlans().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-1.5 text-sm text-barber-muted transition-colors hover:text-barber-gold"
        >
          <ArrowLeft size={16} />
          Voltar à Assinatura
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Renovar / Alterar Plano
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Escolha um plano para renovar ou alterar sua assinatura atual.
        </p>
      </div>

      {/* Current Plan */}
      {subscription && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-barber-gold" />
            <h2 className="text-lg font-semibold text-barber-white">Plano atual</h2>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-barber-white">{subscription.plan_name}</p>
              <p className="text-xs text-barber-muted">
                {subscription.billing_interval === "annual" ? "Cobrança anual" : "Cobrança mensal"} ·{" "}
                {subscription.monthly_price === 0
                  ? "Grátis"
                  : `${BRL.format(subscription.monthly_price)}/mês`}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                subscription.status === "active"
                  ? "bg-barber-success/10 text-barber-success"
                  : subscription.status === "past_due"
                    ? "bg-barber-warning/10 text-barber-warning"
                    : "bg-barber-muted/10 text-barber-muted"
              }`}
            >
              {subscription.status === "active"
                ? "Ativa"
                : subscription.status === "past_due"
                  ? "Pagamento pendente"
                  : subscription.status}
            </span>
          </div>
          {subscription.current_period_end && (
            <p className="mt-3 text-xs text-barber-muted">
              Próxima cobrança: {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {/* Available Plans */}
      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite p-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-barber-muted/50" />
          <h3 className="mt-4 text-lg font-semibold text-barber-white">
            Nenhum plano disponível
          </h3>
          <p className="mt-2 text-sm text-barber-muted">
            Não há planos ativos no momento. Entre em contato com o suporte.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_slug === plan.slug;
            const version = plan.current_version;
            const price = version?.monthly_price ?? 0;

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 shadow-sm transition-all ${
                  isCurrentPlan
                    ? "border-barber-gold bg-barber-gold/5"
                    : "border-barber-border bg-barber-graphite hover:border-barber-gold/30"
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-barber-gold px-3 py-0.5 text-xs font-bold text-barber-white">
                    Plano atual
                  </div>
                )}

                <h3 className="text-lg font-bold text-barber-white">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-barber-muted">{plan.description}</p>
                )}

                <div className="mt-4">
                  <span className="text-3xl font-bold text-barber-white">
                    {price === 0 ? "Grátis" : BRL.format(price)}
                  </span>
                  {price > 0 && <span className="text-sm text-barber-muted">/mês</span>}
                </div>

                {version?.annual_price !== undefined && version.annual_price > 0 && (
                  <p className="mt-1 text-xs text-barber-muted">
                    ou {BRL.format(version.annual_price)}/ano
                  </p>
                )}

                {isCurrentPlan ? (
                  <button
                    disabled
                    className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-barber-gold/30 bg-barber-gold/10 px-4 py-2.5 text-sm font-semibold text-barber-gold"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Plano ativo
                  </button>
                ) : (
                  <Link
                    href="/dashboard/billing"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-barber-gold px-4 py-2.5 text-sm font-semibold text-barber-white transition hover:bg-barber-copper"
                  >
                    Selecionar plano
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-xl border border-barber-border bg-barber-dark/30 p-6">
        <h3 className="text-sm font-semibold text-barber-white">Como funciona a renovação?</h3>
        <ul className="mt-3 space-y-2 text-sm text-barber-muted">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
            A renovação é automática ao final de cada ciclo de cobrança.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
            Para alterar de plano, selecione o plano desejado acima.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
            O pagamento é feito via PIX/transferência mensal ao administrador.
          </li>
        </ul>
      </div>
    </div>
  );
}