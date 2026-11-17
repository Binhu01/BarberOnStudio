// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import Link from "next/link";
import {
  BarChart3,
  Users,
  ShoppingCart,
  Package,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";
import {
  getPurchasesBySupplier,
  getPurchasesByPeriod,
  getMostPurchasedProducts,
} from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosComprasPage() {
  await headers();

  // Default date range: last 12 months
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 1);
  const from = fromDate.toISOString().slice(0, 10);
  const dateRange = { from, to };

  const [bySupplier, byPeriod, topProducts] = await Promise.all([
    getPurchasesBySupplier(dateRange),
    getPurchasesByPeriod(dateRange),
    getMostPurchasedProducts(dateRange),
  ]);

  const totalAmount = bySupplier.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalOrders = bySupplier.reduce((sum, s) => sum + s.orderCount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Relatórios de compras</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Análise de fornecedores, tendências por período e produtos mais adquiridos
          </p>
        </div>
        <Link
          href="/dashboard/compras"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao dashboard
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <BarChart3 className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Total em compras</p>
              <p className="text-xl font-bold text-barber-white">{brl.format(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Total de ordens</p>
              <p className="text-xl font-bold text-barber-white">{totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-success/10">
              <TrendingUp className="h-5 w-5 text-barber-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Ticket médio</p>
              <p className="text-xl font-bold text-barber-white">
                {totalOrders > 0 ? brl.format(totalAmount / totalOrders) : "R$ 0,00"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Purchases by Supplier */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-barber-gold" />
          <h2 className="font-display text-lg font-semibold text-barber-white">Compras por fornecedor</h2>
        </div>
        {bySupplier.length === 0 ? (
          <p className="mt-6 text-center text-sm text-barber-muted">Sem dados para exibir.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark/50">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Fornecedor</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Ordens</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-barber-white">Ticket médio</th>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {bySupplier.map((supplier) => {
                  const share = totalAmount > 0 ? (supplier.totalAmount / totalAmount) * 100 : 0;
                  return (
                    <tr key={supplier.supplierId} className="transition-colors hover:bg-barber-dark/50/30">
                      <td className="px-4 py-2.5 font-medium text-barber-white">{supplier.supplierName}</td>
                      <td className="px-4 py-2.5 text-right text-barber-muted">{supplier.orderCount}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-barber-white">
                        {brl.format(supplier.totalAmount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-barber-muted">
                        {brl.format(supplier.avgOrderValue)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-barber-dark">
                            <div
                              className="h-full rounded-full bg-barber-gold"
                              style={{ width: `${Math.min(100, share)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-barber-muted">{share.toFixed(1)}%</span>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Purchases by Period */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-barber-gold" />
            <h2 className="font-display text-lg font-semibold text-barber-white">Evolução mensal</h2>
          </div>
          {byPeriod.length === 0 ? (
            <p className="mt-6 text-center text-sm text-barber-muted">Sem dados para exibir.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {byPeriod.map((period) => {
                const maxAmount = Math.max(...byPeriod.map((p) => p.totalAmount), 1);
                const barWidth = (period.totalAmount / maxAmount) * 100;
                return (
                  <div key={period.period} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-barber-muted">
                      {period.period}
                    </span>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded-md bg-barber-dark">
                        <div
                          className="flex h-full items-center rounded-md bg-barber-gold px-2 text-[10px] font-bold text-white"
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        >
                          {barWidth > 15 && brl.format(period.totalAmount)}
                        </div>
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs font-medium text-barber-white">
                      {period.orderCount} ord.
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Most Purchased Products */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-barber-gold" />
            <h2 className="font-display text-lg font-semibold text-barber-white">Produtos mais comprados</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="mt-6 text-center text-sm text-barber-muted">Sem dados para exibir.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-barber-border bg-barber-dark/50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-barber-white">Produto</th>
                    <th className="px-3 py-2 text-right font-semibold text-barber-white">Qtd.</th>
                    <th className="px-3 py-2 text-right font-semibold text-barber-white">Total</th>
                    <th className="px-3 py-2 text-right font-semibold text-barber-white">Fornec.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-barber-border">
                  {topProducts.map((product) => (
                    <tr key={product.productId} className="transition-colors hover:bg-barber-dark/50/30">
                      <td className="px-3 py-2">
                        <p className="font-medium text-barber-white">{product.productName}</p>
                        {product.sku && (
                          <p className="text-xs text-barber-muted">{product.sku}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-barber-muted">
                        {product.totalQuantity}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-barber-white">
                        {brl.format(product.totalAmount)}
                      </td>
                      <td className="px-3 py-2 text-right text-barber-muted">
                        {product.supplierCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}