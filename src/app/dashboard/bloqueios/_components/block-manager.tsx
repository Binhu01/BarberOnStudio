"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createScheduleBlock, deleteScheduleBlock } from "../actions";
import type { ScheduleBlock } from "@/types/booking";
import { Plus, Trash2, Ban, CalendarDays, Clock, User } from "lucide-react";

interface BlockManagerProps {
  initialBlocks: ScheduleBlock[];
}

export function BlockManager({ initialBlocks }: BlockManagerProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt || !title) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createScheduleBlock({
        title,
        reason: reason || null,
        start_at: startsAt,
        end_at: endsAt,
      });
      setSuccess("Bloqueio criado com sucesso!");
      setTitle("");
      setReason("");
      setStartsAt("");
      setEndsAt("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar bloqueio");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(blockId: string) {
    if (!confirm("Remover este bloqueio?")) return;
    try {
      await deleteScheduleBlock(blockId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover bloqueio");
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-barber-white">
          Bloqueios ({initialBlocks.length})
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper"
          >
            <Plus className="h-4 w-4" />
            Novo Bloqueio
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-4 py-3 text-sm text-barber-error">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-barber-success/30 bg-barber-success/10 px-4 py-3 text-sm text-barber-success">
          {success}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-barber-gold/30 bg-barber-graphite p-5">
          <h3 className="mb-4 font-display text-base font-bold text-barber-white">
            Criar Bloqueio
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-barber-muted">
                Título *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Férias, Manutenção, Folga..."
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-barber-muted">
                  Início *
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-barber-muted">
                  Fim *
                </label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-barber-muted">
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
              >
                {isCreating ? "Criando..." : "Criar Bloqueio"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:bg-barber-graphite hover:text-barber-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Blocks List */}
      {initialBlocks.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite/50">
          <div className="text-center">
            <Ban className="mx-auto mb-2 h-8 w-8 text-barber-muted opacity-50" />
            <p className="text-sm text-barber-muted">Nenhum bloqueio cadastrado</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {initialBlocks.map((block) => {
            const isPast = new Date(block.end_at) < new Date();
            return (
              <div
                key={block.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  isPast
                    ? "border-barber-border/50 bg-barber-dark/30 opacity-60"
                    : "border-barber-border bg-barber-graphite"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isPast
                      ? "bg-barber-muted/10 text-barber-muted"
                      : "bg-barber-error/10 text-barber-error"
                  }`}
                >
                  <Ban className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-barber-white">{block.title}</p>
                    {isPast && (
                      <span className="rounded bg-barber-muted/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-barber-muted">
                        Expirado
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-barber-muted">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(block.start_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(block.start_at)} → {formatTime(block.end_at)}
                    </span>
                    {block.member_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {block.member_name}
                      </span>
                    )}
                  </div>
                  {block.reason && (
                    <p className="mt-1 text-xs italic text-barber-muted/70">
                      {block.reason}
                    </p>
                  )}
                </div>

                {!isPast && (
                  <button
                    onClick={() => handleDelete(block.id)}
                    className="rounded p-2 text-barber-muted transition-colors hover:bg-barber-error/10 hover:text-barber-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}