// @cache-bust: 2026-11-23T00-00-00 — monitoring dashboard

import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle, Clock, Users, Zap } from "lucide-react";

export default async function MonitoramentoPage() {
 await connection();

 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 // Verificar se é admin (OWNER da organização ativa)
 const { data: membership } = await supabase
 .from("organization_members")
 .select("role, organization_id")
 .eq("user_id", user.id)
 .eq("is_active", true)
 .maybeSingle();

 if (!membership || membership.role !== "OWNER") {
 redirect("/dashboard");
 }

 const orgId = membership.organization_id;

 // Buscar métricas em paralelo
 const [
 subscriptionStats,
 notificationStats,
 cronStats,
 recentErrors,
 ] = await Promise.all([
 // Assinaturas ativas vs trial
 supabase
 .from("subscriptions")
 .select("status")
 .eq("organization_id", orgId),

 // Notificações nas últimas 24h
 supabase
 .from("notification_logs")
 .select("status, channel")
 .gte("created_at", new Date(Date.now() - 86400000).toISOString())
 .eq("organization_id", orgId),

 // Eventos de assinatura recentes
 supabase
 .from("subscription_events")
 .select("event_type, created_at")
 .eq("organization_id", orgId)
 .order("created_at", { ascending: false })
 .limit(10),

 // Últimos erros (se houver tabela de logs)
 supabase
 .from("notification_logs")
 .select("error_message, created_at, channel")
 .eq("status", "failed")
 .eq("organization_id", orgId)
 .order("created_at", { ascending: false })
 .limit(5),
 ]);

 const subs = subscriptionStats.data ?? [];
 const notifs = notificationStats.data ?? [];
 const events = cronStats.data ?? [];
 const errors = recentErrors.data ?? [];

 const activeSubs = subs.filter(s => s.status === "active").length;
 const trialingSubs = subs.filter(s => s.status === "trialing").length;
 const totalNotifs24h = notifs.length;
 const sentNotifs = notifs.filter(n => n.status === "sent" || n.status === "delivered").length;
 const failedNotifs = notifs.filter(n => n.status === "failed").length;
 const successRate = totalNotifs24h > 0 ? Math.round((sentNotifs / totalNotifs24h) * 100) : 100;

 return (
 <div className="space-y-8">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-barber-white">Monitoramento</h1>
 <p className="text-sm text-barber-muted mt-1">
 Visão geral da saúde do sistema e métricas operacionais
 </p>
 </div>
 <Link
 href="/api/health"
 target="_blank"
 className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-white transition hover:bg-barber-graphite"
 >
 <Activity className="h-4 w-4" />
 Health Check API
 </Link>
 </div>

 {/* KPI Cards */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 <KPICard
 icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
 label="Assinaturas Ativas"
 value={activeSubs}
 subtitle={`${trialingSubs} em trial`}
 color="emerald"
 />
 <KPICard
 icon={<Zap className="h-5 w-5 text-barber-gold" />}
 label="Notificações (24h)"
 value={totalNotifs24h}
 subtitle={`${successRate}% sucesso`}
 color={successRate >= 90 ? "gold" : "amber"}
 />
 <KPICard
 icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
 label="Falhas (24h)"
 value={failedNotifs}
 subtitle={failedNotifs > 0 ? "Requer atenção" : "Sem falhas"}
 color={failedNotifs > 0 ? "red" : "emerald"}
 />
 <KPICard
 icon={<Clock className="h-5 w-5 text-blue-400" />}
 label="Eventos Recentes"
 value={events.length}
 subtitle="Últimas ações"
 color="blue"
 />
 </div>

 {/* Grid de detalhes */}
 <div className="grid gap-6 lg:grid-cols-2">
 {/* Notificações por canal */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 text-lg font-semibold text-barber-white">
 Notificações por Canal (24h)
 </h2>
 <div className="space-y-3">
 {["whatsapp", "email"].map(channel => {
 const channelNotifs = notifs.filter(n => n.channel === channel);
 const channelSent = channelNotifs.filter(n => ["sent", "delivered"].includes(n.status)).length;
 const channelTotal = channelNotifs.length;
 const pct = channelTotal > 0 ? Math.round((channelSent / channelTotal) * 100) : 0;

 return (
 <div key={channel} className="flex items-center justify-between">
 <span className="capitalize text-barber-muted">{channel}</span>
 <div className="flex items-center gap-3">
 <div className="h-2 w-32 overflow-hidden rounded-full bg-barber-dark">
 <div
 className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
 style={{ width: `${pct}%` }}
 />
 </div>
 <span className="text-sm font-medium text-barber-white">
 {channelSent}/{channelTotal} ({pct}%)
 </span>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Erros recentes */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 text-lg font-semibold text-barber-white">
 Erros Recentes
 </h2>
 {errors.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-8 text-barber-muted">
 <CheckCircle className="mb-2 h-8 w-8 text-emerald-500/50" />
 <p>Nenhum erro nas últimas 24h</p>
 </div>
 ) : (
 <div className="space-y-3">
 {errors.map((err, i) => (
 <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
 <div className="flex items-start justify-between gap-2">
 <p className="text-sm text-red-200 line-clamp-2">
 {err.error_message ?? "Erro desconhecido"}
 </p>
 <span className="shrink-0 text-xs text-red-300/60">
 {new Date(err.created_at).toLocaleTimeString("pt-BR")}
 </span>
 </div>
 <p className="mt-1 text-xs text-red-300/50 capitalize">Canal: {err.channel}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Eventos recentes */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
 <h2 className="mb-4 text-lg font-semibold text-barber-white">
 Eventos de Assinatura Recentes
 </h2>
 {events.length === 0 ? (
 <p className="py-4 text-center text-barber-muted">Nenhum evento registrado</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-barber-border text-left text-barber-muted">
 <th className="pb-2 font-medium">Evento</th>
 <th className="pb-2 font-medium">Data/Hora</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-barber-border/50">
 {events.map((evt, i) => (
 <tr key={i}>
 <td className="py-2 font-medium text-barber-white">{evt.event_type}</td>
 <td className="py-2 text-barber-muted">
 {new Date(evt.created_at).toLocaleString("pt-BR")}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Info box */}
 <div className="rounded-lg border border-barber-border/50 bg-barber-dark/50 p-4">
 <p className="text-sm text-barber-muted">
 💡 <strong>Dica:</strong> Configure um monitor externo (Uptime Robot, Better Stack)
 para apontar ao endpoint <code className="rounded bg-barber-graphite px-1.5 py-0.5 text-barber-gold">/api/health</code> e
 receber alertas quando o sistema estiver fora do ar.
 </p>
 </div>
 </div>
 );
}

function KPICard({
 icon,
 label,
 value,
 subtitle,
 color,
}: {
 icon: React.ReactNode;
 label: string;
 value: number;
 subtitle: string;
 color: "emerald" | "gold" | "amber" | "red" | "blue";
}) {
 const borderColors = {
 emerald: "border-emerald-500/30",
 gold: "border-barber-gold/30",
 amber: "border-amber-500/30",
 red: "border-red-500/30",
 blue: "border-blue-500/30",
 };

 const bgColors = {
 emerald: "bg-emerald-500/10",
 gold: "bg-barber-gold/10",
 amber: "bg-amber-500/10",
 red: "bg-red-500/10",
 blue: "bg-blue-500/10",
 };

 return (
 <div className={`rounded-xl border ${borderColors[color]} ${bgColors[color]} p-5`}>
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
 {icon}
 </div>
 <div>
 <p className="text-sm text-barber-muted">{label}</p>
 <p className="text-2xl font-bold text-barber-white">{value}</p>
 <p className="text-xs text-barber-muted/70">{subtitle}</p>
 </div>
 </div>
 </div>
 );
}