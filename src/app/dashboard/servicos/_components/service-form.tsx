"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBarberService, updateBarberService } from "../actions";
import type { CreateBarberServiceInput, BarberServiceWithCategory } from "@/types/barber";

interface ServiceFormProps {
  service?: BarberServiceWithCategory;
  categories: Array<{ id: string; name: string; description: string | null }>;
}

export function ServiceForm({ service, categories }: ServiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!service;

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateBarberServiceInput = {
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        category_id: (formData.get("category_id") as string) || undefined,
        duration_minutes: Number(formData.get("duration_minutes")),
        buffer_minutes: Number(formData.get("buffer_minutes")) || 0,
        price: Number(formData.get("price")),
        commission_type: formData.get("commission_type") as "percentage" | "fixed" | "none",
        commission_value: Number(formData.get("commission_value")) || 0,
        is_active: formData.get("is_active") === "true",
        display_order: Number(formData.get("display_order")) || 0,
      };

      if (isEditing && service) {
        await updateBarberService(service.id, input);
      } else {
        await createBarberService(input);
      }

      router.push("/dashboard/servicos");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar serviço");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-4 py-3 text-sm text-barber-error">
          {error}
        </div>
      )}

      {/* Nome */}
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-barber-light">
          Nome do serviço *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={service?.name}
          placeholder="Ex: Corte Masculino"
          className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
        />
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-barber-light">
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={service?.description ?? ""}
          placeholder="Descrição opcional do serviço"
          className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
        />
      </div>

      {/* Categoria e Duração */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="category_id" className="text-sm font-medium text-barber-light">
            Categoria
          </label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={service?.category_id ?? ""}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          >
            <option value="">Sem categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="duration_minutes" className="text-sm font-medium text-barber-light">
            Duração (minutos) *
          </label>
          <input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={1}
            required
            defaultValue={service?.duration_minutes ?? 30}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
      </div>

      {/* Preço e Intervalo */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="price" className="text-sm font-medium text-barber-light">
            Preço (R$) *
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step={0.01}
            required
            defaultValue={service?.price ?? 0}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="buffer_minutes" className="text-sm font-medium text-barber-light">
            Intervalo adicional (min)
          </label>
          <input
            id="buffer_minutes"
            name="buffer_minutes"
            type="number"
            min={0}
            defaultValue={service?.buffer_minutes ?? 0}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
      </div>

      {/* Comissão */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="commission_type" className="text-sm font-medium text-barber-light">
            Tipo de comissão
          </label>
          <select
            id="commission_type"
            name="commission_type"
            defaultValue={service?.commission_type ?? "percentage"}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          >
            <option value="percentage">Percentual (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
            <option value="none">Sem comissão</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="commission_value" className="text-sm font-medium text-barber-light">
            Valor da comissão
          </label>
          <input
            id="commission_value"
            name="commission_value"
            type="number"
            min={0}
            step={0.01}
            defaultValue={service?.commission_value ?? 0}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
      </div>

      {/* Status e Ordem */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="is_active" className="text-sm font-medium text-barber-light">
            Status
          </label>
          <select
            id="is_active"
            name="is_active"
            defaultValue={service?.is_active !== false ? "true" : "false"}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="display_order" className="text-sm font-medium text-barber-light">
            Ordem de exibição
          </label>
          <input
            id="display_order"
            name="display_order"
            type="number"
            min={0}
            defaultValue={service?.display_order ?? 0}
            className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
      </div>

      {/* Botões */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-5 py-2.5 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : isEditing ? "Atualizar Serviço" : "Criar Serviço"}
        </button>
        <a
          href="/dashboard/servicos"
          className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-5 py-2.5 text-sm font-medium text-barber-muted transition-colors hover:bg-barber-graphite hover:text-barber-white"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}