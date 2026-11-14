"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "../actions";

interface Member {
  membership_id: string;
  name: string;
  email: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface EventFormProps {
  members: Member[];
  services?: Service[];
  customers?: Customer[];
}

export function EventForm({ members, services = [], customers = [] }: EventFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);

    try {
      const startAt = formData.get("start_at") as string;
      const endAt = formData.get("end_at") as string;

      if (!startAt || !endAt) {
        throw new Error("Data de início e fim são obrigatórias");
      }

      if (new Date(endAt) <= new Date(startAt)) {
        throw new Error("A data de fim deve ser posterior à data de início");
      }

      const serviceId = formData.get("barber_service_id") as string | null;
      const barberId = formData.get("assigned_barber_id") as string | null;
      const customerId = formData.get("customer_id") as string | null;
      const totalPriceStr = formData.get("total_price") as string | null;

      await createAppointment({
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        barber_service_id: serviceId || null,
        assigned_barber_id: barberId || null,
        customer_id: customerId || null,
        total_price: totalPriceStr ? parseFloat(totalPriceStr) : null,
        notes: (formData.get("notes") as string) || null,
        color: "#0866E8",
      });

      router.push("/dashboard/agenda");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Title */}
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-barber-white">
              Título *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
              placeholder="Ex: Corte de cabelo — João Silva"
            />
          </div>

          {/* Start */}
          <div>
            <label htmlFor="start_at" className="block text-sm font-medium text-barber-white">
              Início *
            </label>
            <input
              id="start_at"
              name="start_at"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
          </div>

          {/* End */}
          <div>
            <label htmlFor="end_at" className="block text-sm font-medium text-barber-white">
              Fim *
            </label>
            <input
              id="end_at"
              name="end_at"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
          </div>

          {/* Service */}
          <div>
            <label htmlFor="barber_service_id" className="block text-sm font-medium text-barber-white">
              Serviço
            </label>
            <select
              id="barber_service_id"
              name="barber_service_id"
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Nenhum serviço</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes}min — R$ {Number(s.price).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Barber */}
          <div>
            <label htmlFor="assigned_barber_id" className="block text-sm font-medium text-barber-white">
              Profissional
            </label>
            <select
              id="assigned_barber_id"
              name="assigned_barber_id"
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Sem profissional atribuído</option>
              {members.map((m) => (
                <option key={m.membership_id} value={m.membership_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label htmlFor="customer_id" className="block text-sm font-medium text-barber-white">
              Cliente
            </label>
            <select
              id="customer_id"
              name="customer_id"
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Cliente não cadastrado</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.phone ? ` — ${c.phone}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label htmlFor="total_price" className="block text-sm font-medium text-barber-white">
              Valor (R$)
            </label>
            <input
              id="total_price"
              name="total_price"
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
              placeholder="0,00"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-barber-white">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={1000}
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
              placeholder="Detalhes do agendamento..."
            />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-barber-white">
              Observações internas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
              placeholder="Notas visíveis apenas para a equipe..."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-barber-gold px-6 py-2.5 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Criar agendamento"}
        </button>
        <a
          href="/dashboard/agenda"
          className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-6 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}