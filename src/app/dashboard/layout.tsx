import { Suspense } from "react";
import { DashboardAuthGate } from "./_components/dashboard-auth-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-barber-dark">
          <p className="text-barber-muted">Carregando...</p>
        </div>
      }
    >
      <DashboardAuthGate>{children}</DashboardAuthGate>
    </Suspense>
  );
}