"use client";

import { useState, useEffect } from "react";
import { getAvailableSlots, createPublicBooking } from "@/app/dashboard/bloqueios/public-booking-actions";
import type { AvailableSlot } from "@/types/booking";
import {
  Scissors,
  User,
  CalendarDays,
  Clock,
  Phone,
  Mail,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string | null;
}

interface Barber {
  membership_id: string;
  name: string;
  bio: string | null;
  specialties: string[] | null;
}

interface BookingFormProps {
  orgId: string;
  services: Service[];
  barbers: Barber[];
  allowBarberSelection: boolean;
  minAdvanceHours: number;
  advanceBookingDays: number;
  primaryColor: string;
}

type Step = "service" | "barber" | "datetime" | "info" | "success";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BookingForm({
  orgId,
  services,
  barbers,
  allowBarberSelection,
  minAdvanceHours,
  advanceBookingDays,
}: BookingFormProps) {
  const [step, setStep] = useState<Step>("service");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Success state
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  // Date range
  const minDate = new Date();
  minDate.setHours(minDate.getHours() + minAdvanceHours);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + advanceBookingDays);

  const minDateStr = minDate.toISOString().slice(0, 10);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    if (!allowBarberSelection && !selectedBarber) return;

    const barberId = selectedBarber?.membership_id ?? barbers[0]?.membership_id;
    if (!barberId) return;

    setIsLoading(true);
    setSlots([]);
    setSelectedSlot(null);

    getAvailableSlots(orgId, selectedService.id, barberId, selectedDate)
      .then(setSlots)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar horários"))
      .finally(() => setIsLoading(false));
  }, [selectedDate, selectedService, selectedBarber, orgId, allowBarberSelection, barbers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createPublicBooking(orgId, {
        barber_service_id: selectedService.id,
        assigned_barber_id: selectedBarber?.membership_id ?? null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        scheduled_at: selectedSlot,
        notes: notes || null,
      });

      setConfirmationToken(result.confirmation_token);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar agendamento");
    } finally {
      setIsLoading(false);
    }
  }

  // Step indicators
  const steps: { key: Step; label: string }[] = [
    { key: "service", label: "Serviço" },
    ...(allowBarberSelection ? [{ key: "barber" as Step, label: "Profissional" }] : []),
    { key: "datetime", label: "Data/Hora" },
    { key: "info", label: "Seus Dados" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  if (step === "success") {
    return (
      <div className="rounded-2xl border border-barber-success/30 bg-barber-graphite p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-barber-success/10">
          <CheckCircle2 className="h-8 w-8 text-barber-success" />
        </div>
        <h2 className="font-display text-2xl font-bold text-barber-white">
          Agendamento Solicitado!
        </h2>
        <p className="mt-2 text-barber-muted">
          Seu horário foi reservado. Você receberá uma confirmação em breve.
        </p>

        <div className="mt-6 rounded-xl border border-barber-border bg-barber-dark p-4 text-left text-sm">
          <p className="text-barber-muted">
            <span className="font-medium text-barber-white">Serviço:</span>{" "}
            {selectedService?.name}
          </p>
          <p className="mt-1 text-barber-muted">
            <span className="font-medium text-barber-white">Data:</span>{" "}
            {selectedSlot && new Date(selectedSlot).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-1 text-barber-muted">
            <span className="font-medium text-barber-white">Horário:</span>{" "}
            {selectedSlot &&
              new Date(selectedSlot).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
          </p>
          {selectedBarber && (
            <p className="mt-1 text-barber-muted">
              <span className="font-medium text-barber-white">Profissional:</span>{" "}
              {selectedBarber.name}
            </p>
          )}
          <p className="mt-1 text-barber-muted">
            <span className="font-medium text-barber-white">Valor:</span>{" "}
            {selectedService && formatCurrency(selectedService.price)}
          </p>
        </div>

        <p className="mt-6 text-xs text-barber-muted">
          Precisa cancelar ou reagendar? Entre em contato diretamente com a barbearia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between rounded-xl border border-barber-border bg-barber-graphite px-4 py-3">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                i <= currentStepIndex
                  ? "bg-barber-gold text-barber-dark"
                  : "bg-barber-dark text-barber-muted"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                i <= currentStepIndex ? "text-barber-white" : "text-barber-muted"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="mx-1 h-3 w-3 text-barber-muted/50" />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-4 py-3 text-sm text-barber-error">
          {error}
        </div>
      )}

      {/* Step 1: Service Selection */}
      {step === "service" && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-barber-white">
            Escolha o serviço
          </h2>
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => {
                setSelectedService(service);
                setStep(allowBarberSelection ? "barber" : "datetime");
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-barber-border bg-barber-graphite p-4 text-left transition-colors hover:border-barber-gold/30 hover:bg-barber-graphite/80"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-barber-gold/10 text-barber-gold">
                <Scissors className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-barber-white">{service.name}</p>
                {service.description && (
                  <p className="truncate text-xs text-barber-muted">
                    {service.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-barber-muted">
                  {service.duration_minutes} min
                  {service.category && ` · ${service.category}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-barber-gold">
                  {formatCurrency(service.price)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-barber-muted" />
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Barber Selection */}
      {step === "barber" && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-barber-white">
            Escolha o profissional
          </h2>
          <button
            onClick={() => {
              setSelectedBarber(null);
              setStep("datetime");
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-barber-border bg-barber-graphite p-4 text-left transition-colors hover:border-barber-gold/30"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-barber-muted/10 text-barber-muted">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-barber-white">Sem preferência</p>
              <p className="text-xs text-barber-muted">
                Qualquer profissional disponível
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-barber-muted" />
          </button>

          {barbers.map((barber) => (
            <button
              key={barber.membership_id}
              onClick={() => {
                setSelectedBarber(barber);
                setStep("datetime");
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-barber-border bg-barber-graphite p-4 text-left transition-colors hover:border-barber-gold/30"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-barber-gold/10 text-sm font-bold text-barber-gold">
                {barber.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-barber-white">{barber.name}</p>
                {barber.bio && (
                  <p className="truncate text-xs text-barber-muted">{barber.bio}</p>
                )}
                {barber.specialties && barber.specialties.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {barber.specialties.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-barber-dark px-1.5 py-0.5 text-[10px] text-barber-muted"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-barber-muted" />
            </button>
          ))}

          <button
            onClick={() => setStep("service")}
            className="mt-4 text-sm font-medium text-barber-muted hover:text-barber-gold"
          >
            ← Voltar
          </button>
        </div>
      )}

      {/* Step 3: Date & Time */}
      {step === "datetime" && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-barber-white">
            Escolha data e horário
          </h2>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
              <CalendarDays className="h-3.5 w-3.5" />
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={minDateStr}
              max={maxDateStr}
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
            />
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
                <Clock className="h-3.5 w-3.5" />
                Horário
              </label>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-barber-gold" />
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 py-8 text-center">
                  <p className="text-sm text-barber-muted">
                    Nenhum horário disponível nesta data
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const time = new Date(slot.slot_start).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isSelected = selectedSlot === slot.slot_start;

                    return (
                      <button
                        key={slot.slot_start}
                        onClick={() => setSelectedSlot(slot.slot_start)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          isSelected
                            ? "border-barber-gold bg-barber-gold text-barber-dark"
                            : "border-barber-border bg-barber-dark text-barber-white hover:border-barber-gold/30"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() =>
                setStep(allowBarberSelection ? "barber" : "service")
              }
              className="text-sm font-medium text-barber-muted hover:text-barber-gold"
            >
              ← Voltar
            </button>
            <button
              onClick={() => setStep("info")}
              disabled={!selectedSlot}
              className="rounded-lg bg-barber-gold px-6 py-2.5 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Customer Info */}
      {step === "info" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="font-display text-xl font-bold text-barber-white">
            Seus dados
          </h2>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
              <User className="h-3.5 w-3.5" />
              Nome completo *
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
              <Phone className="h-3.5 w-3.5" />
              Telefone / WhatsApp *
            </label>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-barber-muted">
              <Mail className="h-3.5 w-3.5" />
              E-mail (opcional)
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-barber-muted">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Preferências, alergias, etc."
              className="w-full resize-none rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-barber-border bg-barber-dark p-4 text-sm">
            <p className="text-barber-muted">
              <span className="font-medium text-barber-white">Serviço:</span>{" "}
              {selectedService?.name} ({selectedService?.duration_minutes} min)
            </p>
            <p className="mt-1 text-barber-muted">
              <span className="font-medium text-barber-white">Data:</span>{" "}
              {selectedSlot && new Date(selectedSlot).toLocaleDateString("pt-BR")} às{" "}
              {selectedSlot &&
                new Date(selectedSlot).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </p>
            {selectedBarber && (
              <p className="mt-1 text-barber-muted">
                <span className="font-medium text-barber-white">Profissional:</span>{" "}
                {selectedBarber.name}
              </p>
            )}
            <div className="mt-2 border-t border-barber-border pt-2">
              <span className="font-bold text-barber-gold">
                Total: {selectedService && formatCurrency(selectedService.price)}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep("datetime")}
              className="text-sm font-medium text-barber-muted hover:text-barber-gold"
            >
              ← Voltar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-6 py-2.5 text-sm font-semibold text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Agendamento
            </button>
          </div>
        </form>
      )}
    </div>
  );
}