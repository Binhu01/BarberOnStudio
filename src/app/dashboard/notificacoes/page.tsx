// This page uses dynamic server data

import { connection } from "next/server";
import Link from "next/link";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { getNotifications } from "../tarefas/actions";

const TYPE_COLORS: Record<string, string> = {
  task_assigned: "bg-barber-gold/10 text-barber-gold",
  task_due_soon: "bg-barber-warning/10 text-barber-warning",
  task_overdue: "bg-barber-error/10 text-barber-error",
  task_completed: "bg-barber-success/10 text-barber-success",
  event_reminder: "bg-barber-copper/10 text-barber-copper",
  event_updated: "bg-barber-gold/10 text-barber-light",
  event_cancelled: "bg-barber-muted/10 text-barber-muted",
  order_status_changed: "bg-barber-gold/10 text-barber-gold",
  payment_received: "bg-barber-success/10 text-barber-success",
  payment_overdue: "bg-barber-error/10 text-barber-error",
  stock_low: "bg-barber-warning/10 text-barber-warning",
  purchase_received: "bg-barber-success/10 text-barber-success",
  member_joined: "bg-barber-success/10 text-barber-success",
  system: "bg-barber-muted/10 text-barber-muted",
};

export default async function NotificacoesPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();
  const data = await getNotifications(1, 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Notificações</h1>
          <p className="mt-1 text-sm text-barber-muted">
            {data.unread_count > 0
              ? `${data.unread_count} não lida${data.unread_count > 1 ? "s" : ""}`
              : "Todas as notificações foram lidas"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/notificacoes/preferencias"
            className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Settings className="h-4 w-4" />
            Preferências
          </Link>
        </div>
      </div>

      {/* Notifications List */}
      {data.notifications.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-barber-border p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-barber-border" />
          <p className="mt-4 text-sm font-medium text-barber-white">Nenhuma notificação</p>
          <p className="mt-1 text-xs text-barber-muted">
            Você será notificado sobre tarefas, eventos e atualizações importantes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((notification) => {
            const typeColor = TYPE_COLORS[notification.type] ?? TYPE_COLORS.system;

            return (
              <div
                key={notification.id}
                className={`group flex items-start gap-4 rounded-xl border p-4 transition-all ${
                  notification.is_read
                    ? "border-barber-border bg-barber-graphite opacity-70"
                    : "border-barber-gold/30 bg-barber-gold/5 shadow-sm"
                }`}
              >
                {/* Icon */}
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${typeColor}`}>
                  <Bell className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm ${notification.is_read ? "text-barber-muted" : "font-medium text-barber-white"}`}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="mt-0.5 text-xs text-barber-muted">{notification.body}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-barber-muted">
                      {new Date(notification.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-3">
                    {!notification.is_read && (
                      <form action={`/dashboard/notificacoes/${notification.id}/ler`} method="POST">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 text-xs font-medium text-barber-gold hover:text-barber-copper"
                        >
                          <CheckCheck className="h-3 w-3" />
                          Marcar como lida
                        </button>
                      </form>
                    )}
                    {notification.link && (
                      <Link
                        href={notification.link}
                        className="text-xs font-medium text-barber-muted hover:text-barber-gold"
                      >
                        Ver detalhes →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}