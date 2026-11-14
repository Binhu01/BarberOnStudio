// This page uses dynamic server data
export const instant = false;

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import { redirect } from "next/navigation";
import { User, Mail, Shield, LogOut } from "lucide-react";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const activeData = await getActiveOrganization();

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url")
    .eq("id", user.id)
    .single();

  const roleName: Record<string, string> = {
    OWNER: "Proprietário",
    ADMIN: "Administrador",
    MANAGER: "Gestor",
    EMPLOYEE: "Colaborador",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-dark">
          Meu Perfil
        </h1>
        <p className="mt-1 text-barber-text-secondary">
          Informações da sua conta na plataforma Barber-On.
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-barber-border bg-white p-8 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-barber-blue/10 text-barber-blue">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <span className="font-display text-2xl font-bold">
                {(profile?.full_name ?? user.email)?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-semibold text-barber-dark">
              {profile?.full_name || "Usuário"}
            </h2>
            <p className="text-sm text-barber-text-secondary">{user.email}</p>
            {activeData && (
              <span className="inline-flex items-center gap-1 rounded-full bg-barber-blue/10 px-2.5 py-0.5 text-xs font-medium text-barber-blue">
                <Shield className="h-3 w-3" />
                {roleName[activeData.org.membership.role] ??
                  activeData.org.membership.role}
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-4 border-t border-barber-border pt-6">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-barber-text-secondary" />
            <div>
              <p className="text-xs text-barber-text-secondary">Nome</p>
              <p className="text-sm font-medium text-barber-text">
                {profile?.full_name || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-barber-text-secondary" />
            <div>
              <p className="text-xs text-barber-text-secondary">E-mail</p>
              <p className="text-sm font-medium text-barber-text">
                {user.email}
              </p>
            </div>
          </div>
          {activeData && (
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-barber-text-secondary" />
              <div>
                <p className="text-xs text-barber-text-secondary">
                  Organização ativa
                </p>
                <p className="text-sm font-medium text-barber-text">
                  {activeData.org.name}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Info */}
      <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
        <h3 className="font-display text-sm font-semibold text-barber-dark">
          Sessão
        </h3>
        <p className="mt-2 text-sm text-barber-text-secondary">
          Sua sessão está ativa e segura. O logout encerrará o acesso em todos
          os dispositivos deste navegador.
        </p>
        <form action="/api/auth/signout" method="POST" className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-text-secondary transition-colors hover:bg-red-50 hover:text-barber-error"
          >
            <LogOut className="h-4 w-4" />
            Encerrar sessão
          </button>
        </form>
      </div>
    </div>
  );
}