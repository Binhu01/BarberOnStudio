// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import {
  Plug,
  MessageCircle,
  Mail,
  CreditCard,
  Calendar,
  Instagram,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { getIntegrationConnections, getWebhookEvents } from "./actions";

const PROVIDER_CONFIG: Record<string, { label: string; icon: typeof Plug; color: string; description: string }> = {
  whatsapp_meta: { label: "WhatsApp Business", icon: MessageCircle, color: "text-green-500", description: "Envio de mensagens e notificações via Meta Cloud API" },
  resend: { label: "Resend (Email)", icon: Mail, color: "text-blue-500", description: "Envio de emails transacionais e campanhas" },
  mercadopago: { label: "Mercado Pago", icon: CreditCard, color: "text-yellow-500", description: "Pagamentos online, PIX e parcelamento" },
  stripe: { label: "Stripe", icon: CreditCard, color: "text-indigo-500", description: "Pagamentos internacionais e assinaturas" },
  google_calendar: { label: "Google Calendar", icon: Calendar, color: "text-red-500", description: "Sincronização bidirecional de agenda" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-500", description: "Agendamento via DM e perfil business" },
  tiktok: { label: "TikTok", icon: Globe, color: "text-cyan-500", description: "Integração com TikTok Business" },
  webhook_custom: { label: "Webhook Personalizado", icon: Globe, color: "text-barber-muted", description: "Envio de eventos para URL externa" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  connected: { label: "Conectado", color: "text-barber-success", bg: "bg-barber-success/10 border-barber-success/20", icon: CheckCircle2 },
  disconnected: { label: "Desconectado", color: "text-barber-muted", bg: "bg-barber-muted/10 border-barber-muted/20", icon: XCircle },
  error: { label: "Erro", color: "text-barber-error", bg: "bg-barber-error/10 border-barber-error/20", icon: AlertCircle },
  pending: { label: "Pendente", color: "text-barber-warning", bg: "bg-barber-warning/10 border-barber-warning/20", icon: RefreshCw },
};

export default async function IntegracoesPage() {
  await headers();

  const [connections, webhookEvents] = await Promise.all([
    getIntegrationConnections().catch(() => []),
    getWebhookEvents({ limit: 10 }).catch(() => []),
  ]);

  const connectedMap = new Map(connections.map((c) => [c.provider, c]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">Integrações</h1>
        <p className="mt-1 text-sm text-barber-muted">
          Conecte serviços externos para automatizar pagamentos, notificações e sincronizações.
        </p>
      </div>

      {/* Available Integrations Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(PROVIDER_CONFIG).map(([provider, config]) => {
          const connection = connectedMap.get(provider);
          const statusCfg = connection ? (STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.disconnected) : STATUS_CONFIG.disconnected;
          const StatusIcon = statusCfg.icon;
          const ProviderIcon = config.icon;
          const isConnected = connection?.status === "connected";

          return (
            <div
              key={provider}
              className={`relative rounded-xl border p-5 transition-all ${
                isConnected
                  ? "border-barber-success/30 bg-barber-graphite"
                  : "border-barber-border bg-barber-graphite hover:border-barber-gold/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-barber-dark ${config.color}`}>
                  <ProviderIcon className="h-5 w-5" />
                </div>
                {connection && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusCfg.label}
                  </span>
                )}
              </div>

              <h3 className="mt-3 font-medium text-barber-white">{config.label}</h3>
              <p className="mt-1 text-xs text-barber-muted leading-relaxed">{config.description}</p>

              {connection?.last_error && (
                <p className="mt-2 rounded bg-barber-error/10 px-2 py-1 text-[10px] text-barber-error">
                  {connection.last_error}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                {isConnected ? (
                  <>
                    <button className="rounded-lg border border-barber-border bg-barber-dark px-3 py-1.5 text-xs font-medium text-barber-white transition-colors hover:bg-barber-border">
                      Configurar
                    </button>
                    <button className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-3 py-1.5 text-xs font-medium text-barber-error transition-colors hover:bg-barber-error/20">
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button className="inline-flex items-center gap-1 rounded-lg bg-barber-gold px-3 py-1.5 text-xs font-medium text-barber-white transition-colors hover:bg-barber-copper">
                    <ExternalLink className="h-3 w-3" />
                    Conectar
                  </button>
                )}
              </div>

              {connection?.last_sync_at && (
                <p className="mt-3 text-[10px] text-barber-muted">
                  Última sync: {new Date(connection.last_sync_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Webhook Events */}
      {webhookEvents.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">Eventos Recentes (Webhooks)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-muted">
                  <th className="pb-2 pr-4">Provider</th>
                  <th className="pb-2 pr-4">Evento</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Recebido em</th>
                  <th className="pb-2">Processado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {webhookEvents.map((event) => (
                  <tr key={event.id} className="text-barber-light">
                    <td className="py-2 pr-4 font-medium">{event.provider}</td>
                    <td className="py-2 pr-4">{event.event_type}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        event.processed
                          ? "bg-barber-success/10 text-barber-success"
                          : event.processing_error
                            ? "bg-barber-error/10 text-barber-error"
                            : "bg-barber-warning/10 text-barber-warning"
                      }`}>
                        {event.processed ? "Processado" : event.processing_error ? "Erro" : "Pendente"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-barber-muted">
                      {new Date(event.received_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 text-xs text-barber-muted">
                      {event.processed_at ? new Date(event.processed_at).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}