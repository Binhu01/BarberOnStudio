// This page uses dynamic server data
// With cacheComponents: true, instant=false allows blocking render + connection() opts out of prerender
export const instant = false;

import { connection } from "next/server";
import { getScheduleBlocks } from "./actions";
import { BlockManager } from "./_components/block-manager";
import { Ban, CalendarDays, Users } from "lucide-react";

export default async function BloqueiosPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();
  const params = await searchParams;

  const blocks = await getScheduleBlocks({
    membership_id: params.member,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Bloquear Horários
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Bloqueie horários para folgas, férias, manutenção ou eventos
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-error/10 text-barber-error">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Bloqueios Ativos</p>
              <p className="text-xl font-bold text-barber-white">
                {blocks.filter((b) => new Date(b.ends_at) > new Date()).length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Este Mês</p>
              <p className="text-xl font-bold text-barber-white">
                {
                  blocks.filter((b) => {
                    const d = new Date(b.starts_at);
                    const now = new Date();
                    return (
                      d.getMonth() === now.getMonth() &&
                      d.getFullYear() === now.getFullYear()
                    );
                  }).length
                }
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Por Profissional</p>
              <p className="text-xl font-bold text-barber-white">
                {
                  blocks.filter((b) => b.membership_id !== null).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Block Manager */}
      <BlockManager initialBlocks={blocks} />
    </div>
  );
}