"use client";

import { useState } from "react";
import { Trash2, CalendarClock, Loader2, XCircle } from "lucide-react";
import { changeAppointmentStatus, rescheduleAppointment } from "../actions";
import type { AppointmentStatus } from "../schemas";

interface AppointmentListActionsProps {
  eventId: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
}

export function AppointmentListActions({
  eventId,
  status,
  startAt,
  endAt,
}: AppointmentListActionsProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [newStartAt, setNewStartAt] = useState("");
  const [newEndAt, setNewEndAt] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAct = ["scheduled", "confirmed", "arrived"].includes(status);
  if (!canAct) return null;

  function openReschedule(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const start = new Date(startAt);
    const end = new Date(endAt);
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setNewStartAt(fmt(start));
    setNewEndAt(fmt(end));
    setRescheduleReason("");
    setError(null);
    setShowReschedule(true);
  }

  function openCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCancelReason("");
    setError(null);
    setShowCancelConfirm(true);
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setError("Informe o motivo do cancelamento.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await changeAppointmentStatus({
        event_id: eventId,
        new_status: "cancelled",
        reason: cancelReason.trim(),
      });
      setShowCancelConfirm(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReschedule() {
    if (!newStartAt || !newEndAt) {
      setError("Informe a nova data e horário.");
      return;
    }
    if (new Date(newStartAt) >= new Date(newEndAt)) {
      setError("O início deve ser anterior ao término.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await rescheduleAppointment({
        event_id: eventId,
        new_start_at: newStartAt,
        new_end_at: newEndAt,
        reason: rescheduleReason.trim() || undefined,
      });
      setShowReschedule(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remarcar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Inline action buttons */}
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.preventDefault()}
      >
        <button
          onClick={openReschedule}
          title="Remarcar"
          className="rounded-lg p-1.5 text-barber-muted transition-colors hover:bg-blue-500/10 hover:text-blue-400"
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={openCancel}
          title="Cancelar"
          className="rounded-lg p-1.5 text-barber-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Cancel Modal */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-barber-white">
              Cancelar agendamento
            </h3>
            <p className="mt-1 text-sm text-barber-muted">
              O agendamento será marcado como cancelado e o horário ficará
              disponível.
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-barber-muted">
                Motivo do cancelamento *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Cliente desistiu, pediu para cancelar..."
                rows={3}
                className="w-full rounded-lg border border-barber-border bg-barber-dark p-3 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
              />
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
                {error}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showReschedule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowReschedule(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-barber-white">
              Remarcar agendamento
            </h3>
            <p className="mt-1 text-sm text-barber-muted">
              O agendamento atual será cancelado e um novo será criado no
              horário escolhido.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-muted">
                  Nova data e horário de início *
                </label>
                <input
                  type="datetime-local"
                  value={newStartAt}
                  onChange={(e) => setNewStartAt(e.target.value)}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark p-3 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-muted">
                  Nova data e horário de término *
                </label>
                <input
                  type="datetime-local"
                  value={newEndAt}
                  onChange={(e) => setNewEndAt(e.target.value)}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark p-3 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-muted">
                  Motivo da remarcação (opcional)
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Ex: Cliente pediu para trocar de horário..."
                  rows={2}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark p-3 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
              </div>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
                {error}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowReschedule(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
              >
                Voltar
              </button>
              <button
                onClick={handleReschedule}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar remarcação
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}