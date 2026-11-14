export const instant = false;

import { headers } from "next/headers";
import { CreditCard, Users, DollarSign, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { getClientSubscriptions, getSubscriptionPlans } from "@/app/dashboard/assinaturas/actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatoriosAssinaturasPage() {
 await headers();

 const [subscriptions, plans] = await Promise.all([
 getClientSubscriptions().catch(() => []),
 getSubscriptionPlans().catch(() => []),
 ]);

 const activeSubs = subscriptions.filter((s: any) => s.status === "active");
 const totalRevenue = activeSubs.reduce((sum: number, s: any) => sum + (s.price ?? 0), 0);

 const now = new Date();
 const sevenDays = new Date(now.getTime() + 7 * 86400000);
 const expiringSoon = activeSubs.filter((s: any) => {
 if (!s.expires_at) return false;
 const exp = new Date(s.expires_at);
 return exp >= now && exp <= sevenDays;
 });

 // Agrupar por plano
 const byPlan = plans.map((plan: any) => {
 const planSubs = activeSubs.filter((s: any) => s.plan_id === plan.id || s.plan_name === plan.name);
 return {
 name: plan.name,
 count: planSubs.length,
 revenue: planSubs.reduce((sum: number, s: any) => sum + (s.price ?? 0), 0),
 };
 }).filter((p: any) => p.count > 0);

 return (
 <div className="space-y-6">
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-dark">
 Relatório de Assinaturas
 </h1>
 <p className="mt-1 text-sm text-barber-text-secondary">
 Métricas de assinaturas ativas, receita recorrente e distribuição por plano
 </p>
 </div>

 {/* Summary KPIs */}
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
 <CreditCard className="h-5 w-5 text-green-600" />
 </div>
 <div>
 <p className="text-2xl font-bold text-barber-dark">{activeSubs.length}</p>
 <p className="text-xs text-barber-text-secondary">Assinaturas ativas</p>
 </div>
 </div>
 </div>
 <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
 <DollarSign className="h-5 w-5 text-blue-600" />
 </div>
 <div>
 <p className="text-2xl font-bold text-barber-dark">{brl.format(totalRevenue)}</p>
 <p className="text-xs text-barber-text-secondary">Receita mensal recorrente</p>
 </div>
 </div>
 </div>
 <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
 <TrendingUp className="h-5 w-5 text-purple-600" />
 </div>
 <div>
 <p className="text-2xl font-bold text-barber-dark">{plans.length}</p>
 <p className="text-xs text-barber-text-secondary">Planos disponíveis</p>
 </div>
 </div>
 </div>
 <div className="rounded-xl border border-barber-border bg-white p-5 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
 <Clock className="h-5 w-5 text-amber-600" />
 </div>
 <div>
 <p className="text-2xl font-bold text-amber-600">{expiringSoon.length}</p>
 <p className="text-xs text-barber-text-secondary">Vencendo em 7 dias</p>
 </div>
 </div>
 </div>
 </div>

 {/* Plans Breakdown */}
 <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
 <h2 className="mb-4 font-display text-lg font-semibold text-barber-dark">
 Distribuição por Plano
 </h2>
 {byPlan.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <CreditCard className="mb-3 h-10 w-10 text-barber-text-secondary/40" />
 <p className="text-sm text-barber-text-secondary">
 Sem dados de assinaturas para exibir
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-barber-border text-xs uppercase tracking-wider text-barber-text-secondary">
 <th className="pb-3 pr-4 font-medium">Plano</th>
 <th className="pb-3 pr-4 text-right font-medium">Assinantes ativos</th>
 <th className="pb-3 pr-4 text-right font-medium">Receita mensal</th>
 <th className="pb-3 text-right font-medium">% do total</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-barber-border/50">
 {byPlan.map((plan: any, i: number) => (
 <tr key={i} className="transition-colors hover:bg-barber-bg-secondary/30">
 <td className="py-3 pr-4 font-medium text-barber-dark">{plan.name}</td>
 <td className="py-3 pr-4 text-right">{plan.count}</td>
 <td className="py-3 pr-4 text-right">{brl.format(plan.revenue)}</td>
 <td className="py-3 text-right text-barber-text-secondary">
 {totalRevenue > 0 ? ((plan.revenue / totalRevenue) * 100).toFixed(1) : 0}%
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
}