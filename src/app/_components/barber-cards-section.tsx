"use client";

import { Clock, Instagram } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface Barber {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  instagram: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
}

interface BarberCardsSectionProps {
  barbers: Barber[];
  services: Service[];
}

// =============================================================================
// COMPONENT — Client Component because it uses window.dispatchEvent
// =============================================================================

export function BarberCardsSection({ barbers, services }: BarberCardsSectionProps) {
  if (barbers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-bo-border bg-bo-card/50">
        <p className="text-bo-gray">
          Equipe sendo cadastrada. Em breve nossos profissionais estarão disponíveis.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {barbers.map((barber) => (
        <div
          key={barber.id}
          className="overflow-hidden rounded-2xl border border-bo-border bg-bo-card transition-all hover:border-bo-blue/30 hover:shadow-[0_0_30px_rgba(8,102,232,0.08)]"
        >
          {/* Barber header */}
          <div className="flex items-center gap-4 border-b border-bo-border/50 bg-bo-graphite/30 p-5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-bo-border bg-bo-graphite">
              {barber.avatar_url ? (
                <img
                  src={barber.avatar_url}
                  alt={barber.full_name ?? "Barbeiro"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-bo-silver">
                  {(barber.full_name ?? "B").charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-bo-white">
                {barber.full_name ?? "Profissional"}
              </h3>
              <p className="text-sm text-bo-gray">{barber.role ?? "Barbeiro"}</p>
              {barber.instagram && (
                <a
                  href={barber.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-bo-blue-bright transition-colors hover:text-bo-blue"
                >
                  <Instagram className="h-3 w-3" />
                  {barber.instagram.replace("https://instagram.com/", "@")}
                </a>
              )}
            </div>
          </div>

          {/* Services list for this barber */}
          <div className="divide-y divide-bo-border/30">
            {services.length > 0 ? (
              services.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-bo-graphite/20">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bo-white">{service.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-bo-gray">
                      <Clock className="h-3 w-3" />
                      <span>{service.duration_minutes} min</span>
                      {service.description && (
                        <>
                          <span className="text-bo-border">•</span>
                          <span className="truncate">{service.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-bo-blue-bright">
                      R$ {Number(service.price).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("barberon-prefill", {
                          detail: { serviceId: service.id, barberId: barber.id },
                        }));
                        // Smooth scroll to booking section
                        document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="rounded-lg bg-bo-blue px-4 py-2 text-xs font-bold text-white transition-all hover:bg-bo-blue-bright hover:shadow-[0_0_15px_rgba(8,102,232,0.3)]"
                    >
                      Agendar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-bo-gray">
                Serviços sendo configurados para este profissional.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}