export const instant = false;

import { connection } from "next/server";
import { CreditCard, Plus, Users, Star, CheckCircle2 } from "lucide-react";
import { getSubscriptionPlans } from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function AssinaturasPlanosPage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const plans = await getSubscriptionPlans().catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Planos de Assinatura</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie os planos disponíveis para seus clientes
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper">
          <Plus className="h-4 w-4" />
          Novo Plano
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-16 text-center shadow-sm">
          <CreditCard className="mb-3 h-10 w-10 text-barber-muted/40" />
          <p className="text-sm font-medium text-barber-white">Nenhum plano cadastrado</p>
          <p className="mt-1 text-xs text-barber-muted">
            Crie planos de assinatura para oferecer benefícios recorrentes aos clientes
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: any) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-5 shadow-sm transition-all ${
                plan.is_active
                  ? "border-barber-border bg-barber-graphite hover:border-barber-gold/40 hover:shadow-md"
                  : "border-dashed border-barber-border/60 bg-barber-graphite/50 opacity-60"
              }`}
            >
              {plan.is_popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-barber-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-barber-white">
                  Popular
                </span>
              )}

              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-barber-white">{plan.name}</h3>
                {plan.is_active ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <span className="rounded bg-barber-border/40 px-2 py-0.5 text-[10px] font-medium text-barber-muted">
                    Inativo
                  </span>
                )}
              </div>

              <div className="mt-3">
                <span className="text-3xl font-bold text-barber-white">
                  {brl.format(plan.price ?? 0)}
                </span>
                <span className="text-sm text-barber-muted">/{plan.billing_cycle ?? "mês"}</span>
              </div>

              {plan.description && (
                <p className="mt-2 text-xs leading-relaxed text-barber-muted">
                  {plan.description}
                </p>
              )}

              {/* Benefits Preview */}
              {plan.benefits_preview && (
                <ul className="mt-4 space-y-1.5">
                  {plan.benefits_preview.slice(0, 4).map((benefit: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-barber-white">
                      <Star className="mt-0.5 h-3 w-3 shrink-0 text-barber-gold" />
                      <span className="line-clamp-1">{benefit}</span>
                    </li>
                  ))}
                  {plan.benefits_preview.length > 4 && (
                    <li className="text-[10px] text-barber-muted">
                      +{plan.benefits_preview.length - 4} mais benefícios
                    </li>
                  )}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-barber-border/50 pt-3">
                <div className="flex items-center gap-1 text-xs text-barber-muted">
                  <Users className="h-3 w-3" />
                  {plan.active_subscribers ?? 0} ativos
                </div>
                <button className="text-xs font-medium text-barber-gold hover:text-barber-copper">
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}