
import { connection } from "next/server";
import { Scissors, TrendingUp, DollarSign } from "lucide-react";
import { getServicePopularity } from "@/app/dashboard/integracoes/actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosServicosPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();

  const services = await getServicePopularity().catch(() => []);

  const totalRevenue = services.reduce((sum, s) => sum + (s.total_revenue ?? 0), 0);
  const totalPerformed = services.reduce((sum, s) => sum + (s.times_performed ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Relatório de Serviços
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Serviços mais populares, rentáveis e tempo médio de execução
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <Scissors className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{services.length}</p>
              <p className="text-xs text-barber-muted">Serviços realizados</p>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <TrendingUp className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-barber-white">{totalPerformed}</p>
              <p className="text-xs text-barber-muted">Total de execuções</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Ranking Table */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Ranking de Serviços por Receita
        </h2>
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Scissors className="mb-3 h-10 w-10 text-barber-muted/40" />
            <p className="text-sm text-barber-muted">
              Sem dados de serviços para exibir
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-muted">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Serviço</th>
                  <th className="pb-3 pr-4 text-right font-medium">Execuções</th>
                  <th className="pb-3 pr-4 text-right font-medium">Duração</th>
                  <th className="pb-3 pr-4 text-right font-medium">Preço médio</th>
                  <th className="pb-3 text-right font-medium">Receita total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border/50">
                {services.map((svc, i) => (
                  <tr key={i} className="transition-colors hover:bg-barber-dark/15">
                    <td className="py-3 pr-4 font-medium text-barber-muted">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-barber-white">
                      {svc.service_name ?? "Sem nome"}
                    </td>
                    <td className="py-3 pr-4 text-right">{svc.times_performed}</td>
                    <td className="py-3 pr-4 text-right text-barber-muted">
                      {svc.duration_minutes ? `${svc.duration_minutes}min` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right">{brl.format(svc.avg_price)}</td>
                    <td className="py-3 text-right font-semibold text-barber-white">
                      {brl.format(svc.total_revenue)}
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