-- =============================================================================
-- BARBER-ON QA: CORREÇÃO DEFINITIVA DO ERRO 42501 (permission denied)
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
--
-- IMPORTANTE: Execute TODAS as linhas abaixo de uma vez.
-- O erro 42501 ocorre porque o RLS precisa ser HABILITADO antes das políticas.
-- =============================================================================

-- Passo 1: Habilitar RLS em TODAS as tabelas necessárias
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Passo 2: Remover políticas antigas para recriar limpo
DROP POLICY IF EXISTS "Public can read organizations" ON organizations;
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON barbershop_settings;
DROP POLICY IF EXISTS "Public can read barber_services" ON barber_services;
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON employee_profiles;
DROP POLICY IF EXISTS "Public can read active memberships" ON memberships;
DROP POLICY IF EXISTS "Public can read profiles" ON profiles;

-- Passo 3: Criar políticas de SELECT para o papel 'anon' (acesso público)
CREATE POLICY "Public can read organizations"
 ON organizations FOR SELECT
 TO anon
 USING (true);

CREATE POLICY "Public can read barbershop_settings"
 ON barbershop_settings FOR SELECT
 TO anon
 USING (true);

CREATE POLICY "Public can read barber_services"
 ON barber_services FOR SELECT
 TO anon
 USING (is_active = true);

CREATE POLICY "Public can read available employee_profiles"
 ON employee_profiles FOR SELECT
 TO anon
 USING (is_available_for_booking = true);

CREATE POLICY "Public can read active memberships"
 ON memberships FOR SELECT
 TO anon
 USING (status = 'active');

CREATE POLICY "Public can read profiles"
 ON profiles FOR SELECT
 TO anon
 USING (true);

-- Passo 4: Verificação - execute esta query separadamente após rodar o script acima
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles', 'memberships', 'profiles')
ORDER BY tablename, policyname;

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Aguarde 2-3 segundos para o Supabase aplicar as mudanças
-- 2. Acesse http://localhost:3000/agendar/barber-on-studio
-- 3. A página deve carregar sem erro 42501 ou 500
-- =============================================================================