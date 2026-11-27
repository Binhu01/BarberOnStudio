-- =============================================================================
-- BARBER-ON QA: CRIAR ADMIN E CORRIGIR PERMISSÕES
-- Project Reference: idymvdboboixjtywhdcd
-- Objetivo: Criar conta de administrador e garantir permissões de leitura
-- =============================================================================

-- 1. GARANTIR PERMISSÕES DE LEITURA PARA service_role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Garantir que anon e authenticated também tenham SELECT nas tabelas públicas
GRANT SELECT ON organizations TO anon, authenticated;
GRANT SELECT ON barber_services TO anon, authenticated;
GRANT SELECT ON barbershop_settings TO anon, authenticated;
GRANT SELECT ON products TO anon, authenticated;

-- 2. CRIAR ORGANIZAÇÃO (se não existir)
-- Adicionado created_by para satisfazer a constraint NOT NULL da tabela
INSERT INTO organizations (name, slug, created_by)
SELECT 'Barber On Studio', 'barber-on-studio', '6d73f153-5058-4849-8555-0d2948302b6c'::UUID
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'barber-on-studio');

-- 3. CRIAR PERFIL DO USUÁRIO ADMIN
-- O usuário já foi criado via API (ID: 6d73f153-5058-4849-8555-0d2948302b6c)
-- Agora vamos garantir que ele tenha um perfil na tabela profiles
INSERT INTO profiles (id, full_name, email)
VALUES ('6d73f153-5058-4849-8555-0d2948302b6c'::UUID, 'Administrador QA', 'admin.barberon.qa@gmail.com')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

-- 4. ASSOCIAR USUÁRIO COMO OWNER DA ORGANIZAÇÃO
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
-- FIM DO SCRIPT
-- =============================================================================