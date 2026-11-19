// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  User,
  Plus,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { getTasksDashboardStats, getTasks } from "./actions";

export default async function TarefasDashboardPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();

  const [stats, recentResult] = await Promise.all([
    getTasksDashboardStats(),
    getTasks({ page: 1, perPage: 10 }),
  ]);

  const statCards = [
    { label: "Minhas tarefas", value: stats.my_tasks_count, icon: User, color: "text-barber-gold bg-barber-gold/10 border-barber-gold/20" },
    { label: "A fazer", value: stats.todo_count, icon: CheckSquare, color: "text-barber-muted bg-barber-muted/10 border-barber-muted/20" },
    { label: "Em andamento", value: stats.in_progress_count, icon: Clock, color: "text-barber-warning bg-barber-warning/10 border-barber-warning/20" },
    { label: "Concluídas", value: stats.done_count, icon: CheckSquare, color: "text-barber-success bg-barber-success/10 border-barber-success/20" },
    { label: "Atrasadas", value: stats.overdue_count, icon: AlertTriangle, color: "text-barber-error bg-barber-error/10 border-barber-error/20" },
    { label: "Urgentes", value: stats.urgent_count, icon: AlertTriangle, color: "text-barber-copper bg-barber-copper/10 border-barber-copper/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Tarefas</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie tarefas, acompanhe prazos e organize o trabalho da equipe.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/tarefas/kanban"
            className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <CheckSquare className="h-4 w-4" />
            Kanban
          </Link>
          <Link
            href="/dashboard/agenda"
            className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <CalendarDays className="h-4 w-4" />
            Agenda
          </Link>
          <Link
            href="/dashboard/tarefas/novo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
          >
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 opacity-70" />
                <span className="text-2xl font-bold">{card.value}</span>
              </div>
              <p className="mt-1 text-xs font-medium opacity-80">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Tasks */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-barber-white">Tarefas recentes</h2>
          <Link
            href="/dashboard/tarefas"
            className="inline-flex items-center gap-1 text-sm font-medium text-barber-gold transition-colors hover:text-barber-copper"
          >
            Ver todas
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentResult.tasks.length === 0 ? (
          <div className="mt-8 text-center">
            <CheckSquare className="mx-auto h-10 w-10 text-barber-border" />
            <p className="mt-3 text-sm text-barber-muted">Nenhuma tarefa encontrada.</p>
            <Link
              href="/dashboard/tarefas/novo"
              className="mt-2 inline-block text-sm font-medium text-barber-gold hover:text-barber-copper"
            >
              Criar primeira tarefa
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark/50">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Tarefa</th>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Prioridade</th>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Responsável</th>
                  <th className="px-4 py-2.5 font-semibold text-barber-white">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {recentResult.tasks.map((task) => {
                  const statusColors: Record<string, string> = {
                    todo: "bg-barber-muted/10 text-barber-muted",
                    in_progress: "bg-barber-warning/10 text-barber-warning",
                    done: "bg-barber-success/10 text-barber-success",
                    cancelled: "bg-barber-error/10 text-barber-error",
                  };
                  const priorityColors: Record<string, string> = {
                    low: "text-barber-muted",
                    medium: "text-barber-gold",
                    high: "text-barber-copper",
                    urgent: "text-barber-error font-bold",
                  };
                  const statusLabels: Record<string, string> = {
                    todo: "A fazer",
                    in_progress: "Em andamento",
                    done: "Concluído",
                    cancelled: "Cancelado",
                  };
                  const priorityLabels: Record<string, string> = {
                    low: "Baixa",
                    medium: "Média",
                    high: "Alta",
                    urgent: "Urgente",
                  };

                  return (
                    <tr key={task.id} className="transition-colors hover:bg-barber-dark/30">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/dashboard/tarefas/${task.id}`}
                          className="font-medium text-barber-white hover:text-barber-gold"
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[task.status] ?? statusColors.todo}`}>
                          {statusLabels[task.status] ?? task.status}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 ${priorityColors[task.priority] ?? ""}`}>
                        {priorityLabels[task.priority] ?? task.priority}
                      </td>
                      <td className="px-4 py-2.5 text-barber-muted">
                        {task.assignee_name ?? "Sem responsável"}
                      </td>
                      <td className="px-4 py-2.5 text-barber-muted">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}