// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import {
  Sparkles,
  MessageSquarePlus,
  Settings,
  AlertTriangle,
  TrendingUp,
  Package,
  DollarSign,
  Users,
  CheckSquare,
  ShoppingCart,
} from "lucide-react";
import { getAiStatus, getConversations, getInsights } from "./actions";

const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "Como estão as vendas da empresa?", color: "text-barber-success bg-barber-success/10" },
  { icon: Package, text: "Quais produtos precisam de reposição?", color: "text-barber-warning bg-barber-warning/10" },
  { icon: DollarSign, text: "Quais são nossas despesas deste mês?", color: "text-barber-error bg-barber-error/10" },
  { icon: Users, text: "Quais clientes precisam de acompanhamento?", color: "text-barber-gold bg-barber-gold/10" },
  { icon: CheckSquare, text: "Existem contas vencidas?", color: "text-barber-warning bg-barber-warning/10" },
  { icon: ShoppingCart, text: "Quais são os pedidos em andamento?", color: "text-barber-copper bg-barber-copper/10" },
];

export default async function IntelligencePage() {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();

  const [status, conversations, insights] = await Promise.all([
    getAiStatus(),
    getConversations().catch(() => []),
    getInsights("active").catch(() => []),
  ]);

  if (!status || status.needs_setup) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Barber-On Intelligence</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Assistente empresarial com inteligência artificial integrado à plataforma.
          </p>
        </div>

        <div className="rounded-xl border border-barber-warning/20 bg-barber-warning/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-barber-warning" />
          <h2 className="mt-4 font-display text-lg font-semibold text-barber-warning">
            Configuração pendente
          </h2>
          <p className="mt-2 text-sm text-barber-muted">
            {!status?.is_configured
              ? "A variável de ambiente ANTHROPIC_API_KEY não está configurada no servidor. Configure-a para ativar o Barber-On Intelligence."
              : "O Barber-On Intelligence está desativado para esta organização. Ative-o nas configurações."}
          </p>
          {["OWNER", "ADMIN"].includes(status?.role ?? "") && (
            <Link
              href="/dashboard/intelligence/configuracoes"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-barber-warning px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-warning/90"
            >
              <Settings className="h-4 w-4" />
              Ir para configurações
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-barber-gold to-barber-copper shadow-md">
            <Sparkles className="h-5 w-5 text-barber-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-barber-white">Barber-On Intelligence</h1>
            <p className="text-xs text-barber-muted">
              Assistente empresarial · {conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/intelligence/configuracoes"
            className="inline-flex items-center gap-1.5 rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <Link
            href="/dashboard/intelligence/novo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Nova conversa
          </Link>
        </div>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-white">Insights recentes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.slice(0, 6).map((insight) => (
              <div
                key={insight.id}
                className="rounded-lg border border-barber-border bg-barber-dark/30 p-4 transition-colors hover:bg-barber-dark/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-barber-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-barber-gold">
                    {insight.insight_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-barber-muted">
                    {new Date(insight.generated_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-barber-white">{insight.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-barber-muted">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-barber-white">Perguntas sugeridas</h2>
        <p className="mt-1 text-xs text-barber-muted">
          Clique em uma pergunta para iniciar uma conversa com o Barber-On Intelligence.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUGGESTED_QUESTIONS.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.text}
                href={`/dashboard/intelligence/novo?q=${encodeURIComponent(q.text)}`}
                className={`group flex items-center gap-3 rounded-lg border border-barber-border p-4 transition-all hover:border-barber-gold/30 hover:shadow-sm ${q.color}`}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-70" />
                <span className="text-sm font-medium text-barber-white group-hover:text-barber-gold">
                  {q.text}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Conversations */}
      {conversations.length > 0 && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-white">Conversas recentes</h2>
          <div className="mt-4 space-y-2">
            {conversations.slice(0, 10).map((conv) => (
              <Link
                key={conv.id}
                href={`/dashboard/intelligence/${conv.id}`}
                className="flex items-center justify-between rounded-lg border border-barber-border p-4 transition-colors hover:bg-barber-dark/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-barber-white">{conv.title}</p>
                  <p className="text-xs text-barber-muted">
                    {new Date(conv.updated_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <MessageSquarePlus className="h-4 w-4 shrink-0 text-barber-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}