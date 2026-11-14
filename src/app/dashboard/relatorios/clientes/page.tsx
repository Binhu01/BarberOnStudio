export const instant = false;

import { headers } from "next/headers";
import { Users, DollarSign, Clock, TrendingUp, UserCheck, UserX } from "lucide-react";
import { getCustomerRetention } from "@/app/dashboard/integracoes/actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof UserCheck }> = {
  active: { label: "Ativo", color: "text-green-600", bg: "bg-green-50", icon: UserCheck },
  at_risk: { label: "Em risco", color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
  churned: { label: "Perdido", color: "text-red-600", bg: "bg-red-50", icon: UserX },
};

export default async function RelatoriosClientesPage() {
  await headers();

  const customers = await getCustomerRetention().catch(() => []);

  const stats = customers.reduce(
    (acc, c) => {
      acc.total++;
      acc.lifetimeValue += c.lifetime_value ?? 0;
      if (c.retention_status === "active") acc.active++;
      else if (c.retention_status === "at_risk") acc.atRisk++;
      else acc.churned++;
      return acc;
    },
    { total: 0, lifetimeValue: 0, active: 0, atRisk: 0, churned: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-dark">
          Relatório de Clientes
        </h1>
        <p className="mt-1 text-sm text-barber-text-secondary">
          Análise de retenção, frequência e valor vitalício dos clientes
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <Users className="mx-auto mb-2 h-5 w-5 text-blue-500" />
          <p className="text-xl font-bold text-barber-dark">{stats.total}</p>
          <p className="text-xs text-barber-text-secondary">Total clientes</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <UserCheck className="mx-auto mb-2 h-5 w-5 text-green-500" />
          <p className="text-xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-barber-text-secondary">Ativos</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <Clock className="mx-auto mb-2 h-5 w-5 text-amber-500" />
          <p className="text-xl font-bold text-amber-600">{stats.atRisk}</p>
          <p className="text-xs text-barber-text-secondary">Em risco</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <UserX className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-xl font-bold text-red-600">{stats.churned}</p>
          <p className="text-xs text-barber-text-secondary">Perdidos</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <DollarSign className="mx-auto mb-2 h-5 w-5 text-indigo-500" />
          <p className="text-xl font-bold text-barber-dark">{brl.format(stats.lifetimeValue)}</p>
          <p className="text-xs text-barber-text-secondary">LTV total</p>
        </div>
      </div>

      {/* Customer Retention Table */}
      <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-dark">
          Ranking por Valor Vitalício (LTV)
        </h2>
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
            <p className="text-sm text-barber-text-secondary">
              Sem dados de clientes para exibir
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-text-secondary">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Cliente</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 text-right font-medium">Visitas</th>
                  <th className="pb-3 pr-4 text-right font-medium">Ticket médio</th>
                  <th className="pb-3 pr-4 text-right font-medium">Freq. (dias)</th>
                  <th className="pb-3 text-right font-medium">LTV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {customers.slice(0, 50).map((cust, i) => {
                  const statusCfg = STATUS_CONFIG[cust.retention_status] ?? STATUS_CONFIG.churned;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={i} className="transition-colors hover:bg-barber-bg-secondary/30">
                      <td className="py-3 pr-4 font-medium text-barber-text-secondary">{i + 1}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-barber-dark">{cust.customer_name ?? "Sem nome"}</p>
                        <p className="text-[10px] text-barber-text-secondary">{cust.customer_phone ?? ""}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">{cust.total_visits}</td>
                      <td className="py-3 pr-4 text-right">{brl.format(cust.avg_ticket)}</td>
                      <td className="py-3 pr-4 text-right text-barber-text-secondary">
                        {cust.avg_days_between_visits ? `${Math.round(cust.avg_days_between_visits)}d` : "—"}
                      </td>
                      <td className="py-3 text-right font-semibold text-barber-dark">
                        {brl.format(cust.lifetime_value)}
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