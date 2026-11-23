// =============================================================================
// Barber-On Studio — Health Check Endpoint
// =============================================================================
// Usado por Uptime Robot, Vercel probes, ou dashboards internos.
// Retorna status dos serviços críticos: DB, Auth, APIs externas.
// =============================================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime_seconds: number;
  checks: Record<string, {
    status: "up" | "down" | "slow";
    latency_ms?: number;
    error?: string;
  }>;
  version?: string;
}

const startTime = Date.now();

async function checkDatabase(): Promise<{ status: "up" | "down" | "slow"; latency_ms?: number; error?: string }> {
  const start = Date.now();
  try {
    // Import dinâmico para evitar dependência circular
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Query simples para verificar conectividade
    const { error } = await supabase.from("organizations").select("id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      return { status: "down", latency_ms: latency, error: error.message };
    }

    return {
      status: latency > 1000 ? "slow" : "up",
      latency_ms: latency
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function checkSupabaseAuth(): Promise<{ status: "up" | "down" | "slow"; latency_ms?: number; error?: string }> {
  const start = Date.now();
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Verificar se o auth está respondendo (mesmo sem sessão)
    const { error } = await supabase.auth.getSession();
    const latency = Date.now() - start;

    // getSession retorna null session quando não logado, mas não erro de conexão
    if (error && !error.message.includes("session")) {
      return { status: "down", latency_ms: latency, error: error.message };
    }

    return {
      status: latency > 1000 ? "slow" : "up",
      latency_ms: latency
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function GET(request: Request): Promise<Response> {
  // Opcional: proteger com token para evitar exposição pública
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.HEALTH_CHECK_TOKEN;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    // Se token configurado mas não fornecido, retornar apenas status básico
    return Response.json({ status: "ok" }, { status: 200 });
  }

  // Executar checks em paralelo
  const [dbCheck, authCheck] = await Promise.all([
    checkDatabase(),
    checkSupabaseAuth(),
  ]);

  // Determinar status geral
  const checks = { database: dbCheck, auth: authCheck };
  const hasDown = Object.values(checks).some(c => c.status === "down");
  const hasSlow = Object.values(checks).some(c => c.status === "slow");

  let overallStatus: HealthCheckResult["status"] = "healthy";
  if (hasDown) overallStatus = "unhealthy";
  else if (hasSlow) overallStatus = "degraded";

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  };

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;

  return Response.json(result, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}