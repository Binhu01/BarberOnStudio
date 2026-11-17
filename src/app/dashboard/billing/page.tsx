import { redirect } from "next/navigation";
import {
  CreditCard,
  FileText,
  Activity,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getMySubscription,
  getMyInvoices,
  getMyUsageSummary,
  getMySupportTickets,
  getMySubscriptionEvents,
} from "./actions";

export const instant = false;

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "bg-barber-success/10 text-barber-success" },
  trialing: { label: "Teste grátis", color: "bg-barber-gold/10 text-barber-gold" },
  past_due: { label: "Pagamento pendente", color: "bg-barber-warning/10 text-barber-warning" },
  grace_period: { label: "Período de carência", color: "bg-barber-copper/10 text-barber-copper" },
  paused: { label: "Pausada", color: "bg-barber-muted/10 text-barber-muted" },
  canceled: { label: "Cancelada", color: "bg-barber-error/10 text-barber-error" },
  expired: { label: "Expirada", color: "bg-barber-error/10 text-barber-error" },
  incomplete: { label: "Incompleta", color: "bg-barber-warning/10 text-barber-warning" },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-barber-warning" },
  approved: { label: "Aprovada", color: "text-barber-success" },
  refused: { label: "Recusada", color: "text-barber-error" },
  processing: { label: "Processando", color: "text-barber-gold" },
  refunded: { label: "Reembolsada", color: "text-barber-muted" },
  cancelled: { label: "Cancelada", color: "text-barber-muted" },
};

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const [subscription, invoices, usageSummary, tickets, events] = await Promise.all([
    getMySubscription(),
    getMyInvoices(),
    getMyUsageSummary(),
    getMySupportTickets(),
    getMySubscriptionEvents(),
  ]);

  const statusInfo = subscription
    ? STATUS_LABELS[subscription.status] ?? { label: subscription.status, color: "bg-barber-muted/10 text-barber-muted" }
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-barber-white">Minha Assinatura</h1>
        <p className="mt-1 text-sm text-barber-muted">
          Gerencie seu plano, faturas e uso da plataforma.
        </p>
      </div>

      {!subscription ? (
        /* No subscription state */
        <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite p-12 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-barber-muted/50" />
          <h3 className="mt-4 text-lg font-semibold text-barber-white">
            Nenhuma assinatura ativa
          </h3>
          <p className="mt-2 text-sm text-barber-muted">
            Sua organização ainda não possui um plano ativo. Escolha um plano para começar.
          </p>
          <a
            href="/planos"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-barber-gold px-6 py-2.5 text-sm font-semibold text-barber-white transition hover:bg-barber-copper"
          >
            Ver planos
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <>
          {/* Subscription Overview Card */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm md:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-barber-white">
                      {subscription.plan_name}
                    </h2>
                    {statusInfo && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-barber-muted">
                    Cobrança {subscription.billing_interval === "annual" ? "anual" : "mensal"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-barber-white">
                    {subscription.monthly_price === 0
                      ? "Grátis"
                      : BRL.format(subscription.monthly_price)}
                  </p>
                  {subscription.monthly_price > 0 && (
                    <p className="text-xs text-barber-muted">/mês</p>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-barber-border pt-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-barber-muted">Início do ciclo</p>
                  <p className="mt-1 text-sm font-medium text-barber-white">
                    {subscription.current_period_start
                      ? new Date(subscription.current_period_start).toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-barber-muted">Próxima cobrança</p>
                  <p className="mt-1 text-sm font-medium text-barber-white">
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-barber-muted">Trial</p>
                  <p className="mt-1 text-sm font-medium text-barber-white">
                    {subscription.trial_end
                      ? `Até ${new Date(subscription.trial_end).toLocaleDateString("pt-BR")}`
                      : "Sem trial"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-barber-muted">Assinatura desde</p>
                  <p className="mt-1 text-sm font-medium text-barber-white">
                    {new Date(subscription.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
                    <Activity className="h-5 w-5 text-barber-gold" />
                  </div>
                  <div>
                    <p className="text-xs text-barber-muted">Status</p>
                    <p className="text-sm font-semibold text-barber-white">{statusInfo?.label}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-cyan/10">
                    <FileText className="h-5 w-5 text-barber-cyan" />
                  </div>
                  <div>
                    <p className="text-xs text-barber-muted">Faturas pendentes</p>
                    <p className="text-sm font-semibold text-barber-white">
                      {invoices.filter((i) => i.status === "pending").length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-copper/10">
                    <MessageSquare className="h-5 w-5 text-barber-copper" />
                  </div>
                  <div>
                    <p className="text-xs text-barber-muted">Tickets abertos</p>
                    <p className="text-sm font-semibold text-barber-white">
                      {tickets.filter((t) => t.status === "open" || t.status === "in_progress").length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Quotas */}
          {usageSummary.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-barber-white">
                <TrendingUp className="h-5 w-5 text-barber-gold" />
                Uso do período
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {usageSummary.map((u) => {
                  const pct = u.percentage ?? 0;
                  const isWarning = pct >= 80;
                  const isDanger = pct >= 95;

                  return (
                    <div
                      key={u.feature_key}
                      className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-barber-white">
                          {u.feature_key.split(".").pop()?.replace(/_/g, " ") ?? u.feature_key}
                        </p>
                        {isDanger && <AlertTriangle className="h-4 w-4 text-barber-error" />}
                        {isWarning && !isDanger && <Clock className="h-4 w-4 text-barber-warning" />}
                      </div>
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-2xl font-bold text-barber-white">{u.current_usage}</span>
                        <span className="mb-1 text-sm text-barber-muted">
                          / {u.limit === null || u.limit === 0 ? "∞" : u.limit}
                        </span>
                      </div>
                      {u.limit !== null && u.limit > 0 && (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-barber-dark">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isDanger
                                ? "bg-barber-error"
                                : isWarning
                                  ? "bg-barber-warning"
                                  : "bg-barber-cyan"
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-barber-white">
              <FileText className="h-5 w-5 text-barber-gold" />
              Faturas recentes
            </h3>
            {invoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite p-8 text-center">
                <p className="text-sm text-barber-muted">Nenhuma fatura emitida ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-barber-border bg-barber-dark">
                      <th className="px-4 py-3 text-left font-semibold text-barber-white">Vencimento</th>
                      <th className="px-4 py-3 text-left font-semibold text-barber-white">Valor</th>
                      <th className="px-4 py-3 text-left font-semibold text-barber-white">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-barber-white">Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 10).map((inv) => {
                      const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, color: "text-barber-muted" };
                      return (
                        <tr key={inv.id} className="border-b border-barber-border last:border-0">
                          <td className="px-4 py-3 text-barber-white">
                            {new Date(inv.due_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 font-medium text-barber-white">
                            {BRL.format(inv.amount)}
                          </td>
                          <td className={`px-4 py-3 font-medium ${st.color}`}>{st.label}</td>
                          <td className="px-4 py-3 text-barber-muted">
                            {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("pt-BR") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Events Timeline */}
          {events.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-barber-white">
                <Clock className="h-5 w-5 text-barber-gold" />
                Histórico da assinatura
              </h3>
              <div className="space-y-3">
                {events.slice(0, 10).map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-3 rounded-lg border border-barber-border bg-barber-graphite p-4 shadow-sm"
                  >
                    {evt.event_type.includes("payment_received") || evt.event_type.includes("activated") ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-barber-success" />
                    ) : evt.event_type.includes("failed") || evt.event_type.includes("canceled") ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-barber-error" />
                    ) : evt.event_type.includes("upgrade") ? (
                      <ArrowUpRight className="mt-0.5 h-5 w-5 shrink-0 text-barber-gold" />
                    ) : evt.event_type.includes("downgrade") ? (
                      <ArrowDownRight className="mt-0.5 h-5 w-5 shrink-0 text-barber-warning" />
                    ) : (
                      <Activity className="mt-0.5 h-5 w-5 shrink-0 text-barber-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-barber-white">
                        {evt.event_type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-barber-muted">
                        {new Date(evt.occurred_at).toLocaleString("pt-BR")} · Fonte: {evt.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}