
import { connection } from "next/server";
import { CalendarDays, TrendingUp, Users, Clock, AlertTriangle } from "lucide-react";
import { getAppointmentsReport } from "@/app/dashboard/integracoes/actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosAgendamentosPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();

  const report = await getAppointmentsReport().catch(() => []);

  const totals = report.reduce(
    (acc, row) => ({
      appointments: acc.appointments + (row.total_appointments ?? 0),
      completed: acc.completed + (row.completed_appointments ?? 0),
      cancelled: acc.cancelled + (row.cancelled_appointments ?? 0),
      noShow: acc.noShow + (row.no_show_appointments ?? 0),
      revenue: acc.revenue + (row.total_revenue ?? 0),
    }),
    { appointments: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Relatório de Agendamentos
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Análise mensal de agendamentos, conclusões e receita gerada
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <CalendarDays className="mx-auto mb-2 h-5 w-5 text-blue-500" />
          <p className="text-xl font-bold text-barber-white">{totals.appointments}</p>
          <p className="text-xs text-barber-muted">Total agendados</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <TrendingUp className="mx-auto mb-2 h-5 w-5 text-green-500" />
          <p className="text-xl font-bold text-barber-success">{totals.completed}</p>
          <p className="text-xs text-barber-muted">Concluídos</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-xl font-bold text-barber-error">{totals.cancelled}</p>
          <p className="text-xs text-barber-muted">Cancelados</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <Clock className="mx-auto mb-2 h-5 w-5 text-amber-500" />
          <p className="text-xl font-bold text-amber-600">{totals.noShow}</p>
          <p className="text-xs text-barber-muted">No-shows</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
          <Users className="mx-auto mb-2 h-5 w-5 text-indigo-500" />
          <p className="text-xl font-bold text-barber-white">{brl.format(totals.revenue)}</p>
          <p className="text-xs text-barber-muted">Receita total</p>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Evolução Mensal
        </h2>
        {report.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-barber-muted/40" />
            <p className="text-sm text-barber-muted">
              Sem dados de agendamento para exibir
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-muted">
                  <th className="pb-3 pr-4 font-medium">Mês</th>
                  <th className="pb-3 pr-4 text-right font-medium">Agendados</th>
                  <th className="pb-3 pr-4 text-right font-medium">Concluídos</th>
                  <th className="pb-3 pr-4 text-right font-medium">Cancelados</th>
                  <th className="pb-3 pr-4 text-right font-medium">No-show</th>
                  <th className="pb-3 pr-4 text-right font-medium">Taxa conclusão</th>
                  <th className="pb-3 text-right font-medium">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {report.map((row, i) => {
                  const periodDate = new Date(row.period);
                  const label = periodDate.toLocaleDateString("pt-BR", {
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <tr key={i} className="transition-colors hover:bg-barber-dark/15">
                      <td className="py-3 pr-4 font-medium capitalize text-barber-white">
                        {label}
                      </td>
                      <td className="py-3 pr-4 text-right">{row.total_appointments}</td>
                      <td className="py-3 pr-4 text-right text-barber-success">
                        {row.completed_appointments}
                      </td>
                      <td className="py-3 pr-4 text-right text-barber-error">
                        {row.cancelled_appointments}
                      </td>
                      <td className="py-3 pr-4 text-right text-amber-600">
                        {row.no_show_appointments}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {row.completion_rate_pct?.toFixed(1)}%
                      </td>
                      <td className="py-3 text-right font-medium text-barber-white">
                        {brl.format(row.total_revenue)}
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