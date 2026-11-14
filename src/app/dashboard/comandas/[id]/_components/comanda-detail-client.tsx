"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addComandaItem,
  removeComandaItem,
  completeComanda,
  cancelComanda,
} from "../../actions";
import type { Comanda } from "@/types/comanda";
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Scissors,
  Package,
  DollarSign,
  User,
  Clock,
  CreditCard,
} from "lucide-react";

interface ComandaDetailClientProps {
  comanda: Comanda;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "other", label: "Outro" },
];

export function ComandaDetailClient({ comanda }: ComandaDetailClientProps) {
  const router = useRouter();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New item form state
  const [itemDesc, setItemDesc] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemType, setItemType] = useState<"service" | "product">("service");

  // Complete form state
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [discount, setDiscount] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const isOpen = comanda.status === "open" || comanda.status === "in_progress";

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const price = parseFloat(itemPrice);
    const qty = parseInt(itemQty, 10);

    if (!itemDesc.trim()) {
      setError("Descrição é obrigatória");
      return;
    }
    if (isNaN(price) || price < 0) {
      setError("Preço inválido");
      return;
    }

    try {
      await addComandaItem({
        order_id: comanda.id,
        description: itemDesc.trim(),
        unit_price: price,
        quantity: qty || 1,
      });
      setItemDesc("");
      setItemPrice("");
      setItemQty("1");
      setSuccess("Item adicionado!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar item");
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!confirm("Remover este item?")) return;
    setError(null);
    try {
      await removeComandaItem(itemId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover item");
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setIsCompleting(true);
    setError(null);

    try {
      await completeComanda({
        order_id: comanda.id,
        payment_method: paymentMethod as any,
        discount: discount ? parseFloat(discount) : 0,
        notes: completeNotes || null,
      });
      setSuccess("Comanda finalizada com sucesso!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar comanda");
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancelar esta comanda? Esta ação não pode ser desfeita.")) return;
    setError(null);
    try {
      await cancelComanda(comanda.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar comanda");
    }
  }

  const items = comanda.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + (item.total ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-barber-white">
                Comanda #{comanda.id.slice(0, 8)}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                  isOpen
                    ? "border border-barber-gold/30 bg-barber-gold/10 text-barber-gold"
                    : comanda.status === "completed"
                      ? "border border-barber-success/30 bg-barber-success/10 text-barber-success"
                      : "border border-barber-muted/30 bg-barber-muted/10 text-barber-muted"
                }`}
              >
                {isOpen ? "Em Atendimento" : comanda.status === "completed" ? "Finalizada" : "Cancelada"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-barber-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {new Date(comanda.issued_at).toLocaleString("pt-BR")}
              </span>
              {comanda.barber_name && (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {comanda.barber_name}
                </span>
              )}
              {comanda.customer_name && (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Cliente: {comanda.customer_name}
                </span>
              )}
            </div>
          </div>

          {isOpen && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 rounded-lg border border-barber-error/30 px-4 py-2 text-sm font-medium text-barber-error transition-colors hover:bg-barber-error/10"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Items */}
        <div className="space-y-4">
          {/* Add Item Form (only when open) */}
          {isOpen && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
                <Plus className="h-5 w-5 text-barber-gold" />
                Adicionar Item
              </h2>

              <form onSubmit={handleAddItem} className="space-y-3">
                {/* Type Toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setItemType("service")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      itemType === "service"
                        ? "bg-barber-gold/10 text-barber-gold"
                        : "text-barber-muted hover:text-barber-white"
                    }`}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Serviço
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType("product")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      itemType === "product"
                        ? "bg-barber-copper/10 text-barber-copper"
                        : "text-barber-muted hover:text-barber-white"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Produto
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_100px_80px]">
                  <input
                    type="text"
                    placeholder={itemType === "service" ? "Nome do serviço..." : "Nome do produto..."}
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    className="rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Preço"
                    step="0.01"
                    min="0"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Qtd"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingItem}
                  className="w-full rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
                >
                  {isAddingItem ? "Adicionando..." : "Adicionar à Comanda"}
                </button>
              </form>
            </div>
          )}

          {/* Items List */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-barber-white">
              Itens ({items.length})
            </h2>

            {items.length === 0 ? (
              <div className="py-8 text-center">
                <Scissors className="mx-auto mb-2 h-8 w-8 text-barber-muted opacity-50" />
                <p className="text-sm text-barber-muted">Nenhum item adicionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-barber-border bg-barber-dark p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-barber-white">{item.description}</p>
                      <p className="text-xs text-barber-muted">
                        {item.quantity}x {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-barber-white">
                      {formatCurrency(item.total)}
                    </p>
                    {isOpen && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-error/10 hover:text-barber-error"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary & Payment */}
        <div className="space-y-4">
          {/* Totals */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-barber-white">Resumo</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-barber-muted">
                <span>Subtotal</span>
                <span className="text-barber-white">{formatCurrency(subtotal)}</span>
              </div>
              {comanda.discount > 0 && (
                <div className="flex justify-between text-barber-muted">
                  <span>Desconto</span>
                  <span className="text-barber-error">-{formatCurrency(comanda.discount)}</span>
                </div>
              )}
              <div className="border-t border-barber-border pt-2">
                <div className="flex justify-between text-base font-bold">
                  <span className="text-barber-white">Total</span>
                  <span className="text-barber-gold">{formatCurrency(comanda.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form (only when open and has items) */}
          {isOpen && items.length > 0 && (
            <div className="rounded-xl border border-barber-gold/30 bg-barber-graphite p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
                <CreditCard className="h-5 w-5 text-barber-gold" />
                Finalizar Pagamento
              </h2>

              <form onSubmit={handleComplete} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-barber-muted">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-barber-muted">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-barber-muted">Observações</label>
                  <textarea
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    rows={2}
                    placeholder="Notas finais..."
                    className="w-full resize-none rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCompleting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-barber-success px-4 py-2.5 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-success/90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isCompleting ? "Finalizando..." : "Finalizar Comanda"}
                </button>
              </form>
            </div>
          )}

          {/* Completed Info */}
          {comanda.status === "completed" && (
            <div className="rounded-xl border border-barber-success/30 bg-barber-success/5 p-5">
              <div className="flex items-center gap-2 text-barber-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-display font-bold">Comanda Finalizada</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-barber-muted">
                <p>
                  Pagamento:{" "}
                  <span className="text-barber-white">
                    {PAYMENT_METHODS.find((m) => m.value === comanda.payment_method)?.label ?? comanda.payment_method}
                  </span>
                </p>
                {comanda.completed_at && (
                  <p>
                    Finalizada em:{" "}
                    <span className="text-barber-white">
                      {new Date(comanda.completed_at).toLocaleString("pt-BR")}
                    </span>
                  </p>
                )}
                {comanda.notes && (
                  <p className="mt-2 text-xs italic opacity-70">{comanda.notes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}