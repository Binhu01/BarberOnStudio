// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import { Package, AlertTriangle, Warehouse, ArrowRightLeft } from "lucide-react";
import { getInventoryKPIs, getInventoryValuation, getMovementSummary } from "../actions";
import { KPICard } from "../_components/kpi-card";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosEstoquePage() {
  await headers();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const dateRange = {
    from: thirtyDaysAgo.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };

  const [kpis, valuation, movements] = await Promise.all([
    getInventoryKPIs(),
    getInventoryValuation(),
    getMovementSummary(dateRange),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-dark">Relatórios de Estoque</h1>
        <p className="mt-1 text-sm text-barber-text-secondary">
          Posição atual, valuation e movimentações dos últimos 30 dias
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Produtos ativos"
          value={kpis.totalProducts}
          icon={<Package className="h-5 w-5" />}
          accentColor="bg-barber-blue/10 text-barber-blue"
        />
        <KPICard
          label="Valor total em estoque"
          value={brl.format(kpis.totalInventoryValue)}
          icon={<Warehouse className="h-5 w-5" />}
          accentColor="bg-green-50 text-green-600"
        />
        <KPICard
          label="Estoque baixo"
          value={kpis.lowStockProducts}
          icon={<AlertTriangle className="h-5 w-5" />}
          accentColor="bg-amber-50 text-amber-600"
          subtitle={`${kpis.outOfStockProducts} sem estoque`}
        />
        <KPICard
          label="Movimentações (30d)"
          value={kpis.totalMovements}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          accentColor="bg-barber-cyan/10 text-barber-cyan"
        />
      </div>

      {/* Inventory Valuation Table */}
      <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-barber-dark">Posição de estoque por produto</h2>
        {valuation.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center text-center">
            <Package className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
            <p className="text-sm text-barber-text-secondary">Nenhum produto com estoque registrado</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wide text-barber-text-secondary">
                  <th className="pb-3 pr-4 font-medium">Produto</th>
                  <th className="pb-3 pr-4 font-medium">Depósito</th>
                  <th className="pb-3 pr-4 text-right font-medium">Qtd. disponível</th>
                  <th className="pb-3 pr-4 text-right font-medium">Custo unitário</th>
                  <th className="pb-3 text-right font-medium">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {valuation.slice(0, 50).map((row) => (
                  <tr key={`${row.product_id}-${row.warehouse_id}-${row.variant_id ?? "base"}`}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-barber-dark">{row.product_name}</p>
                      {row.variant_name && (
                        <p className="text-xs text-barber-text-secondary">{row.variant_name}</p>
                      )}
                      {(row.product_sku || row.variant_sku) && (
                        <p className="text-[10px] text-barber-text-secondary/60">
                          {row.variant_sku ?? row.product_sku}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-barber-text-secondary">{row.warehouse_name}</td>
                    <td className={`py-3 pr-4 text-right font-medium ${row.quantity_available <= 0 ? "text-red-600" : row.quantity_available <= 5 ? "text-amber-600" : "text-barber-dark"}`}>
                      {row.quantity_available}
                    </td>
                    <td className="py-3 pr-4 text-right text-barber-text-secondary">
                      {brl.format(row.unit_cost)}
                    </td>
                    <td className="py-3 text-right font-semibold text-barber-dark">
                      {brl.format(row.total_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {valuation.length > 50 && (
              <p className="mt-3 text-center text-xs text-barber-text-secondary">
                Exibindo 50 de {valuation.length} registros. Exporte para ver todos.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Movement Summary */}
      <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-barber-dark">Resumo de movimentações (30 dias)</h2>
        {movements.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center text-center">
            <ArrowRightLeft className="mb-3 h-8 w-8 text-barber-text-secondary/40" />
            <p className="text-sm text-barber-text-secondary">Sem movimentações no período</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {movements.map((m) => (
              <div key={m.movementType} className="flex items-center justify-between rounded-lg border border-barber-border/50 p-4">
                <div>
                  <p className="text-sm font-medium capitalize text-barber-dark">
                    {m.movementType.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-barber-text-secondary">{m.count} registros</p>
                </div>
                <p className="text-lg font-bold text-barber-dark">{m.totalQuantity} un.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}