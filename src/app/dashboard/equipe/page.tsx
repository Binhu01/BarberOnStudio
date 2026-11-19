// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Building2,
  ShieldCheck,
  ScrollText,
  MailPlus,
  Activity,
} from "lucide-react";
import { getTeamDashboard } from "./actions";

export default async function EquipePage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();
  const stats = await getTeamDashboard();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-barber-white">Equipe</h1>
        <Link
          href="/dashboard/equipe/convites"
          className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-opacity hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          Convidar membro
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
              <Users className="h-5 w-5 text-barber-gold" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Membros ativos</p>
              <p className="text-2xl font-bold text-barber-white">{stats.total_active_members}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-cyan/10">
              <MailPlus className="h-5 w-5 text-barber-cyan" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Convites pendentes</p>
              <p className="text-2xl font-bold text-barber-white">{stats.pending_invitations}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-success/10">
              <ShieldCheck className="h-5 w-5 text-barber-success" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Departamentos</p>
              <p className="text-2xl font-bold text-barber-white">{stats.department_count}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-warning/10">
              <Activity className="h-5 w-5 text-barber-warning" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Atividades recentes</p>
              <p className="text-2xl font-bold text-barber-white">{stats.recent_activities.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Proprietários", count: stats.owner_count, color: "text-barber-gold" },
          { label: "Administradores", count: stats.admin_count, color: "text-barber-copper" },
          { label: "Gerentes", count: stats.manager_count, color: "text-barber-warning" },
          { label: "Colaboradores", count: stats.employee_count, color: "text-barber-muted" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-barber-border bg-barber-graphite p-4 text-center shadow-sm">
            <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
            <p className="text-sm text-barber-muted">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-white">Ações rápidas</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/equipe/convites"
              className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:bg-barber-dark/50"
            >
              <UserPlus className="h-5 w-5 text-barber-gold" />
              <span className="text-sm font-medium text-barber-white">Convidar funcionário</span>
            </Link>
            <Link
              href="/dashboard/equipe/departamentos"
              className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:bg-barber-dark/50"
            >
              <Building2 className="h-5 w-5 text-barber-gold" />
              <span className="text-sm font-medium text-barber-white">Departamentos</span>
            </Link>
            <Link
              href="/dashboard/equipe/cargos"
              className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:bg-barber-dark/50"
            >
              <ShieldCheck className="h-5 w-5 text-barber-gold" />
              <span className="text-sm font-medium text-barber-white">Permissões</span>
            </Link>
            <Link
              href="/dashboard/equipe/auditoria"
              className="flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-colors hover:bg-barber-dark/50"
            >
              <ScrollText className="h-5 w-5 text-barber-gold" />
              <span className="text-sm font-medium text-barber-white">Auditoria</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-barber-white">Atividades recentes</h2>
            <Link href="/dashboard/equipe/auditoria" className="text-sm font-medium text-barber-gold hover:underline">
              Ver tudo
            </Link>
          </div>
          {stats.recent_activities.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center text-center">
              <Activity className="mb-3 h-10 w-10 text-barber-muted/40" />
              <p className="text-sm text-barber-muted">Nenhuma atividade registrada</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {stats.recent_activities.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-barber-border/50 p-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-barber-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-barber-white">{log.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-barber-muted">
                      {log.module} · {new Date(log.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}