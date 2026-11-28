"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Scissors,
  Package,
  DollarSign,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ChevronRight,
  Building2,
  CalendarDays,
  Bell,
  RefreshCw,
  CreditCard,
  MessageCircle,
  Repeat,
  Star,
  Clock,
  Ban,
  Globe,
  ScrollText,
  Puzzle,
  Receipt,
  UserPlus,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

interface NavSubItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
  children?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Comandas", href: "/dashboard/comandas", icon: Receipt },
  { label: "Agendamentos", href: "/dashboard/agenda", icon: CalendarDays },
  {
    label: "Financeiro",
    icon: DollarSign,
    children: [
      { label: "Visão geral", href: "/dashboard/financeiro", icon: LayoutDashboard },
      { label: "Contas a receber", href: "/dashboard/financeiro/receber", icon: Receipt },
      { label: "Contas a pagar", href: "/dashboard/financeiro/pagar", icon: Receipt },
      { label: "Contas", href: "/dashboard/financeiro/contas", icon: Building2 },
      { label: "Fluxo de caixa", href: "/dashboard/financeiro/fluxo", icon: Receipt },
      { label: "Caixa", href: "/dashboard/caixa", icon: Wallet },
    ],
  },
  {
    label: "WhatsApp",
    icon: MessageCircle,
    children: [
      { label: "Central de mensagens", href: "/dashboard/whatsapp", icon: MessageCircle },
      { label: "Modelos", href: "/dashboard/whatsapp/modelos", icon: ScrollText },
      { label: "Lembretes", href: "/dashboard/whatsapp/lembretes", icon: Clock },
      { label: "Campanhas", href: "/dashboard/whatsapp/campanhas", icon: UserPlus },
      { label: "Histórico", href: "/dashboard/whatsapp/historico", icon: ScrollText },
      { label: "Configurações", href: "/dashboard/whatsapp/configuracoes", icon: Settings },
    ],
  },
  { label: "Recorrências", href: "/dashboard/recorrencias", icon: Repeat },
  {
    label: "Relatórios",
    icon: BarChart3,
    children: [
      { label: "Visão geral", href: "/dashboard/relatorios", icon: LayoutDashboard },
      { label: "Financeiro", href: "/dashboard/relatorios/financeiro", icon: DollarSign },
      { label: "Agendamentos", href: "/dashboard/relatorios/agendamentos", icon: CalendarDays },
      { label: "Profissionais", href: "/dashboard/relatorios/equipe", icon: UserCog },
      { label: "Serviços", href: "/dashboard/relatorios/servicos", icon: Scissors },
      { label: "Produtos", href: "/dashboard/relatorios/produtos", icon: Package },
      { label: "Clientes", href: "/dashboard/relatorios/clientes", icon: Users },
      { label: "Assinaturas", href: "/dashboard/relatorios/assinaturas", icon: CreditCard },
      { label: "Comissões", href: "/dashboard/relatorios/comissoes", icon: DollarSign },
      { label: "Estoque", href: "/dashboard/relatorios/estoque", icon: Package },
    ],
  },
  {
    label: "Assinaturas",
    icon: CreditCard,
    children: [
      { label: "Visão geral", href: "/dashboard/assinaturas", icon: LayoutDashboard },
      { label: "Planos", href: "/dashboard/assinaturas/planos", icon: CreditCard },
      { label: "Ativas", href: "/dashboard/assinaturas/ativas", icon: Users },
      { label: "Vencimentos", href: "/dashboard/assinaturas/vencimentos", icon: Clock },
      { label: "Pagamentos", href: "/dashboard/assinaturas/pagamentos", icon: DollarSign },
    ],
  },
  { label: "Profissionais", href: "/dashboard/profissionais", icon: UserCog },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users },
  { label: "Reativar Clientes", href: "/dashboard/reativar", icon: UserPlus },
  { label: "Fidelidade", href: "/dashboard/fidelidade", icon: Star },
  { label: "Serviços", href: "/dashboard/servicos", icon: Scissors },
  { label: "Produtos", href: "/dashboard/produtos", icon: Package },
  { label: "Expedientes", href: "/dashboard/expedientes", icon: Clock },
  { label: "Bloquear Horários", href: "/dashboard/bloqueios", icon: Ban },
  { label: "Agenda Pública", href: "/dashboard/agenda-publica", icon: Globe },
  { label: "Logs", href: "/dashboard/equipe/auditoria", icon: ScrollText },
  {
    label: "Configurações",
    icon: Settings,
    children: [
      { label: "Dados da barbearia", href: "/dashboard/configuracoes", icon: Building2 },
      { label: "Horários", href: "/dashboard/expedientes", icon: Clock },
      { label: "Agendamento", href: "/dashboard/agenda-publica", icon: CalendarDays },
      { label: "Usuários e permissões", href: "/dashboard/equipe", icon: Users },
      { label: "Notificações", href: "/dashboard/notificacoes", icon: Bell },
      { label: "Landing page", href: "/dashboard/agenda-publica", icon: Globe },
    ],
  },
  { label: "Integrações", href: "/dashboard/integracoes", icon: Puzzle },
  { label: "Meu plano", href: "/dashboard/billing", icon: CreditCard },
  { label: "Renovar assinatura", href: "/dashboard/billing/renew", icon: RefreshCw },
];

