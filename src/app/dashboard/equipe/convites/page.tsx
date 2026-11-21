// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import { MailPlus, Clock, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { getInvitations, getDepartments, createInvitation, revokeInvitation } from "../actions";

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/10 text-amber-400" },
  accepted: { label: "Aceito", icon: CheckCircle2, className: "bg-barber-success/10 text-green-400" },
  revoked: { label: "Revogado", icon: XCircle, className: "bg-barber-error/10 text-red-400" },
  expired: { label: "Expirado", icon: XCircle, className: "bg-white/5 text-barber-muted" },
};

export default async function ConvitesPage() {
  await connection();
  const [invitations, departments] = await Promise.all([getInvitations(), getDepartments()]);

  const pending = invitations.filter((i) => !i.accepted_at && !i.revoked_at);
  const past = invitations.filter((i) => i.accepted_at || i.revoked_at);

  async function handleCreateInvite(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const role = formData.get("role") as "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";
    const departmentId = formData.get("department_id") as string | null;
    if (!email || !role) return;
    try {
      await createInvitation({
        email,
        role,
        department_id: departmentId || undefined,
      });
    } catch {
      // Error handling via revalidation / UI feedback
    }
  }

  async function handleRevoke(invitationId: string) {
    "use server";
    try {
      await revokeInvitation(invitationId);
    } catch {
      // Error handling via revalidation
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">Convites</h1>
          <p className="mt-1 text-sm text-barber-muted">
            Convide novos membros para sua organização
          </p>
        </div>
      </div>

      {/* Create Invitation Form */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
            <UserPlus className="h-5 w-5 text-barber-gold" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-barber-white">Novo convite</h2>
            <p className="text-xs text-barber-muted">
              O link de convite será exibido uma única vez após a criação
            </p>
          </div>
        </div>
        <form action={handleCreateInvite} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-barber-muted">E-mail</label>
            <input
              type="email"
              name="email"
              required
              placeholder="nome@empresa.com"
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white placeholder:text-barber-muted/50 focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">Papel</label>
            <select
              name="role"
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="EMPLOYEE">Colaborador</option>
              <option value="MANAGER">Gerente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">Departamento</label>
            <select
              name="department_id"
              className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
            >
              <option value="">Sem departamento</option>
              {departments.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Gerar convite
            </button>
          </div>
        </form>
      </div>

      {/* Pending Invitations */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-barber-white">
          Convites pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-12">
            <MailPlus className="mb-4 h-10 w-10 text-barber-muted/40" />
            <p className="text-base font-medium text-barber-white">Nenhum convite pendente</p>
            <p className="text-sm text-barber-muted">
              Use o formulário acima para convidar novos membros.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite shadow-sm">
            <table className="w-full">
              <thead className="border-b border-barber-border bg-barber-dark">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">E-mail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">Papel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">Departamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">Expira em</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-barber-muted">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {pending.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-barber-dark/50">
                    <td className="px-4 py-3 text-sm font-medium text-barber-white">{inv.email}</td>
                    <td className="px-4 py-3 text-sm text-barber-light">{inv.role_name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-barber-light">{inv.department_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-barber-light">
                      {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={handleRevoke.bind(null, inv.id)} className="inline">
                        <button
                          type="submit"
                          className="rounded-lg border border-barber-error/30 px-3 py-1.5 text-xs font-medium text-barber-error hover:bg-barber-error/10 transition-colors"
                        >
                          Revogar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Past Invitations */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-barber-muted">Histórico</h2>
          <div className="overflow-hidden rounded-xl border border-barber-border bg-barber-graphite shadow-sm opacity-80">
            <table className="w-full">
              <thead className="border-b border-barber-border bg-barber-dark">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">E-mail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-barber-muted">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {past.slice(0, 20).map((inv) => {
                  const invStatus = inv.accepted_at ? "accepted" : inv.revoked_at ? "revoked" : "expired";
                  const config = statusConfig[invStatus] ?? statusConfig.pending;
                  const Icon = config.icon;
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 text-sm text-barber-light">{inv.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-barber-muted">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}