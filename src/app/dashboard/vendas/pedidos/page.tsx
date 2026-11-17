"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, Filter, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getOrders } from "../actions";
import type { OrderWithDetails, OrderStatus } from "@/types/sales";

// --- Formatters ---

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(iso: string): string {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

// --- Status Config ---

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-barber-muted/10 text-barber-muted" },
  confirmed: { label: "Confirmado", className: "bg-barber-gold/10 text-barber-gold" },
  preparing: { label: "Em preparação", className: "bg-barber-warning/10 text-barber-warning" },
  completed: { label: "Concluído", className: "bg-barber-success/10 text-barber-success" },
  cancelled: { label: "Cancelado", className: "bg-barber-error/10 text-barber-error" },
};

// --- Skeleton ---

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-28 animate-pulse rounded bg-barber-border" />
          <div className="h-4 w-40 animate-pulse rounded bg-barber-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-barber-border" />
          <div className="h-4 w-20 animate-pulse rounded bg-barber-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-barber-border" />
          <div className="h-4 w-28 animate-pulse rounded bg-barber-border" />
        </div>
      ))}
    </div>
  );
}

// --- Main Page Component ---

export default function PedidosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter state synced with URL
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") ?? ""
  );
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get("page")) || 1
  );

  // Data state
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (currentPage > 1) params.set("page", String(currentPage));

    const qs = params.toString();
    router.replace(`/dashboard/vendas/pedidos${qs ? `?${qs}` : ""}`, {
      scroll: false,
    });
  }, [debouncedSearch, statusFilter, currentPage, router]);

  // Fetch orders when filters change
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getOrders({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        perPage: pageSize,
      });

      setOrders(result.orders);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, currentPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Standard async data-fetching pattern
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resetting pagination on filter change is a standard pattern
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters = debouncedSearch || statusFilter;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">
            Pedidos
          </h1>
          <p className="mt-1 text-sm text-barber-muted">
            {total > 0
              ? `${total} pedidos registrados`
              : "Gerencie seus pedidos de venda"}
          </p>
        </div>
        <Link
          href="/dashboard/vendas/pedidos/novo"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-barber-gold px-4 py-2.5 text-sm font-medium text-barber-white shadow-sm transition-colors hover:bg-barber-copper"
        >
          <Plus className="h-4 w-4" />
          Novo Pedido
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
            <input
              type="text"
              placeholder="Buscar por nº documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark py-2 pl-9 pr-3 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          >
            <option value="">Todos os status</option>
            <option value="draft">Rascunho</option>
            <option value="confirmed">Confirmado</option>
            <option value="preparing">Em preparação</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border px-3 py-2 text-sm font-medium text-barber-muted hover:bg-barber-dark/50 hover:text-barber-white"
            >
              <Filter className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : orders.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-barber-dark text-barber-muted">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-barber-white">
              Nenhum pedido encontrado
            </h3>
            <p className="mt-1 max-w-xs text-sm text-barber-muted">
              {hasActiveFilters
                ? "Tente ajustar os filtros ou buscar por outro termo."
                : "Comece criando seu primeiro pedido de venda."}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/dashboard/vendas/pedidos/novo"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white hover:bg-barber-copper"
              >
                <Plus className="h-4 w-4" />
                Novo Pedido
              </Link>
            )}
          </div>
        ) : (
          /* Responsive Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-barber-muted">
                    Nº Documento
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-barber-muted">
                    Cliente
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-barber-muted">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-barber-muted">
                    Total
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-barber-muted">
                    Data
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-barber-muted">
                    Canal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {orders.map((order) => {
                  const statusConfig = STATUS_CONFIG[order.status];
                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-barber-dark/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          href={`/dashboard/vendas/pedidos/${order.id}`}
                          className="font-medium text-barber-gold hover:underline"
                        >
                          {order.document_number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-barber-white">
                        {order.customer?.name ?? (
                          <span className="text-barber-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-barber-white">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-barber-light">
                        {formatDate(order.issued_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-barber-light">
                        {order.channel?.name ?? (
                          <span className="text-barber-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && orders.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-barber-border px-4 py-3">
            <p className="text-sm text-barber-muted">
              Mostrando{" "}
              <span className="font-medium text-barber-white">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              –{" "}
              <span className="font-medium text-barber-white">
                {Math.min(currentPage * pageSize, total)}
              </span>{" "}
              de <span className="font-medium text-barber-white">{total}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-barber-border px-3 py-1.5 text-sm font-medium text-barber-light hover:bg-barber-dark/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-sm text-barber-muted">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-barber-border px-3 py-1.5 text-sm font-medium text-barber-light hover:bg-barber-dark/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}