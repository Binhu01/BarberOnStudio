export const instant = false;

import { headers } from "next/headers";
import { Package, DollarSign, TrendingUp, ShoppingCart } from "lucide-react";
import { getProductSalesReport } from "@/app/dashboard/integracoes/actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosProdutosPage() {
  await headers();

  const products = await getProductSalesReport().catch(() => []);

  const totalRevenue = products.reduce((sum, p) => sum + (p.total_revenue ?? 0), 0);
  const totalUnits = products.reduce((sum, p) => sum + (p.units_sold ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Relatório de Produtos
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Produtos mais vendidos, receita e desempenho por categoria
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <Package className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{products.length}</p>
              <p className="text-xs text-barber-muted">Produtos vendidos</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-success/10">
              <DollarSign className="h-5 w-5 text-barber-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{brl.format(totalRevenue)}</p>
              <p className="text-xs text-barber-muted">Receita total</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{totalUnits}</p>
              <p className="text-xs text-barber-muted">Unidades vendidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Ranking Table */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Ranking de Produtos por Receita
        </h2>
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="mb-3 h-10 w-10 text-barber-muted/40" />
            <p className="text-sm text-barber-muted">
              Sem dados de vendas de produtos para exibir
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-muted">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Produto</th>
                  <th className="pb-3 pr-4 font-medium">Categoria</th>
                  <th className="pb-3 pr-4 text-right font-medium">Unidades</th>
                  <th className="pb-3 pr-4 text-right font-medium">Preço médio</th>
                  <th className="pb-3 pr-4 text-right font-medium">Pedidos</th>
                  <th className="pb-3 text-right font-medium">Receita total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {products.map((prod, i) => (
                  <tr key={i} className="transition-colors hover:bg-barber-dark/50/30">
                    <td className="py-3 pr-4 font-medium text-barber-muted">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-barber-white">
                      {prod.product_name ?? "Sem nome"}
                    </td>
                    <td className="py-3 pr-4 text-barber-muted capitalize">
                      {prod.category ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right">{prod.units_sold}</td>
                    <td className="py-3 pr-4 text-right">{brl.format(prod.avg_unit_price)}</td>
                    <td className="py-3 pr-4 text-right">{prod.orders_count}</td>
                    <td className="py-3 text-right font-semibold text-barber-white">
                      {brl.format(prod.total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}