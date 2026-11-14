"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createComanda } from "../actions";
import { Plus, User, Scissors, CalendarDays } from "lucide-react";

export function NewComandaForm() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barberId, setBarberId] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      await createComanda({
        assigned_barber_id: barberId || null,
        notes: notes || null,
      });
      setBarberId("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar comanda");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
        <Plus className="h-5 w-5 text-barber-gold" />
        Nova Comanda
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Barber Selection */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
            <Scissors className="h-3.5 w-3.5" />
            Profissional
          </label>
          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          >
            <option value="">Sem profissional atribuído</option>
            {/* Options populated via server component wrapper if needed */}
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
            <User className="h-3.5 w-3.5" />
            Observações
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nome do cliente, preferências..."
            rows={2}
            className="w-full resize-none rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-barber-error">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-barber-gold px-4 py-2.5 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {isCreating ? "Abrindo..." : "Abrir Comanda"}
        </button>
      </form>

      <p className="mt-3 text-center text-xs text-barber-muted">
        Adicione serviços e produtos após abrir a comanda
      </p>
    </div>
  );
}