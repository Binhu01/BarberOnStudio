// This page uses dynamic server data

import { connection } from "next/server";
import { UserCog, Users, Mail, Building2 } from "lucide-react";
import { getTeamKPIs, getTeamPerformance } from "../actions";
import { KPICard } from "../_components/kpi-card";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosEquipePage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const dateRange = {
    from: thirtyDaysAgo.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };

  const [kpis, performance] = await Promise.all([
    getTeamKPIs(),
    getTeamPerformance(dateRange),
  ]);

  // Sort by revenue descending
  const sortedPerformance = [...performance].sort(
    (a, b) => b.total_revenue - a.total_revenue
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Relatórios de Equipe
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Desempenho dos membros, departamentos e atividades · Últimos 30 dias
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Membros ativos"
          value={kpis.activeMembers}
          icon={<Users className="h-5 w-5" />}
          accentColor="bg-barber-gold/10 text-barber-gold"
        />
        <KPICard
          label="Convites pendentes"
          value={kpis.pendingInvitations}
          icon={<Mail className="h-5 w-5" />}
          accentColor="bg-amber-50 text-amber-600"
          subtitle={`${kpis.acceptedInvitations} aceitos`}
        />
        <KPICard
          label="Departamentos"
          value={Object.keys(kpis.membersByDepartment).length}
          icon={<Building2 className="h-5 w-5" />}
          accentColor="bg-barber-cyan/10 text-barber-cyan"
        />
        <KPICard
          label="Total de pedidos (equipe)"
          value={sortedPerformance.reduce((sum, p) => sum + p.order_count, 0)}
          icon={<UserCog className="h-5 w-5" />}
          accentColor="bg-barber-success/10 text-barber-success"
          subtitle={`Receita: ${brl.format(sortedPerformance.reduce((sum, p) => sum + p.total_revenue, 0))}`}
        />
      </div>

      {/* Members by Department */}
      {Object.keys(kpis.membersByDepartment).length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-white">
            Membros por departamento
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(kpis.membersByDepartment).map(([dept, count]) => (
              <div
                key={dept}
                className="flex items-center justify-between rounded-lg border border-barber-border/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-barber-gold/10">
                    <Building2 className="h-4 w-4 text-barber-gold" />
                  </div>
                  <span className="text-sm font-medium text-barber-white">
                    {dept}
                  </span>
                </div>
                <span className="text-lg font-bold text-barber-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Performance Table */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-barber-white">
          Desempenho por membro
        </h2>
        {sortedPerformance.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center text-center">
            <UserCog className="mb-3 h-10 w-10 text-barber-muted/40" />
            <p className="text-sm text-barber-muted">
              Nenhum pedido registrado pela equipe no período
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wide text-barber-muted">
                  <th className="pb-3 pr-4 font-medium">Membro</th>
                  <th className="pb-3 pr-4 font-medium">Cargo</th>
                  <th className="pb-3 pr-4 font-medium">Departamento</th>
                  <th className="pb-3 pr-4 text-right font-medium">Pedidos</th>
                  <th className="pb-3 pr-4 text-right font-medium">Receita</th>
                  <th className="pb-3 text-right font-medium">Ticket médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {sortedPerformance.map((member) => (
                  <tr key={member.user_id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-barber-white">
                        {member.full_name ?? member.email}
                      </p>
                      {member.full_name && (
                        <p className="text-xs text-barber-muted">
                          {member.email}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 capitalize text-barber-muted">
                      {member.role.toLowerCase()}
                    </td>
                    <td className="py-3 pr-4 text-barber-muted">
                      {member.department_name ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right text-barber-white">
                      {member.order_count}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-barber-white">
                      {brl.format(member.total_revenue)}
                    </td>
                    <td className="py-3 text-right text-barber-muted">
                      {brl.format(member.avg_ticket)}
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