-- =============================================================================
-- Fix V2: Eliminar recursão infinita em memberships RLS policies
--
-- CAUSA RAIZ: A migration 028 removeu policies antigas mas recriou a policy
-- "Owners and admins can manage memberships" com EXISTS (SELECT 1 FROM memberships m ...)
-- dentro do USING/WITH CHECK. Isso causa recursão porque PostgreSQL avalia
-- a policy → consulta memberships → dispara a mesma policy → loop infinito.
--
-- SOLUÇÃO: Substituir TODAS as policies de memberships por versões que NÃO
-- fazem subquery na própria tabela. Usar apenas is_member_of() (SECURITY DEFINER
-- que bypassa RLS) para verificar pertencimento, e uma função auxiliar
-- get_user_role_in_org() também SECURITY DEFINER para verificar role sem recursão.
--
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Criar função auxiliar para verificar role SEM disparar RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_role_in_org(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM memberships
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND status = 'active'
  LIMIT 1;
$$;

-- 2. Remover TODAS as policies existentes em memberships
DROP POLICY IF EXISTS "Members can view memberships of their organizations" ON memberships;
DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON memberships;
DROP POLICY IF EXISTS "Public can view active memberships" ON memberships;
DROP POLICY IF EXISTS "Users can insert own membership on org creation" ON memberships;
DROP POLICY IF EXISTS "memberships_select" ON memberships;
DROP POLICY IF EXISTS "memberships_insert" ON memberships;
DROP POLICY IF EXISTS "memberships_update" ON memberships;
DROP POLICY IF EXISTS "memberships_delete" ON memberships;

-- 3. Policy de LEITURA: membros ativos podem ver outros membros da mesma org
-- is_member_of() é SECURITY DEFINER → não dispara RLS → sem recursão
CREATE POLICY "memberships_select_for_members"
  ON memberships FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id)
    OR user_id = auth.uid()
  );

-- 4. Policy de INSERT: usuário autenticado pode inserir seu próprio membership
-- (necessário durante criação de organização — primeiro membro OWNER)
-- Também permite owners/admins inserirem outros membros via get_user_role_in_org()
CREATE POLICY "memberships_insert_own_or_by_admin"
  ON memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
  );

-- 5. Policy de UPDATE: owners/admins podem gerenciar membros
-- get_user_role_in_org() é SECURITY DEFINER → não dispara RLS → sem recursão
CREATE POLICY "memberships_update_by_admin"
  ON memberships FOR UPDATE
  TO authenticated
  USING (
    get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
    OR user_id = auth.uid()
  );

-- 6. Policy de DELETE: apenas owners/admins
CREATE POLICY "memberships_delete_by_admin"
  ON memberships FOR DELETE
  TO authenticated
  USING (
    get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
  );

-- 7. Validação: listar policies ativas em memberships
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'memberships'
ORDER BY policyname;