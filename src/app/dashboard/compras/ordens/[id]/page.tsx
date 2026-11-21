// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Truck,
  Package,
  FileText,
  User,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
} from "lucide-react";
import { getPurchaseOrderById } from "../../actions";
import type { PurchaseOrderStatus } from "@/types/purchases";
import { OrderActions } from "../_components/order-actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Rascunho", color: "bg-barber-muted/10 text-barber-muted border-gray-200", icon: FileText },
  approved: { label: "Aprovada", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle2 },
  sent: { label: "Enviada ao fornecedor", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Send },
  partially_received: { label: "Parcialmente recebida", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Package },
  received: { label: "Recebida", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  partially_cancelled: { label: "Parcialmente cancelada", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

export default async function OrdemDetailPage(props: { params: Promise<{ id: string }> }) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();
  const { id } = await props.params;
  const order = await getPurchaseOrderById(id);

  if (!order) {
    notFound();
  }

  const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusInfo.icon;
  const items = order.items ?? [];

  const totalReceived = items.reduce((sum, item) => sum + (item.quantity_received ?? 0), 0);
  const totalOrdered = items.reduce((sum, item) => sum + (item.quantity_ordered ?? 0), 0);
  const totalPending = items.reduce(
    (sum, item) => sum + Math.max(0, (item.quantity_ordered ?? 0) - (item.quantity_received ?? 0) - (item.quantity_cancelled ?? 0)),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/compras/ordens"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para ordens
      </Link>

      {/* Header Card */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-barber-white">{order.purchase_number}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusInfo.color}`}>
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-barber-muted">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-barber-gold" />
                {order.supplier_name ?? "Fornecedor desconhecido"}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-barber-gold" />
                Emitida em {new Date(order.issue_date).toLocaleDateString("pt-BR")}
              </span>
              {order.expected_delivery_date && (
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-barber-gold" />
                  Previsão: {new Date(order.expected_delivery_date).toLocaleDateString("pt-BR")}
                </span>
              )}
              {order.warehouse_name && (
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-barber-gold" />
                  Destino: {order.warehouse_name}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-barber-muted">Total da ordem</p>
            <p className="text-2xl font-bold text-barber-white">{brl.format(order.total_amount)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {totalOrdered > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-barber-muted">Progresso do recebimento</span>
              <span className="text-barber-white">
                {totalReceived} / {totalOrdered} itens ({totalPending} pendentes)
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-barber-dark">
              <div
                className="h-full rounded-full bg-barber-gold transition-all"
                style={{ width: `${Math.min(100, (totalReceived / totalOrdered) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <OrderActions order={order} />

      {/* Items Table */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-barber-white">Itens da ordem</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-barber-border bg-barber-dark/50">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-barber-white">Produto</th>
                <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Qtd. pedida</th>
                <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Qtd. recebida</th>
                <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Qtd. pendente</th>
                <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Preço unit.</th>
                <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-barber-border">
              {items.map((item) => {
                const pending = Math.max(0, item.quantity_ordered - item.quantity_received - item.quantity_cancelled);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-barber-dark/15">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-barber-white">{item.product_name_snapshot}</p>
                      {item.sku_snapshot && (
                        <p className="text-xs text-barber-muted">SKU: {item.sku_snapshot}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-barber-white">{item.quantity_ordered}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-green-700">{item.quantity_received}</td>
                    <td className="px-4 py-2.5 text-right text-barber-muted">
                      {pending > 0 ? pending : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-barber-muted">
                      {brl.format(item.unit_price)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-barber-white">
                      {brl.format(item.line_total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-barber-border bg-barber-dark/30">
              <tr>
                <td colSpan={5} className="px-4 py-2.5 text-right font-semibold text-barber-white">Subtotal</td>
                <td className="px-4 py-2.5 text-right font-semibold text-barber-white">{brl.format(order.subtotal)}</td>
              </tr>
              {order.discount_total > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right text-barber-muted">Desconto</td>
                  <td className="px-4 py-2.5 text-right text-barber-error">-{brl.format(order.discount_total)}</td>
                </tr>
              )}
              {order.freight_amount > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right text-barber-muted">Frete</td>
                  <td className="px-4 py-2.5 text-right text-barber-white">{brl.format(order.freight_amount)}</td>
                </tr>
              )}
              {order.additional_costs > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right text-barber-muted">Custos adicionais</td>
                  <td className="px-4 py-2.5 text-right text-barber-white">{brl.format(order.additional_costs)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-barber-border">
                <td colSpan={5} className="px-4 py-3 text-right text-base font-bold text-barber-white">Total</td>
                <td className="px-4 py-3 text-right text-base font-bold text-barber-white">{brl.format(order.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes & Terms */}
      {(order.notes || order.commercial_terms) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {order.notes && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-barber-white">Observações</h2>
              <p className="mt-3 whitespace-pre-line text-sm text-barber-muted">{order.notes}</p>
            </div>
          )}
          {order.commercial_terms && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-barber-white">Condições comerciais</h2>
              <p className="mt-3 whitespace-pre-line text-sm text-barber-muted">{order.commercial_terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Metadata Footer */}
      <div className="rounded-lg border border-barber-border/50 bg-barber-dark/30 px-4 py-3 text-xs text-barber-muted">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>Criado em: {new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
          {order.approved_at && (
            <span>Aprovado em: {new Date(order.approved_at).toLocaleDateString("pt-BR")}</span>
          )}
          {order.sent_at && (
            <span>Enviado em: {new Date(order.sent_at).toLocaleDateString("pt-BR")}</span>
          )}
          {order.received_at && (
            <span>Recebido em: {new Date(order.received_at).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>
    </div>
  );
}