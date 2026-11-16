-- =============================================================================
-- Script: Adicionar barbeiros Ruan e Lucas à Barber-On Studio
-- Executar no Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Criar profiles para os barbeiros (sem autenticação, apenas dados públicos)
INSERT INTO profiles (id, full_name) VALUES
  (gen_random_uuid(), 'Ruan'),
  (gen_random_uuid(), 'Lucas');

-- 2. Adicionar como membros ativos da organização com role BARBER
-- O organization_id é fixo: 9f912f7c-4360-4763-b274-de60c2b98b9a
INSERT INTO memberships (user_id, organization_id, role, status)
SELECT p.id, '9f912f7c-4360-4763-b274-de60c2b98b9a', 'BARBER', 'active'
FROM profiles p
WHERE p.full_name IN ('Ruan', 'Lucas')
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = p.id
      AND m.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
  );

-- 3. (Opcional) Remover o administrador da lista pública de barbeiros
-- O admin permanece no sistema com acesso ao dashboard, mas não aparece na landing
UPDATE memberships
SET status = 'inactive'
WHERE user_id = '2a98cfc0-f218-4ea5-a58c-d837e51531ba'
  AND organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
  AND role = 'OWNER';

-- Verificação: listar barbeiros ativos da organização
SELECT p.full_name, m.role, m.status
FROM memberships m
JOIN profiles p ON p.id = m.user_id
WHERE m.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
  AND m.status = 'active'
ORDER BY p.full_name;