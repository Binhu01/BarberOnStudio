-- =============================================================================
-- BARBER-ON QA: CORREÇÃO FINAL E COMPLETA DO ERRO 42501
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
--
-- O erro 42501 persistia porque, além da política de RLS, o papel 'anon'
-- precisa da permissão básica de GRANT SELECT na tabela.
-- =============================================================================

-- 1. Garantir permissão de uso no esquema público
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Conceder permissão de SELECT explícita (O PASSO QUE ESTAVA FALTANDO)
GRANT SELECT ON public.organizations TO anon, authenticated;
GRANT SELECT ON public.barbershop_settings TO anon, authenticated;
GRANT SELECT ON public.barber_services TO anon, authenticated;
GRANT SELECT ON public.employee_profiles TO anon, authenticated;
GRANT SELECT ON public.memberships TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.public_bookings TO anon, authenticated;

-- 3. Habilitar RLS em todas as tabelas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_bookings ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas para evitar conflitos de nomes
DROP POLICY IF EXISTS "Public can read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON public.barbershop_settings;
DROP POLICY IF EXISTS "Public can read barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON public.employee_profiles;
DROP POLICY IF EXISTS "Public can read active memberships" ON public.memberships;
DROP POLICY IF EXISTS "Public can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow public read barbershop_settings" ON public.barbershop_settings;
DROP POLICY IF EXISTS "Allow public read barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Public can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Public can view barbershop settings" ON public.barbershop_settings;
DROP POLICY IF EXISTS "Public can view active barber services" ON public.barber_services;
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view active memberships" ON public.memberships;

-- 5. Criar políticas de SELECT limpas e definitivas para o papel 'anon'
CREATE POLICY "anon_select_organizations" ON public.organizations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_barbershop_settings" ON public.barbershop_settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_barber_services" ON public.barber_services FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "anon_select_employee_profiles" ON public.employee_profiles FOR SELECT TO anon USING (is_available_for_booking = true);
CREATE POLICY "anon_select_memberships" ON public.memberships FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "anon_select_profiles" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_public_bookings" ON public.public_bookings FOR SELECT TO anon USING (true);

-- 6. Verificação: deve retornar 7 linhas (uma para cada tabela com a política 'anon')
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles', 'memberships', 'profiles', 'public_bookings')
  AND roles = '{anon}'
ORDER BY tablename;

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Aguarde 2-3 segundos para o Supabase aplicar as mudanças.
-- 2. Acesse http://localhost:3000/agendar/barber-on-studio
-- 3. A página deve carregar sem o erro 42501.
-- =============================================================================