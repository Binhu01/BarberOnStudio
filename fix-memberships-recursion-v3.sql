-- =============================================================================
-- Fix V3 (DEFINITIVO): Eliminar recursão infinita em memberships RLS
--
-- CAUSA RAIZ CONFIRMADA: A função is_member_of() usa LANGUAGE sql.
-- O PostgreSQL pode INLINAR funções LANGUAGE sql dentro das policies,
-- e quando inlinada, o atributo SECURITY DEFINER é PERDIDO — a query
-- passa a executar com as permissões do chamador, disparando RLS
-- novamente na mesma tabela → recursão infinita.
--
-- SOLUÇÃO:
-- 1. Recriar is_member_of como LANGUAGE plpgsql (NÃO pode ser inlinado)
-- 2. Criar get_user_role_in_org como LANGUAGE plpgsql
-- 3. Remover TODAS as policies existentes em memberships
-- 4. Criar policies que NÃO fazem subquery direta na própria tabela
--
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- ============================================================
-- 1. Recriar is_member_of como plpgsql (impede inlining)
-- ============================================================
CREATE OR REPLACE FUNCTION is_member_of(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = p_org_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'
  );
END;
$$;

-- ============================================================
-- 2. Criar get_user_role_in_org como plpgsql
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role_in_org(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM memberships
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND status = 'active'
  LIMIT 1;
  RETURN v_role;
END;
$$;

-- ============================================================
-- 3. Remover TODAS as policies existentes em memberships
-- ============================================================
DROP POLICY IF EXISTS "Members can view memberships of their organizations" ON memberships;
DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON memberships;
DROP POLICY IF EXISTS "Public can view active memberships" ON memberships;
DROP POLICY IF EXISTS "Users can insert own membership on org creation" ON memberships;
DROP POLICY IF EXISTS "memberships_select" ON memberships;
DROP POLICY IF EXISTS "memberships_insert" ON memberships;
DROP POLICY IF EXISTS "memberships_update" ON memberships;
DROP POLICY IF EXISTS "memberships_delete" ON memberships;
DROP POLICY IF EXISTS "memberships_select_for_members" ON memberships;
DROP POLICY IF EXISTS "memberships_insert_own_or_by_admin" ON memberships;
DROP POLICY IF EXISTS "memberships_update_by_admin" ON memberships;
DROP POLICY IF EXISTS "memberships_delete_by_admin" ON memberships;

-- ============================================================
-- 4. Criar policies limpas SEM auto-referência
-- ============================================================

-- SELECT: membros podem ver outros membros da mesma org
-- is_member_of() é plpgsql + SECURITY DEFINER → não é inlinado → bypassa RLS
CREATE POLICY "memberships_select"
  ON memberships FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id)
    OR user_id = auth.uid()
  );

-- INSERT: usuário pode inserir seu próprio membership (org creation)
-- OU admin/owner pode inserir outros membros
CREATE POLICY "memberships_insert"
  ON memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
  );

-- UPDATE: admin/owner pode gerenciar, ou usuário pode atualizar próprio registro
CREATE POLICY "memberships_update"
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

-- DELETE: apenas admin/owner
CREATE POLICY "memberships_delete"
  ON memberships FOR DELETE
  TO authenticated
  USING (
    get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- 5. Validação
-- ============================================================
SELECT 'is_member_of language' AS check_item,
       CASE WHEN prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
            THEN '✅ plpgsql (correct)' ELSE '❌ NOT plpgsql' END AS status
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_member_of' AND n.nspname = 'public'
UNION ALL
SELECT 'get_user_role_in_org language',
       CASE WHEN prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
            THEN '✅ plpgsql (correct)' ELSE '❌ NOT plpgsql' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_user_role_in_org' AND n.nspname = 'public'
UNION ALL
SELECT 'memberships policies count',
       (SELECT COUNT(*)::TEXT || ' policies active' FROM pg_policies WHERE tablename = 'memberships')
UNION ALL
SELECT 'policy names',
       string_agg(policyname, ', ' ORDER BY policyname)
FROM pg_policies WHERE tablename = 'memberships';