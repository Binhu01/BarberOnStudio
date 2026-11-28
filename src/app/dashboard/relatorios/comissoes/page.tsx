
import { connection } from "next/server";
import { DollarSign, Users, BarChart3 } from "lucide-react";
import { getBarberRanking } from "@/app/dashboard/integracoes/actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosComissoesPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();

  const ranking = await getBarberRanking().catch(() => []);

  const totalRevenue = ranking.reduce((sum, r) => sum + (r.revenue_generated ?? 0), 0);
  const totalAppointments = ranking.reduce((sum, r) => sum + (r.appointments_completed ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Relatório de Comissões
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Desempenho e receita gerada por profissional para cálculo de comissões
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <Users className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{ranking.length}</p>
              <p className="text-xs text-barber-muted">Profissionais ativos</p>
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
              <p className="text-xs text-barber-muted">Receita total gerada</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <BarChart3 className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{totalAppointments}</p>
              <p className="text-xs text-barber-muted">Atendimentos concluídos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barber Ranking Table */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Ranking de Profissionais por Receita
        </h2>
        {ranking.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-barber-muted/40" />
            <p className="text-sm text-barber-muted">
              Sem dados de desempenho para exibir
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-muted">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Profissional</th>
                  <th className="pb-3 pr-4 text-right font-medium">Atendimentos</th>
                  <th className="pb-3 pr-4 text-right font-medium">Clientes únicos</th>
                  <th className="pb-3 pr-4 text-right font-medium">Ticket médio</th>
                  <th className="pb-3 pr-4 text-right font-medium">Taxa conclusão</th>
                  <th className="pb-3 text-right font-medium">Receita gerada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {ranking.map((barber, i) => (
                  <tr key={barber.barber_id ?? i} className="transition-colors hover:bg-barber-dark/30">
                    <td className="py-3 pr-4 font-medium text-barber-muted">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {barber.barber_avatar && (
                          <img
                            src={barber.barber_avatar}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        )}
                        <span className="font-medium text-barber-white">
                          {barber.barber_name ?? "Sem nome"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">{barber.appointments_completed}</td>
                    <td className="py-3 pr-4 text-right">{barber.unique_customers_served}</td>
                    <td className="py-3 pr-4 text-right">{brl.format(barber.avg_ticket)}</td>
                    <td className="py-3 pr-4 text-right">
                      {barber.completion_rate_pct?.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right font-semibold text-barber-white">
                      {brl.format(barber.revenue_generated)}
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