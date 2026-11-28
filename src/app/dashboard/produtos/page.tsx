// This page uses dynamic server data

import Link from "next/link";
import { Plus, Search, Package, Archive, AlertTriangle, Filter } from "lucide-react";
import { getProducts, getProductStats, getCategories } from "./actions";
import { getActiveOrganization } from "@/lib/organizations";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category_id?: string;
    product_type?: string;
    status?: string;
    page?: string;
  }>;
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function ProdutosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const category_id = params.category_id || "";
  const product_type = params.product_type || "";
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);

  const [organization, productsData, categories] = await Promise.all([
    getActiveOrganization(),
    getProducts({
      search: search || undefined,
      category_id: category_id || undefined,
      product_type: product_type || undefined,
      is_active: status === "active" ? true : status === "inactive" ? false : undefined,
      page,
    }),
    getCategories(),
  ]);

  const orgId = organization?.org?.id;
  const stats = orgId ? await getProductStats(orgId) : null;

  const { products, total } = productsData;
  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function buildFilterUrl(updates: Record<string, string>) {
    const newParams = new URLSearchParams();
    const current = { search, category_id, product_type, status, page: String(page) };
    const merged = { ...current, ...updates };

    Object.entries(merged).forEach(([key, value]) => {
      if (value && value !== "1" || key === "search" && value) {
        newParams.set(key, value);
      }
    });

    // Reset page to 1 when filters change (unless we're explicitly changing page)
    if (!updates.page) {
      newParams.delete("page");
    }

    return `/dashboard/produtos?${newParams.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Produtos
        </h1>
        <Link
          href="/dashboard/produtos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Total de Produtos</p>
              <p className="text-xl font-bold text-barber-white">{stats?.total_products ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Produtos Ativos</p>
              <p className="text-xl font-bold text-barber-white">{stats?.active_products ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-warning/10 text-barber-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Estoque Baixo</p>
              <p className="text-xl font-bold text-barber-white">{stats?.low_stock_count ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-error/10 text-barber-error">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Sem Estoque</p>
              <p className="text-xl font-bold text-barber-white">{stats?.out_of_stock_count ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-barber-muted">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Nome ou SKU..."
                className="w-full rounded-lg border border-barber-border bg-barber-dark py-2 pl-9 pr-3 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
              />
            </div>
          </div>

          <div className="min-w-[160px]">
            <label className="mb-1 block text-sm font-medium text-barber-muted">
              Categoria
            </label>
            <select
              name="category_id"
              defaultValue={category_id}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Todas</option>
              {categories.map((cat: { id: string; name: string }) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[160px]">
            <label className="mb-1 block text-sm font-medium text-barber-muted">
              Tipo
            </label>
            <select
              name="product_type"
              defaultValue={product_type}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Todos</option>
              <option value="physical">Físico</option>
              <option value="service">Serviço</option>
            </select>
          </div>

          <div className="min-w-[160px]">
            <label className="mb-1 block text-sm font-medium text-barber-muted">
              Status
            </label>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
          >
            <Filter className="h-4 w-4" />
            Filtrar
          </button>

          {(search || category_id || product_type || status) && (
            <Link
              href="/dashboard/produtos"
              className="inline-flex items-center rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:bg-barber-dark hover:text-barber-white"
            >
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-barber-dark text-barber-muted">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-barber-white">
              Nenhum produto encontrado
            </h3>
            <p className="max-w-sm text-center text-sm text-barber-muted">
              {search || category_id || product_type || status
                ? "Tente ajustar os filtros ou limpar a busca."
                : "Comece adicionando seu primeiro produto ao catálogo."}
            </p>
            {!search && !category_id && !product_type && !status && (
              <Link
                href="/dashboard/produtos/novo"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
              >
                <Plus className="h-4 w-4" />
                Adicionar Produto
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Preço
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Estoque
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-barber-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {products.map((product) => {
                  const categoryName = (product.category as { name: string } | null)?.name ?? null;
                  return (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-barber-dark/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/produtos/${product.id}`}
                        className="font-medium text-barber-white transition-colors hover:text-barber-gold"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-barber-light">
                      {product.sku || "—"}
                    </td>
                    <td className="px-4 py-3 text-barber-light">
                      {categoryName || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-barber-light">
                      {product.product_type === "physical"
                        ? "Físico"
                        : product.product_type === "service"
                        ? "Serviço"
                        : product.product_type}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-barber-white">
                      {brlFormatter.format(Number(product.sale_price))}
                    </td>
                    <td className="px-4 py-3 text-right text-barber-light">
                      <span className={product.track_inventory ? "" : "italic text-barber-muted"}>
                        {product.track_inventory ? "—" : "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          product.is_active
                            ? "bg-barber-success/10 text-barber-success"
                            : "bg-barber-muted/10 text-barber-muted"
                        }`}
                      >
                        {product.is_active ? "Ativo" : "Inativo"}
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
            Mostrando página {page} de {totalPages} ({total} produtos)
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={buildFilterUrl({ page: String(page - 1) })}
                className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:bg-barber-dark hover:text-barber-white"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildFilterUrl({ page: String(page + 1) })}
                className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:bg-barber-dark hover:text-barber-white"
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