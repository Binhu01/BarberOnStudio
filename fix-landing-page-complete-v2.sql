-- =============================================================================
-- Fix COMPLETO v2: Landing Page — Profissionais + Horários (09:00–19:00)
--
-- CORREÇÃO: Drop explícito de TODAS as policies possíveis antes de recriar
-- O erro anterior ocorreu porque memberships_select_for_members (da v2)
-- não estava sendo removida antes de criar memberships_select
--
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- =============================================================================

-- ============================================================
-- 1. Garantir que is_member_of é plpgsql (anti-recursão)
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
-- 2. Remover TODAS as policies de memberships (nome por nome)
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
DROP POLICY IF EXISTS "memberships_public_read" ON memberships;

-- Safety net: drop ANY remaining policy on memberships
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'memberships'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON memberships', pol.policyname);
  END LOOP;
END $$;

-- ============================================================
-- 3. Criar policies limpas
-- ============================================================

-- PÚBLICA: qualquer pessoa (anon) pode ver membros ativos
CREATE POLICY "memberships_public_read"
  ON memberships FOR SELECT
  USING (status = 'active');

-- AUTENTICADO: membros podem ver outros membros da mesma org
CREATE POLICY "memberships_select"
  ON memberships FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id)
    OR user_id = auth.uid()
  );

-- INSERT
CREATE POLICY "memberships_insert"
  ON memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
  );

-- UPDATE
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

-- DELETE
CREATE POLICY "memberships_delete"
  ON memberships FOR DELETE
  TO authenticated
  USING (
    get_user_role_in_org(organization_id, auth.uid()) IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- 4. Organizations — policy pública para landing page
-- ============================================================
DROP POLICY IF EXISTS "Public can view organizations" ON organizations;
DROP POLICY IF EXISTS "organizations_public_read" ON organizations;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'organizations' AND policyname LIKE '%public%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON organizations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "organizations_public_read"
  ON organizations FOR SELECT
  USING (true);

-- ============================================================
-- 5. Profiles — policy pública para landing page
-- ============================================================
DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND policyname LIKE '%public%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_public_read"
  ON profiles FOR SELECT
  USING (true);

-- ============================================================
-- 6. barber_services — garantir que serviços estão ativos
-- ============================================================
UPDATE barber_services SET is_active = true WHERE is_active IS NULL;

-- ============================================================
-- 7. barber_schedules — seed dinâmico para TODOS os barbeiros ativos
-- ============================================================
DO $$
DECLARE
  v_membership RECORD;
  v_day INT;
  v_exists BOOLEAN;
BEGIN
  FOR v_membership IN
    SELECT m.id AS membership_id, m.organization_id
    FROM memberships m
    WHERE m.status = 'active'
      AND m.role IN ('EMPLOYEE', 'MANAGER', 'OWNER', 'ADMIN')
  LOOP
    FOR v_day IN 0..6 LOOP
      SELECT EXISTS (
        SELECT 1 FROM barber_schedules
        WHERE membership_id = v_membership.membership_id
          AND day_of_week = v_day
      ) INTO v_exists;

      IF NOT v_exists THEN
        IF v_day = 0 THEN
          INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, is_working_day)
          VALUES (v_membership.organization_id, v_membership.membership_id, v_day, '09:00', '19:00', false);
        ELSIF v_day IN (5, 6) THEN
          INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, is_working_day)
          VALUES (v_membership.organization_id, v_membership.membership_id, v_day, '09:00', '20:00', true);
        ELSE
          INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, is_working_day)
          VALUES (v_membership.organization_id, v_membership.membership_id, v_day, '09:00', '19:00', true);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Schedules criados/atualizados para todos os membros ativos';
END $$;

-- ============================================================
-- 8. Validação final
-- ============================================================
SELECT 'memberships policies' AS check_item,
       string_agg(policyname, ', ' ORDER BY policyname) AS status
FROM pg_policies WHERE tablename = 'memberships'
UNION ALL
SELECT 'organizations public policy',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'organizations_public_read'
       ) THEN '✅ exists' ELSE '❌ MISSING' END
UNION ALL
SELECT 'profiles public policy',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_public_read'
       ) THEN '✅ exists' ELSE '❌ MISSING' END
UNION ALL
SELECT 'is_member_of language',
       CASE WHEN prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
            THEN '✅ plpgsql' ELSE '❌ NOT plpgsql' END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_member_of' AND n.nspname = 'public'
UNION ALL
SELECT 'barber_schedules count',
       (SELECT COUNT(*)::TEXT || ' schedules' FROM barber_schedules WHERE is_working_day = true)
UNION ALL
SELECT 'active services count',
       (SELECT COUNT(*)::TEXT || ' services' FROM barber_services WHERE is_active = true)
UNION ALL
SELECT 'active memberships count',
       (SELECT COUNT(*)::TEXT || ' members' FROM memberships WHERE status = 'active');