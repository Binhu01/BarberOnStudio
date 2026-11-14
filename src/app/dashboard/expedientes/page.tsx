import { getAvailableBarbers, getBarberSchedules } from "./actions";
import { ScheduleManager } from "./_components/schedule-manager";
import { Clock, Users, CalendarDays } from "lucide-react";

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ barber?: string }>;
}) {
  const params = await searchParams;
  const selectedBarberId = params.barber;

  const [barbers, schedules] = await Promise.all([
    getAvailableBarbers(),
    selectedBarberId
      ? getBarberSchedules(selectedBarberId)
      : Promise.resolve([]),
  ]);

  const selectedBarber = barbers.find((b) => b.membership_id === selectedBarberId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Expedientes Individuais
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Configure os horários de trabalho de cada profissional
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Profissionais</p>
              <p className="text-xl font-bold text-barber-white">
                {barbers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Configurado</p>
              <p className="text-xl font-bold text-barber-white">
                {selectedBarberId ? "Sim" : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Dias Configurados</p>
              <p className="text-xl font-bold text-barber-white">
                {schedules.filter((s) => s.is_working_day).length}/7
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barber Selector + Schedule Manager */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Lista de profissionais */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-barber-muted uppercase tracking-wide">
            Profissionais
          </h2>
          {barbers.length === 0 ? (
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-barber-muted opacity-50" />
              <p className="text-sm text-barber-muted">
                Nenhum profissional na equipe
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {barbers.map((barber) => (
                <a
                  key={barber.membership_id}
                  href={`/dashboard/expedientes?barber=${barber.membership_id}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    selectedBarberId === barber.membership_id
                      ? "bg-barber-gold/10 text-barber-gold"
                      : "text-barber-muted hover:bg-barber-graphite hover:text-barber-white"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-barber-dark text-xs font-bold text-barber-gold">
                    {barber.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{barber.name}</p>
                    <p className="text-xs opacity-60">{barber.role}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Main: Schedule Editor */}
        <div>
          {!selectedBarberId ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite/50">
              <div className="text-center">
                <Clock className="mx-auto mb-3 h-10 w-10 text-barber-muted opacity-50" />
                <p className="text-barber-muted">
                  Selecione um profissional para configurar o expediente
                </p>
              </div>
            </div>
          ) : (
            <ScheduleManager
              membershipId={selectedBarberId}
              barberName={selectedBarber?.name ?? "Profissional"}
              initialSchedules={schedules}
            />
          )}
        </div>
      </div>
    </div>
  );
}