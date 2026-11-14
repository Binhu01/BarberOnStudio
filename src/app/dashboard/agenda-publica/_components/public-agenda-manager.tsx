"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  Link2,
  Settings,
  Check,
  Copy,
  ExternalLink,
  Scissors,
  Users,
  Clock,
  ShieldCheck,
} from "lucide-react";
import type { BarbershopSettings } from "@/types/booking";
import { upsertBarbershopSettings } from "../../bloqueios/actions";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Barber {
  id: string;
  full_name: string | null;
}

interface Props {
  settings: BarbershopSettings | null;
  services: Service[];
  barbers: Barber[];
  orgSlug: string;
}

export function PublicAgendaManager({ settings, services, barbers, orgSlug }: Props) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  // Form state initialized from real BarbershopSettings fields
  const [bookingEnabled, setBookingEnabled] = useState(settings?.booking_enabled ?? false);
  const [shopName, setShopName] = useState(settings?.shop_name ?? "");
  const [shopDescription, setShopDescription] = useState(settings?.shop_description ?? "");
  const [shopAddress, setShopAddress] = useState(settings?.shop_address ?? "");
  const [shopPhone, setShopPhone] = useState(settings?.shop_phone ?? "");
  const [advanceBookingDays, setAdvanceBookingDays] = useState(String(settings?.advance_booking_days ?? 30));
  const [minAdvanceHours, setMinAdvanceHours] = useState(String(settings?.min_advance_hours ?? 2));
  const [autoConfirm, setAutoConfirm] = useState(settings?.auto_confirm ?? false);
  const [allowBarberSelection, setAllowBarberSelection] = useState(settings?.allow_barber_selection ?? true);
  const [whatsappReminderHours, setWhatsappReminderHours] = useState(String(settings?.whatsapp_reminder_hours ?? 24));
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color ?? "#0866E8");

  async function handleSave() {
    startTransition(async () => {
      try {
        await upsertBarbershopSettings({
          shop_name: shopName || undefined,
          shop_description: shopDescription || null,
          shop_address: shopAddress || null,
          shop_phone: shopPhone || null,
          booking_enabled: bookingEnabled,
          advance_booking_days: Number(advanceBookingDays) || 30,
          min_advance_hours: Number(minAdvanceHours) || 2,
          auto_confirm: autoConfirm,
          allow_barber_selection: allowBarberSelection,
          whatsapp_reminder_hours: Number(whatsappReminderHours) || 24,
          primary_color: primaryColor,
        });
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao salvar configurações");
      }
    });
  }

  function handleCopyLink() {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${orgSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const publicUrl = `/agendar/${orgSlug}`;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={`rounded-xl border p-4 ${
          bookingEnabled
            ? "border-barber-green/30 bg-barber-green/5"
            : "border-yellow-400/30 bg-yellow-400/5"
        }`}
      >
        <div className="flex items-center gap-3">
          {bookingEnabled ? (
            <ShieldCheck className="h-5 w-5 text-barber-green" />
          ) : (
            <Globe className="h-5 w-5 text-yellow-400" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${bookingEnabled ? "text-barber-green" : "text-yellow-400"}`}>
              {bookingEnabled ? "Agendamento público está ATIVO" : "Agendamento público está DESATIVADO"}
            </p>
            <p className="text-xs text-barber-muted">
              {bookingEnabled
                ? "Clientes podem agendar serviços pela página pública sem precisar de login"
                : "Ative para permitir que clientes agendem online pelo link público"}
            </p>
          </div>
          <button
            onClick={() => setBookingEnabled(!bookingEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              bookingEnabled ? "bg-barber-green" : "bg-barber-graphite"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                bookingEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Public Link Card */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
          <Link2 className="h-4 w-4 text-barber-gold" />
          Link da Página Pública
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-muted">
            {typeof window !== "undefined" ? window.location.origin : "https://seusite.com"}{publicUrl}
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
          >
            {copied ? <Check className="h-4 w-4 text-barber-green" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir
          </a>
        </div>
        <p className="mt-2 text-xs text-barber-muted">
          Compartilhe este link nas redes sociais, WhatsApp ou imprima um QR code para a recepção
        </p>
      </div>

      {/* Configuration Form */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-barber-white">
          <Settings className="h-4 w-4 text-barber-copper" />
          Configurações do Agendamento
        </h3>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-barber-muted">Nome da Barbearia</label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              placeholder="Barber-On Studio"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">Telefone</label>
            <input
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              placeholder="(82) 99999-9999"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-barber-muted">Endereço</label>
            <input
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              placeholder="Rua Exemplo, 123 - Cidade"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-barber-muted">Descrição</label>
            <textarea
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
              placeholder="Descrição da barbearia para a página pública..."
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 border-t border-barber-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">Dias à frente para agendar</label>
            <input
              type="number"
              value={advanceBookingDays}
              onChange={(e) => setAdvanceBookingDays(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">Antecedência mínima (horas)</label>
            <input
              type="number"
              value={minAdvanceHours}
              onChange={(e) => setMinAdvanceHours(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">Lembrete WhatsApp (horas antes)</label>
            <input
              type="number"
              value={whatsappReminderHours}
              onChange={(e) => setWhatsappReminderHours(e.target.value)}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-barber-border pt-5">
          <h4 className="mb-3 text-sm font-medium text-barber-white">Opções de agendamento</h4>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-barber-light">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="rounded border-barber-border accent-barber-gold"
              />
              Confirmar automaticamente
            </label>
            <label className="flex items-center gap-2 text-sm text-barber-light">
              <input
                type="checkbox"
                checked={allowBarberSelection}
                onChange={(e) => setAllowBarberSelection(e.target.checked)}
                className="rounded border-barber-border accent-barber-gold"
              />
              Permitir escolha do profissional
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-barber-border pt-5">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-barber-gold px-6 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar Configurações"}
          </button>
          <p className="text-xs text-barber-muted">
            As alterações são aplicadas imediatamente na página pública
          </p>
        </div>
      </div>

      {/* Available Services & Barbers Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
            <Scissors className="h-4 w-4 text-barber-copper" />
            Serviços Disponíveis ({services.length})
          </h3>
          {services.length === 0 ? (
            <p className="text-xs text-barber-muted">
              Nenhum serviço ativo. Cadastre serviços para aparecerem no agendamento público.
            </p>
          ) : (
            <div className="max-h-[200px] space-y-1 overflow-y-auto">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-barber-light">{s.name}</span>
                  <span className="text-barber-muted">
                    {s.duration_minutes}min · R$ {Number(s.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
            <Users className="h-4 w-4 text-barber-copper" />
            Profissionais Disponíveis ({barbers.length})
          </h3>
          {barbers.length === 0 ? (
            <p className="text-xs text-barber-muted">
              Nenhum profissional cadastrado na equipe.
            </p>
          ) : (
            <div className="max-h-[200px] space-y-1 overflow-y-auto">
              {barbers.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-barber-gold/10 text-[10px] font-bold text-barber-gold">
                    {(b.full_name ?? "?").charAt(0)}
                  </div>
                  <span className="text-barber-light">{b.full_name ?? "Sem nome"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}