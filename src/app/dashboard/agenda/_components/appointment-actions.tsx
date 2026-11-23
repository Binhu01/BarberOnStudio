"use client";

import { useState } from "react";
import { XCircle, CalendarClock, Loader2 } from "lucide-react";
import { changeAppointmentStatus, rescheduleAppointment } from "../actions";
import type { AppointmentStatus } from "../schemas";

interface AppointmentActionsProps {
  eventId: string;
  currentStatus: AppointmentStatus;
  currentStartAt: string;
  currentEndAt: string;
}

export function AppointmentActions({
  eventId,
  currentStatus,
  currentStartAt,
  currentEndAt,
}: AppointmentActionsProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [newStartAt, setNewStartAt] = useState("");
  const [newEndAt, setNewEndAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Não mostrar ações para status terminais já resolvidos
  const canCancel = ["scheduled", "confirmed", "arrived", "in_progress"].includes(currentStatus);
  const canReschedule = ["scheduled", "confirmed", "arrived"].includes(currentStatus);

  if (!canCancel && !canReschedule) return null;

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
      setSuccess("Agendamento cancelado com sucesso.");
      setShowCancelModal(false);
      // Reload para refletir mudanças
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
      setError("O horário de início deve ser anterior ao término.");
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
      setSuccess("Agendamento remarcado com sucesso.");
      setShowRescheduleModal(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remarcar.");
    } finally {
      setLoading(false);
    }
  }

  // Pré-preencher com dados atuais para remarcação
  function openReschedule() {
    const start = new Date(currentStartAt);
    const end = new Date(currentEndAt);
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setNewStartAt(fmt(start));
    setNewEndAt(fmt(end));
    setRescheduleReason("");
    setError(null);
    setShowRescheduleModal(true);
  }

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {canReschedule && (
          <button
            onClick={openReschedule}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Remarcar
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => {
              setCancelReason("");
              setError(null);
              setShowCancelModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancelar agendamento
          </button>
        )}
      </div>

      {/* Feedback messages */}
      {success && (
        <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          {success}
        </div>
      )}
      {error && !showCancelModal && !showRescheduleModal && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-barber-white">
              Cancelar agendamento
            </h3>
            <p className="mt-1 text-sm text-barber-muted">
              O agendamento será marcado como cancelado e o horário ficará disponível.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-barber-muted">
                Motivo do cancelamento *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Cliente desistiu, cliente pediu para cancelar..."
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
                onClick={() => setShowCancelModal(false)}
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
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-barber-white">
              Remarcar agendamento
            </h3>
            <p className="mt-1 text-sm text-barber-muted">
              O agendamento atual será cancelado e um novo será criado no horário escolhido.
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
                onClick={() => setShowRescheduleModal(false)}
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