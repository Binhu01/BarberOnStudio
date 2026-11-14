import { getBarbershopSettings } from "../bloqueios/actions";
import { SettingsForm } from "./_components/settings-form";
import { Settings, Globe, Clock, MessageCircle } from "lucide-react";

export default async function ConfiguracoesPage() {
  const settings = await getBarbershopSettings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Configurações da Barbearia
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Configure agendamento público, aparência e notificações
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Agendamento Público</p>
              <p className="text-xl font-bold text-barber-white">
                {settings?.booking_enabled ? "Ativo" : "Inativo"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Antecedência Mínima</p>
              <p className="text-xl font-bold text-barber-white">
                {settings?.min_advance_hours ?? 2}h
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Lembrete WhatsApp</p>
              <p className="text-xl font-bold text-barber-white">
                {settings?.whatsapp_reminder_hours ?? 24}h antes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <SettingsForm initialSettings={settings} />
    </div>
  );
}