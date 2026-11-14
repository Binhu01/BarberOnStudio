"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  RefreshCw,
  Calendar,
  Users,
  TrendingUp,
  CreditCard,
  Pause,
  Play,
  XCircle,
  Check,
  AlertTriangle,
  ChevronDown,
  Search,
} from "lucide-react";
import type {
  SubscriptionPlan,
  ClientSubscription,
  SubscriptionSummary,
} from "@/types/subscription";
import {
  createClientSubscription,
  updateClientSubscription,
  processRenewals,
} from "../../assinaturas/actions";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface Props {
  plans: SubscriptionPlan[];
  subscriptions: ClientSubscription[];
  customers: Customer[];
  summary: SubscriptionSummary;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "text-barber-green bg-barber-green/10" },
  trial: { label: "Trial", color: "text-barber-copper bg-barber-copper/10" },
  paused: { label: "Pausada", color: "text-yellow-400 bg-yellow-400/10" },
  cancelled: { label: "Cancelada", color: "text-barber-error bg-barber-error/10" },
  expired: { label: "Expirada", color: "text-barber-muted bg-barber-muted/10" },
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

export function RecurrenceManager({ plans, subscriptions, customers, summary }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // New subscription form state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [autoRenew, setAutoRenew] = useState(true);
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");

  function resetForm() {
    setSelectedCustomerId("");
    setSelectedPlanId("");
    setPaymentMethod("pix");
    setAutoRenew(true);
    setNotes("");
    setStartDate("");
    setShowForm(false);
  }

  async function handleCreateSubscription() {
    if (!selectedCustomerId || !selectedPlanId) return;

    startTransition(async () => {
      try {
        await createClientSubscription({
          customer_profile_id: selectedCustomerId,
          subscription_plan_id: selectedPlanId,
          payment_method: paymentMethod as any,
          auto_renew: autoRenew,
          notes: notes || null,
          start_date: startDate || undefined,
        });
        resetForm();
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao criar assinatura");
      }
    });
  }

  async function handleProcessRenewals() {
    if (!confirm("Processar renovações de assinaturas vencidas?")) return;
    startTransition(async () => {
      try {
        const result = await processRenewals();
        alert(`Renovadas: ${result.renewed_count}, Expiradas: ${result.expired_count}`);
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao processar renovações");
      }
    });
  }

  async function handleUpdateStatus(subId: string, status: "active" | "paused" | "cancelled") {
    const reason = status === "cancelled" ? prompt("Motivo do cancelamento:") : null;
    if (status === "cancelled" && reason === null) return;

    startTransition(async () => {
      try {
        await updateClientSubscription(subId, {
          status,
          cancellation_reason: reason ?? undefined,
        });
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao atualizar assinatura");
      }
    });
  }

  // Filter subscriptions
  const filtered = subscriptions.filter((sub) => {
    if (filterStatus !== "all" && sub.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const name = (sub.customer_name ?? "").toLowerCase();
      const plan = (sub.plan_name ?? "").toLowerCase();
      if (!name.includes(term) && !plan.includes(term)) return false;
    }
    return true;
  });

  // Upcoming renewals (next 30 days)
  const upcomingRenewals = subscriptions
    .filter((s) => s.status === "active" && s.next_billing_date)
    .sort((a, b) => (a.next_billing_date ?? "").localeCompare(b.next_billing_date ?? ""))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleProcessRenewals}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            Processar Renovações
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
        >
          <Plus className="h-4 w-4" />
          Nova Assinatura
        </button>
      </div>

      {/* New Subscription Form */}
      {showForm && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
          <h3 className="mb-4 text-base font-semibold text-barber-white">
            Nova Assinatura de Cliente
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Cliente *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value="">Selecione um cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name ?? "Sem nome"} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Plano *
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value="">Selecione um plano...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — R$ {Number(p.price).toFixed(2)}/{CYCLE_LABELS[p.billing_cycle]?.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Forma de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value="pix">PIX</option>
                <option value="credit">Cartão de Crédito</option>
                <option value="debit">Cartão de Débito</option>
                <option value="cash">Dinheiro</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Data de Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                placeholder="Observações sobre esta assinatura..."
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-barber-light">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="rounded border-barber-border accent-barber-gold"
                />
                Renovação automática
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleCreateSubscription}
              disabled={isPending || !selectedCustomerId || !selectedPlanId}
              className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
            >
              {isPending ? "Criando..." : "Criar Assinatura"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente ou plano..."
            className="w-full rounded-lg border border-barber-border bg-barber-graphite py-2 pl-10 pr-3 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-barber-border bg-barber-graphite p-1">
          {[
            { key: "all", label: "Todas" },
            { key: "active", label: "Ativas" },
            { key: "trial", label: "Trial" },
            { key: "paused", label: "Pausadas" },
            { key: "cancelled", label: "Canceladas" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === f.key
                  ? "bg-barber-gold text-barber-dark"
                  : "text-barber-muted hover:text-barber-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout: Subscriptions list + Upcoming renewals sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main list */}
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-barber-muted/40" />
              <p className="mt-3 text-sm text-barber-muted">
                {subscriptions.length === 0
                  ? "Nenhuma assinatura cadastrada"
                  : "Nenhuma assinatura encontrada com os filtros atuais"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((sub) => {
                const statusInfo = STATUS_LABELS[sub.status] ?? STATUS_LABELS.active;
                return (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-barber-border bg-barber-graphite p-4 transition-colors hover:border-barber-border/80"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate font-medium text-barber-white">
                            {sub.customer_name ?? "Cliente"}
                          </h4>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-barber-muted">
                          {sub.plan_name ?? "Plano"} · R${" "}
                          {sub.plan_price ? Number(sub.plan_price).toFixed(2) : "—"}/
                          {CYCLE_LABELS[sub.plan_billing_cycle ?? "monthly"]?.toLowerCase()}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-barber-muted">
                          <span>
                            📅{" "}
                            {sub.current_period_start
                              ? new Date(sub.current_period_start).toLocaleDateString("pt-BR")
                              : "—"}{" "}
                            →{" "}
                            {sub.current_period_end
                              ? new Date(sub.current_period_end).toLocaleDateString("pt-BR")
                              : "—"}
                          </span>
                          <span>
                            ✂️ {sub.services_used_this_period}
                            {sub.plan_max_services ? `/${sub.plan_max_services}` : "/∞"} serviços
                          </span>
                          {sub.auto_renew && <span>🔄 Auto-renovação</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {sub.status !== "paused" &&
                          sub.status !== "cancelled" &&
                          sub.status !== "expired" && (
                            <button
                              onClick={() => handleUpdateStatus(sub.id, "paused")}
                              title="Pausar"
                              className="rounded p-1.5 text-barber-muted transition-colors hover:bg-yellow-400/10 hover:text-yellow-400"
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          )}
                        {sub.status === "paused" && (
                          <button
                            onClick={() => handleUpdateStatus(sub.id, "active")}
                            title="Retomar"
                            className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-green/10 hover:text-barber-green"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {sub.status !== "cancelled" && sub.status !== "expired" && (
                          <button
                            onClick={() => handleUpdateStatus(sub.id, "cancelled")}
                            title="Cancelar"
                            className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-error/10 hover:text-barber-error"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Upcoming Renewals */}
        <div className="space-y-4">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
              <Calendar className="h-4 w-4 text-barber-copper" />
              Próximas Renovações
            </h3>
            {upcomingRenewals.length === 0 ? (
              <p className="text-xs text-barber-muted">Nenhuma renovação nos próximos 30 dias</p>
            ) : (
              <div className="space-y-3">
                {upcomingRenewals.map((sub) => (
                  <div key={sub.id} className="border-b border-barber-border/50 pb-2 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-barber-white">
                      {sub.customer_name ?? "Cliente"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-barber-muted">
                      <span>{sub.plan_name}</span>
                      <span className="text-barber-copper">
                        {sub.next_billing_date
                          ? new Date(sub.next_billing_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
              <TrendingUp className="h-4 w-4 text-barber-green" />
              Resumo do Mês
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-barber-muted">Receita ativa</span>
                <span className="font-medium text-barber-green">
                  R$ {summary.monthly_revenue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-barber-muted">Assinaturas ativas</span>
                <span className="font-medium text-barber-white">{summary.total_active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-barber-muted">Média uso/período</span>
                <span className="font-medium text-barber-white">
                  {summary.avg_services_used.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-barber-muted">Renovações em 7d</span>
                <span className="font-medium text-barber-copper">
                  {summary.upcoming_renewals_7d}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}