"use client";

import { useOrganization } from "./organization-context";
import { Building2, Users, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
 const orgContext = useOrganization();

 // Se não há organização ativa, o middleware já cuidou do redirecionamento
 if (!orgContext || !orgContext.org) {
 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <p className="text-barber-muted">Carregando...</p>
 </div>
 );
 }

 const { org } = orgContext;

 const roleName: Record<string, string> = {
 OWNER: "Proprietário",
 ADMIN: "Administrador",
 MANAGER: "Gestor",
 EMPLOYEE: "Colaborador",
 };

 return (
 <div className="space-y-8">
 {/* Greeting */}
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-white">
 Olá, Bem-vindo!
 </h1>
 <p className="mt-1 text-barber-muted">
 Visão geral da barbearia{" "}
 <span className="font-medium text-barber-gold">
 {org.name}
 </span>
 .
 </p>
 </div>

 {/* Info Cards */}
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
 <Building2 className="h-5 w-5" />
 </div>
 <div>
 <p className="text-xs font-medium text-barber-muted">
 Organização
 </p>
 <p className="truncate text-sm font-semibold text-barber-white">
 {org.name}
 </p>
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
 <Users className="h-5 w-5" />
 </div>
 <div>
 <p className="text-xs font-medium text-barber-muted">
 Seu papel
 </p>
 <p className="text-sm font-semibold text-barber-white">
 {roleName[org.membership.role] ?? org.membership.role}
 </p>
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
 <ShieldCheck className="h-5 w-5" />
 </div>
 <div>
 <p className="text-xs font-medium text-barber-muted">
 Status
 </p>
 <p className="text-sm font-semibold text-barber-success">
 Configurado
 </p>
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
 <CheckCircle2 className="h-5 w-5" />
 </div>
 <div>
 <p className="text-xs font-medium text-barber-muted">
 Slug
 </p>
 <p className="text-sm font-semibold text-barber-white">
 {org.slug}
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Welcome Section */}
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-8 shadow-sm">
 <div className="flex items-start gap-4">
 <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-barber-gold/10 text-barber-gold">
 <CheckCircle2 className="h-6 w-6" />
 </div>
 <div>
 <h2 className="font-display text-lg font-semibold text-barber-white">
 Ambiente pronto para uso
 </h2>
 <p className="mt-2 text-sm leading-relaxed text-barber-muted">
 Sua organização <strong>{org.name}</strong> está
 configurada e operacional. Todos os módulos estão disponíveis:
 Clientes, Leads, Vendas, Produtos, Estoque, Financeiro, Equipe,
 Relatórios, Inteligência IA e Assinaturas.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}