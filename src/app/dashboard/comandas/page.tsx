import { getComandas, getComandaStats } from "./actions";
import { getOpenCashSession } from "./cash-actions";
import { ComandaList } from "./_components/comanda-list";
import { NewComandaForm } from "./_components/new-comanda-form";
import { Receipt, TrendingUp, DollarSign, Clock } from "lucide-react";

export default async function ComandasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; barber?: string }>;
}) {
  const params = await searchParams;

  const [comandas, stats, openSession] = await Promise.all([
    getComandas({
      status: params.status,
      barber_id: params.barber,
    }),
    getComandaStats(),
    getOpenCashSession(),
  ]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">
            Comandas
          </h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie atendimentos, serviços e pagamentos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {openSession ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-barber-success/30 bg-barber-success/10 px-3 py-1.5 text-xs font-medium text-barber-success">
              <span className="h-2 w-2 animate-pulse rounded-full bg-barber-success" />
              Caixa Aberto
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-barber-warning/30 bg-barber-warning/10 px-3 py-1.5 text-xs font-medium text-barber-warning">
              <span className="h-2 w-2 rounded-full bg-barber-warning" />
              Caixa Fechado
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Em Aberto</p>
              <p className="text-xl font-bold text-barber-white">
                {stats.total_open}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Finalizadas Hoje</p>
              <p className="text-xl font-bold text-barber-white">
                {stats.total_completed_today}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Receita Hoje</p>
              <p className="text-xl font-bold text-barber-white">
                {formatCurrency(stats.revenue_today)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-white/10 text-barber-white">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-barber-muted">Ticket Médio</p>
              <p className="text-xl font-bold text-barber-white">
                {formatCurrency(stats.avg_ticket)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Two columns on desktop */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left: New Comanda Form */}
        <div className="space-y-4">
          <NewComandaForm />
        </div>

        {/* Right: Comanda List */}
        <div>
          <ComandaList
            comandas={comandas}
            currentStatus={params.status}
            currentBarber={params.barber}
          />
        </div>
      </div>
    </div>
  );
}