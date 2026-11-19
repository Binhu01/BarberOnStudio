// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import {
  Package,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";
import { getGoodsReceipts } from "../actions";
import type { GoodsReceiptStatus } from "@/types/purchases";

const STATUS_CONFIG: Record<GoodsReceiptStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  confirmed: { label: "Confirmado", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  partial: { label: "Parcial", color: "bg-amber-100 text-amber-700", icon: Package },
  with_discrepancies: { label: "Com divergências", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

export default async function RecebimentosPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();
  const params = await props.searchParams;
  const search = params.q ?? "";
  const statusFilter = (params.status as GoodsReceiptStatus | undefined) ?? undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 20;

  // getGoodsReceipts does not support search/status filters yet — fetch all and filter client-side if needed
  const result = await getGoodsReceipts({ page, perPage });
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">Recebimentos</h1>
        <p className="mt-1 text-sm text-barber-muted">
          Histórico de entradas de mercadorias e confirmações de recebimento · {result.total} registros
        </p>
      </div>

      {/* Filters */}
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar por número do recebimento ou ordem…"
            className="w-full rounded-lg border border-barber-border bg-barber-graphite py-2.5 pl-10 pr-4 text-sm text-barber-white placeholder:text-barber-muted/60 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
        >
          <option value="">Todos os status</option>
          <option value="confirmed">Confirmados</option>
          <option value="partial">Parciais</option>
          <option value="with_discrepancies">Com divergências</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-barber-border bg-barber-graphite px-4 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      {result.receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-16 text-center">
          <Package className="mb-4 h-12 w-12 text-barber-muted/30" />
          <p className="text-base font-medium text-barber-white">Nenhum recebimento encontrado</p>
          <p className="mt-1 text-sm text-barber-muted">
            {search || statusFilter
              ? "Tente ajustar os filtros de busca."
              : "Registre um recebimento a partir de uma ordem de compra."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-barber-white">Número</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Ordem de compra</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Depósito</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Data</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Status</th>
                  <th className="px-4 py-3 font-semibold text-barber-white">Recebido por</th>
                  <th className="px-4 py-3 text-right font-semibold text-barber-white">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {result.receipts.map((receipt) => {
                  const statusInfo = STATUS_CONFIG[receipt.status] ?? STATUS_CONFIG.confirmed;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={receipt.id} className="transition-colors hover:bg-barber-dark/15">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/compras/recebimentos/${receipt.id}`}
                          className="font-medium text-barber-white hover:text-barber-gold"
                        >
                          {receipt.receipt_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/compras/ordens/${receipt.purchase_order_id}`}
                          className="text-barber-gold hover:underline"
                        >
                          {receipt.purchase_number ?? receipt.purchase_order_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-barber-muted">
                        {receipt.warehouse_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-barber-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(receipt.received_at).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-barber-muted">
                        {receipt.receiver_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/compras/recebimentos/${receipt.id}`}
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
                Página {result.page} de {totalPages} · {result.total} recebimentos
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