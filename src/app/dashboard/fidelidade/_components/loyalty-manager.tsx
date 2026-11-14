"use client";

import { useState, useTransition } from "react";
import {
  Star,
  CreditCard,
  Plus,
  MoreVertical,
  Gift,
  TrendingUp,
  Users,
  RefreshCw,
  XCircle,
  History,
  Search,
} from "lucide-react";
import type {
  LoyaltyProgram,
  LoyaltyCard,
  LoyaltySummary,
} from "@/types/loyalty";
import {
  createLoyaltyProgram,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  createLoyaltyCard,
  addLoyaltyPoints,
  redeemLoyaltyPoints,
  getLoyaltyTransactions,
} from "../actions";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface Props {
  programs: LoyaltyProgram[];
  cards: LoyaltyCard[];
  customers: Customer[];
  summary: LoyaltySummary;
}

type Tab = "programs" | "cards";

const REWARD_LABELS: Record<string, string> = {
  discount: "Desconto",
  free_service: "Serviço Grátis",
  product: "Produto",
  cashback: "Cashback",
};

export function LoyaltyManager({ programs, cards, customers, summary }: Props) {
  const [tab, setTab] = useState<Tab>("programs");
  const [isPending, startTransition] = useTransition();

  // Program form state
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [progName, setProgName] = useState("");
  const [progDesc, setProgDesc] = useState("");
  const [progPointsPerReal, setProgPointsPerReal] = useState("1");
  const [progPointsPerVisit, setProgPointsPerVisit] = useState("0");
  const [progThreshold, setProgThreshold] = useState("100");
  const [progRewardType, setProgRewardType] = useState<"discount" | "free_service" | "product" | "cashback">("discount");
  const [progRewardValue, setProgRewardValue] = useState("0");
  const [progExpiry, setProgExpiry] = useState("");

  // Card form state
  const [showCardForm, setShowCardForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");

  // Points adjustment state
  const [adjustCardId, setAdjustCardId] = useState("");
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [adjustMode, setAdjustMode] = useState<"add" | "redeem">("add");

  // Transaction history viewer
  const [viewHistoryCardId, setViewHistoryCardId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);

  function resetProgramForm() {
    setProgName("");
    setProgDesc("");
    setProgPointsPerReal("1");
    setProgPointsPerVisit("0");
    setProgThreshold("100");
    setProgRewardType("discount");
    setProgRewardValue("0");
    setProgExpiry("");
    setEditingProgram(null);
    setShowProgramForm(false);
  }

  function handleEditProgram(p: LoyaltyProgram) {
    setProgName(p.name);
    setProgDesc(p.description ?? "");
    setProgPointsPerReal(String(p.points_per_real));
    setProgPointsPerVisit(String(p.points_per_visit));
    setProgThreshold(String(p.redemption_threshold));
    setProgRewardType(p.reward_type);
    setProgRewardValue(String(p.reward_value));
    setProgExpiry(p.expiry_days ? String(p.expiry_days) : "");
    setEditingProgram(p);
    setShowProgramForm(true);
  }

  async function handleSaveProgram() {
    if (!progName) return;
    startTransition(async () => {
      try {
        const input = {
          name: progName,
          description: progDesc || null,
          points_per_real: Number(progPointsPerReal) || 1,
          points_per_visit: Number(progPointsPerVisit) || 0,
          redemption_threshold: Number(progThreshold) || 100,
          reward_type: progRewardType,
          reward_value: Number(progRewardValue) || 0,
          expiry_days: progExpiry ? Number(progExpiry) : null,
        };
        if (editingProgram) {
          await updateLoyaltyProgram(editingProgram.id, input);
        } else {
          await createLoyaltyProgram(input);
        }
        resetProgramForm();
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao salvar programa");
      }
    });
  }

  async function handleDeleteProgram(id: string) {
    if (!confirm("Excluir este programa? Cartões ativos impedirão a exclusão.")) return;
    startTransition(async () => {
      try {
        await deleteLoyaltyProgram(id);
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao excluir");
      }
    });
  }

  async function handleCreateCard() {
    if (!selectedCustomerId || !selectedProgramId) return;
    startTransition(async () => {
      try {
        await createLoyaltyCard({
          customer_profile_id: selectedCustomerId,
          loyalty_program_id: selectedProgramId,
        });
        setSelectedCustomerId("");
        setSelectedProgramId("");
        setShowCardForm(false);
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao criar cartão");
      }
    });
  }

  async function handleAdjustPoints() {
    if (!adjustCardId || !adjustPoints) return;
    startTransition(async () => {
      try {
        if (adjustMode === "add") {
          await addLoyaltyPoints({
            card_id: adjustCardId,
            points: Number(adjustPoints),
            description: adjustDesc || undefined,
            reference_type: "manual",
          });
        } else {
          await redeemLoyaltyPoints({
            card_id: adjustCardId,
            points: Number(adjustPoints),
            description: adjustDesc || undefined,
          });
        }
        setAdjustCardId("");
        setAdjustPoints("");
        setAdjustDesc("");
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao ajustar pontos");
      }
    });
  }

  async function handleViewHistory(cardId: string) {
    setViewHistoryCardId(cardId);
    try {
      const data = await getLoyaltyTransactions(cardId);
      setHistoryData(data);
    } catch {
      setHistoryData([]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-barber-border bg-barber-graphite p-1">
        <button
          onClick={() => setTab("programs")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "programs"
              ? "bg-barber-gold text-barber-dark"
              : "text-barber-muted hover:text-barber-white"
          }`}
        >
          <Star className="h-4 w-4" />
          Programas ({programs.length})
        </button>
        <button
          onClick={() => setTab("cards")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "cards"
              ? "bg-barber-gold text-barber-dark"
              : "text-barber-muted hover:text-barber-white"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Cartões ({cards.length})
        </button>
      </div>

      {/* Programs Tab */}
      {tab === "programs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-barber-white">Programas de Fidelidade</h2>
            <button
              onClick={() => { resetProgramForm(); setShowProgramForm(true); }}
              className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
            >
              <Plus className="h-4 w-4" />
              Novo Programa
            </button>
          </div>

          {showProgramForm && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
              <h3 className="mb-4 text-base font-semibold text-barber-white">
                {editingProgram ? "Editar Programa" : "Novo Programa"}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Nome *</label>
                  <input
                    value={progName}
                    onChange={(e) => setProgName(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="Ex: Clube Bronze"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Pontos por R$ gasto</label>
                  <input
                    type="number"
                    step="0.01"
                    value={progPointsPerReal}
                    onChange={(e) => setProgPointsPerReal(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Pontos por visita</label>
                  <input
                    type="number"
                    value={progPointsPerVisit}
                    onChange={(e) => setProgPointsPerVisit(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Limite para resgate</label>
                  <input
                    type="number"
                    value={progThreshold}
                    onChange={(e) => setProgThreshold(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Tipo de Recompensa</label>
                  <select
                    value={progRewardType}
                    onChange={(e) => setProgRewardType(e.target.value as any)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  >
                    <option value="discount">Desconto</option>
                    <option value="free_service">Serviço Grátis</option>
                    <option value="product">Produto</option>
                    <option value="cashback">Cashback</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Valor da Recompensa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={progRewardValue}
                    onChange={(e) => setProgRewardValue(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Validade dos pontos (dias)</label>
                  <input
                    type="number"
                    value={progExpiry}
                    onChange={(e) => setProgExpiry(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="Sem validade"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Descrição</label>
                  <textarea
                    value={progDesc}
                    onChange={(e) => setProgDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                    placeholder="Regras e benefícios do programa..."
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleSaveProgram}
                  disabled={isPending || !progName}
                  className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : editingProgram ? "Atualizar" : "Criar Programa"}
                </button>
                <button
                  onClick={resetProgramForm}
                  className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {programs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 p-12 text-center">
              <Star className="mx-auto h-10 w-10 text-barber-muted/40" />
              <p className="mt-3 text-sm text-barber-muted">Nenhum programa criado ainda</p>
              <button
                onClick={() => { resetProgramForm(); setShowProgramForm(true); }}
                className="mt-4 text-sm font-medium text-barber-gold hover:underline"
              >
                Criar primeiro programa
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((p) => (
                <div
                  key={p.id}
                  className={`relative rounded-xl border bg-barber-graphite p-5 transition-all ${
                    p.is_active ? "border-barber-border" : "border-barber-border/50 opacity-60"
                  }`}
                >
                  {!p.is_active && (
                    <span className="absolute right-3 top-3 rounded bg-barber-muted/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-barber-muted">
                      Inativo
                    </span>
                  )}
                  <h3 className="font-display text-lg font-bold text-barber-white">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 text-xs leading-relaxed text-barber-muted line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 space-y-1 text-xs text-barber-light">
                    <p>⭐ {p.points_per_real} pt/R$ · {p.points_per_visit} pt/visita</p>
                    <p>🎁 Resgate: {p.redemption_threshold} pts → {REWARD_LABELS[p.reward_type]} {p.reward_value > 0 ? `(R$ ${Number(p.reward_value).toFixed(2)})` : ""}</p>
                    {p.expiry_days && <p>⏰ Pontos expiram em {p.expiry_days} dias</p>}
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-barber-border pt-3">
                    <button
                      onClick={() => handleEditProgram(p)}
                      className="flex-1 rounded-lg border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-muted transition-colors hover:text-barber-white"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(p.id)}
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

      {/* Cards Tab */}
      {tab === "cards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-barber-white">Cartões de Fidelidade</h2>
            <button
              onClick={() => setShowCardForm(!showCardForm)}
              className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
            >
              <Plus className="h-4 w-4" />
              Novo Cartão
            </button>
          </div>

          {showCardForm && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
              <h3 className="mb-4 text-base font-semibold text-barber-white">Criar Cartão de Fidelidade</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Cliente *</label>
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
                  <label className="mb-1 block text-xs font-medium text-barber-muted">Programa *</label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  >
                    <option value="">Selecione um programa...</option>
                    {programs.filter((p) => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleCreateCard}
                  disabled={isPending || !selectedCustomerId || !selectedProgramId}
                  className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
                >
                  {isPending ? "Criando..." : "Criar Cartão"}
                </button>
                <button
                  onClick={() => setShowCardForm(false)}
                  className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Points Adjustment Panel */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
              <RefreshCw className="h-4 w-4 text-barber-copper" />
              Ajuste Rápido de Pontos
            </h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <select
                value={adjustCardId}
                onChange={(e) => setAdjustCardId(e.target.value)}
                className="rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value="">Selecione cartão...</option>
                {cards.filter((c) => c.card_status === "active").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name ?? "Cliente"} — {c.current_points} pts
                  </option>
                ))}
              </select>
              <div className="flex gap-1 rounded-lg border border-barber-border bg-barber-dark p-1">
                <button
                  onClick={() => setAdjustMode("add")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${adjustMode === "add" ? "bg-barber-green text-barber-dark" : "text-barber-muted"}`}
                >
                  Adicionar
                </button>
                <button
                  onClick={() => setAdjustMode("redeem")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${adjustMode === "redeem" ? "bg-barber-copper text-barber-dark" : "text-barber-muted"}`}
                >
                  Resgatar
                </button>
              </div>
              <input
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                placeholder="Pontos"
                className="rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              />
              <button
                onClick={handleAdjustPoints}
                disabled={isPending || !adjustCardId || !adjustPoints}
                className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
              >
                {isPending ? "..." : "Aplicar"}
              </button>
            </div>
          </div>

          {/* Cards List */}
          {cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 p-12 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-barber-muted/40" />
              <p className="mt-3 text-sm text-barber-muted">Nenhum cartão criado ainda</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-barber-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-barber-border bg-barber-graphite">
                  <tr>
                    <th className="px-4 py-3 font-medium text-barber-muted">Cliente</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Programa</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Pontos</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Visitas</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Status</th>
                    <th className="px-4 py-3 font-medium text-barber-muted">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-barber-border">
                  {cards.map((card) => (
                    <tr key={card.id} className="hover:bg-barber-graphite/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-barber-white">{card.customer_name ?? "Cliente"}</p>
                      </td>
                      <td className="px-4 py-3 text-barber-light">{card.program_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-barber-gold">{card.current_points}</span>
                        {card.redemption_threshold && (
                          <span className="text-xs text-barber-muted">/{card.redemption_threshold}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-barber-light">{card.total_visits}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          card.card_status === "active"
                            ? "text-barber-green bg-barber-green/10"
                            : "text-barber-muted bg-barber-muted/10"
                        }`}>
                          {card.card_status === "active" ? "Ativo" : card.card_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewHistory(card.id)}
                          title="Histórico"
                          className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-gold/10 hover:text-barber-gold"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transaction History Modal */}
          {viewHistoryCardId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setViewHistoryCardId(null)}>
              <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-barber-border bg-barber-graphite p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-barber-white">Histórico de Transações</h3>
                  <button onClick={() => setViewHistoryCardId(null)} className="text-barber-muted hover:text-barber-white">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                {historyData.length === 0 ? (
                  <p className="text-sm text-barber-muted">Nenhuma transação registrada</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border border-barber-border bg-barber-dark p-3">
                        <div>
                          <p className="text-sm font-medium text-barber-white">
                            {tx.transaction_type === "earn_purchase" ? "Compra" :
                             tx.transaction_type === "earn_visit" ? "Visita" :
                             tx.transaction_type === "earn_bonus" ? "Bônus" :
                             tx.transaction_type === "redeem" ? "Resgate" :
                             tx.transaction_type === "expire" ? "Expirou" : "Ajuste"}
                          </p>
                          <p className="text-xs text-barber-muted">
                            {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                            {tx.description ? ` · ${tx.description}` : ""}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${tx.points_change >= 0 ? "text-barber-green" : "text-barber-copper"}`}>
                          {tx.points_change >= 0 ? "+" : ""}{tx.points_change}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}