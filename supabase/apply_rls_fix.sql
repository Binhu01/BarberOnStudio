-- =============================================================================
-- BARBER-ON QA: Aplicar TODAS as políticas de RLS com ENABLE ROW LEVEL SECURITY
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql
-- =============================================================================

-- 1. Organizações
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read organizations" ON organizations;
CREATE POLICY "Public can read organizations" ON organizations FOR SELECT USING (true);

-- 2. Configurações da barbearia
ALTER TABLE barbershop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON barbershop_settings;
CREATE POLICY "Public can read barbershop_settings" ON barbershop_settings FOR SELECT USING (true);

-- 3. Serviços ativos
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read barber_services" ON barber_services;
CREATE POLICY "Public can read barber_services" ON barber_services FOR SELECT USING (is_active = true);

-- 4. Perfis de funcionários disponíveis
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON employee_profiles;
CREATE POLICY "Public can read available employee_profiles" ON employee_profiles FOR SELECT USING (is_available_for_booking = true);

-- 5. Memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active memberships" ON memberships;
CREATE POLICY "Public can read active memberships" ON memberships FOR SELECT USING (status = 'active');

-- 6. Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read profiles" ON profiles;
CREATE POLICY "Public can read profiles" ON profiles FOR SELECT USING (true);

-- Verificar aplicação
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles', 'memberships', 'profiles')
ORDER BY tablename, policyname;