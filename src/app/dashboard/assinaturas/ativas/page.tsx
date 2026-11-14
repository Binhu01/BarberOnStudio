export const instant = false;

import { headers } from "next/headers";
import { CreditCard, Users, CheckCircle2, AlertTriangle, Clock, Search } from "lucide-react";
import { getClientSubscriptions } from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 active: { label: "Ativa", color: "text-green-600", bg: "bg-green-50" },
 paused: { label: "Pausada", color: "text-amber-600", bg: "bg-amber-50" },
 expired: { label: "Expirada", color: "text-red-600", bg: "bg-red-50" },
 cancelled: { label: "Cancelada", color: "text-gray-600", bg: "bg-gray-50" },
};

export default async function AssinaturasAtivasPage() {
 await headers();

 const subscriptions = await getClientSubscriptions().catch(() => []);

 const activeOnly = subscriptions.filter((s: any) => s.status === "active");

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-dark">Assinaturas Ativas</h1>
 <p className="mt-1 text-sm text-barber-text-secondary">
 Gerencie as assinaturas ativas dos clientes
 </p>
 </div>
 <div className="flex items-center gap-2 rounded-lg border border-barber-border bg-white px-3 py-1.5 text-sm">
 <CheckCircle2 className="h-4 w-4 text-green-500" />
 <span className="font-medium text-barber-dark">{activeOnly.length}</span>
 <span className="text-barber-text-secondary">ativas</span>
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-text-secondary" />
 <input
 type="text"
 placeholder="Buscar por cliente ou plano..."
 className="w-full rounded-lg border border-barber-border bg-white py-2.5 pl-10 pr-4 text-sm text-barber-dark placeholder:text-barber-text-secondary focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
 />
 </div>

 {activeOnly.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-white py-16 text-center shadow-sm">
 <CreditCard className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
 <p className="text-sm font-medium text-barber-dark">Nenhuma assinatura ativa</p>
 <p className="mt-1 text-xs text-barber-text-secondary">
 As assinaturas ativas aparecerão aqui quando clientes contratarem planos
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-barber-border bg-white shadow-sm">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-barber-border bg-barber-bg-secondary/50 text-xs uppercase tracking-wider text-barber-text-secondary">
 <th className="px-4 py-3 font-medium">Cliente</th>
 <th className="px-4 py-3 font-medium">Plano</th>
 <th className="px-4 py-3 font-medium">Status</th>
 <th className="px-4 py-3 font-medium">Início</th>
 <th className="px-4 py-3 font-medium">Vencimento</th>
 <th className="px-4 py-3 text-right font-medium">Valor</th>
 <th className="px-4 py-3 text-right font-medium">Renovações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-barber-border/50">
 {activeOnly.map((sub: any) => {
 const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active;
 return (
 <tr key={sub.id} className="transition-colors hover:bg-barber-bg-secondary/30">
 <td className="px-4 py-3">
 <p className="font-medium text-barber-dark">{sub.customer_name ?? "Sem nome"}</p>
 <p className="text-[10px] text-barber-text-secondary">{sub.customer_phone ?? ""}</p>
 </td>
 <td className="px-4 py-3 font-medium text-barber-dark">{sub.plan_name ?? "—"}</td>
 <td className="px-4 py-3">
 <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
 {statusCfg.label}
 </span>
 </td>
 <td className="px-4 py-3 text-xs text-barber-text-secondary">
 {sub.started_at ? new Date(sub.started_at).toLocaleDateString("pt-BR") : "—"}
 </td>
 <td className="px-4 py-3 text-xs text-barber-text-secondary">
 {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("pt-BR") : "—"}
 </td>
 <td className="px-4 py-3 text-right font-medium text-barber-dark">
 {brl.format(sub.price ?? 0)}
 </td>
 <td className="px-4 py-3 text-right text-barber-text-secondary">
 {sub.renewal_count ?? 0}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}