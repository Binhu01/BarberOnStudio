"use client";

import { useState, useTransition } from "react";
import {
  CreditCard,
  Plus,
  MoreVertical,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  Users,
  TrendingUp,
  Calendar,
  Check,
  AlertTriangle,
} from "lucide-react";
import type {
  SubscriptionPlan,
  ClientSubscription,
  SubscriptionSummary,
} from "@/types/subscription";
import {
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  createClientSubscription,
  updateClientSubscription,
  processRenewals,
} from "../actions";

interface Props {
  plans: SubscriptionPlan[];
  subscriptions: ClientSubscription[];
  summary: SubscriptionSummary;
}

type Tab = "plans" | "subscriptions";

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

export function SubscriptionManager({ plans, subscriptions, summary }: Props) {
  const [tab, setTab] = useState<Tab>("plans");
  const [isPending, startTransition] = useTransition();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showSubForm, setShowSubForm] = useState(false);

  // Plan form state
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planCycle, setPlanCycle] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [planTrial, setPlanTrial] = useState("0");
  const [planMaxServices, setPlanMaxServices] = useState("");
  const [planDiscount, setPlanDiscount] = useState("0");
  const [planDescription, setPlanDescription] = useState("");

  function resetPlanForm() {
    setPlanName("");
    setPlanPrice("");
    setPlanCycle("monthly");
    setPlanTrial("0");
    setPlanMaxServices("");
    setPlanDiscount("0");
    setPlanDescription("");
    setEditingPlan(null);
    setShowPlanForm(false);
  }

  function handleEditPlan(plan: SubscriptionPlan) {
    setPlanName(plan.name);
    setPlanPrice(String(plan.price));
    setPlanCycle(plan.billing_cycle);
    setPlanTrial(String(plan.trial_days));
    setPlanMaxServices(plan.max_services_per_month ? String(plan.max_services_per_month) : "");
    setPlanDiscount(String(plan.discount_percentage));
    setPlanDescription(plan.description ?? "");
    setEditingPlan(plan);
    setShowPlanForm(true);
  }

  async function handleSavePlan() {
    if (!planName || !planPrice) return;

    startTransition(async () => {
      try {
        const input = {
          name: planName,
          price: Number(planPrice),
          billing_cycle: planCycle,
          trial_days: Number(planTrial) || 0,
          max_services_per_month: planMaxServices ? Number(planMaxServices) : null,
          discount_percentage: Number(planDiscount) || 0,
          description: planDescription || null,
        };

        if (editingPlan) {
          await updateSubscriptionPlan(editingPlan.id, input);
        } else {
          await createSubscriptionPlan(input);
        }
        resetPlanForm();
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao salvar plano");
      }
    });
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      try {
        await deleteSubscriptionPlan(planId);
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao excluir plano");
      }
    });
  }

  async function handleTogglePlanActive(plan: SubscriptionPlan) {
    startTransition(async () => {
      try {
        await updateSubscriptionPlan(plan.id, { is_active: !plan.is_active });
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao atualizar plano");
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

  async function handleUpdateSubStatus(subId: string, status: "active" | "paused" | "cancelled") {
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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-barber-border bg-barber-graphite p-1">
        <button
          onClick={() => setTab("plans")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "plans"
              ? "bg-barber-gold text-barber-dark"
              : "text-barber-muted hover:text-barber-white"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Planos ({plans.length})
        </button>
        <button
          onClick={() => setTab("subscriptions")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "subscriptions"
              ? "bg-barber-gold text-barber-dark"
              : "text-barber-muted hover:text-barber-white"
          }`}
        >
          <Users className="h-4 w-4" />
          Assinaturas ({subscriptions.length})
        </button>
      </div>

      {/* Plans Tab */}
      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-barber-white">Planos de Assinatura</h2>
            <button
              onClick={() => { resetPlanForm(); setShowPlanForm(true); }}
              className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
            >
              <Plus className="h-4 w-4" />
              Novo Plano
            </button>
          </div>

          {/* Plan Form */}
          {showPlanForm && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
              <h3 className="mb-4 text-base font-semibold text-barber-white">
                {editingPlan ? "Editar Plano" : "Novo Plano"}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Nome *</label>
                  <input
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="Ex: Clube Bronze"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="89.90"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Ciclo</label>
                  <select
                    value={planCycle}
                    onChange={(e) => setPlanCycle(e.target.value as any)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Dias de Trial</label>
                  <input
                    type="number"
                    value={planTrial}
                    onChange={(e) => setPlanTrial(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Máx. Serviços/Mês</label>
                  <input
                    type="number"
                    value={planMaxServices}
                    onChange={(e) => setPlanMaxServices(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="Ilimitado"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Desconto (%)</label>
                  <input
                    type="number"
                    value={planDiscount}
                    onChange={(e) => setPlanDiscount(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Descrição</label>
                  <textarea
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="Benefícios incluídos no plano..."
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleSavePlan}
                  disabled={isPending || !planName || !planPrice}
                  className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : editingPlan ? "Atualizar" : "Criar Plano"}
                </button>
                <button
                  onClick={resetPlanForm}
                  className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Plans Grid */}
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 p-12 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-barber-muted/40" />
              <p className="mt-3 text-sm text-barber-muted">Nenhum plano criado ainda</p>
              <button
                onClick={() => { resetPlanForm(); setShowPlanForm(true); }}
                className="mt-4 text-sm font-medium text-barber-gold hover:underline"
              >
                Criar primeiro plano
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border bg-barber-graphite p-5 transition-all ${
                    plan.is_active
                      ? "border-barber-border"
                      : "border-barber-border/50 opacity-60"
                  }`}
                >
                  {!plan.is_active && (
                    <span className="absolute right-3 top-3 rounded bg-barber-muted/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-barber-muted">
                      Inativo
                    </span>
                  )}
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-barber-white">{plan.name}</h3>
                      <p className="text-xs text-barber-muted">{CYCLE_LABELS[plan.billing_cycle]}</p>
                    </div>
                    <p className="text-xl font-bold text-barber-gold">
                      R$ {Number(plan.price).toFixed(2)}
                    </p>
                  </div>

                  {plan.description && (
                    <p className="mb-3 text-xs leading-relaxed text-barber-muted line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  <div className="mb-4 space-y-1 text-xs text-barber-light">
                    {plan.max_services_per_month && (
                      <p>✂️ Até {plan.max_services_per_month} serviços/mês</p>
                    )}
                    {plan.discount_percentage > 0 && (
                      <p>🏷️ {plan.discount_percentage}% desconto em serviços avulsos</p>
                    )}
                    {plan.trial_days > 0 && (
                      <p>🎁 {plan.trial_days} dias grátis</p>
                    )}
                    {plan.priority_booking && <p>⚡ Agendamento prioritário</p>}
                  </div>

                  <div className="flex gap-2 border-t border-barber-border pt-3">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="flex-1 rounded-lg border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-muted transition-colors hover:text-barber-white"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleTogglePlanActive(plan)}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        plan.is_active
                          ? "border-barber-border text-barber-muted hover:text-yellow-400"
                          : "border-barber-green/30 text-barber-green hover:bg-barber-green/10"
                      }`}
                    >
                      {plan.is_active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="rounded-lg border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-muted transition-colors hover:text-barber-error"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscriptions Tab */}
      {tab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-barber-white">Assinaturas dos Clientes</h2>
            <div className="flex gap-2">
              <button
                onClick={handleProcessRenewals}
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                Processar Renovações
              </button>
              <button
                onClick={() => setShowSubForm(!showSubForm)}
                className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
              >
                <Plus className="h-4 w-4" />
                Nova Assinatura
              </button>
            </div>
          </div>

          {showSubForm && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
              <h3 className="mb-4 text-base font-semibold text-barber-white">Nova Assinatura</h3>
              <p className="mb-4 text-sm text-barber-muted">
                Para criar uma assinatura, vincule um cliente a um plano ativo. O sistema calculará automaticamente o período e data de renovação.
              </p>
              <p className="text-xs text-barber-muted italic">
                Formulário completo disponível na página de Recorrências com seleção de cliente e plano.
              </p>
              <button
                onClick={() => setShowSubForm(false)}
                className="mt-4 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Subscriptions List */}
          {subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-barber-muted/40" />
              <p className="mt-3 text-sm text-barber-muted">Nenhuma assinatura cadastrada</p>
              <p className="mt-1 text-xs text-barber-muted/60">
                Crie planos primeiro, depois vincule clientes
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-barber-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-barber-border bg-barber-graphite">
                  <tr>
                    <th className="px-4 py-3 font-medium text-barber-muted">Cliente</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Plano</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Status</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Período</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Uso</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-barber-border">
                  {subscriptions.map((sub) => {
                    const statusInfo = STATUS_LABELS[sub.status] ?? STATUS_LABELS.active;
                    return (
                      <tr key={sub.id} className="hover:bg-barber-graphite/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-barber-white">
                            {sub.customer_name ?? "Cliente"}
                          </p>
                          <p className="text-xs text-barber-muted">
                            {sub.payment_method?.toUpperCase() ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-barber-white">
                            {sub.plan_name ?? "Plano"}
                          </p>
                          <p className="text-xs text-barber-muted">
                            R$ {sub.plan_price ? Number(sub.plan_price).toFixed(2) : "—"}
                            /{CYCLE_LABELS[sub.plan_billing_cycle ?? "monthly"]?.toLowerCase()}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-barber-light">
                            {sub.current_period_start
                              ? new Date(sub.current_period_start).toLocaleDateString("pt-BR")
                              : "—"}
                          </p>
                          <p className="text-xs text-barber-muted">
                            até{" "}
                            {sub.current_period_end
                              ? new Date(sub.current_period_end).toLocaleDateString("pt-BR")
                              : "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-barber-light">
                            {sub.services_used_this_period}
                            {sub.plan_max_services ? `/${sub.plan_max_services}` : "/∞"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {sub.status !== "paused" && sub.status !== "cancelled" && sub.status !== "expired" && (
                              <button
                                onClick={() => handleUpdateSubStatus(sub.id, "paused")}
                                title="Pausar"
                                className="rounded p-1.5 text-barber-muted transition-colors hover:bg-yellow-400/10 hover:text-yellow-400"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {sub.status === "paused" && (
                              <button
                                onClick={() => handleUpdateSubStatus(sub.id, "active")}
                                title="Retomar"
                                className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-green/10 hover:text-barber-green"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {sub.status !== "cancelled" && sub.status !== "expired" && (
                              <button
                                onClick={() => handleUpdateSubStatus(sub.id, "cancelled")}
                                title="Cancelar"
                                className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-error/10 hover:text-barber-error"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}