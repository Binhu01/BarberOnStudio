// This page uses dynamic server data

import {
  ArrowLeft,
  Edit,
  Archive,
  TrendingUp,
  Calendar,
  DollarSign,
  User,
  Building2,
  MessageCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById, getPipelineAndStages } from "../actions";
import { getInteractions } from "@/lib/crm/interactions";
import InteractionTimeline from "../../clientes/_components/interaction-timeline";
import ConvertLeadButton from "../_components/convert-lead-button";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusConfig: Record<
  string,
  { label: string; classes: string; icon: React.ElementType }
> = {
  open: {
    label: "Aberto",
    classes: "bg-barber-gold/10 text-barber-gold border-barber-gold/20",
    icon: TrendingUp,
  },
  won: {
    label: "Ganho",
    classes: "bg-barber-success/10 text-barber-success border-barber-success/20",
    icon: CheckCircle2,
  },
  lost: {
    label: "Perdido",
    classes: "bg-barber-error/10 text-barber-error border-barber-error/20",
    icon: XCircle,
  },
  archived: {
    label: "Arquivado",
    classes: "bg-barber-muted/10 text-barber-muted border-barber-muted/20",
    icon: Archive,
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;

  const [lead, pipelineData, interactionsResult] = await Promise.all([
    getLeadById(id),
    getPipelineAndStages(),
    getInteractions({ leadId: id }),
  ]);

  if (!lead) {
    notFound();
  }

  const interactions =
    "interactions" in interactionsResult
      ? (interactionsResult.interactions ?? [])
      : [];

  const formattedInteractions = interactions.map(
    (i: Record<string, unknown>) => ({
      id: i.id as string,
      type: i.type as string,
      description: i.description as string,
      occurred_at: i.occurred_at as string,
      creator_name:
        (i.profiles as { full_name?: string } | null)?.full_name ??
        "Desconhecido",
    })
  );

  const status = statusConfig[lead.status] ?? statusConfig.open;
  const StatusIcon = status.icon;

  // Resolve assigned_to user name from pipeline stages query is not available,
  // so we display the raw ID or a placeholder. In production this would join profiles.
  const assignedToName = lead.assigned_to ? "Responsável atribuído" : "Não atribuído";

  const isConverted = Boolean(lead.converted_customer_id);
  const canConvert = lead.status === "won" && !isConverted;

  return (
    <div className="space-y-6">
      {/* Back link + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/leads"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-barber-border text-barber-muted transition-colors hover:bg-barber-dark/50 hover:text-barber-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-barber-white">
                {lead.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.classes}`}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
            </div>
            {lead.company_name && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-barber-muted">
                <Building2 className="h-3.5 w-3.5" />
                {lead.company_name}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/leads/${id}/editar`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          {!lead.archived_at && (
            <form action={`/dashboard/leads/${id}/arquivar`} method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
              >
                <Archive className="h-4 w-4" />
                Arquivar
              </button>
            </form>
          )}
          {canConvert && (
            <ConvertLeadButton
              leadId={lead.id}
              leadName={lead.name}
              leadEmail={lead.email}
              leadPhone={lead.phone}
            />
          )}
        </div>
      </div>

      {/* Converted banner */}
      {isConverted && (
        <div className="flex items-center gap-3 rounded-xl border border-barber-success/20 bg-barber-success/5 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-barber-success" />
          <p className="text-sm font-medium text-barber-success">
            Lead convertido em cliente.{" "}
            <Link
              href={`/dashboard/clientes/${lead.converted_customer_id}`}
              className="underline decoration-barber-success/40 underline-offset-2 hover:decoration-barber-success"
            >
              Ver página do cliente
            </Link>
          </p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Oportunidade */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-barber-gold" />
            <h2 className="text-base font-semibold text-barber-white">
              Oportunidade
            </h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Estágio
              </dt>
              <dd className="mt-1 text-sm font-medium text-barber-white">
                {lead.stage?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Origem
              </dt>
              <dd className="mt-1 text-sm text-barber-light">
                {lead.source || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Interesse
              </dt>
              <dd className="mt-1 text-sm text-barber-light">
                {lead.interest || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Valor estimado
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-barber-white">
                <DollarSign className="h-4 w-4 text-barber-gold" />
                {lead.estimated_value != null
                  ? formatCurrency(lead.estimated_value)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Retorno esperado
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-barber-light">
                <Calendar className="h-4 w-4 text-barber-muted" />
                {lead.expected_return_at
                  ? formatDate(lead.expected_return_at)
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Right: Contato */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-barber-gold" />
            <h2 className="text-base font-semibold text-barber-white">
              Contato
            </h2>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                E-mail
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-barber-light">
                <MessageCircle className="h-4 w-4 text-barber-muted" />
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-barber-gold hover:underline"
                  >
                    {lead.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Telefone
              </dt>
              <dd className="mt-1 text-sm text-barber-light">
                {lead.phone || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                WhatsApp
              </dt>
              <dd className="mt-1 text-sm text-barber-light">
                {lead.whatsapp ? (
                  <a
                    href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-barber-gold hover:underline"
                  >
                    {lead.whatsapp}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                Responsável
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-barber-light">
                <User className="h-4 w-4 text-barber-muted" />
                {assignedToName}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Notes */}
      {lead.notes && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-barber-white">
            Observações
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-barber-light">
            {lead.notes}
          </p>
        </div>
      )}

      {/* Interaction Timeline */}
      <InteractionTimeline
        interactions={formattedInteractions}
        targetType="lead"
        targetId={lead.id}
      />
    </div>
  );
}