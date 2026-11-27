-- =============================================================================
-- BARBER-ON QA: Fix COMPLETO de RLS para página de agendamento público
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql
-- =============================================================================

-- 1. Organizações - leitura pública
DROP POLICY IF EXISTS "Public can read organizations" ON organizations;
CREATE POLICY "Public can read organizations" ON organizations FOR SELECT USING (true);

-- 2. Configurações da barbearia - leitura pública
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON barbershop_settings;
CREATE POLICY "Public can read barbershop_settings" ON barbershop_settings FOR SELECT USING (true);

-- 3. Serviços ativos - leitura pública
DROP POLICY IF EXISTS "Public can read barber_services" ON barber_services;
CREATE POLICY "Public can read barber_services" ON barber_services FOR SELECT USING (is_active = true);

-- 4. Perfis de funcionários disponíveis - leitura pública
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON employee_profiles;
CREATE POLICY "Public can read available employee_profiles" ON employee_profiles FOR SELECT USING (is_available_for_booking = true);

-- 5. Memberships - leitura pública para perfis de barbeiros (NOVO)
DROP POLICY IF EXISTS "Public can read active memberships" ON memberships;
CREATE POLICY "Public can read active memberships" ON memberships FOR SELECT USING (status = 'active');

-- 6. Profiles - leitura pública para nomes dos barbeiros (NOVO)
DROP POLICY IF EXISTS "Public can read profiles" ON profiles;
CREATE POLICY "Public can read profiles" ON profiles FOR SELECT USING (true);

-- Verificar todas as políticas aplicadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles', 'memberships', 'profiles')
ORDER BY tablename, policyname;