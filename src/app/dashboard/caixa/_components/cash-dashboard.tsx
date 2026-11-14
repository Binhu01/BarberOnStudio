"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  openCashSession,
  closeCashSession,
  createCashMovement,
  markCommissionPaid,
} from "../../comandas/cash-actions";
import type {
  CashRegister,
  CashSession,
  CashMovement,
  DailyCashSummary,
  BarberCommission,
  CommissionStats,
} from "@/types/comanda";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  Clock,
  Users,
  Receipt,
  Plus,
} from "lucide-react";

interface CashDashboardProps {
  openSession: CashSession | null;
  sessions: CashSession[];
  summary: DailyCashSummary;
  registers: CashRegister[];
  movements: CashMovement[];
  commissions: BarberCommission[];
  commissionStats: CommissionStats;
  targetDate: string;
}

const MOVEMENT_TYPE_LABELS: Record<string, { label: string; icon: typeof ArrowUpRight; color: string }> = {
  sale: { label: "Venda", icon: ArrowUpRight, color: "text-barber-success" },
  refund: { label: "Reembolso", icon: ArrowDownRight, color: "text-barber-error" },
  withdrawal: { label: "Retirada", icon: ArrowDownRight, color: "text-barber-warning" },
  deposit: { label: "Depósito", icon: ArrowUpRight, color: "text-barber-gold" },
  adjustment: { label: "Ajuste", icon: Minus, color: "text-barber-muted" },
};

