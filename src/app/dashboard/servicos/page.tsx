import { getBarberServices, getBarberServiceStats, getServiceCategories } from "./actions";
import Link from "next/link";
import { Scissors, Plus, Clock, DollarSign, TrendingUp, Package } from "lucide-react";

export default async function ServicosPage() {
  const [services, stats, categories] = await Promise.all([
    getBarberServices({ includeInactive: true }),
    getBarberServiceStats(),
    getServiceCategories(),
  ]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Serviços</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie o catálogo de serviços da barbearia
          </p>
        </div>
        <Link
          href="/dashboard/servicos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2.5 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-copper"
        >
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Total de Serviços</p>
              <p className="text-xl font-bold text-barber-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Ativos</p>
              <p className="text-xl font-bold text-barber-white">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Preço Médio</p>
              <p className="text-xl font-bold text-barber-white">{formatCurrency(stats.avg_price)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-warning/10 text-barber-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Duração Média</p>
              <p className="text-xl font-bold text-barber-white">{stats.avg_duration} min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-barber-border bg-barber-dark">
              <tr>
                <th className="px-4 py-3 font-medium text-barber-muted">Serviço</th>
                <th className="px-4 py-3 font-medium text-barber-muted">Categoria</th>
                <th className="px-4 py-3 font-medium text-barber-muted">Duração</th>
                <th className="px-4 py-3 font-medium text-barber-muted">Preço</th>
                <th className="px-4 py-3 font-medium text-barber-muted">Comissão</th>
                <th className="px-4 py-3 font-medium text-barber-muted">Status</th>
                <th className="px-4 py-3 font-medium text-barber-muted">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-barber-border">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-barber-muted">
                    <Package className="mx-auto mb-3 h-8 w-8 opacity-50" />
                    <p>Nenhum serviço cadastrado</p>
                    <Link
                      href="/dashboard/servicos/novo"
                      className="mt-2 inline-block text-sm font-medium text-barber-gold hover:text-barber-copper"
                    >
                      Cadastrar primeiro serviço
                    </Link>
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-barber-dark/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-barber-white">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-barber-muted line-clamp-1">{service.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-barber-light">
                      {service.category_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-barber-light">
                      {service.duration_minutes} min
                      {service.buffer_minutes > 0 && (
                        <span className="ml-1 text-xs text-barber-muted">
                          (+{service.buffer_minutes})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-barber-white">
                      {formatCurrency(service.price)}
                    </td>
                    <td className="px-4 py-3 text-barber-light">
                      {service.commission_type === "percentage"
                        ? `${service.commission_value}%`
                        : service.commission_type === "fixed"
                          ? formatCurrency(service.commission_value)
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          service.is_active
                            ? "bg-barber-success/10 text-barber-success"
                            : "bg-barber-muted/10 text-barber-muted"
                        }`}
                      >
                        {service.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/servicos/${service.id}/editar`}
                        className="text-sm font-medium text-barber-gold hover:text-barber-copper"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}