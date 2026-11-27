-- =============================================================================
-- BARBER-ON QA: SOLUÇÃO FINAL COM SECURITY DEFINER
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
--
-- Este script cria funções que bypassam o RLS usando SECURITY DEFINER,
-- executando com privilégios de superusuário do Supabase.
-- =============================================================================

-- 1. Criar schema para funções seguras
CREATE SCHEMA IF NOT EXISTS public_api;

-- 2. Função para buscar configurações da barbearia por slug
CREATE OR REPLACE FUNCTION public_api.get_barbershop_by_slug(p_slug TEXT)
RETURNS SETOF barbershop_settings
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM barbershop_settings WHERE public_slug = p_slug LIMIT 1;
$$;

-- 3. Função para listar serviços ativos
CREATE OR REPLACE FUNCTION public_api.get_public_services(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  duration_minutes INTEGER,
  price NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, name, description, duration_minutes, price
  FROM barber_services
  WHERE organization_id = p_org_id AND is_active = true
  ORDER BY display_order ASC;
$$;

-- 4. Função para listar barbeiros disponíveis
CREATE OR REPLACE FUNCTION public_api.get_public_barbers(p_org_id UUID)
RETURNS TABLE (
  membership_id UUID,
  name TEXT,
  bio TEXT,
  specialties TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ep.membership_id,
    p.full_name AS name,
    ep.bio,
    ep.specialties
  FROM employee_profiles ep
  JOIN memberships m ON m.id = ep.membership_id
  JOIN profiles p ON p.id = m.user_id
  WHERE ep.organization_id = p_org_id
    AND ep.is_available_for_booking = true
    AND m.status = 'active';
$$;

-- 5. Conceder permissão de execução para anon
GRANT USAGE ON SCHEMA public_api TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_api.get_barbershop_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_api.get_public_services(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_api.get_public_barbers(UUID) TO anon, authenticated;

-- 6. Verificação: testar as funções
SELECT 'Teste get_barbershop_by_slug:' AS teste;
SELECT * FROM public_api.get_barbershop_by_slug('barber-on-studio');

SELECT 'Teste get_public_services:' AS teste;
SELECT * FROM public_api.get_public_services(
  (SELECT id FROM organizations WHERE slug = 'barber-on-studio' LIMIT 1)
);

SELECT 'Teste get_public_barbers:' AS teste;
SELECT * FROM public_api.get_public_barbers(
  (SELECT id FROM organizations WHERE slug = 'barber-on-studio' LIMIT 1)
);

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Aguarde 2-3 segundos.
-- 2. Acesse http://localhost:3000/agendar/barber-on-studio
-- 3. A página deve carregar sem erro 42501.
-- =============================================================================