// This page uses dynamic server data
// With cacheComponents: true, instant=false allows blocking render + connection() opts out of prerender

import { connection } from "next/server";
import Link from "next/link";
import {
  Plus,
  CalendarDays,
  Scissors,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CircleDot,
  Timer,
  CalendarCheck,
} from "lucide-react";
import { getAppointments, getAppointmentStats } from "./actions";
import type { AppointmentStatus } from "./actions";
import { AppointmentListActions } from "./_components/appointment-list-actions";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  scheduled: {
    label: "Agendado",
    color: "text-barber-gold",
    bg: "bg-barber-gold/10 border-barber-gold/20",
    icon: CalendarDays,
  },
  confirmed: {
    label: "Confirmado",
    color: "text-barber-success",
    bg: "bg-barber-success/10 border-barber-success/20",
    icon: CalendarCheck,
  },
  arrived: {
    label: "Cliente chegou",
    color: "text-barber-gold",
    bg: "bg-barber-gold/10 border-barber-gold/20",
    icon: CircleDot,
  },
  in_progress: {
    label: "Em andamento",
    color: "text-barber-copper",
    bg: "bg-barber-copper/10 border-barber-copper/20",
    icon: Timer,
  },
  completed: {
    label: "Concluído",
    color: "text-barber-success",
    bg: "bg-barber-success/10 border-barber-success/20",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    color: "text-barber-error",
    bg: "bg-barber-error/10 border-barber-error/20",
    icon: XCircle,
  },
  no_show: {
    label: "Não compareceu",
    color: "text-barber-warning",
    bg: "bg-barber-warning/10 border-barber-warning/20",
    icon: AlertCircle,
  },
};

const ORIGIN_LABELS: Record<string, string> = {
  manual: "Manual",
  landing_page: "Site",
  recurring: "Recorrente",
  whatsapp: "WhatsApp",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AgendaPage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString();

  const [appointments, stats] = await Promise.all([
    getAppointments({ startDate, endDate }),
    getAppointmentStats().catch(() => ({
      today: 0,
      this_week: 0,
      pending: 0,
      completed_this_month: 0,
      cancelled_this_month: 0,
      no_show_this_month: 0,
      revenue_this_month: 0,
    })),
  ]);

  const monthName = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Group by day
  const groupedByDay = appointments.reduce<
    Record<string, typeof appointments>
  >((acc, appt) => {
    const dayKey = new Date(appt.start_at).toLocaleDateString("pt-BR");
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(appt);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">
            Agenda
          </h1>
          <p className="mt-1 text-sm capitalize text-barber-muted">
            {monthName}
          </p>
        </div>
        <Link
          href="/dashboard/agenda/novo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
        >
          <Plus className="h-4 w-4" />
          Novo agendamento
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
          <p className="text-xs text-barber-muted">Hoje</p>
          <p className="text-2xl font-bold text-barber-white">{stats.today}</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
          <p className="text-xs text-barber-muted">Esta semana</p>
          <p className="text-2xl font-bold text-barber-white">
            {stats.this_week}
          </p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
          <p className="text-xs text-barber-muted">Pendentes</p>
          <p className="text-2xl font-bold text-barber-gold">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
          <p className="text-xs text-barber-muted">Receita do mês</p>
          <p className="text-2xl font-bold text-barber-success">
            {formatCurrency(stats.revenue_this_month)}
          </p>
        </div>
      </div>

      {/* Appointments List grouped by day */}
      {appointments.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-barber-border p-12 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-barber-muted opacity-40" />
          <p className="mt-4 text-sm font-medium text-barber-white">
            Nenhum agendamento neste mês
          </p>
          <p className="mt-1 text-xs text-barber-muted">
            Crie um agendamento para começar a organizar sua agenda.
          </p>
          <Link
            href="/dashboard/agenda/novo"
            className="mt-4 inline-block rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white hover:bg-barber-copper"
          >
            Criar agendamento
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDay).map(([dayLabel, dayAppts]) => (
            <div key={dayLabel}>
              {/* Day header */}
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-barber-border" />
                <span className="text-xs font-semibold uppercase tracking-wider text-barber-muted">
                  {dayLabel}
                </span>
                <div className="h-px flex-1 bg-barber-border" />
              </div>

              <div className="space-y-2">
                {dayAppts.map((appt) => {
                  const start = new Date(appt.start_at);
                  const end = new Date(appt.end_at);
                  const statusCfg =
                    STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <Link
                      key={appt.event_id}
                      href={`/dashboard/agenda/${appt.event_id}`}
                      className="group flex flex-col gap-3 rounded-xl border border-barber-border bg-barber-graphite p-4 transition-all hover:border-barber-gold/30 hover:shadow-md sm:flex-row sm:items-center"
                    >
                      {/* Time column */}
                      <div className="min-w-[80px] text-center sm:text-left">
                        <p className="text-lg font-bold text-barber-white">
                          {start.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-xs text-barber-muted">
                          {end.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* Service & Customer info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h3 className="truncate font-medium text-barber-white group-hover:text-barber-gold">
                            {appt.title}
                          </h3>
                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-barber-muted">
                          {/* Barber */}
                          {appt.barber_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {appt.barber_name}
                            </span>
                          )}

                          {/* Service */}
                          {appt.service_name && (
                            <span className="flex items-center gap-1">
                              <Scissors className="h-3 w-3" />
                              {appt.service_name}
                              {appt.service_duration && (
                                <span className="opacity-60">
                                  ({appt.service_duration}min)
                                </span>
                              )}
                            </span>
                          )}

                          {/* Customer */}
                          {appt.customer_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {appt.customer_name}
                            </span>
                          )}

                          {/* Price */}
                          {appt.total_price != null && appt.total_price > 0 && (
                            <span className="font-medium text-barber-gold">
                              {formatCurrency(appt.total_price)}
                            </span>
                          )}

                          {/* Origin */}
                          {appt.origin !== "manual" && (
                            <span className="rounded bg-barber-dark px-1.5 py-0.5 text-[10px] text-barber-muted">
                              {ORIGIN_LABELS[appt.origin] ?? appt.origin}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status badge + actions */}
                      <div className="flex items-center gap-2 sm:justify-end">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusCfg.bg} ${statusCfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                        <AppointmentListActions
                          eventId={appt.event_id}
                          status={appt.status}
                          startAt={appt.start_at}
                          endAt={appt.end_at}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}