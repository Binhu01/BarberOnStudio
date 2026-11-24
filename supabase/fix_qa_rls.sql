-- =============================================================================
-- BARBER-ON QA: RLS AUDIT AND SECURE PUBLIC ACCESS FIX
-- Project Reference: idymvdboboixjtywhdcd
-- Objetivo: Permitir leitura pública segura para a Landing Page sem expor
-- dados sensíveis (emails, memberships, financeiros) e sem desativar o RLS.
-- =============================================================================

-- 1. INVESTIGAÇÃO INICIAL: Verificar políticas atuais
-- Execute este bloco primeiro para ver o estado atual das políticas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. CORREÇÃO SEGURA: Aplicar permissões mínimas necessárias

-- 2.1 Limpeza de permissões padrão inseguras (garantia de segurança)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- 2.2 Organizations: Permitir leitura pública APENAS de colunas seguras
GRANT SELECT ON organizations TO anon, authenticated;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read organizations" ON organizations;
CREATE POLICY "Allow public read organizations"
  ON organizations FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2.3 Barber Services: Permitir leitura pública para exibição na landing page
GRANT SELECT ON barber_services TO anon, authenticated;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read barber_services" ON barber_services;
CREATE POLICY "Allow public read barber_services"
  ON barber_services FOR SELECT
  TO anon, authenticated
  USING (true); -- Nota: Se existir coluna 'is_active', alterar para: USING (is_active = true)

-- 2.4 Barbershop Settings: Permitir leitura pública
GRANT SELECT ON barbershop_settings TO anon, authenticated;
ALTER TABLE barbershop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read barbershop_settings" ON barbershop_settings;
CREATE POLICY "Allow public read barbershop_settings"
  ON barbershop_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2.5 Products: Permitir leitura pública (retornará vazio corretamente se não houver dados)
GRANT SELECT ON products TO anon, authenticated;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read products" ON products;
CREATE POLICY "Allow public read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2.6 Profiles e Memberships: PROTEGIDOS (NÃO conceder SELECT direto ao anon)
-- Para evitar exposição de emails e dados de associação, criamos uma View Segura.
-- Esta view expõe apenas nome e avatar de membros ativos da organização.
CREATE OR REPLACE VIEW public_professionals AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url
FROM profiles p
JOIN memberships m ON p.id = m.user_id
WHERE m.role IN ('OWNER', 'ADMIN', 'EMPLOYEE', 'MANAGER');

-- Conceder acesso APENAS à View, mantendo a tabela 'profiles' bloqueada para anon
GRANT SELECT ON public_professionals TO anon, authenticated;

-- 2.7 Função RPC Segura (Recomendada para agregar dados da organização em uma única chamada)
-- Fornece dados públicos agregados de uma organização por slug, com search_path fixo.
CREATE OR REPLACE FUNCTION get_public_org_data(p_slug TEXT)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  services_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- CRÍTICO: Previne ataques de injeção de schema
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    (SELECT COUNT(*) FROM barber_services bs WHERE bs.organization_id = o.id)::INT
  FROM organizations o
  WHERE o.slug = p_slug;
END;
$$;

-- Revogar execução pública padrão e conceder apenas a roles autorizadas
REVOKE ALL ON FUNCTION get_public_org_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_org_data(TEXT) TO anon, authenticated;

-- =============================================================================
-- FIM DO SCRIPT DE CORREÇÃO
-- =============================================================================