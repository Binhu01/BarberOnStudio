-- =============================================================================
-- BARBER-ON QA: FIX FINAL (ADMIN + RLS + DADOS)
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
-- =============================================================================

-- 1. Garantir permissões básicas de SELECT para o usuário 'anon' (Correção do Erro 42501/404)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT ON public.barbershop_settings TO anon;
GRANT SELECT ON public.barber_services TO anon;
GRANT SELECT ON public.employee_profiles TO anon;
GRANT SELECT ON public.memberships TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.public_bookings TO anon;

-- 2. Habilitar RLS em todas as tabelas (se ainda não estiver)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_bookings ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de leitura pública limpas
DROP POLICY IF EXISTS "anon_select_all" ON public.organizations;
CREATE POLICY "anon_select_all" ON public.organizations FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_select_all" ON public.barbershop_settings;
CREATE POLICY "anon_select_all" ON public.barbershop_settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_select_all" ON public.barber_services;
CREATE POLICY "anon_select_all" ON public.barber_services FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "anon_select_all" ON public.employee_profiles;
CREATE POLICY "anon_select_all" ON public.employee_profiles FOR SELECT TO anon USING (is_available_for_booking = true);

DROP POLICY IF EXISTS "anon_select_all" ON public.memberships;
CREATE POLICY "anon_select_all" ON public.memberships FOR SELECT TO anon USING (status = 'active');

DROP POLICY IF EXISTS "anon_select_all" ON public.profiles;
CREATE POLICY "anon_select_all" ON public.profiles FOR SELECT TO anon USING (true);

-- 4. Corrigir/Administrar o Usuário (Senha: Admin@123456)
-- Nota: A criação de usuários via SQL é bloqueada por padrão no Supabase.
-- Você deve definir a senha pelo menu Authentication > Users > Edit User se ainda não conseguiu logar.
-- Este passo garante que o registro na tabela 'profiles' exista.
INSERT INTO public.profiles (id, full_name, email)
VALUES ('6d73f153-5058-4849-8555-0d2948302b6c', 'Administrador QA', 'glaubercavalcanti04@gmail.com')
ON CONFLICT (id) DO UPDATE SET full_name = 'Administrador QA';

-- 5. Corrigir o vínculo de Membership (O erro que o script JS estava dando)
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Pega o ID da organização 'barber-on-studio'
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'barber-on-studio' LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        -- Tenta inserir o vínculo se não existir
        INSERT INTO public.memberships (organization_id, user_id, role, status)
        VALUES (v_org_id, '6d73f153-5058-4849-8555-0d2948302b6c', 'OWNER', 'active')
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Vínculo de administrador verificado para a organização: %', v_org_id;
    ELSE
        RAISE NOTICE 'Organização barber-on-studio não encontrada. Execute o seed de dados primeiro.';
    END IF;
END $$;

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Vá em Authentication > Users, edite o usuário glaubercavalcanti04@gmail.com e defina a senha "Admin@123456".
-- 2. Acesse http://localhost:3000/agendar/barber-on-studio (Deve carregar sem erros).
-- 3. Tente logar no dashboard com a nova senha.
-- =============================================================================