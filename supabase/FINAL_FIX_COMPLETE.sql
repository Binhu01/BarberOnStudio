-- =============================================================================
-- BARBER-ON QA: FIX FINAL COMPLETO (DADOS + PERMISSÕES + ADMIN)
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
-- =============================================================================

-- PARTE 1: GARANTIR DADOS EXISTAM
-- 1.1 Criar organização se não existir
INSERT INTO public.organizations (id, name, slug, created_by)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', 'Barber On Studio', 'barber-on-studio', '6d73f153-5058-4849-8555-0d2948302b6c')
ON CONFLICT (slug) DO NOTHING;

-- 1.2 Criar configurações da barbearia se não existir
INSERT INTO public.barbershop_settings (organization_id, public_slug, shop_name, booking_enabled)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', 'barber-on-studio', 'Barber On Studio', true)
ON CONFLICT (public_slug) DO NOTHING;

-- PARTE 2: PERMISSÕES PÚBLICAS (CORREÇÃO ERRO 42501/404)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.organizations TO anon, authenticated;
GRANT SELECT ON public.barbershop_settings TO anon, authenticated;
GRANT SELECT ON public.barber_services TO anon, authenticated;
GRANT SELECT ON public.employee_profiles TO anon, authenticated;
GRANT SELECT ON public.memberships TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_orgs" ON public.organizations;
CREATE POLICY "anon_read_orgs" ON public.organizations FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_settings" ON public.barbershop_settings;
CREATE POLICY "anon_read_settings" ON public.barbershop_settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_services" ON public.barber_services;
CREATE POLICY "anon_read_services" ON public.barber_services FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "anon_read_employees" ON public.employee_profiles;
CREATE POLICY "anon_read_employees" ON public.employee_profiles FOR SELECT TO anon USING (is_available_for_booking = true);

DROP POLICY IF EXISTS "anon_read_memberships" ON public.memberships;
CREATE POLICY "anon_read_memberships" ON public.memberships FOR SELECT TO anon USING (status = 'active');

DROP POLICY IF EXISTS "anon_read_profiles" ON public.profiles;
CREATE POLICY "anon_read_profiles" ON public.profiles FOR SELECT TO anon USING (true);

-- PARTE 3: CONFIGURAR ADMINISTRADOR
-- 3.1 Garantir perfil na tabela profiles
INSERT INTO public.profiles (id, full_name, email)
VALUES ('6d73f153-5058-4849-8555-0d2948302b6c', 'Administrador QA', 'glaubercavalcanti04@gmail.com')
ON CONFLICT (id) DO UPDATE SET full_name = 'Administrador QA';

-- 3.2 Garantir vínculo de membership
INSERT INTO public.memberships (organization_id, user_id, role, status)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', '6d73f153-5058-4849-8555-0d2948302b6c', 'OWNER', 'active')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Vá em Authentication > Users no painel do Supabase.
-- 2. Encontre glaubercavalcanti04@gmail.com, clique em Edit User e defina a senha "Admin@123456".
-- 3. No terminal, execute: rm -rf .next && npm run dev
-- 4. Acesse http://localhost:3000/agendar/barber-on-studio (deve carregar).
-- 5. Tente logar no dashboard com a nova senha.
-- =============================================================================