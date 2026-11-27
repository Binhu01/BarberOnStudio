import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service_role key para operações no servidor.
 * Bypassa RLS completamente — usar APENAS em server actions/rotas API
 * onde a autorização já foi validada pelo middleware.
 *
 * Retorna null se SUPABASE_SERVICE_ROLE_KEY não estiver configurada,
 * permitindo fallback graceful em vez de crash.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(
      "[admin] SUPABASE_SERVICE_ROLE_KEY não configurada — admin client indisponível"
    );
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Cria admin client ou lança erro descritivo.
 * Usar em contexts onde a ausência da chave é um erro fatal (ex: server actions).
 */
export function requireAdminClient(): SupabaseClient {
  const client = createAdminClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está configurada. Adicione esta variável de ambiente na Vercel."
    );
  }
  return client;
}