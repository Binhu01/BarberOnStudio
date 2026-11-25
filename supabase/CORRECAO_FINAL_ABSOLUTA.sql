-- =============================================================================
-- BARBER-ON QA: CORREÇÃO FINAL ABSOLUTA DO ERRO 42501
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
--
-- Este script garante a concessão de permissões de SELECT e a criação de
-- políticas de RLS para o usuário 'anon' em todas as tabelas necessárias.
-- =============================================================================

-- 1. Conceder permissão de USO no esquema público
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Conceder permissão EXPLÍCITA de SELECT em todas as tabelas necessárias
-- Esta etapa é crucial e frequentemente esquecida ao configurar o RLS.
GRANT SELECT ON public.organizations TO anon, authenticated;
GRANT SELECT ON public.barbershop_settings TO anon, authenticated;
GRANT SELECT ON public.barber_services TO anon, authenticated;
GRANT SELECT ON public.employee_profiles TO anon, authenticated;
GRANT SELECT ON public.memberships TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.public_bookings TO anon, authenticated;

-- 3. Habilitar RLS em todas as tabelas (garante que as políticas sejam avaliadas)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_bookings ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Public can read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow public read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Public can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;

DROP POLICY IF EXISTS "Public can read barbershop_settings" ON public.barbershop_settings;
DROP POLICY IF EXISTS "Allow public read barbershop_settings" ON public.barbershop_settings;
DROP POLICY IF EXISTS "Public can view barbershop settings" ON public.barbershop_settings;

DROP POLICY IF EXISTS "Public can read barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Allow public read barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Public can view active barber services" ON public.barber_services;

DROP POLICY IF EXISTS "Public can read available employee_profiles" ON public.employee_profiles;
DROP POLICY IF EXISTS "Members can view employee profiles" ON public.employee_profiles;

DROP POLICY IF EXISTS "Public can read active memberships" ON public.memberships;
DROP POLICY IF EXISTS "Public can view active memberships" ON public.memberships;

DROP POLICY IF EXISTS "Public can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;

-- 5. Criar políticas novas e limpas para o papel 'anon'
CREATE POLICY "anon_select_organizations" ON public.organizations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_barbershop_settings" ON public.barbershop_settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_barber_services" ON public.barber_services FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "anon_select_employee_profiles" ON public.employee_profiles FOR SELECT TO anon USING (is_available_for_booking = true);
CREATE POLICY "anon_select_memberships" ON public.memberships FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "anon_select_profiles" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_public_bookings" ON public.public_bookings FOR SELECT TO anon USING (true);

-- 6. Verificação: deve retornar 7 linhas com roles = {anon}
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles', 'memberships', 'profiles', 'public_bookings')
 AND roles = '{anon}'
ORDER BY tablename;

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Aguarde 2-3 segundos.
-- 2. Acesse http://localhost:3000/agendar/barber-on-studio
-- 3. A página deve carregar sem o erro 42501.
-- =============================================================================