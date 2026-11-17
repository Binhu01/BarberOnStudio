// This page uses dynamic server data
export const instant = false;

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Printer,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ChevronDown,
} from "lucide-react";
import { getQuoteById } from "../../actions";
import type { QuoteStatus } from "@/types/sales";
import { ConvertButton } from "../_components/convert-button";
import { StatusChanger } from "./status-changer";

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

// --- Status helpers ---

const statusConfig: Record<
  QuoteStatus,
  { label: string; color: string; icon: typeof FileText }
> = {
  draft: {
    label: "Rascunho",
    color: "bg-barber-muted/10 text-barber-muted border-barber-muted/20",
    icon: FileText,
  },
  sent: {
    label: "Enviado",
    color: "bg-barber-gold/10 text-barber-gold border-barber-gold/20",
    icon: Send,
  },
  accepted: {
    label: "Aceito",
    color: "bg-barber-success/10 text-barber-success border-barber-success/20",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejeitado",
    color: "bg-barber-error/10 text-barber-error border-barber-error/20",
    icon: XCircle,
  },
  expired: {
    label: "Expirado",
    color: "bg-barber-warning/10 text-barber-warning border-barber-warning/20",
    icon: Clock,
  },
  converted: {
    label: "Convertido",
    color: "bg-barber-copper/10 text-barber-copper border-barber-copper/20",
    icon: CheckCircle2,
  },
};

function isExpired(validUntil: string): boolean {
  try {
    return new Date(validUntil) < new Date();
  } catch {
    return false;
  }
}

// --- Page Component ---

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  if (!quote) {
    notFound();
  }

  const status = quote.status as QuoteStatus;
  const config = statusConfig[status] ?? statusConfig.draft;
  const StatusIcon = config.icon;
  const expired = isExpired(quote.valid_until);
  const canConvert = status !== "converted" && status !== "expired";

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Back Link */}
      <Link
        href="/dashboard/vendas/orcamentos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para orçamentos
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-barber-white">
              {quote.document_number}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
          </div>
          <p className="text-sm text-barber-muted">
            Criado em {formatDate(quote.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <Link
            href={`/dashboard/vendas/orcamentos/${quote.id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          {canConvert && <ConvertButton quoteId={quote.id} />}
        </div>
      </div>

      {/* Converted Banner */}
      {status === "converted" && quote.converted_order_id && (
        <div className="flex items-center gap-3 rounded-xl border border-barber-success/20 bg-barber-success/5 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-barber-success" />
          <p className="text-sm text-barber-success">
            Este orçamento foi convertido em pedido.{" "}
            <Link
              href={`/dashboard/vendas/pedidos/${quote.converted_order_id}`}
              className="font-semibold underline decoration-barber-success/40 underline-offset-2 hover:decoration-barber-success"
            >
              Ver pedido
            </Link>
          </p>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid gap-4 rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-barber-muted">
            Cliente
          </p>
          <p className="mt-1 text-sm font-medium text-barber-white">
            {quote.customer.name}
          </p>
          {quote.customer.email && (
            <p className="text-xs text-barber-muted">
              {quote.customer.email}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-barber-muted">
            Canal
          </p>
          <p className="mt-1 text-sm font-medium text-barber-white">
            {quote.channel?.name ?? (
              <span className="text-barber-muted">—</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-barber-muted">
            Criado por
          </p>
          <p className="mt-1 text-sm font-medium text-barber-white">
            {quote.creator.full_name ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-barber-muted">
            Válido até
          </p>
          <p
            className={`mt-1 text-sm font-medium ${
              expired && status !== "converted"
                ? "text-barber-error"
                : "text-barber-white"
            }`}
          >
            {formatDate(quote.valid_until)}
            {expired && status !== "converted" && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-medium text-barber-error">
                <AlertTriangle className="h-3 w-3" />
                Expirado
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Items Table + Financial Summary */}
      <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
        <div className="border-b border-barber-border px-6 py-4">
          <h2 className="font-display text-base font-semibold text-barber-white">
            Itens do orçamento
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-barber-border bg-barber-dark">
              <tr>
                <th className="whitespace-nowrap px-6 py-3 font-medium text-barber-muted">
                  Descrição
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-barber-muted">
                  Qtd
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-barber-muted">
                  Preço unitário
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-barber-muted">
                  Desconto
                </th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-barber-muted">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-barber-border">
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-3 font-medium text-barber-white">
                    {item.description}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-barber-light">
                    {item.quantity}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-barber-light">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-barber-light">
                    {item.discount > 0
                      ? `- ${formatCurrency(item.discount)}`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-barber-white">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="border-t border-barber-border bg-barber-dark/30 px-6 py-4">
          <div className="flex flex-col items-end gap-2">
            <div className="flex w-64 justify-between text-sm">
              <span className="text-barber-muted">Subtotal</span>
              <span className="font-medium text-barber-white">
                {formatCurrency(quote.subtotal)}
              </span>
            </div>
            {quote.discount > 0 && (
              <div className="flex w-64 justify-between text-sm">
                <span className="text-barber-muted">Desconto</span>
                <span className="font-medium text-barber-error">
                  - {formatCurrency(quote.discount)}
                </span>
              </div>
            )}
            <div className="flex w-64 justify-between border-t border-barber-border pt-2 text-sm">
              <span className="font-semibold text-barber-white">Total</span>
              <span className="font-bold text-barber-white">
                {formatCurrency(quote.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold text-barber-white">
            Observações
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-barber-light">
            {quote.notes}
          </p>
        </div>
      )}

      {/* Status Change */}
      <div className="print:hidden">
        <StatusChanger quoteId={quote.id} currentStatus={status} />
      </div>
    </div>
  );
}