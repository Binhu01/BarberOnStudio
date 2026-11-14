"use client";

import Link from "next/link";
import { Receipt, Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import type { Comanda } from "@/types/comanda";

interface ComandaListProps {
  comandas: Comanda[];
  currentStatus?: string;
  currentBarber?: string;
}

const STATUS_CONFIG = {
  open: { label: "Aberta", icon: Clock, color: "text-barber-warning", bg: "bg-barber-warning/10", border: "border-barber-warning/30" },
  in_progress: { label: "Em Atendimento", icon: Receipt, color: "text-barber-gold", bg: "bg-barber-gold/10", border: "border-barber-gold/30" },
  completed: { label: "Finalizada", icon: CheckCircle2, color: "text-barber-success", bg: "bg-barber-success/10", border: "border-barber-success/30" },
  cancelled: { label: "Cancelada", icon: XCircle, color: "text-barber-muted", bg: "bg-barber-muted/10", border: "border-barber-muted/30" },
};

const FILTER_TABS = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "in_progress", label: "Em Atendimento" },
  { value: "completed", label: "Finalizadas" },
];

export function ComandaList({ comandas, currentStatus }: ComandaListProps) {
  const activeTab = currentStatus ?? "all";

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-barber-border bg-barber-dark p-1">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/dashboard/comandas${tab.value === "all" ? "" : `?status=${tab.value}`}`}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-barber-graphite text-barber-gold"
                : "text-barber-muted hover:text-barber-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* List */}
      {comandas.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite/50">
          <div className="text-center">
            <Receipt className="mx-auto mb-2 h-8 w-8 text-barber-muted opacity-50" />
            <p className="text-sm text-barber-muted">Nenhuma comanda encontrada</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {comandas.map((comanda) => {
            const config = STATUS_CONFIG[comanda.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
            const StatusIcon = config.icon;

            return (
              <Link
                key={comanda.id}
                href={`/dashboard/comandas/${comanda.id}`}
                className="group flex items-center gap-4 rounded-xl border border-barber-border bg-barber-graphite p-4 transition-colors hover:border-barber-gold/30 hover:bg-barber-graphite/80"
              >
                {/* Status Badge */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-barber-white">
                      #{comanda.id.slice(0, 8)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-barber-muted">
                    <span>{formatTime(comanda.issued_at)}</span>
                    {comanda.barber_name && (
                      <>
                        <span className="h-3 w-px bg-barber-border" />
                        <span>{comanda.barber_name}</span>
                      </>
                    )}
                    {comanda.customer_name && (
                      <>
                        <span className="h-3 w-px bg-barber-border" />
                        <span>{comanda.customer_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="text-right">
                  <p className="text-sm font-bold text-barber-white">
                    {formatCurrency(comanda.total)}
                  </p>
                  <p className="text-xs text-barber-muted">
                    {(comanda.items?.length ?? 0)} itens
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 shrink-0 text-barber-muted transition-colors group-hover:text-barber-gold" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}