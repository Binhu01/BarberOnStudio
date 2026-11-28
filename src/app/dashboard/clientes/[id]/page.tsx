// This page uses dynamic server data

import {
  ArrowLeft,
  Edit,
  Archive,
  Mail,
  Phone,
  MessageCircle,
  Building2,
  Calendar,
  User,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "../actions";
import { getInteractions } from "@/lib/crm/interactions";
import InteractionTimeline from "../_components/interaction-timeline";

interface ClienteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetailPage({
  params,
}: ClienteDetailPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const interactionsResult = await getInteractions({ customerId: id });
  const interactions =
    "interactions" in interactionsResult
      ? (interactionsResult.interactions ?? [])
      : [];

  const formattedInteractions = interactions.map((i: Record<string, unknown>) => ({
    id: i.id as string,
    type: i.type as string,
    description: i.description as string,
    occurred_at: i.occurred_at as string,
    creator_name:
      (i.profiles as { full_name?: string } | null)?.full_name ?? "Desconhecido",
  }));

  const statusLabel = customer.status === "active" ? "Ativo" : "Inativo";
  const statusClasses =
    customer.status === "active"
      ? "bg-barber-success/10 text-barber-success border-barber-success/20"
      : "bg-barber-muted/10 text-barber-muted border-barber-muted/20";

  const typeLabel = customer.customer_type === "pf" ? "Pessoa Física" : "Pessoa Jurídica";

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/clientes"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-barber-border text-barber-muted transition-colors hover:bg-barber-dark/50 hover:text-barber-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-barber-white">
              {customer.name}
            </h1>
            <span className="inline-flex items-center rounded-full border border-barber-gold/20 bg-barber-gold/10 px-2.5 py-0.5 text-xs font-medium text-barber-gold">
              {typeLabel}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-barber-muted">
            Detalhes do cliente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/clientes/${id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-barber-error/30 bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-error transition-colors hover:bg-barber-error/10"
          >
            <Archive className="h-4 w-4" />
            Arquivar
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados Cadastrais */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">
              Dados Cadastrais
            </h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-barber-muted">Tipo</dt>
              <dd className="text-sm font-medium text-barber-light">{typeLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Documento</dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.document || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Origem</dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.source || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Categoria</dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.category || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Criado em</dt>
              <dd className="text-sm font-medium text-barber-light">
                {formatDate(customer.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Atualizado em</dt>
              <dd className="text-sm font-medium text-barber-light">
                {formatDate(customer.updated_at)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Contato */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">Contato</h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-barber-muted">E-mail</dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-1.5 text-barber-gold hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {customer.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">Telefone</dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-barber-muted" />
                    {customer.phone}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">WhatsApp</dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.whatsapp ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-barber-muted" />
                    {customer.whatsapp}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-barber-muted">
                Contato Principal
              </dt>
              <dd className="text-sm font-medium text-barber-light">
                {customer.primary_contact_name ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-barber-muted" />
                    {customer.primary_contact_name}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-barber-muted" />
            <h2 className="text-base font-semibold text-barber-white">
              Observações
            </h2>
          </div>
          <p className="whitespace-pre-wrap text-sm text-barber-light">
            {customer.notes}
          </p>
        </div>
      )}

      {/* Interactions Timeline */}
      <InteractionTimeline
        interactions={formattedInteractions}
        targetType="customer"
        targetId={id}
      />
    </div>
  );
}