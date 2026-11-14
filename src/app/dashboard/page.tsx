import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization, getOrganizationMemberCount } from "@/lib/organizations";
import { redirect } from "next/navigation";
import {
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Target,
  Trophy,
  AlertTriangle,
  ShoppingCart,
  Percent,
  Package,
  Warehouse,
  ArrowLeftRight,
} from "lucide-react";
import { getCustomerStats } from "./clientes/actions";
import { getLeadStats, getLeadsByStage, getPipelineAndStages } from "./leads/actions";
import { getSalesStats, getQuoteStats } from "./vendas/actions";
import { getProductStats } from "./produtos/actions";
import { getInventoryStats } from "./estoque/actions";
import { getFinancialDashboard } from "./financeiro/actions";

export default async function DashboardPage() {
  // Force dynamic rendering — reads request headers to opt out of static caching
  await headers();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const activeData = await getActiveOrganization();

  // Se não há organização ativa, renderiza placeholder e deixa o middleware
  // redirecionar para /dashboard/onboarding. Não usamos redirect() aqui
  // porque causa NEXT_REDIRECT durante a validação do instant.
  if (!activeData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-barber-muted">Redirecionando…</p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const memberCount = await getOrganizationMemberCount(activeData.org.id);

  // CRM metrics
  const customerStats = await getCustomerStats(activeData.org.id);
  const leadStats = await getLeadStats(activeData.org.id);

  // Sales metrics
  let salesStats: Awaited<ReturnType<typeof getSalesStats>> | null = null;
  let quoteStats: Awaited<ReturnType<typeof getQuoteStats>> | null = null;
  try {
    salesStats = await getSalesStats(activeData.org.id);
    quoteStats = await getQuoteStats(activeData.org.id);
  } catch {
    // Sales module may not have data yet
  }

  // Inventory & Product metrics
  let productStats: Awaited<ReturnType<typeof getProductStats>> | null = null;
  let inventoryStats: Awaited<ReturnType<typeof getInventoryStats>> | null = null;
  try {
    productStats = await getProductStats(activeData.org.id);
    inventoryStats = await getInventoryStats(activeData.org.id);
  } catch {
    // Inventory module may not have data yet
  }

  // Financial metrics
  let financialStats: Awaited<ReturnType<typeof getFinancialDashboard>> | null = null;
  try {
    financialStats = await getFinancialDashboard();
  } catch {
    // Financial module may not have data yet
  }

  let pipelineStages: { stage: { id: string; name: string }; leads: unknown[] }[] = [];
  try {
    const pipelineData = await getPipelineAndStages();
    if (pipelineData?.pipeline?.id) {
      pipelineStages = await getLeadsByStage(pipelineData.pipeline.id);
    }
  } catch {
    // Pipeline may not exist yet — show empty state gracefully
  }

  const roleName: Record<string, string> = {
    OWNER: "Proprietário",
    ADMIN: "Administrador",
    MANAGER: "Gestor",
    EMPLOYEE: "Colaborador",
  };

  // Saudação fixa — new Date() é incompatível com cacheComponents: true
  // A saudação dinâmica por horário será movida para um Client Component futuramente
  const greeting = "Olá";

  const displayName = profile?.full_name?.split(" ")[0] ?? "Usuário";

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          {greeting}, {displayName}
        </h1>
        <p className="mt-1 text-barber-muted">
          Visão geral da barbearia{" "}
          <span className="font-medium text-barber-gold">
            {activeData.org.name}
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
                {activeData.org.name}
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
                Membros
              </p>
              <p className="text-sm font-semibold text-barber-white">
                {memberCount} {memberCount === 1 ? "membro" : "membros"}
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
                Seu papel
              </p>
              <p className="text-sm font-semibold text-barber-white">
                {roleName[activeData.org.membership.role] ??
                  activeData.org.membership.role}
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
                Status
              </p>
              <p className="text-sm font-semibold text-barber-success">
                Configurado
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo Comercial */}
      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Resumo Comercial
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Clientes Ativos
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {customerStats.active}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Leads Abertos
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {leadStats.open}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Leads Ganhos
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {leadStats.won}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border bg-barber-graphite p-6 shadow-sm ${leadStats.overdue > 0 ? "border-amber-300 ring-1 ring-amber-200" : "border-barber-border"}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${leadStats.overdue > 0 ? "bg-amber-500/10 text-amber-600" : "bg-barber-graphite text-barber-muted"}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Retornos Atrasados
                </p>
                <p className={`text-sm font-semibold ${leadStats.overdue > 0 ? "text-amber-600" : "text-barber-white"}`}>
                  {leadStats.overdue}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas de Vendas */}
      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Métricas de Vendas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Receita Total
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(salesStats?.revenue_total ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Receita este Mês
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(salesStats?.revenue_month ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Pedidos Concluídos
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {salesStats?.completed_orders ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-barber-muted">
                  Taxa de Conversão
                </p>
                <p className="text-sm font-semibold text-barber-white">
                  {quoteStats?.conversion_rate ?? 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Produtos e Estoque */}
      {(productStats || inventoryStats) && (
        <div>
          <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
            Produtos e Estoque
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    Produtos Ativos
                  </p>
                  <p className="text-sm font-semibold text-barber-white">
                    {productStats?.active_products ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl border bg-barber-graphite p-6 shadow-sm ${(productStats?.low_stock_count ?? 0) > 0 ? "border-amber-300 ring-1 ring-amber-200" : "border-barber-border"}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${(productStats?.low_stock_count ?? 0) > 0 ? "bg-amber-500/10 text-amber-600" : "bg-barber-graphite text-barber-muted"}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    Estoque Baixo
                  </p>
                  <p className={`text-sm font-semibold ${(productStats?.low_stock_count ?? 0) > 0 ? "text-amber-600" : "text-barber-white"}`}>
                    {productStats?.low_stock_count ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
                  <Warehouse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    Depósitos
                  </p>
                  <p className="text-sm font-semibold text-barber-white">
                    {inventoryStats?.total_warehouses ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    Movimentações (mês)
                  </p>
                  <p className="text-sm font-semibold text-barber-white">
                    {inventoryStats?.total_movements_month ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Comercial */}
      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
          Pipeline Comercial
        </h2>
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          {pipelineStages.length > 0 ? (
            <div className="space-y-3">
              {pipelineStages.map(({ stage, leads }) => {
                const total = pipelineStages.reduce((sum, s) => sum + s.leads.length, 0);
                const pct = total > 0 ? Math.round((leads.length / total) * 100) : 0;
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-sm font-medium text-barber-white">
                      {stage.name}
                    </span>
                    <div className="flex-1">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-barber-graphite">
                        <div
                          className="h-full rounded-full bg-barber-gold transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold text-barber-white">
                      {leads.length}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-barber-muted">
              Nenhum pipeline configurado ainda.
            </p>
          )}
        </div>
      </div>

      {/* Resumo Financeiro */}
      {financialStats && (
        <div>
          <h2 className="mb-4 font-display text-lg font-semibold text-barber-white">
            Resumo Financeiro
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    Saldo Total
                  </p>
                  <p className="text-sm font-semibold text-barber-white">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialStats.total_balance)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    A Receber (aberto)
                  </p>
                  <p className="text-sm font-semibold text-barber-white">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialStats.receivables_amount_open)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-barber-error">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    A Pagar (aberto)
                  </p>
                  <p className="text-sm font-semibold text-barber-white">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialStats.payables_amount_open)}
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl border bg-barber-graphite p-6 shadow-sm ${financialStats.net_flow_this_month >= 0 ? "border-barber-border" : "border-amber-300 ring-1 ring-amber-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${financialStats.net_flow_this_month >= 0 ? "bg-barber-success/10 text-barber-success" : "bg-amber-500/10 text-amber-600"}`}>
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-barber-muted">
                    Fluxo do Mês
                  </p>
                  <p className={`text-sm font-semibold ${financialStats.net_flow_this_month >= 0 ? "text-barber-white" : "text-amber-600"}`}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialStats.net_flow_this_month)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              Sua organização <strong>{activeData.org.name}</strong> está
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