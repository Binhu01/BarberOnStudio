"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertBarbershopSettings } from "../../bloqueios/actions";
import type { BarbershopSettings } from "@/types/booking";
import { Save, Globe, Clock, MessageCircle, Palette, Store } from "lucide-react";

interface SettingsFormProps {
 initialSettings: BarbershopSettings | null;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
 const router = useRouter();
 const [isSaving, setIsSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 // Form state with defaults
 const [shopName, setShopName] = useState(initialSettings?.shop_name ?? "");
 const [shopDescription, setShopDescription] = useState(initialSettings?.shop_description ?? "");
 const [shopAddress, setShopAddress] = useState(initialSettings?.shop_address ?? "");
 const [shopPhone, setShopPhone] = useState(initialSettings?.shop_phone ?? "");
 const [publicSlug, setPublicSlug] = useState(initialSettings?.public_slug ?? "");
 const [bookingEnabled, setBookingEnabled] = useState(initialSettings?.booking_enabled ?? true);
 const [advanceBookingDays, setAdvanceBookingDays] = useState(initialSettings?.advance_booking_days ?? 30);
 const [minAdvanceHours, setMinAdvanceHours] = useState(initialSettings?.min_advance_hours ?? 2);
 const [autoConfirm, setAutoConfirm] = useState(initialSettings?.auto_confirm ?? false);
 const [allowBarberSelection, setAllowBarberSelection] = useState(initialSettings?.allow_barber_selection ?? true);
 const [whatsappReminderHours, setWhatsappReminderHours] = useState(initialSettings?.whatsapp_reminder_hours ?? 24);
 const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color ?? "#C9A96E");

 async function handleSave(e: React.FormEvent) {
 e.preventDefault();
 setIsSaving(true);
 setError(null);
 setSuccess(null);

 try {
 await upsertBarbershopSettings({
 shop_name: shopName,
 shop_description: shopDescription || null,
 shop_address: shopAddress || null,
 shop_phone: shopPhone || null,
 public_slug: publicSlug || null,
 booking_enabled: bookingEnabled,
 advance_booking_days: advanceBookingDays,
 min_advance_hours: minAdvanceHours,
 auto_confirm: autoConfirm,
 allow_barber_selection: allowBarberSelection,
 whatsapp_reminder_hours: whatsappReminderHours,
 primary_color: primaryColor,
 });
 setSuccess("Configurações salvas com sucesso!");
 router.refresh();
 } catch (err) {
 setError(err instanceof Error ? err.message : "Erro ao salvar configurações");
 } finally {
 setIsSaving(false);
 }
 }

 return (
 <form onSubmit={handleSave} className="space-y-6">
 {/* Messages */}
 {error && (
 <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-4 py-3 text-sm text-barber-error">
 {error}
 </div>
 )}
 {success && (
 <div className="rounded-lg border border-barber-success/30 bg-barber-success/10 px-4 py-3 text-sm text-barber-success">
 {success}
 </div>
 )}

 {/* Identidade da Barbearia */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
 <Store className="h-5 w-5 text-barber-gold" />
 Identidade da Barbearia
 </h2>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Nome da barbearia *</label>
 <input
 type="text"
 required
 value={shopName}
 onChange={(e) => setShopName(e.target.value)}
 className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Descrição curta</label>
 <textarea
 value={shopDescription}
 onChange={(e) => setShopDescription(e.target.value)}
 rows={2}
 placeholder="Ex: Barbearia premium no centro de SP..."
 className="w-full resize-none rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
 />
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Endereço</label>
 <input
 type="text"
 value={shopAddress}
 onChange={(e) => setShopAddress(e.target.value)}
 placeholder="Rua Exemplo, 123 - São Paulo/SP"
 className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Telefone</label>
 <input
 type="tel"
 value={shopPhone}
 onChange={(e) => setShopPhone(e.target.value)}
 placeholder="(11) 99999-9999"
 className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Agendamento Público */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
 <Globe className="h-5 w-5 text-barber-gold" />
 Agendamento Público
 </h2>
 <div className="space-y-4">
 <div className="flex items-center justify-between rounded-lg border border-barber-border bg-barber-dark p-3">
 <div>
 <p className="text-sm font-medium text-barber-white">Agendamento online ativo</p>
 <p className="text-xs text-barber-muted">Clientes podem agendar sem login via link público</p>
 </div>
 <button
 type="button"
 onClick={() => setBookingEnabled(!bookingEnabled)}
 className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
 bookingEnabled ? "bg-barber-gold" : "bg-barber-border"
 }`}
 >
 <span
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
 bookingEnabled ? "translate-x-5" : "translate-x-0.5"
 } mt-0.5`}
 />
 </button>
 </div>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Slug público (URL)</label>
 <div className="flex items-center gap-2">
 <span className="text-sm text-barber-muted">barberon.com.br/agendar/</span>
 <input
 type="text"
 value={publicSlug}
 onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
 placeholder="minha-barbearia"
 className="flex-1 rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
 />
 </div>
 <p className="text-xs text-barber-muted">
 Link para clientes agendarem: barberon.com.br/agendar/{publicSlug || "minha-barbearia"}
 </p>
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Antecedência mínima (horas)</label>
 <input
 type="number"
 min={0}
 max={168}
 value={minAdvanceHours}
 onChange={(e) => setMinAdvanceHours(parseInt(e.target.value) || 0)}
 className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Dias futuros disponíveis</label>
 <input
 type="number"
 min={1}
 max={365}
 value={advanceBookingDays}
 onChange={(e) => setAdvanceBookingDays(parseInt(e.target.value) || 1)}
 className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>
 </div>

