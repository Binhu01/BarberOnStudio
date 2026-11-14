export const instant = false;

import { headers } from "next/headers";
import { Send, Plus, Users, CheckCircle2, XCircle, Clock, BarChart3 } from "lucide-react";
import { getCampaigns } from "../actions";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Rascunho", color: "text-gray-600", bg: "bg-gray-50" },
  scheduled: { label: "Agendada", color: "text-blue-600", bg: "bg-blue-50" },
  sending: { label: "Enviando", color: "text-amber-600", bg: "bg-amber-50" },
  completed: { label: "Concluída", color: "text-green-600", bg: "bg-green-50" },
  cancelled: { label: "Cancelada", color: "text-red-600", bg: "bg-red-50" },
};

const TYPE_LABELS: Record<string, string> = {
  reactivation: "Reativação",
  promotion: "Promoção",
  announcement: "Comunicado",
  survey: "Pesquisa",
  seasonal: "Sazonal",
  custom: "Personalizada",
};

export default async function WhatsappCampanhasPage() {
  await headers();

  const campaigns = await getCampaigns().catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-dark">Campanhas</h1>
          <p className="mt-1 text-sm text-barber-text-secondary">
            Envie mensagens em massa para segmentos de clientes
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-copper">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-white py-16 text-center shadow-sm">
          <Send className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
          <p className="text-sm font-medium text-barber-dark">Nenhuma campanha criada</p>
          <p className="mt-1 text-xs text-barber-text-secondary">
            Crie campanhas para reativar clientes, promover serviços ou enviar comunicados
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={campaign.id}
                className="rounded-xl border border-barber-border bg-white p-5 shadow-sm transition-all hover:border-barber-gold/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-barber-dark">{campaign.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="mt-1 text-xs text-barber-text-secondary">{campaign.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        {TYPE_LABELS[campaign.campaign_type] ?? campaign.campaign_type}
                      </span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 capitalize">
                        {campaign.channel}
                      </span>
                    </div>
                  </div>
                  {campaign.scheduled_at && (
                    <div className="flex items-center gap-1 text-xs text-barber-text-secondary">
                      <Clock className="h-3 w-3" />
                      {new Date(campaign.scheduled_at).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>

                {/* Stats Row */}
                <div className="mt-4 grid grid-cols-4 gap-3 border-t border-barber-border/50 pt-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-barber-dark">{campaign.total_recipients}</p>
                    <p className="text-[10px] text-barber-text-secondary">Destinatários</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{campaign.delivered_count}</p>
                    <p className="text-[10px] text-barber-text-secondary">Entregues</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600">{campaign.sent_count - campaign.delivered_count}</p>
                    <p className="text-[10px] text-barber-text-secondary">Pendentes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-600">{campaign.failed_count}</p>
                    <p className="text-[10px] text-barber-text-secondary">Falhas</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}