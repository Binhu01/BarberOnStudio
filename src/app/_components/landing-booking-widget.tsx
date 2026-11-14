"use client";

import { useState, useEffect, useCallback } from "react";
import { getAvailableSlotsForLanding, createPublicBookingFromLanding } from "../actions";

// =============================================================================
// TYPES
// =============================================================================

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
}

interface Barber {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  instagram: string | null;
}

interface LandingBookingWidgetProps {
  services: Service[];
  barbers: Barber[];
  settings: {
    booking_enabled?: boolean;
    advance_booking_days?: number;
    min_advance_hours?: number;
    allow_barber_selection?: boolean;
    shop_phone?: string | null;
  } | null;
}

type Step = "service" | "barber" | "date" | "time" | "info" | "confirm" | "success";

// =============================================================================
// COMPONENT
// =============================================================================

export function LandingBookingWidget({
  services,
  barbers,
  settings,
}: LandingBookingWidgetProps) {
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    bookingId: string;
    serviceName: string;
    price: number;
    scheduledAt: string;
    durationMinutes: number;
  } | null>(null);

  // Gerar datas disponíveis (próximos N dias)
  const maxDays = settings?.advance_booking_days ?? 30;
  const minHours = settings?.min_advance_hours ?? 2;

  const availableDates = useCallback(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      // Pular domingos (opcional — barbearias costumam fechar)
      if (d.getDay() === 0) continue;
      // Se for hoje, verificar hora mínima
      if (i === 0) {
        const now = new Date();
        const minTime = new Date(now.getTime() + minHours * 60 * 60 * 1000);
        if (minTime.getHours() >= 20) continue; // muito tarde
      }
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [maxDays, minHours]);

  // Buscar slots quando data/barbeiro/serviço mudarem
  useEffect(() => {
    if (!selectedDate || !selectedService) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setError(null);

    getAvailableSlotsForLanding({
      serviceId: selectedService.id,
      barberId: selectedBarber?.id ?? null,
      date: selectedDate,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
          setAvailableSlots([]);
        } else {
          setAvailableSlots(result.slots as string[]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? "Erro ao buscar horários");
          setAvailableSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedService, selectedBarber]);

  // Formatadores
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${weekdays[date.getDay()]}, ${day}/${month}`;
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !customerName || !customerPhone) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await createPublicBookingFromLanding({
        serviceId: selectedService.id,
        barberId: selectedBarber?.id ?? null,
        date: selectedDate,
        timeSlot: selectedTime,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        notes: notes || undefined,
      });

      setBookingResult(result);
      setStep("success");
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset
  const handleReset = () => {
    setStep("service");
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedDate("");
    setSelectedTime("");
    setAvailableSlots([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setNotes("");
    setError(null);
    setBookingResult(null);
  };

  // Steps indicator
  const steps: { key: Step; label: string }[] = [
    { key: "service", label: "Serviço" },
    { key: "barber", label: "Profissional" },
    { key: "date", label: "Data" },
    { key: "time", label: "Horário" },
    { key: "info", label: "Dados" },
    { key: "confirm", label: "Confirmar" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // ===========================================================================
  // RENDER: SUCCESS STATE
  // ===========================================================================
  if (step === "success" && bookingResult) {
    return (
      <div className="rounded-2xl border border-bo-blue/30 bg-bo-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bo-blue/20">
          <svg className="h-8 w-8 text-bo-blue-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-bo-white">Agendamento Confirmado!</h3>
        <p className="mt-2 text-bo-silver">Seu horário foi reservado com sucesso.</p>

        <div className="mt-6 rounded-xl border border-bo-border bg-bo-black/50 p-4 text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-bo-gray">Serviço</span>
            <span className="font-medium text-bo-white">{bookingResult.serviceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-bo-gray">Data e Hora</span>
            <span className="font-medium text-bo-white capitalize">{formatDateTime(bookingResult.scheduledAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-bo-gray">Duração</span>
            <span className="font-medium text-bo-white">{bookingResult.durationMinutes} min</span>
          </div>
          <div className="border-t border-bo-border pt-2 flex justify-between">
            <span className="text-bo-gray">Valor</span>
            <span className="font-bold text-bo-blue-bright">{formatPrice(bookingResult.price)}</span>
          </div>
        </div>

        <p className="mt-4 text-sm text-bo-gray">
          Enviamos a confirmação para <strong className="text-bo-silver">{customerPhone}</strong>
        </p>

        <button
          onClick={handleReset}
          className="mt-6 rounded-lg border border-bo-border px-6 py-2.5 text-sm font-medium text-bo-silver transition-colors hover:border-bo-blue hover:text-bo-white"
        >
          Novo Agendamento
        </button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: BOOKING FLOW
  // ===========================================================================
  return (
    <div className="rounded-2xl border border-bo-border bg-bo-card overflow-hidden">
      {/* Progress Bar */}
      {step !== "success" && (
        <div className="border-b border-bo-border bg-bo-black/50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      i <= currentStepIndex
                        ? "bg-bo-blue text-bo-white"
                        : "bg-bo-border text-bo-gray"
                    }`}
                  >
                    {i < currentStepIndex ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`mt-1 hidden text-[10px] sm:block ${i <= currentStepIndex ? "text-bo-blue-bright" : "text-bo-gray"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded ${i < currentStepIndex ? "bg-bo-blue" : "bg-bo-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 sm:px-6">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="p-4 sm:p-6">
        {/* STEP 1: SERVICE */}
        {step === "service" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-bo-white">Escolha o serviço</h3>
            {services.length === 0 ? (
              <p className="text-bo-gray">Nenhum serviço disponível no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => {
                      setSelectedService(svc);
                      setStep(settings?.allow_barber_selection !== false && barbers.length > 0 ? "barber" : "date");
                      setError(null);
                    }}
                    className="group relative flex items-start gap-3 rounded-xl border border-bo-border bg-bo-black/30 p-4 text-left transition-all hover:border-bo-blue hover:bg-bo-blue/5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bo-blue/10 text-bo-blue-bright transition-colors group-hover:bg-bo-blue/20">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-7 7m7-7l-7-7" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-bo-white truncate">{svc.name}</span>
                        <span className="shrink-0 text-sm font-bold text-bo-blue-bright">{formatPrice(svc.price)}</span>
                      </div>
                      {svc.description && (
                        <p className="mt-0.5 truncate text-xs text-bo-gray">{svc.description}</p>
                      )}
                      <span className="mt-1 inline-block text-[11px] text-bo-gray">{svc.duration_minutes} min</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: BARBER */}
        {step === "barber" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-bo-white">Escolha o profissional</h3>
              <button onClick={() => setStep("service")} className="text-xs text-bo-gray hover:text-bo-white transition-colors">Voltar</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Opção: qualquer profissional */}
              <button
                onClick={() => {
                  setSelectedBarber(null);
                  setStep("date");
                  setError(null);
                }}
                className="group flex flex-col items-center gap-2 rounded-xl border border-bo-border bg-bo-black/30 p-4 text-center transition-all hover:border-bo-blue hover:bg-bo-blue/5"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bo-blue/10 text-bo-blue-bright transition-colors group-hover:bg-bo-blue/20">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-medium text-bo-white">Qualquer profissional</span>
                <span className="text-xs text-bo-gray">Primeiro disponível</span>
              </button>

              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => {
                    setSelectedBarber(barber);
                    setStep("date");
                    setError(null);
                  }}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-bo-border bg-bo-black/30 p-4 text-center transition-all hover:border-bo-blue hover:bg-bo-blue/5"
                >
                  {barber.avatar_url ? (
                    <img src={barber.avatar_url} alt={barber.full_name} className="h-14 w-14 rounded-full object-cover ring-2 ring-transparent transition-all group-hover:ring-bo-blue" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bo-graphite text-lg font-bold text-bo-silver">
                      {barber.full_name.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-bo-white">{barber.full_name}</span>
                  <span className="text-xs text-bo-gray">{barber.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: DATE */}
        {step === "date" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-bo-white">Escolha a data</h3>
              <button onClick={() => setStep(settings?.allow_barber_selection !== false && barbers.length > 0 ? "barber" : "service")} className="text-xs text-bo-gray hover:text-bo-white transition-colors">Voltar</button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {availableDates().map((date) => (
                <button
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedTime("");
                    setStep("time");
                    setError(null);
                  }}
                  className={`rounded-lg border px-2 py-3 text-center text-sm transition-all ${
                    selectedDate === date
                      ? "border-bo-blue bg-bo-blue/10 text-bo-white"
                      : "border-bo-border bg-bo-black/30 text-bo-silver hover:border-bo-blue/50 hover:text-bo-white"
                  }`}
                >
                  <span className="block text-xs uppercase text-bo-gray">{formatDate(date).split(",")[0]}</span>
                  <span className="block font-semibold">{formatDate(date).split(", ")[1]}</span>
                </button>
              ))}
            </div>
            {availableDates().length === 0 && (
              <p className="text-bo-gray">Nenhuma data disponível.</p>
            )}
          </div>
        )}

        {/* STEP 4: TIME */}
        {step === "time" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-bo-white">
                Horários para {formatDate(selectedDate)}
              </h3>
              <button onClick={() => setStep("date")} className="text-xs text-bo-gray hover:text-bo-white transition-colors">Voltar</button>
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-bo-border border-t-bo-blue" />
                <span className="ml-3 text-bo-gray">Buscando horários...</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-bo-gray">Nenhum horário disponível nesta data.</p>
                <button onClick={() => setStep("date")} className="mt-3 text-sm text-bo-blue-bright hover:underline">
                  Escolher outra data
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => {
                      setSelectedTime(slot);
                      setStep("info");
                      setError(null);
                    }}
                    className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all ${
                      selectedTime === slot
                        ? "border-bo-blue bg-bo-blue text-bo-white shadow-lg shadow-bo-blue/25"
                        : "border-bo-border bg-bo-black/30 text-bo-silver hover:border-bo-blue/50 hover:text-bo-white"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 5: CUSTOMER INFO */}
        {step === "info" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-bo-white">Seus dados</h3>
              <button onClick={() => setStep("time")} className="text-xs text-bo-gray hover:text-bo-white transition-colors">Voltar</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-bo-silver">Nome completo *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-bo-border bg-bo-black/50 px-4 py-2.5 text-bo-white placeholder:text-bo-gray focus:border-bo-blue focus:outline-none focus:ring-1 focus:ring-bo-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-bo-silver">WhatsApp *</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(82) 99999-9999"
                  className="w-full rounded-lg border border-bo-border bg-bo-black/50 px-4 py-2.5 text-bo-white placeholder:text-bo-gray focus:border-bo-blue focus:outline-none focus:ring-1 focus:ring-bo-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-bo-silver">E-mail (opcional)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-bo-border bg-bo-black/50 px-4 py-2.5 text-bo-white placeholder:text-bo-gray focus:border-bo-blue focus:outline-none focus:ring-1 focus:ring-bo-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-bo-silver">Observações (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alguma preferência ou observação?"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-bo-border bg-bo-black/50 px-4 py-2.5 text-bo-white placeholder:text-bo-gray focus:border-bo-blue focus:outline-none focus:ring-1 focus:ring-bo-blue"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!customerName.trim() || !customerPhone.trim()) {
                  setError("Nome e WhatsApp são obrigatórios");
                  return;
                }
                setError(null);
                setStep("confirm");
              }}
              className="w-full rounded-lg bg-bo-blue px-6 py-3 text-sm font-bold text-bo-white transition-all hover:bg-bo-blue-bright hover:shadow-lg hover:shadow-bo-blue/25"
            >
              Continuar
            </button>
          </div>
        )}

        {/* STEP 6: CONFIRM */}
        {step === "confirm" && selectedService && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-bo-white">Confirmar agendamento</h3>
              <button onClick={() => setStep("info")} className="text-xs text-bo-gray hover:text-bo-white transition-colors">Voltar</button>
            </div>

            <div className="rounded-xl border border-bo-border bg-bo-black/50 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-bo-gray">Serviço</span>
                <span className="font-medium text-bo-white">{selectedService.name}</span>
              </div>
              {selectedBarber && (
                <div className="flex justify-between">
                  <span className="text-bo-gray">Profissional</span>
                  <span className="font-medium text-bo-white">{selectedBarber.full_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-bo-gray">Data</span>
                <span className="font-medium text-bo-white capitalize">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-bo-gray">Horário</span>
                <span className="font-medium text-bo-white">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-bo-gray">Duração</span>
                <span className="font-medium text-bo-white">{selectedService.duration_minutes} min</span>
              </div>
              <div className="border-t border-bo-border pt-3 flex justify-between">
                <span className="text-bo-silver font-medium">Total</span>
                <span className="text-lg font-bold text-bo-blue-bright">{formatPrice(selectedService.price)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-bo-border bg-bo-black/50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-bo-gray">Nome</span>
                <span className="font-medium text-bo-white">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-bo-gray">WhatsApp</span>
                <span className="font-medium text-bo-white">{customerPhone}</span>
              </div>
              {customerEmail && (
                <div className="flex justify-between">
                  <span className="text-bo-gray">E-mail</span>
                  <span className="font-medium text-bo-white">{customerEmail}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-lg bg-bo-blue px-6 py-3.5 text-sm font-bold text-bo-white transition-all hover:bg-bo-blue-bright hover:shadow-lg hover:shadow-bo-blue/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-bo-white/30 border-t-bo-white" />
                  Confirmando...
                </span>
              ) : (
                "Confirmar Agendamento"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}