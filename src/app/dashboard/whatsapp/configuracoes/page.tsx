export const instant = false;

import { connection } from "next/server";
import { Settings, Save, AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import { getWhatsappConfig } from "../actions";

export default async function WhatsappConfiguracoesPage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const config = await getWhatsappConfig().catch(() => null);

  const isConnected = config?.is_active ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Configurações WhatsApp
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Configure a integração com WhatsApp Business Cloud API
        </p>
      </div>

      {/* Connection Status */}
      <div
        className={`rounded-xl border p-6 shadow-sm ${
          isConnected
            ? "border-barber-success/30 bg-barber-success/10"
            : "border-barber-warning/30 bg-barber-warning/10"
        }`}
      >
        <div className="flex items-center gap-3">
          {isConnected ? (
            <CheckCircle2 className="h-6 w-6 text-barber-success" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-barber-warning" />
          )}
          <div>
            <h2
              className={`text-sm font-semibold ${
                isConnected ? "text-barber-success" : "text-barber-warning"
              }`}
            >
              {isConnected ? "Conectado" : "Não conectado"}
            </h2>
            <p
              className={`text-xs ${
                isConnected ? "text-barber-success/80" : "text-barber-warning/80"
              }`}
            >
              {isConnected
                ? `WABA ID: ${config?.waba_id ?? "—"}`
                : "Configure as credenciais da Meta Cloud API para ativar o módulo WhatsApp"}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-barber-gold" />
          <h2 className="font-display text-lg font-semibold text-barber-white">
            Credenciais da API
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-barber-white">
              Phone Number ID
            </label>
            <input
              type="text"
              defaultValue={config?.phone_number_id ?? ""}
              placeholder="Ex: 1234567890"
              className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
            <p className="mt-1 text-[10px] text-barber-muted">
              ID do número de telefone no Meta Business Manager
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-barber-white">
              WABA ID
            </label>
            <input
              type="text"
              defaultValue={config?.waba_id ?? ""}
              placeholder="Ex: 987654321"
              className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
            <p className="mt-1 text-[10px] text-barber-muted">
              WhatsApp Business Account ID
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-barber-white">
              Access Token
            </label>
            <input
              type="password"
              placeholder="Token permanente da API"
              className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
            <p className="mt-1 text-[10px] text-barber-muted">
              Gere um token permanente no Meta Developer Portal
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-barber-white">
              Lembretes (horas antes)
            </label>
            <input
              type="number"
              defaultValue={config?.reminder_hours_before ?? 24}
              min={1}
              max={168}
              className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
            <p className="mt-1 text-[10px] text-barber-muted">
              Horas antes do agendamento para enviar lembrete
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-barber-white">
              Aviso de vencimento (dias antes)
            </label>
            <input
              type="number"
              defaultValue={config?.expiry_reminder_days ?? 3}
              min={1}
              max={30}
              className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
            <p className="mt-1 text-[10px] text-barber-muted">
              Dias antes do vencimento da assinatura para enviar aviso
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-barber-border/50 pt-4">
          <button className="rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50">
            Testar Conexão
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper">
            <Save className="h-4 w-4" />
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-barber-border bg-barber-gold/10 p-5">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-barber-gold" />
          <div>
            <h3 className="text-sm font-medium text-barber-white">
              Como configurar
            </h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-barber-muted">
              <li>
                Acesse{" "}
                <a
                  href="https://developers.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  developers.facebook.com
                </a>{" "}
                e crie um app do tipo Business
              </li>
              <li>Adicione o produto WhatsApp Business Platform</li>
              <li>
                Gere um token de acesso permanente com as permissões
                whatsapp_business_messaging
              </li>
              <li>Copie o Phone Number ID e WABA ID</li>
              <li>Aprove os templates de mensagem no Meta Business Suite</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}