// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import Link from "next/link";
import {
  ShoppingCart,
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  Truck,
} from "lucide-react";
import { getPurchaseOrders } from "../actions";
import type { PurchaseOrderStatus } from "@/types/purchases";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-barber-muted/10 text-barber-muted" },
  approved: { label: "Aprovada", color: "bg-blue-100 text-blue-700" },
  sent: { label: "Enviada", color: "bg-indigo-100 text-indigo-700" },
  partially_received: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
  received: { label: "Recebida", color: "bg-green-100 text-green-700" },
  partially_cancelled: { label: "Parc. cancelada", color: "bg-orange-100 text-orange-700" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

export default async function OrdensPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await headers();
  const params = await props.searchParams;
  const search = params.q ?? "";
  const statusFilter = (params.status as PurchaseOrderStatus | undefined) ?? undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 20;

  const result = await getPurchaseOrders({ search, status: statusFilter, page, perPage });
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Ordens de compra</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie ordens de compra e acompanhe recebimentos · {result.total} registros
          </p>
        </div>
        <Link
          href="/dashboard/compras/ordens/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-barber-gold/90"
        >
          <Plus className="h-4 w-4" />
          Nova ordem
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar por número ou fornecedor…"
            className="w-full rounded-lg border border-barber-border bg-barber-graphite py-2.5 pl-10 pr-4 text-sm text-barber-white placeholder:text-barber-muted/60 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
        >
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="approved">Aprovada</option>
          <option value="sent">Enviada</option>
          <option value="partially_received">Parcialmente recebida</option>
          <option value="received">Recebida</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-barber-border bg-barber-graphite px-4 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      {result.orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-16 text-center">
          <ShoppingCart className="mb-4 h-12 w-12 text-barber-muted/30" />
          <p className="text-base font-medium text-barber-white">Nenhuma ordem de compra encontrada</p>
          <p className="mt-1 text-sm text-barber-muted">
            {search || statusFilter
              ? "Tente ajustar os filtros de busca."
              : "Crie sua primeira ordem de compra para começar."}
          </p>
          {!search && !statusFilter && (
            <Link
              href="/dashboard/compras/ordens/novo"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-white hover:bg-barber-gold/90"
            >
              <Plus className="h-4 w-4" />
              Criar ordem
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-barber-white">Número</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Fornecedor</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Emissão</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Previsão</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-barber-white">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-barber-white">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {result.orders.map((order) => {
                  const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
                  const isLate =
                    order.expected_delivery_date &&
                    new Date(order.expected_delivery_date) < new Date() &&
                    !["received", "cancelled", "partially_cancelled"].includes(order.status);

                  return (
                    <tr key={order.id} className="transition-colors hover:bg-barber-dark/50/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/compras/ordens/${order.id}`}
                          className="font-medium text-barber-white hover:text-barber-gold"
                        >
                          {order.purchase_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-barber-white">{order.supplier_name ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-barber-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(order.issue_date).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-barber-muted">
                        {order.expected_delivery_date ? (
                          <span className={`flex items-center gap-1 ${isLate ? "text-barber-error" : ""}`}>
                            <Truck className="h-3 w-3" />
                            {new Date(order.expected_delivery_date).toLocaleDateString("pt-BR")}
                            {isLate && " (atrasada)"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-barber-white">
                        {brl.format(order.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/compras/ordens/${order.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-barber-gold hover:bg-barber-gold/10"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-barber-border px-4 py-3">
              <p className="text-xs text-barber-muted">
                Página {result.page} de {totalPages} · {result.total} ordens
              </p>
              <div className="flex gap-2">
                {result.page > 1 && (
                  <Link
                    href={{ query: { ...params, page: String(result.page - 1) } }}
                    className="rounded-md border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-white hover:bg-barber-dark/50"
                  >
                    Anterior
                  </Link>
                )}
                {result.page < totalPages && (
                  <Link
                    href={{ query: { ...params, page: String(result.page + 1) } }}
                    className="rounded-md border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-white hover:bg-barber-dark/50"
                  >
                    Próxima
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}