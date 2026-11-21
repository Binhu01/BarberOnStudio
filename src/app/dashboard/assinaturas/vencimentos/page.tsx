export const instant = false;

import { connection } from "next/server";
import { Clock, AlertTriangle, CreditCard, RefreshCw } from "lucide-react";
import { getClientSubscriptions } from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function AssinaturasVencimentosPage() {
 // Opt out of static prerendering — required when cacheComponents: true

 await connection();

 const subscriptions = await getClientSubscriptions().catch(() => []);

 const now = new Date();
 const sevenDays = new Date(now.getTime() + 7 * 86400000);
 const thirtyDays = new Date(now.getTime() + 30 * 86400000);

 const expiringSoon = subscriptions.filter((s: any) => {
 if (s.status !== "active" || !s.expires_at) return false;
 const exp = new Date(s.expires_at);
 return exp >= now && exp <= sevenDays;
 });

 const expiringMonth = subscriptions.filter((s: any) => {
 if (s.status !== "active" || !s.expires_at) return false;
 const exp = new Date(s.expires_at);
 return exp > sevenDays && exp <= thirtyDays;
 });

 const expired = subscriptions.filter((s: any) => {
 if (!s.expires_at) return false;
 return new Date(s.expires_at) < now && s.status !== "cancelled";
 });

 const Section = ({
 title,
 items,
 icon: Icon,
 color,
 emptyMsg,
 }: {
 title: string;
 items: any[];
 icon: typeof Clock;
 color: string;
 emptyMsg: string;
 }) => (
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
 <div className="mb-4 flex items-center gap-2">
 <Icon className={`h-5 w-5 ${color}`} />
 <h2 className="font-display text-lg font-semibold text-barber-white">{title}</h2>
 <span className="rounded-full bg-barber-dark px-2 py-0.5 text-xs font-medium text-barber-muted">
 {items.length}
 </span>
 </div>
 {items.length === 0 ? (
 <p className="py-8 text-center text-sm text-barber-muted">{emptyMsg}</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-muted">
 <th className="pb-2 pr-4 font-medium">Cliente</th>
 <th className="pb-2 pr-4 font-medium">Plano</th>
 <th className="pb-2 pr-4 font-medium">Vencimento</th>
 <th className="pb-2 pr-4 text-right font-medium">Valor</th>
 <th className="pb-2 text-right font-medium">Renovações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-barber-border/50">
 {items.map((sub: any) => (
 <tr key={sub.id} className="transition-colors hover:bg-barber-dark/15">
 <td className="py-2.5 pr-4">
 <p className="font-medium text-barber-white">{sub.customer_name ?? "Sem nome"}</p>
 <p className="text-[10px] text-barber-muted">{sub.customer_phone ?? ""}</p>
 </td>
 <td className="py-2.5 pr-4 text-barber-white">{sub.plan_name ?? "—"}</td>
 <td className="py-2.5 pr-4 text-xs text-barber-muted">
 {new Date(sub.expires_at).toLocaleDateString("pt-BR")}
 </td>
 <td className="py-2.5 pr-4 text-right font-medium text-barber-white">
 {brl.format(sub.price ?? 0)}
 </td>
 <td className="py-2.5 text-right text-barber-muted">{sub.renewal_count ?? 0}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );

 return (
 <div className="space-y-6">
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-white">Vencimentos</h1>
 <p className="mt-1 text-sm text-barber-muted">
 Acompanhe assinaturas próximas do vencimento para ações de retenção
 </p>
 </div>

 {/* Summary */}
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
 <div className="rounded-xl border border-barber-error/20 bg-barber-error/10 p-4 text-center">
 <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-barber-error" />
 <p className="text-2xl font-bold text-barber-error">{expired.length}</p>
 <p className="text-xs text-barber-error">Expiradas</p>
 </div>
 <div className="rounded-xl border border-barber-warning/20 bg-barber-warning/10 p-4 text-center">
 <Clock className="mx-auto mb-2 h-5 w-5 text-barber-warning" />
 <p className="text-2xl font-bold text-barber-warning">{expiringSoon.length}</p>
 <p className="text-xs text-barber-warning">Vencem em 7 dias</p>
 </div>
 <div className="rounded-xl border border-barber-gold/20 bg-barber-gold/10 p-4 text-center">
 <CreditCard className="mx-auto mb-2 h-5 w-5 text-barber-gold" />
 <p className="text-2xl font-bold text-barber-gold">{expiringMonth.length}</p>
 <p className="text-xs text-barber-gold">Vencem em 30 dias</p>
 </div>
 </div>

 <Section
 title="Vencendo nos próximos 7 dias"
 items={expiringSoon}
 icon={AlertTriangle}
 color="text-barber-error"
 emptyMsg="Nenhuma assinatura vencendo nos próximos 7 dias"
 />

 <Section
 title="Vencendo nos próximos 30 dias"
 items={expiringMonth}
 icon={Clock}
 color="text-barber-warning"
 emptyMsg="Nenhuma assinatura vencendo nos próximos 30 dias"
 />

 <Section
 title="Expiradas"
 items={expired}
 icon={RefreshCw}
 color="text-barber-muted"
 emptyMsg="Nenhuma assinatura expirada"
 />
 </div>
 );
}