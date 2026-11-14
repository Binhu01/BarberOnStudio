export const instant = false;

import { headers } from "next/headers";
import { DollarSign, CreditCard, CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { getClientSubscriptions } from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Pago", color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
  expired: { label: "Vencido", color: "text-red-600", bg: "bg-red-50", icon: XCircle },
  paused: { label: "Pausado", color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
  cancelled: { label: "Cancelado", color: "text-gray-600", bg: "bg-gray-50", icon: XCircle },
};

export default async function AssinaturasPagamentosPage() {
  await headers();

  const subscriptions = await getClientSubscriptions().catch(() => []);

  const totalRevenue = subscriptions
    .filter((s: any) => s.status === "active")
    .reduce((sum: number, s: any) => sum + (s.price ?? 0), 0);

  const activeCount = subscriptions.filter((s: any) => s.status === "active").length;
  const expiredCount = subscriptions.filter((s: any) => s.status === "expired").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-dark">Pagamentos de Assinaturas</h1>
          <p className="mt-1 text-sm text-barber-text-secondary">
            Acompanhe o status de pagamento das assinaturas dos clientes
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-dark">{brl.format(totalRevenue)}</p>
              <p className="text-xs text-barber-text-secondary">Receita mensal ativa</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-dark">{activeCount}</p>
              <p className="text-xs text-barber-text-secondary">Pagamentos em dia</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
              <p className="text-xs text-barber-text-secondary">Pagamentos pendentes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-text-secondary" />
        <input
          type="text"
          placeholder="Buscar por cliente ou plano..."
          className="w-full rounded-lg border border-barber-border bg-white py-2.5 pl-10 pr-4 text-sm text-barber-dark placeholder:text-barber-text-secondary focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
        />
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-dark">
          Status de Pagamentos
        </h2>
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
            <p className="text-sm text-barber-text-secondary">
              Nenhuma assinatura cadastrada para exibir pagamentos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-text-secondary">
                  <th className="pb-3 pr-4 font-medium">Cliente</th>
                  <th className="pb-3 pr-4 font-medium">Plano</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Última renovação</th>
                  <th className="pb-3 pr-4 font-medium">Próxima cobrança</th>
                  <th className="pb-3 pr-4 text-right font-medium">Valor</th>
                  <th className="pb-3 text-right font-medium">Total pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {subscriptions.map((sub: any) => {
                  const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={sub.id} className="transition-colors hover:bg-barber-bg-secondary/30">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-barber-dark">{sub.customer_name ?? "Sem nome"}</p>
                        <p className="text-[10px] text-barber-text-secondary">{sub.customer_phone ?? ""}</p>
                      </td>
                      <td className="py-3 pr-4 text-barber-dark">{sub.plan_name ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-barber-text-secondary">
                        {sub.last_renewal_at
                          ? new Date(sub.last_renewal_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-barber-text-secondary">
                        {sub.expires_at
                          ? new Date(sub.expires_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-barber-dark">
                        {brl.format(sub.price ?? 0)}
                      </td>
                      <td className="py-3 text-right font-semibold text-barber-dark">
                        {brl.format((sub.price ?? 0) * (sub.renewal_count ?? 1))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}