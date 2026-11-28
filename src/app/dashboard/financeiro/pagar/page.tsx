// This page uses dynamic server data
// With cacheComponents: true, instant=false allows blocking render + connection() opts out of prerender

import { connection } from "next/server";
import { Plus, Search, Filter, TrendingDown, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getPayables } from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusLabels: Record<string, { label: string; className: string }> = {
  open: { label: "Em aberto", className: "bg-barber-gold/10 text-barber-gold" },
  partially_paid: { label: "Parcial", className: "bg-barber-warning/10 text-barber-warning" },
  paid: { label: "Pago", className: "bg-barber-success/10 text-barber-success" },
  overdue: { label: "Vencido", className: "bg-barber-error/10 text-barber-error" },
  cancelled: { label: "Cancelado", className: "bg-barber-muted/10 text-barber-muted" },
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function PagarPage({ searchParams }: PageProps) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();
  const params = await searchParams;
  const search = params.search || "";
  const status = params.status || "all";
  const page = parseInt(params.page || "1", 10);

  const { payables, total } = await getPayables({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    page,
    perPage: 20,
  });

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-barber-white">Contas a Pagar</h1>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-opacity hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nova Despesa
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-barber-light">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Fornecedor ou descrição..."
                className="w-full rounded-lg border border-barber-border bg-barber-dark py-2 pl-9 pr-3 text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-2 focus:ring-barber-gold/20"
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-sm font-medium text-barber-light">Status</label>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-barber-white focus:border-barber-gold focus:outline-none focus:ring-2 focus:ring-barber-gold/20"
            >
              <option value="all">Todos</option>
              <option value="open">Em aberto</option>
              <option value="partially_paid">Parcial</option>
              <option value="paid">Pago</option>
              <option value="overdue">Vencido</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-opacity hover:opacity-90"
          >
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
          {(search || status !== "all") && (
            <Link
              href="/dashboard/financeiro/pagar"
              className="inline-flex items-center rounded-lg border border-barber-border px-4 py-2 text-sm text-barber-light transition-colors hover:bg-barber-dark/50"
            >
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite">
        {payables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <TrendingDown className="mb-4 h-12 w-12 text-barber-muted/50" />
            <p className="text-lg font-medium text-barber-white">Nenhuma despesa encontrada</p>
            <p className="text-sm text-barber-muted">
              {search || status !== "all" ? "Tente ajustar os filtros." : "Cadastre suas contas a pagar."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-barber-border bg-barber-dark">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Fornecedor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Pago
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {payables.map((p) => {
                  const isOverdue =
                    p.due_date < todayStr &&
                    p.status !== "paid" &&
                    p.status !== "cancelled";
                  const st = statusLabels[p.status] ?? statusLabels.open;

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-barber-dark/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-barber-white">{p.description}</p>
                        {p.installment_number && (
                          <p className="text-xs text-barber-muted">
                            Parcela {p.installment_number}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-barber-light">{p.counterparty_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            isOverdue ? "font-medium text-barber-error" : "text-barber-light"
                          }
                        >
                          {new Date(p.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        {isOverdue && (
                          <AlertTriangle className="ml-1 inline h-3 w-3 text-barber-error" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-barber-light">
                        {brl.format(Number(p.original_amount))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-barber-light">
                        {brl.format(Number(p.amount_paid))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}
                        >
                          {isOverdue && p.status === "open" ? "Vencido" : st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-barber-muted">
            Página {page} de {totalPages} ({total} despesas)
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/dashboard/financeiro/pagar?page=${page - 1}${search ? `&search=${search}` : ""}${status !== "all" ? `&status=${status}` : ""}`}
                className="rounded-lg border border-barber-border px-4 py-2 text-sm text-barber-light transition-colors hover:bg-barber-dark/50"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/dashboard/financeiro/pagar?page=${page + 1}${search ? `&search=${search}` : ""}${status !== "all" ? `&status=${status}` : ""}`}
                className="rounded-lg border border-barber-border px-4 py-2 text-sm text-barber-light transition-colors hover:bg-barber-dark/50"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}