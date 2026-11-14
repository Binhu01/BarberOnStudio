export const instant = false;

import { headers } from "next/headers";
import {
  MessageCircle,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { getAutomationStats } from "./actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function WhatsappCentralPage() {
  await headers();

  const stats = await getAutomationStats().catch(() => ({
    today_notifications: 0,
    today_sent: 0,
    today_delivered: 0,
    today_failed: 0,
    pending_queue: 0,
    active_rules_triggered: 0,
    completed_campaigns: 0,
    total_campaign_sends: 0,
  }));

  const kpis = [
    {
      label: "Notificações hoje",
      value: stats.today_notifications,
      icon: MessageCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Enviadas hoje",
      value: stats.today_sent,
      icon: Send,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Entregues hoje",
      value: stats.today_delivered,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Falhas hoje",
      value: stats.today_failed,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-dark">
          Central de Mensagens
        </h1>
        <p className="mt-1 text-sm text-barber-text-secondary">
          Visão geral das notificações e automações WhatsApp
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-barber-border bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-barber-dark">{kpi.value}</p>
                <p className="text-xs text-barber-text-secondary">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <Clock className="mx-auto mb-2 h-5 w-5 text-amber-500" />
          <p className="text-xl font-bold text-barber-dark">{stats.pending_queue}</p>
          <p className="text-xs text-barber-text-secondary">Na fila de envio</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <TrendingUp className="mx-auto mb-2 h-5 w-5 text-blue-500" />
          <p className="text-xl font-bold text-barber-dark">{stats.active_rules_triggered}</p>
          <p className="text-xs text-barber-text-secondary">Regras ativas disparadas</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-green-500" />
          <p className="text-xl font-bold text-barber-dark">{stats.completed_campaigns}</p>
          <p className="text-xs text-barber-text-secondary">Campanhas concluídas</p>
        </div>
        <div className="rounded-xl border border-barber-border bg-white p-4 text-center shadow-sm">
          <Send className="mx-auto mb-2 h-5 w-5 text-indigo-500" />
          <p className="text-xl font-bold text-barber-dark">{stats.total_campaign_sends}</p>
          <p className="text-xs text-barber-text-secondary">Total envios campanhas</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-dark">
          Ações Rápidas
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <a
            href="/dashboard/whatsapp/campanhas"
            className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:border-barber-gold/50 hover:bg-barber-bg-secondary"
          >
            <Send className="h-5 w-5 text-barber-gold" />
            <div>
              <p className="text-sm font-medium text-barber-dark">Nova Campanha</p>
              <p className="text-xs text-barber-text-secondary">
                Enviar mensagem em massa
              </p>
            </div>
          </a>
          <a
            href="/dashboard/whatsapp/lembretes"
            className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:border-barber-gold/50 hover:bg-barber-bg-secondary"
          >
            <Clock className="h-5 w-5 text-barber-blue" />
            <div>
              <p className="text-sm font-medium text-barber-dark">Lembretes</p>
              <p className="text-xs text-barber-text-secondary">
                Configurar lembretes automáticos
              </p>
            </div>
          </a>
          <a
            href="/dashboard/whatsapp/historico"
            className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:border-barber-gold/50 hover:bg-barber-bg-secondary"
          >
            <MessageCircle className="h-5 w-5 text-barber-text-secondary" />
            <div>
              <p className="text-sm font-medium text-barber-dark">Histórico</p>
              <p className="text-xs text-barber-text-secondary">
                Ver todas as mensagens enviadas
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}