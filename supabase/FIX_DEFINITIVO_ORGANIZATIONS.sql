-- =============================================================================
-- BARBER-ON QA: FIX DEFINITIVO - PERMISSÃO DE CRIAÇÃO (SEM BLOQUEIO)
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
-- =============================================================================

-- 1. Garantir permissões totais para o usuário logado
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.organizations TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.barbershop_settings TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.memberships TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO authenticated;

-- 2. Desativar RLS temporariamente para garantir a inserção dos dados iniciais
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships DISABLE ROW LEVEL SECURITY;

-- 3. Inserir os dados iniciais (Seed)
INSERT INTO public.organizations (id, name, slug, created_by)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', 'Barber On Studio', 'barber-on-studio', '6d73f153-5058-4849-8555-0d2948302b6c')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.barbershop_settings (organization_id, public_slug, shop_name, booking_enabled)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', 'barber-on-studio', 'Barber On Studio', true)
ON CONFLICT (public_slug) DO NOTHING;

INSERT INTO public.memberships (organization_id, user_id, role, status)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', '6d73f153-5058-4849-8555-0d2948302b6c', 'OWNER', 'active')
ON CONFLICT DO NOTHING;

-- 4. Reativar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas PERMISSIVAS para qualquer usuário autenticado
-- Isso permite que qualquer pessoa logada crie uma organização
DROP POLICY IF EXISTS "any_auth_create_org" ON public.organizations;
CREATE POLICY "any_auth_create_org" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (true);

-- Permite que o dono gerencie a organização depois de criada
DROP POLICY IF EXISTS "users_manage_own_orgs" ON public.organizations;
CREATE POLICY "users_manage_own_orgs" ON public.organizations
FOR ALL TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Políticas para as outras tabelas
DROP POLICY IF EXISTS "users_manage_own_settings" ON public.barbershop_settings;
CREATE POLICY "users_manage_own_settings" ON public.barbershop_settings
FOR ALL TO authenticated
USING (organization_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid()))
WITH CHECK (organization_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid()));

DROP POLICY IF EXISTS "users_manage_own_memberships" ON public.memberships;
CREATE POLICY "users_manage_own_memberships" ON public.memberships
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Políticas de leitura pública (para o site funcionar)
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

-- =============================================================================
-- APÓS EXECUTAR: Atualize a página do dashboard e tente criar a organização.
-- =============================================================================