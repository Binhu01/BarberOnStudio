export const instant = false;

import { headers } from "next/headers";
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, Bell } from "lucide-react";
import { getAutomationRules } from "../actions";

const EVENT_LABELS: Record<string, string> = {
  appointment_created: "Agendamento criado",
  appointment_confirmed: "Agendamento confirmado",
  appointment_cancelled: "Agendamento cancelado",
  appointment_reminder_24h: "Lembrete 24h antes",
  appointment_reminder_1h: "Lembrete 1h antes",
  subscription_expiring_7d: "Assinatura vencendo (7 dias)",
  subscription_expiring_3d: "Assinatura vencendo (3 dias)",
  subscription_expired: "Assinatura expirada",
  payment_received: "Pagamento recebido",
  payment_overdue: "Pagamento atrasado",
  customer_inactive_30d: "Cliente inativo 30 dias",
  customer_inactive_60d: "Cliente inativo 60 dias",
  customer_inactive_90d: "Cliente inativo 90 dias",
  birthday: "Aniversário",
  custom: "Personalizado",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  in_app: "In-app",
};

export default async function WhatsappLembretesPage() {
  await headers();

  const rules = await getAutomationRules().catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-dark">
            Lembretes Automáticos
          </h1>
          <p className="mt-1 text-sm text-barber-text-secondary">
            Configure regras de notificação automática para agendamentos, assinaturas e mais
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-copper">
          <Plus className="h-4 w-4" />
          Nova Regra
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-white py-16 text-center shadow-sm">
          <Bell className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
          <p className="text-sm font-medium text-barber-dark">
            Nenhuma regra de lembrete configurada
          </p>
          <p className="mt-1 text-xs text-barber-text-secondary">
            Crie regras para enviar notificações automáticas aos clientes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                rule.is_active
                  ? "border-barber-border"
                  : "border-dashed border-barber-border/60 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      rule.is_active ? "bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    <Clock
                      className={`h-4 w-4 ${
                        rule.is_active ? "text-green-600" : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-barber-dark">
                      {rule.name}
                    </h3>
                    {rule.description && (
                      <p className="mt-0.5 text-xs text-barber-text-secondary">
                        {rule.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {EVENT_LABELS[rule.event_type] ?? rule.event_type}
                      </span>
                      <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        {CHANNEL_LABELS[rule.channel] ?? rule.channel}
                      </span>
                      {rule.delay_minutes > 0 && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Atraso: {rule.delay_minutes}min
                        </span>
                      )}
                      {rule.max_per_day && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          Máx: {rule.max_per_day}/dia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-barber-text-secondary">
                    {rule.trigger_count} disparos
                  </span>
                  {rule.is_active ? (
                    <ToggleRight className="h-6 w-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-300" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}