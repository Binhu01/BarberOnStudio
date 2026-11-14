"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Send,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  Calendar,
  TrendingUp,
  Search,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import type {
  ReactivationCampaign,
  InactiveCustomer,
} from "@/types/loyalty";
import {
  createReactivationCampaign,
  updateReactivationCampaign,
  deleteReactivationCampaign,
  populateCampaignRecipients,
} from "../actions";

interface Props {
  campaigns: ReactivationCampaign[];
  inactiveCustomers: InactiveCustomer[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "text-barber-muted bg-barber-muted/10" },
  scheduled: { label: "Agendada", color: "text-barber-copper bg-barber-copper/10" },
  sending: { label: "Enviando", color: "text-yellow-400 bg-yellow-400/10" },
  completed: { label: "Concluída", color: "text-barber-green bg-barber-green/10" },
  cancelled: { label: "Cancelada", color: "text-barber-error bg-barber-error/10" },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
  push: "Push",
};

const TYPE_LABELS: Record<string, string> = {
  inactive_clients: "Clientes Inativos",
  birthday: "Aniversário",
  custom_segment: "Segmento Personalizado",
  win_back: "Win-back",
};

export function ReactivationManager({ campaigns, inactiveCustomers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [inactiveDaysFilter, setInactiveDaysFilter] = useState(30);

  // Form state
  const [campName, setCampName] = useState("");
  const [campDesc, setCampDesc] = useState("");
  const [campType, setCampType] = useState<"inactive_clients" | "birthday" | "custom_segment" | "win_back">("inactive_clients");
  const [campDays, setCampDays] = useState("30");
  const [campMessage, setCampMessage] = useState("");
  const [campChannel, setCampChannel] = useState<"whatsapp" | "sms" | "email" | "push">("whatsapp");

  function resetForm() {
    setCampName("");
    setCampDesc("");
    setCampType("inactive_clients");
    setCampDays("30");
    setCampMessage("");
    setCampChannel("whatsapp");
    setShowForm(false);
  }

  async function handleCreateCampaign() {
    if (!campName || !campMessage) return;
    startTransition(async () => {
      try {
        await createReactivationCampaign({
          name: campName,
          description: campDesc || null,
          campaign_type: campType,
          inactive_days_threshold: Number(campDays) || 30,
          message_template: campMessage,
          channel: campChannel,
        });
        resetForm();
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao criar campanha");
      }
    });
  }

  async function handlePopulateRecipients(campaignId: string) {
    if (!confirm("Carregar clientes inativos nesta campanha?")) return;
    startTransition(async () => {
      try {
        const count = await populateCampaignRecipients(campaignId);
        alert(`${count} clientes adicionados à campanha`);
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao carregar destinatários");
      }
    });
  }

  async function handleDeleteCampaign(id: string) {
    if (!confirm("Excluir esta campanha?")) return;
    startTransition(async () => {
      try {
        await deleteReactivationCampaign(id);
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao excluir campanha");
      }
    });
  }

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(term);
    }
    return true;
  });

  // Filter inactive customers by days
  const filteredInactive = inactiveCustomers.filter(
    (c) => c.days_inactive >= inactiveDaysFilter
  );

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-barber-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar campanhas..."
              className="w-64 rounded-lg border border-barber-border bg-barber-graphite py-2 pl-10 pr-3 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-barber-border bg-barber-graphite p-1">
            {[
              { key: "all", label: "Todas" },
              { key: "draft", label: "Rascunho" },
              { key: "completed", label: "Concluídas" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === f.key
                    ? "bg-barber-gold text-barber-dark"
                    : "text-barber-muted hover:text-barber-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90"
        >
          <Plus className="h-4 w-4" />
          Nova Campanha
        </button>
      </div>

      {/* New Campaign Form */}
      {showForm && (
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6">
          <h3 className="mb-4 text-base font-semibold text-barber-white">
            Nova Campanha de Reativação
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Nome da Campanha *
              </label>
              <input
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                placeholder="Ex: Retorno Pós-Férias"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Tipo de Campanha
              </label>
              <select
                value={campType}
                onChange={(e) => setCampType(e.target.value as any)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value="inactive_clients">Clientes Inativos</option>
                <option value="birthday">Aniversário</option>
                <option value="win_back">Win-back</option>
                <option value="custom_segment">Segmento Personalizado</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Dias de Inatividade
              </label>
              <input
                type="number"
                value={campDays}
                onChange={(e) => setCampDays(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Canal de Envio
              </label>
              <select
                value={campChannel}
                onChange={(e) => setCampChannel(e.target.value as any)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">E-mail</option>
                <option value="push">Push Notification</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Mensagem * (use {'{nome}'} para personalizar)
              </label>
              <textarea
                value={campMessage}
                onChange={(e) => setCampMessage(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                placeholder="Olá {nome}! Sentimos sua falta na barbearia. Que tal agendar um corte esta semana?"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Descrição (opcional)
              </label>
              <input
                value={campDesc}
                onChange={(e) => setCampDesc(e.target.value)}
                className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none"
                placeholder="Objetivo e público-alvo da campanha"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleCreateCampaign}
              disabled={isPending || !campName || !campMessage}
              className="rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-gold/90 disabled:opacity-50"
            >
              {isPending ? "Criando..." : "Criar Campanha"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-muted transition-colors hover:text-barber-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Campaigns List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-barber-white">
            Campanhas ({filteredCampaigns.length})
          </h2>

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-barber-border bg-barber-graphite/50 p-12 text-center">
              <Send className="mx-auto h-10 w-10 text-barber-muted/40" />
              <p className="mt-3 text-sm text-barber-muted">
                Nenhuma campanha encontrada
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((campaign) => {
                const statusInfo = STATUS_LABELS[campaign.status] ?? STATUS_LABELS.draft;
                return (
                  <div
                    key={campaign.id}
                    className="rounded-xl border border-barber-border bg-barber-graphite p-4 transition-colors hover:border-barber-border/80"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate font-medium text-barber-white">
                            {campaign.name}
                          </h4>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-barber-muted">
                          <span>📋 {TYPE_LABELS[campaign.campaign_type]}</span>
                          <span>📱 {CHANNEL_LABELS[campaign.channel]}</span>
                          <span>⏰ {campaign.inactive_days_threshold}d inatividade</span>
                        </div>
                        {campaign.description && (
                          <p className="mt-2 text-xs text-barber-muted line-clamp-1">
                            {campaign.description}
                          </p>
                        )}
                        <div className="mt-2 flex gap-4 text-xs">
                          <span className="text-barber-light">
                            🎯 Alvo: {campaign.target_count ?? "—"}
                          </span>
                          <span className="text-barber-light">
                            📤 Enviado: {campaign.sent_count}
                          </span>
                          <span className="text-barber-green">
                            ✅ Convertidos: {campaign.conversion_count}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {campaign.status === "draft" && (
                          <>
                            <button
                              onClick={() => handlePopulateRecipients(campaign.id)}
                              title="Carregar destinatários"
                              className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-gold/10 hover:text-barber-gold"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCampaign(campaign.id)}
                              title="Excluir"
                              className="rounded p-1.5 text-barber-muted transition-colors hover:bg-barber-error/10 hover:text-barber-error"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Inactive Customers */}
        <div className="space-y-4">
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-barber-white">
                <Clock className="h-4 w-4 text-barber-copper" />
                Clientes Inativos
              </h3>
              <select
                value={inactiveDaysFilter}
                onChange={(e) => setInactiveDaysFilter(Number(e.target.value))}
                className="rounded border border-barber-border bg-barber-dark px-2 py-1 text-xs text-barber-white focus:border-barber-gold focus:outline-none"
              >
                <option value={15}>15+ dias</option>
                <option value={30}>30+ dias</option>
                <option value={60}>60+ dias</option>
                <option value={90}>90+ dias</option>
              </select>
            </div>
            {filteredInactive.length === 0 ? (
              <p className="text-xs text-barber-muted">
                Nenhum cliente inativo neste período
              </p>
            ) : (
              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                {filteredInactive.slice(0, 20).map((customer) => (
                  <div
                    key={customer.customer_id}
                    className="border-b border-barber-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <p className="text-sm font-medium text-barber-white">
                      {customer.full_name ?? "Sem nome"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-barber-muted">
                      <span>{customer.days_inactive}d ausente</span>
                      <span>
                        {customer.total_visits} visitas · R${" "}
                        {Number(customer.total_spent).toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredInactive.length > 20 && (
                  <p className="text-center text-xs text-barber-muted/60">
                    +{filteredInactive.length - 20} mais clientes
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quick Tips */}
          <div className="rounded-xl border border-barber-border bg-barber-graphite p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-barber-white">
              <TrendingUp className="h-4 w-4 text-barber-green" />
              Dicas de Reativação
            </h3>
            <ul className="space-y-2 text-xs text-barber-muted">
              <li className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-barber-green" />
                <span>Clientes entre 30-60 dias têm maior taxa de retorno</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-barber-green" />
                <span>Personalize a mensagem com o nome do cliente</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-barber-green" />
                <span>Ofereça um incentivo (desconto ou serviço extra)</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-barber-green" />
                <span>Envie em horários de pico de uso do WhatsApp</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}