 <div className="flex items-center justify-between rounded-lg border border-barber-border bg-barber-dark p-3">
 <div>
 <p className="text-sm font-medium text-barber-white">Seleção de profissional</p>
 <p className="text-xs text-barber-muted">Cliente pode escolher o barbeiro no agendamento</p>
 </div>
 <button
 type="button"
 onClick={() => setAllowBarberSelection(!allowBarberSelection)}
 className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
 allowBarberSelection ? "bg-barber-gold" : "bg-barber-border"
 }`}
 >
 <span
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
 allowBarberSelection ? "translate-x-5" : "translate-x-0.5"
 } mt-0.5`}
 />
 </button>
 </div>

 <div className="flex items-center justify-between rounded-lg border border-barber-border bg-barber-dark p-3">
 <div>
 <p className="text-sm font-medium text-barber-white">Confirmação automática</p>
 <p className="text-xs text-barber-muted">Agendamentos são confirmados automaticamente</p>
 </div>
 <button
 type="button"
 onClick={() => setAutoConfirm(!autoConfirm)}
 className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
 autoConfirm ? "bg-barber-gold" : "bg-barber-border"
 }`}
 >
 <span
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
 autoConfirm ? "translate-x-5" : "translate-x-0.5"
 } mt-0.5`}
 />
 </button>
 </div>
 </div>
 </div>

 {/* Notificações */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
 <MessageCircle className="h-5 w-5 text-barber-gold" />
 Notificações e Lembretes
 </h2>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Lembrete WhatsApp (horas antes)</label>
 <input
 type="number"
 min={1}
 max={168}
 value={whatsappReminderHours}
 onChange={(e) => setWhatsappReminderHours(parseInt(e.target.value) || 1)}
 className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 <p className="text-xs text-barber-muted">
 O cliente receberá um lembrete {whatsappReminderHours}h antes do agendamento
 </p>
 </div>
 </div>
 </div>

 {/* Aparência */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-barber-white">
 <Palette className="h-5 w-5 text-barber-gold" />
 Aparência
 </h2>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-barber-muted">Cor primária da página pública</label>
 <div className="flex items-center gap-3">
 <input
 type="color"
 value={primaryColor}
 onChange={(e) => setPrimaryColor(e.target.value)}
 className="h-10 w-10 cursor-pointer rounded border border-barber-border bg-transparent"
 />
 <input
 type="text"
 value={primaryColor}
 onChange={(e) => setPrimaryColor(e.target.value)}
 className="w-32 rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Save Button */}
 <div className="flex justify-end">
 <button
 type="submit"
 disabled={isSaving}
 className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-6 py-3 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
 >
 <Save className="h-4 w-4" />
 {isSaving ? "Salvando..." : "Salvar Configurações"}
 </button>
 </div>
 </form>
 );
}