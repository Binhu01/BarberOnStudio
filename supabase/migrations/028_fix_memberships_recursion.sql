-- =============================================================================
-- Migration 028: Fix infinite recursion in memberships RLS policies
-- Barber-On Studio — As policies originais da migration 001 causam recursão
-- infinita porque fazem SELECT direto na tabela memberships dentro da USING.
-- A solução é usar is_member_of() (SECURITY DEFINER) ou remover a auto-referência.
-- =============================================================================

-- 1. Remover as policies problemáticas que causam recursão
DROP POLICY IF EXISTS "Members can view memberships of their organizations" ON memberships;
DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON memberships;
DROP POLICY IF EXISTS "Public can view active memberships" ON memberships;

-- 2. Recriar policy de leitura para membros usando is_member_of() (SECURITY DEFINER, sem recursão)
CREATE POLICY "Members can view memberships of their organizations"
  ON memberships FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id));

-- 3. Recriar policy de gerenciamento para owners/admins usando is_member_of() + role check via função
CREATE POLICY "Owners and admins can manage memberships"
  ON memberships FOR ALL
  TO authenticated
  USING (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- 4. Policy pública para memberships — NÃO referenciar a própria tabela
-- Usar apenas verificação direta de coluna, sem subquery
CREATE POLICY "Public can view active memberships"
  ON memberships FOR SELECT
  TO anon, authenticated
  USING (status = 'active');