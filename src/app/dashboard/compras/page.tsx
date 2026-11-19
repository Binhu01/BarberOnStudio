// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import {
  ShoppingCart,
  Users,
  Package,
  Truck,
  AlertTriangle,
  DollarSign,
  ArrowRight,
  Clock,
} from "lucide-react";
import { getPurchasesDashboard } from "./actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-barber-muted/10 text-barber-muted" },
  approved: { label: "Aprovada", color: "bg-barber-gold/10 text-barber-gold" },
  sent: { label: "Enviada", color: "bg-barber-copper/10 text-barber-copper" },
  partially_received: { label: "Parcial", color: "bg-barber-warning/10 text-barber-warning" },
  received: { label: "Recebida", color: "bg-barber-success/10 text-barber-success" },
  partially_cancelled: { label: "Parc. cancelada", color: "bg-barber-warning/10 text-barber-warning" },
  cancelled: { label: "Cancelada", color: "bg-barber-error/10 text-barber-error" },
};

export default async function ComprasPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();

  const stats = await getPurchasesDashboard();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">Compras</h1>
        <p className="mt-1 text-sm text-barber-muted">
          Visão geral de fornecedores, ordens de compra e recebimentos · Últimos 30 dias
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <Users className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Fornecedores ativos</p>
              <p className="text-xl font-bold text-barber-white">{stats.activeSuppliers}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-copper/10">
              <ShoppingCart className="h-5 w-5 text-barber-copper" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Ordens no período</p>
              <p className="text-xl font-bold text-barber-white">{stats.totalOrdersInPeriod}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-barber-muted">{stats.ordersInProgress} em andamento</span>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-success/10">
              <DollarSign className="h-5 w-5 text-barber-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Total em compras</p>
              <p className="text-xl font-bold text-barber-white">{brl.format(stats.totalPurchaseAmount)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-barber-muted">
              A pagar: {brl.format(stats.payablesFromPurchases)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-warning/10">
              <Truck className="h-5 w-5 text-barber-warning" />
            </div>
            <div>
              <p className="text-xs font-medium text-barber-muted">Aguardando recebimento</p>
              <p className="text-xl font-bold text-barber-white">{stats.ordersAwaitingReceipt}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-barber-muted">
              {stats.partiallyReceivedOrders} parciais
            </span>
            {stats.lateDeliveries > 0 && (
              <span className="flex items-center gap-0.5 text-barber-error">
                <AlertTriangle className="h-3 w-3" />
                {stats.lateDeliveries} atrasadas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Secondary KPIs Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-barber-white">{stats.completedOrders}</p>
          <p className="text-xs text-barber-muted">Concluídas no período</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-barber-warning">{stats.partiallyReceivedOrders}</p>
          <p className="text-xs text-barber-muted">Parcialmente recebidas</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <p className={`text-2xl font-bold ${stats.lateDeliveries > 0 ? "text-barber-error" : "text-barber-white"}`}>
            {stats.lateDeliveries}
          </p>
          <p className="text-xs text-barber-muted">Entregas atrasadas</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-barber-white">{stats.topSuppliers.length}</p>
          <p className="text-xs text-barber-muted">Fornecedores utilizados</p>
        </div>
      </div>

      {/* Recent Orders + Upcoming Receipts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-barber-white">Ordens recentes</h2>
            <Link href="/dashboard/compras/ordens" className="text-sm font-medium text-barber-gold hover:underline">
              Ver todas
            </Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="mb-3 h-10 w-10 text-barber-muted/40" />
              <p className="text-sm text-barber-muted">Nenhuma ordem de compra registrada</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {stats.recentOrders.map((order) => {
                const statusInfo = STATUS_LABELS[order.status] ?? STATUS_LABELS.draft;
                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/compras/ordens/${order.id}`}
                    className="flex items-center justify-between rounded-lg border border-barber-border/50 p-3 transition-colors hover:bg-barber-dark/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-barber-white">{order.purchaseNumber}</p>
                      <p className="truncate text-xs text-barber-muted">
                        {order.supplierName} · {new Date(order.issueDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <p className="text-sm font-semibold text-barber-white">{brl.format(order.totalAmount)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Receipts */}
        <div className="space-y-6">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-barber-white">Próximos recebimentos</h2>
              <Link href="/dashboard/compras/ordens" className="text-sm font-medium text-barber-gold hover:underline">
                Ver ordens
              </Link>
            </div>
            {stats.upcomingReceipts.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center text-center">
                <Clock className="mb-3 h-8 w-8 text-barber-muted/40" />
                <p className="text-sm text-barber-muted">Sem recebimentos previstos</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {stats.upcomingReceipts.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-barber-border/50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-barber-white">{item.purchaseNumber}</p>
                      <p className="text-xs text-barber-muted">
                        {item.supplierName} · Previsto: {new Date(item.expectedDeliveryDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-barber-white">{brl.format(item.totalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Suppliers Mini */}
          {stats.topSuppliers.length > 0 && (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-barber-gold" />
                <h2 className="font-display text-lg font-semibold text-barber-white">Top fornecedores</h2>
              </div>
              <div className="mt-3 space-y-2">
                {stats.topSuppliers.map((supplier, i) => (
                  <div key={supplier.supplierId} className="flex items-center justify-between rounded-lg border border-barber-border/50 p-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-barber-gold/10 text-xs font-bold text-barber-gold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-barber-white">{supplier.supplierName}</p>
                        <p className="text-xs text-barber-muted">{supplier.orderCount} ordens</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-barber-white">{brl.format(supplier.totalAmount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="font-display text-lg font-semibold text-barber-white">Módulo de compras</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { label: "Fornecedores", href: "/dashboard/compras/fornecedores", icon: Users, description: "Cadastro, contatos e endereços" },
            { label: "Ordens de compra", href: "/dashboard/compras/ordens", icon: ShoppingCart, description: "Criar, aprovar e acompanhar" },
            { label: "Recebimentos", href: "/dashboard/compras/recebimentos", icon: Package, description: "Registrar entradas e divergências" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-4 rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm transition-all hover:border-barber-gold/30 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 transition-colors group-hover:bg-barber-gold group-hover:text-barber-white">
                <link.icon className="h-5 w-5 text-barber-gold transition-colors group-hover:text-barber-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-semibold text-barber-white">{link.label}</h3>
                <p className="mt-1 text-sm text-barber-muted">{link.description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-barber-muted/40 transition-transform group-hover:translate-x-1 group-hover:text-barber-gold" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}