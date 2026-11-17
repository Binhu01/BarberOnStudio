export const instant = false;

import { headers } from "next/headers";
import { FileText, Plus, Search, Tag } from "lucide-react";
import { getNotificationTemplates } from "../actions";

const CATEGORY_LABELS: Record<string, string> = {
  appointment: "Agendamentos",
  payment: "Pagamentos",
  birthday: "Aniversário",
  reactivation: "Reativação",
  reminder: "Lembretes",
  custom: "Personalizados",
};

export default async function WhatsappModelosPage() {
  await headers();

  const templates = await getNotificationTemplates().catch(() => []);

  const grouped: Record<string, Array<{ id: string; name: string; category?: string; body?: string; body_preview?: string; variables?: string[] }>> = {};
  for (const t of templates) {
    const cat = (t as any).category ?? "custom";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t as any);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">
            Modelos de Mensagem
          </h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie templates aprovados para notificações automáticas
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper">
          <Plus className="h-4 w-4" />
          Novo Modelo
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
        <input
          type="text"
          placeholder="Buscar modelo..."
          className="w-full rounded-lg border border-barber-border bg-barber-graphite py-2.5 pl-10 pr-4 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
        />
      </div>

      {/* Templates by Category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-16 text-center shadow-sm">
          <FileText className="mb-3 h-10 w-10 text-barber-muted/40" />
          <p className="text-sm font-medium text-barber-white">
            Nenhum modelo cadastrado
          </p>
          <p className="mt-1 text-xs text-barber-muted">
            Crie modelos de mensagem para usar nas automações e campanhas
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-barber-gold" />
                <h2 className="font-display text-base font-semibold text-barber-white">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <span className="rounded-full bg-barber-dark px-2 py-0.5 text-xs text-barber-muted">
                  {items.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tpl: any) => (
                  <div
                    key={tpl.id}
                    className="group rounded-xl border border-barber-border bg-barber-graphite p-4 shadow-sm transition-all hover:border-barber-gold/40 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-medium text-barber-white">
                        {tpl.name}
                      </h3>
                      <span className="rounded bg-barber-success/10 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                        Ativo
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-barber-muted">
                      {tpl.body_preview ?? tpl.body ?? "Sem preview disponível"}
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-barber-border/50 pt-3">
                      <span className="text-[10px] text-barber-muted">
                        Variáveis:{" "}
                        {tpl.variables?.length
                          ? tpl.variables.join(", ")
                          : "nenhuma"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}