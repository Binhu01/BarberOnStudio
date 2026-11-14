import {
  getOpenCashSession,
  getCashSessions,
  getCashMovements,
  getDailyCashSummary,
  getCashRegisters,
  getBarberCommissions,
  getCommissionStats,
} from "../comandas/cash-actions";
import { CashDashboard } from "./_components/cash-dashboard";

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const targetDate = params.date ?? new Date().toISOString().slice(0, 10);

  const [openSession, sessions, summary, registers, commissions, commissionStats] =
    await Promise.all([
      getOpenCashSession(),
      getCashSessions({ date_from: `${targetDate}T00:00:00`, date_to: `${targetDate}T23:59:59` }),
      getDailyCashSummary(targetDate),
      getCashRegisters(),
      getBarberCommissions({ status: "pending" }),
      getCommissionStats(),
    ]);

  // Get movements for the open session or first session of the day
  const activeSessionId = openSession?.id ?? sessions[0]?.id;
  const movements = activeSessionId ? await getCashMovements(activeSessionId) : [];

  return (
    <CashDashboard
      openSession={openSession}
      sessions={sessions}
      summary={summary}
      registers={registers}
      movements={movements}
      commissions={commissions}
      commissionStats={commissionStats}
      targetDate={targetDate}
    />
  );
}