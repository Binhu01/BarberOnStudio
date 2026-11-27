import { DashboardAuthGate } from "./_components/dashboard-auth-gate";

export default function DashboardLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return <DashboardAuthGate>{children}</DashboardAuthGate>;
}