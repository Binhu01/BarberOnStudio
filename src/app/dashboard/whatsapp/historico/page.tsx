
import { connection } from "next/server";
import { MessageCircle, CheckCircle2, XCircle, Clock, Search, Filter } from "lucide-react";
import { getNotificationLogs } from "../actions";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  sent: { label: "Enviado", color: "text-barber-gold", bg: "bg-barber-gold/10", icon: MessageCircle },
  delivered: { label: "Entregue", color: "text-barber-success", bg: "bg-barber-success/10", icon: CheckCircle2 },
  failed: { label: "Falha", color: "text-barber-error", bg: "bg-barber-error/10", icon: XCircle },
  pending: { label: "Pendente", color: "text-barber-warning", bg: "bg-barber-warning/10", icon: Clock },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  in_app: "In-app",
};

export default async function WhatsappHistoricoPage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const logs = await getNotificationLogs({ limit: 50 }).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Histórico de Mensagens</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Registro completo de todas as notificações enviadas
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
          <input
            type="text"
            placeholder="Buscar por telefone ou email..."
            className="w-full rounded-lg border border-barber-border bg-barber-graphite py-2.5 pl-10 pr-4 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
          />
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-barber-graphite px-4 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50">
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-16 text-center shadow-sm">
          <MessageCircle className="mb-3 h-10 w-10 text-barber-muted/40" />
          <p className="text-sm font-medium text-barber-white">Nenhuma mensagem enviada ainda</p>
          <p className="mt-1 text-xs text-barber-muted">
            O histórico aparecerá aqui quando automações ou campanhas forem disparadas
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-barber-border bg-barber-dark/50 text-xs uppercase tracking-wider text-barber-muted">
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Destinatário</th>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Enviado em</th>
                <th className="px-4 py-3 font-medium">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-barber-border/50">
              {logs.map((log) => {
                const statusCfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                return (
                  <tr key={log.id} className="transition-colors hover:bg-barber-dark/30">
                    <td className="px-4 py-3">
                      <span className="rounded bg-barber-copper/10 px-2 py-0.5 text-[10px] font-medium text-barber-copper capitalize">
                        {CHANNEL_LABELS[log.channel] ?? log.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-barber-white">
                      {log.recipient_phone ?? log.recipient_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-barber-muted">{log.event_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-barber-muted">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-barber-error">
                      {log.error_message ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}