-- =============================================================================
-- BARBER-ON QA: FIX DEFINITIVO - PERMISSÃO DE CRIAÇÃO DE ORGANIZAÇÃO
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
-- =============================================================================

-- 1. Garantir permissões de esquema e tabela para o usuário logado (authenticated)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.organizations TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.barbershop_settings TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.memberships TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO authenticated;

-- 2. Habilitar RLS (Row Level Security) se ainda não estiver ativo
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Criar política que permite QUALQUER usuário autenticado criar organizações
-- Isso resolve o erro "permission denied" imediatamente
DROP POLICY IF EXISTS "authenticated_create_orgs" ON public.organizations;
CREATE POLICY "authenticated_create_orgs" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (true);

-- Política para que o criador possa gerenciar a organização depois
DROP POLICY IF EXISTS "users_manage_own_orgs" ON public.organizations;
CREATE POLICY "users_manage_own_orgs" ON public.organizations
FOR ALL TO authenticated
USING (auth.uid() = created_by OR auth.uid() IN (SELECT user_id FROM public.memberships WHERE organization_id = id AND role = 'OWNER'))
WITH CHECK (auth.uid() = created_by);

-- 4. Políticas para as tabelas relacionadas
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

-- 5. Seed dos dados iniciais (Garante que a organização base exista)
INSERT INTO public.organizations (id, name, slug, created_by)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', 'Barber On Studio', 'barber-on-studio', '6d73f153-5058-4849-8555-0d2948302b6c')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.barbershop_settings (organization_id, public_slug, shop_name, booking_enabled)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', 'barber-on-studio', 'Barber On Studio', true)
ON CONFLICT (public_slug) DO NOTHING;

INSERT INTO public.memberships (organization_id, user_id, role, status)
VALUES ('54f8c7ce-6bc1-40eb-b069-fcc71174ec07', '6d73f153-5058-4849-8555-0d2948302b6c', 'OWNER', 'active')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- APÓS EXECUTAR: Atualize a página do dashboard e clique em "Criar organização".
-- =============================================================================