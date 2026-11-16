-- =============================================================================
-- Script: Adicionar barbeiros Ruan e Lucas à Barber-On Studio
-- Executar no Supabase Dashboard → SQL Editor
-- =============================================================================

-- A tabela profiles tem FK para auth.users(id) e exige email NOT NULL.
-- Precisamos criar os usuários no auth primeiro, depois inserir os profiles.

-- 1. Criar usuários no Supabase Auth (sem senha, apenas email placeholder)
-- Se já existirem, o INSERT será ignorado pelo ON CONFLICT
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'ruan@barberon.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'lucas@barberon.local', '', now(), now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- 2. Criar profiles vinculados aos usuários auth
INSERT INTO profiles (id, full_name, email)
SELECT u.id,
       CASE WHEN u.email = 'ruan@barberon.local' THEN 'Ruan'
            WHEN u.email = 'lucas@barberon.local' THEN 'Lucas'
       END,
       u.email
FROM auth.users u
WHERE u.email IN ('ruan@barberon.local', 'lucas@barberon.local')
ON CONFLICT (id) DO NOTHING;

-- 3. Adicionar como membros ativos da organização com role BARBER
INSERT INTO memberships (user_id, organization_id, role, status)
SELECT p.id, '9f912f7c-4360-4763-b274-de60c2b98b9a', 'BARBER', 'active'
FROM profiles p
WHERE p.email IN ('ruan@barberon.local', 'lucas@barberon.local')
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = p.id
      AND m.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
  );

-- 4. Desativar o administrador da lista pública de barbeiros
-- O admin permanece no sistema com acesso ao dashboard, mas não aparece na landing
UPDATE memberships
SET status = 'inactive'
WHERE user_id = '2a98cfc0-f218-4ea5-a58c-d837e51531ba'
  AND organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a';

-- 5. Verificação: listar barbeiros ativos da organização
SELECT p.full_name, p.email, m.role, m.status
FROM memberships m
JOIN profiles p ON p.id = m.user_id
WHERE m.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
  AND m.status = 'active'
ORDER BY p.full_name;