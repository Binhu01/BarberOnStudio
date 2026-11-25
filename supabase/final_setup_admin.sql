-- =============================================================================
-- BARBER-ON QA: CONFIGURAÇÃO FINAL DE PERMISSÕES E CRIAÇÃO DE ADMIN
-- Project Reference: idymvdboboixjtywhdcd
-- =============================================================================

-- 1. GARANTIR PERMISSÕES TOTAIS PARA service_role (Necessário para scripts e API interna)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Garantir permissões futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 2. GARANTIR PERMISSÕES DE LEITURA PÚBLICA (Para a Landing Page funcionar)
GRANT SELECT ON organizations TO anon, authenticated;
GRANT SELECT ON barber_services TO anon, authenticated;
GRANT SELECT ON barbershop_settings TO anon, authenticated;
GRANT SELECT ON products TO anon, authenticated;

-- 3. CRIAR ORGANIZAÇÃO "Barber On Studio"
-- Usamos created_by com o ID do usuário que criaremos a seguir
INSERT INTO organizations (name, slug, created_by)
VALUES ('Barber On Studio', 'barber-on-studio', '6d73f153-5058-4849-8555-0d2948302b6c'::UUID)
ON CONFLICT (slug) DO NOTHING;

-- 4. ATUALIZAR PERFIL DO USUÁRIO ADMIN
-- O usuário já existe no Auth (ID: 6d73f153-5058-4849-8555-0d2948302b6c)
INSERT INTO profiles (id, full_name, email)
VALUES ('6d73f153-5058-4849-8555-0d2948302b6c'::UUID, 'Administrador QA', 'admin.barberon.qa@gmail.com')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

-- 5. ASSOCIAR USUÁRIO COMO OWNER DA ORGANIZAÇÃO
DO $$
DECLARE
 org_id UUID;
 user_id UUID := '6d73f153-5058-4849-8555-0d2948302b6c'::UUID;
BEGIN
 SELECT id INTO org_id FROM organizations WHERE slug = 'barber-on-studio' LIMIT 1;
 IF org_id IS NOT NULL THEN
 INSERT INTO memberships (organization_id, user_id, role, status)
 VALUES (org_id, user_id, 'OWNER', 'active')
 ON CONFLICT DO NOTHING;
 END IF;
END $$;

-- =============================================================================
-- FIM DO SCRIPT - Execute este bloco inteiro no SQL Editor do Supabase
-- =============================================================================