export function CashDashboard({
  openSession,
  sessions,
  summary,
  registers,
  movements,
  commissions,
  commissionStats,
  targetDate,
}: CashDashboardProps) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Open session form
  const [openingAmount, setOpeningAmount] = useState("0");
  const [selectedRegister, setSelectedRegister] = useState(registers[0]?.id ?? "");

  // Close session form
  const [closingAmount, setClosingAmount] = useState("");

  // Movement form
  const [movementType, setMovementType] = useState<"withdrawal" | "deposit" | "adjustment">("withdrawal");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDesc, setMovementDesc] = useState("");
  const [movementPayment, setMovementPayment] = useState("cash");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  async function handleOpenSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRegister) {
      setError("Selecione um caixa");
      return;
    }
    setIsOpening(true);
    setError(null);
    try {
      await openCashSession({
        cash_register_id: selectedRegister,
        opening_amount: parseFloat(openingAmount) || 0,
      });
      setSuccess("Caixa aberto com sucesso!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir caixa");
    } finally {
      setIsOpening(false);
    }
  }

  async function handleCloseSession(e: React.FormEvent) {
    e.preventDefault();
    if (!openSession) return;
    setIsClosing(true);
    setError(null);
    try {
      await closeCashSession({
        cash_session_id: openSession.id,
        closing_amount: parseFloat(closingAmount) || 0,
      });
      setSuccess("Caixa fechado com sucesso!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar caixa");
    } finally {
      setIsClosing(false);
    }
  }

  async function handleAddMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!openSession) {
      setError("Abra o caixa antes de registrar movimentações");
      return;
    }
    setIsAddingMovement(true);
    setError(null);
    try {
      await createCashMovement({
        cash_session_id: openSession.id,
        movement_type: movementType,
        amount: parseFloat(movementAmount) || 0,
        description: movementDesc,
        payment_method: movementPayment as any,
      });
      setSuccess("Movimentação registrada!");
      setMovementAmount("");
      setMovementDesc("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar movimentação");
    } finally {
      setIsAddingMovement(false);
    }
  }

  async function handleMarkCommissionsPaid(ids: string[]) {
    setError(null);
    try {
      await markCommissionPaid({ commission_ids: ids });
      setSuccess(`${ids.length} comissão(ões) marcada(s) como paga(s)!`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao marcar comissões");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Caixa e Fechamento Diário
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Gerencie sessões de caixa, movimentações e comissões
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-4 py-3 text-sm text-barber-error">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-barber-success/30 bg-barber-success/10 px-4 py-3 text-sm text-barber-success">
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Vendas Hoje</p>
              <p className="text-xl font-bold text-barber-white">
                {formatCurrency(summary.total_sales)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Atendimentos</p>
              <p className="text-xl font-bold text-barber-white">
                {summary.orders_count}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Saldo Líquido</p>
              <p className="text-xl font-bold text-barber-white">
                {formatCurrency(summary.net_amount)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-warning/10 text-barber-warning">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Comissões Pendentes</p>
              <p className="text-xl font-bold text-barber-white">
                {formatCurrency(commissionStats.total_pending_amount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Cash Session Status */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    openSession
                      ? "bg-barber-success/10 text-barber-success"
                      : "bg-barber-warning/10 text-barber-warning"
                  }`}
                >
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-barber-white">
                    {openSession ? "Caixa Aberto" : "Caixa Fechado"}
                  </h2>
                  <p className="text-sm text-barber-muted">
                    {openSession
                      ? `Aberto às ${new Date(openSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${openSession.register_name ?? "Caixa"}`
                      : "Nenhuma sessão ativa no momento"}
                  </p>
                </div>
              </div>
              {openSession && (
                <div className="text-right">
                  <p className="text-xs text-barber-muted">Fundo de Troco</p>
                  <p className="text-lg font-bold text-barber-white">
                    {formatCurrency(openSession.opening_amount)}
                  </p>
                </div>
              )}
            </div>

            {/* Open Session Form */}
            {!openSession && (
              <form onSubmit={handleOpenSession} className="mt-6 space-y-3 border-t border-barber-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-barber-muted">Caixa</label>
                    <select
                      value={selectedRegister}
                      onChange={(e) => setSelectedRegister(e.target.value)}
                      className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                    >
                      {registers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-barber-muted">Fundo de Troco (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isOpening}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-barber-success px-4 py-2.5 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-success/90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {isOpening ? "Abrindo..." : "Abrir Caixa"}
                </button>
              </form>
            )}

            {/* Close Session Form */}
            {openSession && (
              <form onSubmit={handleCloseSession} className="mt-6 space-y-3 border-t border-barber-border pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-barber-muted">Valor de Fechamento (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder="Conte o dinheiro no caixa..."
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isClosing}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-barber-warning px-4 py-2.5 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-warning/90 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" />
                  {isClosing ? "Fechando..." : "Fechar Caixa"}
                </button>
              </form>
            )}
          </div>

          {/* Movements List */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-barber-white">
              Movimentações do Dia
            </h2>

            {movements.length === 0 ? (
              <div className="py-8 text-center">
                <Minus className="mx-auto mb-2 h-8 w-8 text-barber-muted opacity-50" />
                <p className="text-sm text-barber-muted">Nenhuma movimentação registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((m) => {
                  const config = MOVEMENT_TYPE_LABELS[m.movement_type] ?? MOVEMENT_TYPE_LABELS.adjustment;
                  const Icon = config.icon;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-barber-border bg-barber-dark p-3"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-barber-graphite ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-barber-white">
                          {m.description ?? config.label}
                        </p>
                        <p className="text-xs text-barber-muted">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {m.created_by_name && ` — ${m.created_by_name}`}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${config.color}`}>
                        {m.movement_type === "refund" || m.movement_type === "withdrawal" ? "-" : "+"}
                        {formatCurrency(m.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Movement Form */}
          {openSession && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
                <Plus className="h-5 w-5 text-barber-gold" />
                Registrar Movimentação
              </h2>

              <form onSubmit={handleAddMovement} className="space-y-3">
                <div className="flex gap-2">
                  {(["withdrawal", "deposit", "adjustment"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMovementType(type)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        movementType === type
                          ? "bg-barber-gold/10 text-barber-gold"
                          : "text-barber-muted hover:text-barber-white"
                      }`}
                    >
                      {type === "withdrawal" ? "Retirada" : type === "deposit" ? "Depósito" : "Ajuste"}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-barber-muted">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-barber-muted">Descrição</label>
                  <input
                    type="text"
                    value={movementDesc}
                    onChange={(e) => setMovementDesc(e.target.value)}
                    placeholder="Motivo da movimentação..."
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingMovement}
                  className="w-full rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
                >
                  {isAddingMovement ? "Registrando..." : "Registrar"}
                </button>
              </form>
            </div>
          )}

          {/* Pending Commissions */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-barber-white">
                Comissões Pendentes
              </h2>
              <span className="rounded-full bg-barber-warning/10 px-2 py-0.5 text-xs font-semibold text-barber-warning">
                {commissions.length}
              </span>
            </div>

            {commissions.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-barber-success opacity-50" />
                <p className="text-sm text-barber-muted">Todas as comissões estão pagas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {commissions.slice(0, 10).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-barber-border bg-barber-dark p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-barber-gold/10 text-xs font-bold text-barber-gold">
                      {(c.barber_name ?? "?").charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-barber-white">
                        {c.barber_name ?? "Profissional"}
                      </p>
                      <p className="text-xs text-barber-muted">{c.service_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-barber-white">
                        {formatCurrency(c.commission_amount)}
                      </p>
                      <button
                        onClick={() => handleMarkCommissionsPaid([c.id])}
                        className="text-[10px] font-medium text-barber-success hover:underline"
                      >
                        Marcar paga
                      </button>
                    </div>
                  </div>
                ))}

                {commissions.length > 10 && (
                  <p className="text-center text-xs text-barber-muted">
                    +{commissions.length - 10} outras comissões pendentes
                  </p>
                )}

                {commissions.length > 1 && (
                  <button
                    onClick={() =>
                      handleMarkCommissionsPaid(commissions.map((c) => c.id))
                    }
                    className="mt-2 w-full rounded-lg border border-barber-success/30 px-4 py-2 text-sm font-medium text-barber-success transition-colors hover:bg-barber-success/10"
                  >
                    Marcar Todas como Pagas
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sessions History */}
          {sessions.length > 0 && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
              <h2 className="mb-4 font-display text-lg font-bold text-barber-white">
                Sessões do Dia
              </h2>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-barber-border bg-barber-dark p-3"
                  >
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        s.status === "open"
                          ? "animate-pulse bg-barber-success"
                          : s.status === "closed"
                            ? "bg-barber-muted"
                            : "bg-barber-error"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-barber-white">
                        {s.register_name ?? "Caixa"}
                      </p>
                      <p className="text-xs text-barber-muted">
                        {new Date(s.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {s.closed_at &&
                          ` → ${new Date(s.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-barber-muted">Abertura</p>
                      <p className="text-sm font-bold text-barber-white">
                        {formatCurrency(s.opening_amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}