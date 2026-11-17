"use client";

import { useState, useEffect, useCallback } from "react";
import { X, User, Briefcase, Clock, ClipboardCheck, CalendarDays, Scissors, Tag, Hourglass, Phone, Plus } from "lucide-react";
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

type Step = "services" | "datetime" | "summary" | "info";

// =============================================================================
// COMPONENT
// =============================================================================

export function LandingBookingWidget({
  services,
  barbers,
  settings,
}: LandingBookingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("services");
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<{ slot_start: string; slot_end: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isForOtherPerson, setIsForOtherPerson] = useState(false);
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
      if (d.getDay() === 0) continue;
      if (i === 0) {
        const now = new Date();
        const minTime = new Date(now.getTime() + minHours * 60 * 60 * 1000);
        if (minTime.getHours() >= 20) continue;
      }
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [maxDays, minHours]);

  // Buscar slots quando data/barbeiro/serviços mudarem
  useEffect(() => {
    if (!selectedDate || selectedServices.length === 0 || !isOpen) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setError(null);

    getAvailableSlotsForLanding({
      serviceId: selectedServices[0].id,
      barberId: selectedBarber?.id ?? null,
      date: selectedDate,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
          setAvailableSlots([]);
        } else {
          setAvailableSlots((result.slots ?? []) as { slot_start: string; slot_end: string }[]);
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
  }, [selectedDate, selectedServices, selectedBarber, isOpen]);

  // Formatadores
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${weekdays[date.getDay()]}, ${day}/${month}`;
  };

  const formatDateShort = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return `${day}/${String(month).padStart(2, "0")}/${String(year).slice(2)}`;
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);

  // Toggle service selection
  const toggleService = (svc: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === svc.id);
      if (exists) return prev.filter((s) => s.id !== svc.id);
      return [...prev, svc];
    });
    setError(null);
  };

  // Open modal with a pre-selected service (and optionally a specific barber)
  const openWithService = (svc: Service, barber?: Barber | null) => {
    setSelectedServices([svc]);
    setSelectedBarber(barber ?? null);
    setStep("datetime");
    setSelectedDate("");
    setSelectedTime("");
    setAvailableSlots([]);
    setCustomerName("");
    setCustomerPhone("");
    setIsForOtherPerson(false);
    setError(null);
    setBookingResult(null);
    setIsOpen(true);
  };

  // Listen for barberon-prefill events dispatched from barber cards on the landing page
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { serviceId?: string; barberId?: string } | undefined;
      if (!detail?.serviceId) return;
      const svc = services.find((s) => s.id === detail.serviceId);
      if (!svc) return;
      const barber = detail.barberId ? barbers.find((b) => b.id === detail.barberId) ?? null : null;
      openWithService(svc, barber);
    };
    window.addEventListener("barberon-prefill", handler);
    return () => window.removeEventListener("barberon-prefill", handler);
  }, [services, barbers]);

  // Submit handler
  const handleSubmit = async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime || !customerName.trim() || !customerPhone.trim()) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await createPublicBookingFromLanding({
        serviceId: selectedServices[0].id,
        barberId: selectedBarber?.id ?? null,
        date: selectedDate,
        timeSlot: selectedTime,
        customerName,
        customerPhone,
        notes: isForOtherPerson ? "Agendamento para outra pessoa" : undefined,
      });

      setBookingResult(result);
      setIsOpen(false);
      // Show success inline in the section
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setIsOpen(false);
    setStep("services");
    setSelectedServices([]);
    setSelectedDate("");
    setSelectedTime("");
    setAvailableSlots([]);
    setCustomerName("");
    setCustomerPhone("");
    setIsForOtherPerson(false);
    setError(null);
  };

  // Steps config
  const steps: { key: Step; label: string; icon: typeof User }[] = [
    { key: "services", label: "Serviços", icon: Briefcase },
    { key: "datetime", label: "Data/Hora", icon: Clock },
    { key: "summary", label: "Resumo", icon: ClipboardCheck },
    { key: "info", label: "Dados", icon: User },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // ===========================================================================
  // RENDER: SUCCESS STATE (inline, after modal closes)
  // ===========================================================================
  if (bookingResult && !isOpen) {
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
            <span className="font-medium text-bo-white capitalize">
              {new Date(bookingResult.scheduledAt).toLocaleString("pt-BR", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="border-t border-bo-border pt-2 flex justify-between">
            <span className="text-bo-gray">Valor</span>
            <span className="font-bold text-bo-blue-bright">{formatPrice(bookingResult.price)}</span>
          </div>
        </div>
        <button
          onClick={() => { setBookingResult(null); }}
          className="mt-6 rounded-lg border border-bo-border px-6 py-2.5 text-sm font-medium text-bo-silver transition-colors hover:border-bo-blue hover:text-bo-white"
        >
          Novo Agendamento
        </button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: SERVICE CARDS (clickable to open modal) + MODAL
  // ===========================================================================
  return (
    <>
      {/* Service cards grid — clicking opens the modal */}
      <div className="space-y-4">
        <h3 className="font-display text-xl font-bold text-bo-white">Nossos Serviços</h3>
        <p className="text-sm text-bo-gray">Clique em um serviço para agendar</p>
        {services.length === 0 ? (
          <p className="text-bo-gray">Nenhum serviço disponível no momento.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => openWithService(svc)}
                className="group flex items-center justify-between rounded-xl border border-bo-border bg-[#383838] p-4 text-left transition-all hover:border-bo-blue/50 hover:bg-[#424242]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{svc.name}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[#BDBDBD]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{svc.duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 pl-3">
                  <span className="text-sm font-bold text-white">{formatPrice(Number(svc.price))}</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4A4A4A] text-[#9E9E9E] transition-colors group-hover:bg-bo-blue group-hover:text-white">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL OVERLAY */}
      {/* ===================================================================== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal container */}
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#3E4042] bg-[#242526] shadow-2xl">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#3A3B3C] text-[#B0B3B8] transition-colors hover:bg-[#4A4B4C] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header summary bar */}
            <div className="border-b border-[#3E4042] bg-[#242526] px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-500" />
                <span className="text-base font-bold text-white">Resumo</span>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                {selectedBarber && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <User className="h-4 w-4" />
                      <span>Profissional:</span>
                    </div>
                    <span className="font-bold text-white">{selectedBarber.full_name}</span>
                  </div>
                )}
                {selectedServices.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <Scissors className="h-4 w-4" />
                      <span>Serviços:</span>
                    </div>
                    <span className="font-bold text-white">
                      {selectedServices.map((s) => s.name).join(", ")}
                    </span>
                  </div>
                )}
                {selectedServices.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <Tag className="h-4 w-4" />
                      <span>Valor:</span>
                    </div>
                    <span className="font-bold text-white">{formatPrice(totalPrice)}</span>
                  </div>
                )}
                {selectedServices.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <Hourglass className="h-4 w-4" />
                      <span>Duração:</span>
                    </div>
                    <span className="font-bold text-white">{totalDuration} min</span>
                  </div>
                )}
                {selectedDate && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <CalendarDays className="h-4 w-4" />
                      <span>Data:</span>
                    </div>
                    <span className="font-bold text-white">{formatDateShort(selectedDate)}</span>
                  </div>
                )}
                {selectedTime && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <Clock className="h-4 w-4" />
                      <span>Horário:</span>
                    </div>
                    <span className="font-bold text-white">{selectedTime}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="border-b border-[#3E4042] bg-[#242526] px-5 py-3">
              <div className="flex items-center justify-between">
                {steps.map((s, i) => (
                  <div key={s.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                          i <= currentStepIndex ? "bg-blue-600 text-white" : "bg-[#525252] text-[#242424]"
                        }`}
                      >
                        <s.icon className="h-4 w-4" />
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`mx-1 h-0.5 flex-1 rounded ${i < currentStepIndex ? "bg-blue-600" : "bg-[#525252]"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="border-b border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Step content */}
            <div className="max-h-[60vh] overflow-y-auto bg-[#2E2F31] px-5 py-5">
              {/* STEP 1: SELECT SERVICES */}
              {step === "services" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold italic text-white">Selecione os serviços</h3>

                  {/* Selected services box */}
                  {selectedServices.length > 0 && (
                    <div className="rounded-xl border border-[#3E4042] bg-[#242526] p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white">Serviços Selecionados</span>
                        <span className="font-bold text-white">Total: {formatPrice(totalPrice)}</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {selectedServices.map((svc) => (
                          <div key={svc.id} className="flex items-center justify-between rounded-lg bg-[#3D3D3D] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{svc.name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-[#A3A3A3]">
                                <Clock className="h-3 w-3" />
                                <span>{svc.duration_minutes} min</span>
                                <span className="font-medium text-white">{formatPrice(Number(svc.price))}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleService(svc)}
                              className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#A3A3A3] hover:bg-red-500/20 hover:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available services list */}
                  <div className="space-y-2">
                    {services.map((svc) => {
                      const isSelected = selectedServices.some((s) => s.id === svc.id);
                      return (
                        <button
                          key={svc.id}
                          onClick={() => toggleService(svc)}
                          className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-600/10"
                              : "border-[#3E4042] bg-[#303030] hover:border-[#525252]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-bold ${isSelected ? "text-blue-400" : "text-white"}`}>{svc.name}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#A3A3A3]">
                              <Clock className="h-3 w-3" />
                              <span>{svc.duration_minutes} min</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-3">
                            <span className="text-sm font-bold text-white">{formatPrice(Number(svc.price))}</span>
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                              isSelected ? "bg-blue-600 text-white" : "bg-[#4A4A4A] text-[#9E9E9E]"
                            }`}>
                              {isSelected ? <X className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      if (selectedServices.length === 0) {
                        setError("Selecione pelo menos um serviço");
                        return;
                      }
                      setError(null);
                      setStep("datetime");
                    }}
                    className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* STEP 2: DATE & TIME */}
              {step === "datetime" && (
                <div className="space-y-5">
                  {/* Barber selection */}
                  {barbers.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold italic text-white">Profissional:</label>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                          onClick={() => setSelectedBarber(null)}
                          className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            !selectedBarber ? "border-blue-600 bg-blue-600/10 text-white" : "border-[#3E4042] bg-[#303030] text-[#A3A3A3] hover:border-[#525252]"
                          }`}
                        >
                          Qualquer
                        </button>
                        {barbers.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBarber(b)}
                            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                              selectedBarber?.id === b.id ? "border-blue-600 bg-blue-600/10 text-white" : "border-[#3E4042] bg-[#303030] text-[#A3A3A3] hover:border-[#525252]"
                            }`}
                          >
                            {b.full_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date picker */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold italic text-white">Dia:</label>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {availableDates().map((date) => (
                        <button
                          key={date}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime("");
                          }}
                          className={`shrink-0 rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition-all ${
                            selectedDate === date
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-[#3E4042] bg-[#262626] text-[#F5F5F5] hover:border-[#525252]"
                          }`}
                        >
                          <span className="block text-[10px] uppercase opacity-70">{formatDate(date).split(",")[0]}</span>
                          <span className="block font-semibold">{formatDate(date).split(", ")[1]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold italic text-white">Selecione um Horário Disponível:</label>
                      {loadingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3E4042] border-t-blue-600" />
                          <span className="ml-2 text-sm text-[#A3A3A3]">Buscando...</span>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="py-4 text-center text-sm text-[#A3A3A3]">Nenhum horário disponível nesta data.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {availableSlots.map((slot) => {
                            const timeLabel = new Date(slot.slot_start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                            return (
                              <button
                                key={slot.slot_start}
                                onClick={() => setSelectedTime(timeLabel)}
                                className={`rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                                  selectedTime === timeLabel
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                                    : "bg-[#171717] text-[#F5F5F5] hover:bg-[#262626]"
                                }`}
                              >
                                {timeLabel}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep("services")} className="flex-1 rounded-lg bg-[#4B5563] py-3 text-sm font-bold text-white transition-all hover:bg-[#5B6573]">
                      Voltar
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedDate || !selectedTime) {
                          setError("Selecione data e horário");
                          return;
                        }
                        setError(null);
                        setStep("summary");
                      }}
                      disabled={!selectedDate || !selectedTime}
                      className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SUMMARY */}
              {step === "summary" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold italic text-white">Confirme os detalhes</h3>

                  <div className="rounded-xl border border-[#3E4042] bg-[#242526] p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#9CA3AF]"><User className="h-4 w-4" /><span>Profissional:</span></div>
                      <span className="font-bold text-white">{selectedBarber?.full_name ?? "Qualquer disponível"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#9CA3AF]"><Scissors className="h-4 w-4" /><span>Serviços:</span></div>
                      <span className="font-bold text-white text-right max-w-[60%]">{selectedServices.map((s) => s.name).join(", ")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#9CA3AF]"><Tag className="h-4 w-4" /><span>Valor:</span></div>
                      <span className="font-bold text-white">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#9CA3AF]"><Hourglass className="h-4 w-4" /><span>Duração:</span></div>
                      <span className="font-bold text-white">{totalDuration} min</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#9CA3AF]"><CalendarDays className="h-4 w-4" /><span>Data:</span></div>
                      <span className="font-bold text-white">{formatDateShort(selectedDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#9CA3AF]"><Clock className="h-4 w-4" /><span>Horário:</span></div>
                      <span className="font-bold text-white">{selectedTime}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep("datetime")} className="flex-1 rounded-lg bg-[#4B5563] py-3 text-sm font-bold text-white transition-all hover:bg-[#5B6573]">
                      Voltar
                    </button>
                    <button onClick={() => setStep("info")} className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700">
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: CUSTOMER INFO */}
              {step === "info" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-bold italic text-white">Seu Nome</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Digite seu nome completo"
                        className="w-full rounded-lg border border-[#3E4042] bg-[#2E2F31] px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-bold italic text-white">Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="(82) 99999-9999"
                          className="w-full rounded-lg border border-[#3E4042] bg-[#2E2F31] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#3E4042] bg-[#2E2F31] px-4 py-3 text-sm text-white transition-colors hover:border-[#525252]">
                      <input
                        type="checkbox"
                        checked={isForOtherPerson}
                        onChange={(e) => setIsForOtherPerson(e.target.checked)}
                        className="h-4 w-4 rounded border-[#3E4042] accent-blue-600"
                      />
                      <span>O horário é para outra pessoa (ex.: filho)</span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep("summary")} className="flex-1 rounded-lg bg-[#4B5563] py-3 text-sm font-bold text-white transition-all hover:bg-[#5B6573]">
                      Voltar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Agendando...
                        </span>
                      ) : (
                        "Agendar"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}