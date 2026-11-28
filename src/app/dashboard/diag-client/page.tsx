"use client";

import { useEffect, useState } from "react";

/**
 * Página de diagnóstico client-side para identificar a causa da tela preta.
 * NÃO importa nenhum componente do dashboard — apenas verifica se o React
 * consegue hidratar e renderizar conteúdo básico.
 */
export default function DiagClientPage() {
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);

    // Capturar erros globais
    const handler = (e: ErrorEvent) => {
      setErrors((prev) => [...prev, `${e.message} (${e.filename}:${e.lineno})`]);
    };
    window.addEventListener("error", handler);

    return () => window.removeEventListener("error", handler);
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", background: "#1a1a2e", color: "#fff", minHeight: "100vh" }}>
      <h1 style={{ color: "#d4a853" }}>Diagnóstico Client-Side</h1>

      <div style={{ marginTop: 20, padding: 16, border: "1px solid #333", borderRadius: 8 }}>
        <p><strong>React montado:</strong> {mounted ? "✅ SIM" : "❌ NÃO"}</p>
        <p><strong>User Agent:</strong> {typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}</p>
        <p><strong>URL:</strong> {typeof window !== "undefined" ? window.location.href : "N/A"}</p>
        <p><strong>Cookies presentes:</strong> {typeof document !== "undefined" ? (document.cookie ? "SIM" : "NÃO") : "N/A"}</p>
      </div>

      {errors.length > 0 && (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #ff4444", borderRadius: 8, background: "#2a0000" }}>
          <h3 style={{ color: "#ff4444" }}>Erros capturados ({errors.length}):</h3>
          {errors.map((err, i) => (
            <p key={i} style={{ color: "#ff8888", fontSize: 12 }}>{err}</p>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, padding: 16, border: "1px solid #333", borderRadius: 8 }}>
        <h3>Teste de imports dinâmicos</h3>
        <button
          onClick={async () => {
            try {
              const mod = await import("@/lib/supabase/client");
              setErrors((prev) => [...prev, `✅ supabase/client carregado: ${typeof mod.createClient}`]);
            } catch (e) {
              setErrors((prev) => [...prev, `❌ supabase/client falhou: ${(e as Error).message}`]);
            }
          }}
          style={{ padding: "8px 16px", margin: 4, cursor: "pointer" }}
        >
          Testar @/lib/supabase/client
        </button>

        <button
          onClick={async () => {
            try {
              const mod = await import("@/app/dashboard/actions");
              setErrors((prev) => [...prev, `✅ actions carregado: ${Object.keys(mod).join(", ")}`]);
            } catch (e) {
              setErrors((prev) => [...prev, `❌ actions falhou: ${(e as Error).message}`]);
            }
          }}
          style={{ padding: "8px 16px", margin: 4, cursor: "pointer" }}
        >
          Testar ./actions
        </button>

        <button
          onClick={async () => {
            try {
              const mod = await import("@/app/dashboard/organization-context");
              setErrors((prev) => [...prev, `✅ org-context carregado: ${Object.keys(mod).join(", ")}`]);
            } catch (e) {
              setErrors((prev) => [...prev, `❌ org-context falhou: ${(e as Error).message}`]);
            }
          }}
          style={{ padding: "8px 16px", margin: 4, cursor: "pointer" }}
        >
          Testar organization-context
        </button>
      </div>

      <p style={{ marginTop: 40, color: "#666", fontSize: 12 }}>
        Se esta página renderiza mas o /dashboard não, o problema está nos componentes do dashboard (shell.tsx, page.tsx, etc).
      </p>
    </div>
  );
}