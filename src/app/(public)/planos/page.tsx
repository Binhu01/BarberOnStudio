import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, Sparkles, ArrowRight } from "lucide-react";
import { getActivePlans, getPlanEntitlements } from "@/app/dashboard/billing/actions";

export const instant = false;

export const metadata: Metadata = {
  title: "Planos e Preços — Barber-On Studio",
  description:
    "Escolha o plano ideal para sua barbearia. Do profissional solo à rede de unidades, o Barber-On escala com você.",
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Feature labels for the comparison table
const FEATURE_LABELS: Record<string, string> = {
  "team.users": "Usuários na equipe",
  "team.owners": "Proprietários",
  "crm.customers": "Clientes no CRM",
  "crm.leads": "Leads no funil",
  "sales.orders": "Pedidos por mês",
  "inventory.products": "Produtos cadastrados",
  "inventory.warehouses": "Depósitos / locais",
  "finance.receivables": "Contas a receber",
  "finance.payables": "Contas a pagar",
  "reports.basic": "Relatórios básicos",
  "reports.advanced": "Relatórios avançados",
  "ai.assistant": "Assistente IA",
  "integrations.whatsapp": "Integração WhatsApp",
  "integrations.instagram": "Integração Instagram",
  "automations.rules": "Regras de automação",
};

function formatLimit(value: number | null, unit: string | null): string {
  if (value === null || value === 0) return "Ilimitado";
  if (unit === "users" || unit === "items") return String(value);
  if (unit === "month") return `${value}/mês`;
  return String(value);
}

export default async function PlanosPage() {
  const plans = await getActivePlans();

  // Fetch entitlements for each plan's current version
  const plansWithEntitlements = await Promise.all(
    plans.map(async (plan) => {
      const entitlements = plan.current_version
        ? await getPlanEntitlements(plan.current_version.id)
        : [];
      return { ...plan, entitlements };
    }),
  );

  // Collect all feature keys across plans for comparison
  const allFeatureKeys = Array.from(
    new Set(
      plansWithEntitlements.flatMap((p) =>
        p.entitlements.map((e) => e.feature_key),
      ),
    ),
  ).sort();

  return (
    <div className="min-h-screen bg-barber-dark">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-barber-dark via-barber-graphite to-barber-dark py-24 text-barber-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-barber-gold blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-barber-copper blur-[128px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-barber-gold/30 bg-barber-gold/10 px-4 py-1.5 text-sm font-medium text-barber-gold">
            <Sparkles className="h-4 w-4" />
            Gestão premium para barbearias
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-barber-white md:text-6xl">
            O plano certo para sua barbearia
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-barber-muted">
            Comece grátis e escale conforme sua barbearia cresce. Sem surpresas,
            sem contratos longos, cancele quando quiser.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-8 py-3.5 text-base font-semibold text-barber-dark transition hover:bg-barber-copper"
            >
              Começar grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-8 py-3.5 text-base font-semibold text-barber-white transition hover:bg-barber-graphite"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {plansWithEntitlements.map((plan) => {
            const isFeatured = plan.is_featured;
            const price = plan.current_version?.monthly_price ?? 0;
            const annualPrice = plan.current_version?.annual_price ?? 0;
            const trialDays = plan.current_version?.trial_days ?? 0;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  isFeatured
                    ? "border-barber-gold bg-barber-graphite shadow-xl ring-1 ring-barber-gold/30"
                    : "border-barber-border bg-barber-graphite shadow-sm"
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-barber-gold px-4 py-1 text-xs font-bold uppercase tracking-wide text-barber-dark">
                    Mais popular
                  </div>
                )}

                <h3 className="text-xl font-bold text-barber-white">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-barber-muted">
                  {plan.description ?? "Para barbearias que estão começando."}
                </p>

                <div className="mt-6">
                  <span className="text-4xl font-bold text-barber-white">
                    {price === 0 ? "Grátis" : BRL.format(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-sm text-barber-muted">/mês</span>
                  )}
                </div>

                {annualPrice > 0 && (
                  <p className="mt-1 text-xs text-barber-muted">
                    ou {BRL.format(annualPrice / 12)}/mês no plano anual
                  </p>
                )}

                {trialDays > 0 && (
                  <p className="mt-2 text-xs font-medium text-barber-gold">
                    {trialDays} dias grátis para testar
                  </p>
                )}

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.entitlements
                    .filter((e) => e.is_enabled)
                    .slice(0, 8)
                    .map((e) => (
                      <li
                        key={e.feature_key}
                        className="flex items-start gap-3 text-sm text-barber-muted"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-barber-gold" />
                        <span>
                          <span className="font-medium text-barber-white">
                            {formatLimit(e.limit_value, e.limit_unit)}
                          </span>{" "}
                          {FEATURE_LABELS[e.feature_key] ?? e.feature_key}
                        </span>
                      </li>
                    ))}
                </ul>

                <Link
                  href="/cadastro"
                  className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition ${
                    isFeatured
                      ? "bg-barber-gold text-barber-dark hover:bg-barber-copper"
                      : "border border-barber-border bg-barber-dark text-barber-white hover:bg-barber-graphite"
                  }`}
                >
                  {price === 0 ? "Começar grátis" : "Começar teste grátis"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-bold text-barber-white">
          Compare os planos em detalhe
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-barber-border bg-barber-graphite shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-barber-border bg-barber-dark">
                <th className="px-6 py-4 text-left font-semibold text-barber-white">
                  Recurso
                </th>
                {plansWithEntitlements.map((plan) => (
                  <th
                    key={plan.id}
                    className={`px-6 py-4 text-center font-semibold ${
                      plan.is_featured ? "text-barber-gold" : "text-barber-white"
                    }`}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatureKeys.map((key, i) => (
                <tr
                  key={key}
                  className={
                    i % 2 === 0 ? "bg-barber-graphite" : "bg-barber-dark/50"
                  }
                >
                  <td className="px-6 py-3 font-medium text-barber-white">
                    {FEATURE_LABELS[key] ?? key}
                  </td>
                  {plansWithEntitlements.map((plan) => {
                    const ent = plan.entitlements.find(
                      (e) => e.feature_key === key,
                    );
                    if (!ent || !ent.is_enabled) {
                      return (
                        <td key={plan.id} className="px-6 py-3 text-center">
                          <X className="mx-auto h-4 w-4 text-barber-muted/30" />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={plan.id}
                        className="px-6 py-3 text-center font-medium text-barber-white"
                      >
                        {formatLimit(ent.limit_value, ent.limit_unit)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="border-t border-barber-border bg-barber-graphite/30 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-barber-white">
            Ainda tem dúvidas?
          </h2>
          <p className="mt-4 text-barber-muted">
            Nossa equipe está pronta para ajudar você a escolher o melhor plano
            para sua barbearia.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-barber-border px-6 py-3 text-sm font-semibold text-barber-white transition hover:bg-barber-graphite"
          >
            Falar com um especialista
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}