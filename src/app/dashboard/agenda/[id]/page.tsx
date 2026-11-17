// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Scissors,
  Phone,
  Mail,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CircleDot,
  Timer,
  CalendarCheck,
  CalendarDays,
  Repeat,
} from "lucide-react";
import {
  getAppointmentById,
  getAppointmentStatusHistory,
  type AppointmentStatus,
} from "../actions";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  scheduled: {
    label: "Agendado",
    color: "text-barber-gold",
    bg: "bg-barber-gold/10 border-blue-200",
    icon: CalendarDays,
  },
  confirmed: {
    label: "Confirmado",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    icon: CalendarCheck,
  },
  arrived: {
    label: "Cliente chegou",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    icon: CircleDot,
  },
  in_progress: {
    label: "Em andamento",
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
    icon: Timer,
  },
  completed: {
    label: "Concluído",
    color: "text-barber-success",
    bg: "bg-barber-success/10 border-green-200",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    color: "text-barber-error",
    bg: "bg-barber-error/10 border-red-200",
    icon: XCircle,
  },
  no_show: {
    label: "Não compareceu",
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    icon: AlertCircle,
  },
};

const ORIGIN_LABELS: Record<string, string> = {
  manual: "Manual",
  landing_page: "Site (Landing Page)",
  recurring: "Recorrente",
  whatsapp: "WhatsApp",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

// ---------------------------------------------------------------------------
// Valid transitions per status
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled", "no_show"],
  confirmed: ["arrived", "cancelled", "no_show", "scheduled"],
  arrived: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: ["cancelled"],
  cancelled: ["scheduled"],
  no_show: ["scheduled"],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AppointmentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await headers();
  const { id } = await props.params;

  const [appointment, history] = await Promise.all([
    getAppointmentById(id),
    getAppointmentStatusHistory(id).catch(() => []),
  ]);

  if (!appointment) {
    notFound();
  }

  const start = new Date(appointment.start_at);
  const end = new Date(appointment.end_at);
  const statusCfg =
    STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG.scheduled;
  const StatusIcon = statusCfg.icon;
  const nextStatuses =
    VALID_TRANSITIONS[appointment.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/agenda"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para agenda
      </Link>

      {/* Header Card */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-barber-white">
                {appointment.title}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
              {appointment.origin !== "manual" && (
                <span className="rounded-full bg-barber-dark px-2.5 py-1 text-xs font-medium text-barber-muted">
                  {ORIGIN_LABELS[appointment.origin] ?? appointment.origin}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-barber-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-barber-gold" />
                {start.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-barber-gold" />
                {start.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                —{" "}
                {end.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {appointment.total_price != null &&
                appointment.total_price > 0 && (
                  <span className="font-medium text-barber-gold">
                    {formatCurrency(appointment.total_price)}
                  </span>
                )}
            </div>
          </div>
        </div>

        {/* Description / Notes */}
        {(appointment.description || appointment.notes) && (
          <div className="mt-6 rounded-lg bg-barber-dark/50 p-4">
            {appointment.description && (
              <p className="whitespace-pre-line text-sm text-barber-muted">
                {appointment.description}
              </p>
            )}
            {appointment.notes && (
              <div className="mt-3 border-t border-barber-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wider text-barber-muted">
                  Observações internas
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-barber-light">
                  {appointment.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cancellation reason */}
        {appointment.status === "cancelled" &&
          appointment.cancellation_reason && (
            <div className="mt-4 rounded-lg border border-red-900/30 bg-red-950/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-red-400">
                Motivo do cancelamento
              </p>
              <p className="mt-1 text-sm text-red-300">
                {appointment.cancellation_reason}
              </p>
            </div>
          )}
      </div>

      {/* Info Grid: Barber, Service, Customer */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Barber */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-barber-muted">
            <User className="h-3.5 w-3.5" />
            Profissional
          </h3>
          {appointment.barber_name ? (
            <div className="flex items-center gap-3">
              {appointment.barber_avatar ? (
                <img
                  src={appointment.barber_avatar}
                  alt={appointment.barber_name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-barber-gold/10 text-sm font-bold text-barber-gold">
                  {appointment.barber_name.charAt(0)}
                </div>
              )}
              <p className="font-medium text-barber-white">
                {appointment.barber_name}
              </p>
            </div>
          ) : (
            <p className="text-sm text-barber-muted">
              Nenhum profissional atribuído
            </p>
          )}
        </div>

        {/* Service */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-barber-muted">
            <Scissors className="h-3.5 w-3.5" />
            Serviço
          </h3>
          {appointment.service_name ? (
            <div>
              <p className="font-medium text-barber-white">
                {appointment.service_name}
              </p>
              {appointment.service_duration && (
                <p className="mt-1 text-xs text-barber-muted">
                  Duração: {appointment.service_duration} min
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-barber-muted">
              Nenhum serviço vinculado
            </p>
          )}
        </div>

        {/* Customer */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-barber-muted">
            <User className="h-3.5 w-3.5" />
            Cliente
          </h3>
          {appointment.customer_name ? (
            <div className="space-y-1.5">
              <p className="font-medium text-barber-white">
                {appointment.customer_name}
              </p>
              {appointment.customer_phone && (
                <p className="flex items-center gap-1.5 text-xs text-barber-muted">
                  <Phone className="h-3 w-3" />
                  {appointment.customer_phone}
                </p>
              )}
              {appointment.customer_email && (
                <p className="flex items-center gap-1.5 text-xs text-barber-muted">
                  <Mail className="h-3 w-3" />
                  {appointment.customer_email}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-barber-muted">
              Cliente não vinculado
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions — Status Transition Buttons */}
      {nextStatuses.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-barber-muted">
            Ações rápidas
          </h3>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((nextStatus) => {
              const cfg = STATUS_CONFIG[nextStatus];
              const Icon = cfg.icon;
              return (
                <form
                  key={nextStatus}
                  action={`/dashboard/agenda/${id}/status`}
                  method="POST"
                  className="inline"
                >
                  <input
                    type="hidden"
                    name="new_status"
                    value={nextStatus}
                  />
                  <button
                    type="submit"
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${cfg.bg} ${cfg.color} hover:opacity-80`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                </form>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-barber-muted">
            As alterações são registradas automaticamente no histórico.
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-barber-muted">
          Linha do tempo
        </h3>
        <div className="grid gap-2 text-xs text-barber-muted sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="block text-[10px] uppercase">Criado por</span>
            <span className="text-barber-light">
              {appointment.creator_name ?? "—"}
            </span>
          </div>
          {appointment.confirmed_at && (
            <div>
              <span className="block text-[10px] uppercase">Confirmado em</span>
              <span className="text-barber-light">
                {new Date(appointment.confirmed_at).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
          {appointment.completed_at && (
            <div>
              <span className="block text-[10px] uppercase">Concluído em</span>
              <span className="text-barber-light">
                {new Date(appointment.completed_at).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
          {appointment.cancelled_at && (
            <div>
              <span className="block text-[10px] uppercase">Cancelado em</span>
              <span className="text-red-400">
                {new Date(appointment.cancelled_at).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-barber-white">
            <History className="h-4 w-4 text-barber-gold" />
            Histórico de status
          </h2>
          <div className="relative space-y-0 pl-4">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-barber-border" />

            {history.map((entry, idx) => {
              const entryCfg =
                STATUS_CONFIG[entry.new_status as AppointmentStatus] ??
                STATUS_CONFIG.scheduled;
              const EntryIcon = entryCfg.icon;
              return (
                <div key={entry.id} className="relative pb-4 last:pb-0">
                  {/* Dot */}
                  <div
                    className={`absolute -left-4 top-1 flex h-4 w-4 items-center justify-center rounded-full border ${entryCfg.bg}`}
                  >
                    <EntryIcon className="h-2.5 w-2.5" />
                  </div>

                  <div className="ml-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-medium ${entryCfg.color}`}
                      >
                        {entryCfg.label}
                      </span>
                      {entry.previous_status && (
                        <span className="text-[10px] text-barber-muted">
                          ←{" "}
                          {
                            STATUS_CONFIG[
                              entry.previous_status as AppointmentStatus
                            ]?.label ?? entry.previous_status
                          }
                        </span>
                      )}
                      <span className="text-[10px] text-barber-muted">
                        {new Date(entry.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="mt-0.5 text-xs text-barber-muted">
                        {entry.reason}
                      </p>
                    )}
                    {entry.changed_by_name && (
                      <p className="text-[10px] text-barber-muted opacity-60">
                        por {entry.changed_by_name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}