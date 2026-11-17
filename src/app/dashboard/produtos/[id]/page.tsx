// This page uses dynamic server data
export const instant = false;

import {
  ArrowLeft,
  Edit,
  Archive,
  Package,
  Warehouse,
  Tag,
  DollarSign,
  Hash,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, archiveProduct } from "../actions";
import { getInventoryMovements } from "../../estoque/actions";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  sale: "Venda",
  adjustment_in: "Ajuste (+)",
  adjustment_out: "Ajuste (-)",
  transfer_in: "Transferência (Entrada)",
  transfer_out: "Transferência (Saída)",
  return_in: "Devolução (Entrada)",
  return_out: "Devolução (Saída)",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  physical: "Físico",
  service: "Serviço",
  digital: "Digital",
  bundle: "Kit",
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const movementsResult = await getInventoryMovements({
    product_id: id,
    perPage: 10,
  });
  const movements = movementsResult.movements ?? [];

  const typeLabel =
    PRODUCT_TYPE_LABELS[product.product_type] ?? product.product_type;

  const balances =
    (product.balances as Array<{
      quantity_on_hand: number;
      quantity_reserved: number;
      warehouse: { id: string; name: string; code: string };
    }>) ?? [];

  const variants =
    (product.variants as Array<{
      id: string;
      name: string;
      sku: string | null;
      attributes: Record<string, string> | null;
      cost_price_override: number | null;
      sale_price_override: number | null;
      minimum_stock: number;
      is_active: boolean;
    }>) ?? [];

  async function handleArchive() {
    "use server";
    await archiveProduct(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/produtos"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-barber-border text-barber-muted transition-colors hover:bg-barber-dark/50 hover:text-barber-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-barber-white">
              {product.name}
            </h1>
            <span className="inline-flex items-center rounded-full border border-barber-gold/20 bg-barber-gold/10 px-2.5 py-0.5 text-xs font-medium text-barber-gold">
              {typeLabel}
            </span>
            {!product.is_active && (
              <span className="inline-flex items-center rounded-full border border-barber-muted/20 bg-barber-muted/10 px-2.5 py-0.5 text-xs font-medium text-barber-muted">
                Arquivado
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-barber-muted">
            Detalhes do produto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/produtos/${id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          {product.is_active && (
            <form action={handleArchive}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-barber-error/30 bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-error transition-colors hover:bg-barber-error/10"
              >
                <Archive className="h-4 w-4" />
                Arquivar
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados do Produto */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">
              Dados do Produto
            </h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-barber-muted">Nome</dt>
              <dd className="text-sm font-medium text-barber-light">
                {product.name}
              </dd>
            </div>
            {product.description && (
              <div>
                <dt className="text-xs text-barber-muted">Descrição</dt>
                <dd className="whitespace-pre-wrap text-sm text-barber-light">
                  {product.description}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="flex items-center gap-1 text-xs text-barber-muted">
                  <Hash className="h-3 w-3" />
                  SKU
                </dt>
                <dd className="text-sm font-medium text-barber-light">
                  {product.sku || "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-barber-muted">
                  <Hash className="h-3 w-3" />
                  Código de Barras
                </dt>
                <dd className="text-sm font-medium text-barber-light">
                  {product.barcode || "—"}
                </dd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="flex items-center gap-1 text-xs text-barber-muted">
                  <Tag className="h-3 w-3" />
                  Marca
                </dt>
                <dd className="text-sm font-medium text-barber-light">
                  {product.brand || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-barber-muted">Categoria</dt>
                <dd className="text-sm font-medium text-barber-light">
                  {(product.category as { name: string } | null)?.name || "—"}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Unidade</dt>
              <dd className="text-sm font-medium text-barber-light">
                {product.unit}
              </dd>
            </div>
          </dl>
        </div>

        {/* Preços */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">Preços</h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-barber-muted">Preço de Custo</dt>
              <dd className="text-sm font-medium text-barber-light">
                {formatBRL(product.cost_price)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Preço de Venda</dt>
              <dd className="text-lg font-semibold text-barber-white">
                {formatBRL(product.sale_price)}
              </dd>
            </div>
            {product.cost_price != null && product.sale_price != null && (
              <div>
                <dt className="text-xs text-barber-muted">Margem</dt>
                <dd className="text-sm font-medium text-barber-light">
                  {Number(product.cost_price) > 0
                    ? `${(((Number(product.sale_price) - Number(product.cost_price)) / Number(product.cost_price)) * 100).toFixed(1)}%`
                    : "—"}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-barber-muted">Estoque Mínimo</dt>
              <dd className="text-sm font-medium text-barber-light">
                {product.minimum_stock} {product.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Controle de Estoque</dt>
              <dd className="text-sm font-medium text-barber-light">
                {product.track_inventory ? "Ativado" : "Desativado"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Inventory Balances */}
      {product.track_inventory && balances.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">
              Saldo por Depósito
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs text-barber-muted">
                  <th className="pb-2 font-medium">Depósito</th>
                  <th className="pb-2 font-medium text-right">Em Estoque</th>
                  <th className="pb-2 font-medium text-right">Reservado</th>
                  <th className="pb-2 font-medium text-right">Disponível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {balances.map((balance) => {
                  const onHand = Number(balance.quantity_on_hand);
                  const reserved = Number(balance.quantity_reserved);
                  const available = onHand - reserved;
                  const isLow = available <= product.minimum_stock;
                  return (
                    <tr key={balance.warehouse.id}>
                      <td className="py-3 font-medium text-barber-light">
                        {balance.warehouse.name}
                      </td>
                      <td className="py-3 text-right text-barber-light">
                        {onHand}
                      </td>
                      <td className="py-3 text-right text-barber-light">
                        {reserved}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={
                            isLow
                              ? "font-medium text-barber-warning"
                              : "text-barber-light"
                          }
                        >
                          {available}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-barber-muted">
            Estoque mínimo configurado: {product.minimum_stock} {product.unit}
          </p>
        </div>
      )}

      {/* Variants */}
      {variants.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">
              Variantes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs text-barber-muted">
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 font-medium">Atributos</th>
                  <th className="pb-2 font-medium text-right">Custo</th>
                  <th className="pb-2 font-medium text-right">Venda</th>
                  <th className="pb-2 font-medium text-right">Est. Mín.</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="py-3 font-medium text-barber-light">
                      {variant.name}
                    </td>
                    <td className="py-3 text-barber-light">
                      {variant.sku || "—"}
                    </td>
                    <td className="py-3 text-barber-light">
                      {variant.attributes
                        ? Object.entries(variant.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="py-3 text-right text-barber-light">
                      {formatBRL(variant.cost_price_override)}
                    </td>
                    <td className="py-3 text-right text-barber-light">
                      {formatBRL(variant.sale_price_override)}
                    </td>
                    <td className="py-3 text-right text-barber-light">
                      {variant.minimum_stock}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          variant.is_active
                            ? "border-barber-success/20 bg-barber-success/10 text-barber-success"
                            : "border-barber-muted/20 bg-barber-muted/10 text-barber-muted"
                        }`}
                      >
                        {variant.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Movements */}
      {movements.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">
              Movimentações Recentes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs text-barber-muted">
                  <th className="pb-2 font-medium">Data</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium text-right">Quantidade</th>
                  <th className="pb-2 font-medium">Depósito</th>
                  <th className="pb-2 font-medium">Motivo</th>
                  <th className="pb-2 font-medium">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {movements.map((movement) => {
                  const qty = Number(movement.quantity_delta);
                  return (
                    <tr key={movement.id}>
                      <td className="py-3 text-barber-light">
                        {formatDateTime(movement.created_at)}
                      </td>
                      <td className="py-3 text-barber-light">
                        {MOVEMENT_TYPE_LABELS[movement.movement_type] ??
                          movement.movement_type}
                      </td>
                      <td
                        className={`py-3 text-right font-medium ${
                          qty > 0 ? "text-barber-success" : "text-barber-error"
                        }`}
                      >
                        {qty > 0 ? `+${qty}` : qty}
                      </td>
                      <td className="py-3 text-barber-light">
                        {(movement.warehouse as { name: string } | null)?.name ??
                          "—"}
                      </td>
                      <td className="max-w-[200px] truncate py-3 text-barber-light" title={movement.reason ?? ""}>
                        {movement.reason || "—"}
                      </td>
                      <td className="py-3 text-barber-light">
                        {(movement.creator as { full_name: string } | null)
                          ?.full_name ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}