// This page uses dynamic server data
export const instant = false;

import Link from "next/link";
import {
  Warehouse,
  Package,
  AlertTriangle,
  ArrowLeftRight,
  TrendingUp,
  Box,
} from "lucide-react";
import {
  getInventoryBalances,
  getInventoryAlerts,
  getInventoryStats,
  getWarehouses,
} from "./actions";
import { getActiveOrganization } from "@/lib/organizations";

export default async function EstoquePage() {
  const activeData = await getActiveOrganization();
  if (!activeData) return null;

  const [stats, alerts, balances] = await Promise.all([
    getInventoryStats(activeData.org.id),
    getInventoryAlerts(),
    getInventoryBalances(),
  ]);

  const topBalances = balances.slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Controle de Estoque
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/estoque/movimentacoes"
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white hover:bg-barber-dark/50 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Movimentações
          </Link>
          <Link
            href="/dashboard/estoque/depositos"
            className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white hover:bg-barber-copper transition-colors"
          >
            <Warehouse className="w-4 h-4" />
            Depósitos
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Depósitos Ativos</p>
              <p className="text-2xl font-bold text-barber-white">
                {stats.total_warehouses}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Movimentações (Mês)</p>
              <p className="text-2xl font-bold text-barber-white">
                {stats.total_movements_month}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-warning/10 text-barber-warning">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Itens com Reserva</p>
              <p className="text-2xl font-bold text-barber-white">
                {stats.items_with_reservations}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Qtd. Reservada</p>
              <p className="text-2xl font-bold text-barber-white">
                {stats.total_reserved_quantity}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-barber-white">
          <AlertTriangle className="w-5 h-5 text-barber-warning" />
          Alertas de Estoque
        </h2>

        {alerts.length === 0 ? (
          <div className="rounded-xl border border-barber-success/20 bg-barber-success/5 p-6 text-center">
            <p className="text-barber-success font-medium">
              Nenhum alerta de estoque. Todos os produtos estão dentro dos níveis mínimos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((alert, idx) => (
              <div
                key={`${alert.product_id}-${alert.warehouse_id}-${alert.variant_id ?? "base"}-${idx}`}
                className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/produtos/${alert.product_id}`}
                      className="truncate text-sm font-semibold text-barber-white hover:text-barber-gold hover:underline"
                    >
                      {alert.product_name}
                    </Link>
                    {alert.product_sku && (
                      <p className="text-xs text-barber-muted">
                        SKU: {alert.product_sku}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      alert.alert_type === "out_of_stock"
                        ? "bg-barber-error/10 text-barber-error"
                        : "bg-barber-warning/10 text-barber-warning"
                    }`}
                  >
                    {alert.alert_type === "out_of_stock"
                      ? "Sem Estoque"
                      : "Estoque Baixo"}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-barber-muted">Depósito:</span>
                    <span className="font-medium text-barber-white">
                      {alert.warehouse_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-barber-muted">Disponível:</span>
                    <span className="font-medium text-barber-white">
                      {alert.quantity_available}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-barber-muted">Mínimo:</span>
                    <span className="font-medium text-barber-white">
                      {alert.minimum_stock}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Balance Table */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-barber-white">
          Saldo de Estoque
        </h2>

        {topBalances.length === 0 ? (
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 text-center">
            <p className="text-barber-muted">
              Nenhum saldo de estoque registrado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark">
                <tr>
                  <th className="px-4 py-3 font-semibold text-barber-white">
                    Produto
                  </th>
                  <th className="px-4 py-3 font-semibold text-barber-white">
                    SKU
                  </th>
                  <th className="px-4 py-3 font-semibold text-barber-white">
                    Depósito
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-barber-white">
                    Em Mão
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-barber-white">
                    Reservado
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-barber-white">
                    Disponível
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {topBalances.map((balance) => {
                  const onHand = Number(balance.quantity_on_hand);
                  const reserved = Number(balance.quantity_reserved);
                  const available = onHand - reserved;

                  return (
                    <tr
                      key={balance.id}
                      className="hover:bg-barber-dark/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/produtos/${balance.product.id}`}
                          className="font-medium text-barber-white hover:text-barber-gold hover:underline"
                        >
                          {balance.product.name}
                        </Link>
                        {balance.variant && (
                          <span className="ml-1 text-xs text-barber-muted">
                            ({balance.variant.name})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-barber-muted">
                        {balance.variant?.sku ?? balance.product.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-barber-white">
                        {balance.warehouse.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-barber-white">
                        {onHand}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-barber-muted">
                        {reserved}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-barber-white">
                        {available}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {balances.length > 20 && (
          <div className="mt-3 text-center">
            <Link
              href="/dashboard/estoque/saldos"
              className="text-sm font-medium text-barber-gold hover:underline"
            >
              Ver todos os saldos ({balances.length})
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}