interface DashboardShellProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  activeOrg: {
    id: string;
    name: string;
    slug: string;
    role: UserRole;
  } | null;
  allOrgs: Array<{ id: string; name: string; slug: string }>;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  activeOrg,
  allOrgs,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  function toggleSubmenu(label: string) {
    setOpenSubmenus((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSwitchOrg(orgId: string) {
    setOrgMenuOpen(false);
    // Set cookie client-side and refresh — avoids importing server actions
    document.cookie = `barber_active_org=${orgId};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  const userInitial = (user.name ?? user.email).charAt(0).toUpperCase();
  const roleName: Record<string, string> = {
    OWNER: "Proprietário",
    ADMIN: "Administrador",
    MANAGER: "Gestor",
    EMPLOYEE: "Colaborador",
  };

  return (
    <div className="flex min-h-screen bg-barber-dark">
      {/* DIAGNOSTIC: confirms shell renders — remove after fix verified */}
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 99999, background: "#22c55e", color: "#000", padding: "4px 12px", fontSize: "12px", fontWeight: "bold" }}>SHELL OK</div>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-barber-border bg-barber-dark transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-barber-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-barber-gold font-display text-sm font-bold text-barber-dark">
            B
          </div>
          <span className="font-display text-lg font-bold text-barber-white">
            Barber-On
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            // Submenu with children (e.g. Vendas)
            if (item.children) {
              const isChildActive = item.children.some(
                (child) => child.href && pathname.startsWith(child.href)
              );
              const isOpen = openSubmenus[item.label] ?? isChildActive;

              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isChildActive
                        ? "bg-barber-gold/10 text-barber-gold"
                        : "text-barber-muted hover:bg-barber-graphite hover:text-barber-white"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-barber-border pl-2">
                      {item.children.map((child) => {
                        const childActive = pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              childActive
                                ? "bg-barber-gold/10 text-barber-gold"
                                : "text-barber-muted hover:bg-barber-graphite hover:text-barber-white"
                            }`}
                          >
                            <child.icon className="h-3.5 w-3.5" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = pathname === item.href;

            if (item.comingSoon) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-barber-muted/60"
                >
                  <item.icon className="h-4 w-4 opacity-50" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded bg-barber-graphite px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-barber-muted/70">
                    Em breve
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-barber-gold/10 text-barber-gold"
                    : "text-barber-muted hover:bg-barber-graphite hover:text-barber-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-barber-border p-3">
          <Link
            href="/dashboard/perfil"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname === "/dashboard/perfil"
                ? "bg-barber-gold/10 text-barber-gold"
                : "text-barber-muted hover:bg-barber-graphite hover:text-barber-white"
            }`}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-barber-gold/10 text-xs font-bold text-barber-gold">
              {userInitial}
            </div>
            <span className="flex-1 truncate">{user.name ?? user.email}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-barber-muted transition-colors hover:bg-red-900/20 hover:text-barber-error"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-barber-border bg-barber-dark px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-barber-muted hover:bg-barber-graphite md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Org selector */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-barber-border px-3 py-1.5 text-sm transition-colors hover:bg-barber-graphite"
            >
              <Building2 className="h-4 w-4 text-barber-gold" />
              <span className="max-w-[200px] truncate font-medium text-barber-white">
                {activeOrg?.name ?? "Selecionar barbearia"}
              </span>
              {allOrgs.length > 1 && (
                <ChevronDown className="h-3.5 w-3.5 text-barber-muted" />
              )}
            </button>

            {orgMenuOpen && allOrgs.length > 1 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOrgMenuOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-barber-border bg-barber-graphite py-1 shadow-lg">
                  {allOrgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrg(org.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-barber-dark ${
                        activeOrg && org.id === activeOrg.id
                          ? "font-medium text-barber-gold"
                          : "text-barber-light"
                      }`}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{org.name}</span>
                      {activeOrg && org.id === activeOrg.id && (
                        <span className="ml-auto text-xs text-barber-gold">Ativa</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-barber-white">
                {user.name ?? "Usuário"}
              </p>
              <p className="text-xs text-barber-muted">
                {activeOrg ? (roleName[activeOrg.role] ?? activeOrg.role) : ""}
              </p>
            </div>
            <Link
              href="/dashboard/perfil"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-barber-gold/10 text-sm font-medium text-barber-gold transition-colors hover:bg-barber-gold/20"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                userInitial
              )}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}