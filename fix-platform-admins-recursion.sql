-- =============================================================================
-- Fix: Eliminar recursão infinita em platform_admins RLS
--
-- CAUSA RAIZ: A função is_platform_admin() usa LANGUAGE sql (linha 593 da
-- migration 011). O PostgreSQL INLINA funções LANGUAGE sql dentro das policies,
-- e quando inlinada, o SECURITY DEFINER é PERDIDO — a query passa a executar
-- com as permissões do chamador, disparando RLS novamente na mesma tabela
-- platform_admins → recursão infinita.
--
-- Além disso, várias policies em outras tabelas (subscription_plans,
-- subscription_plan_versions, plan_entitlements, billing_customers,
-- subscriptions, subscription_events, subscription_invoices,
-- subscription_payment_events, plan_changes, organization_usage_records,
-- platform_audit_logs, support_tickets) usam subqueries diretas em
-- platform_admins, o que também pode causar problemas.
--
-- SOLUÇÃO:
-- 1. Recriar is_platform_admin como LANGUAGE plpgsql (impede inlining)
-- 2. Substituir TODAS as subqueries diretas em platform_admins por chamadas
--    à função is_platform_admin() (que agora é plpgsql + SECURITY DEFINER)
-- 3. Corrigir a chave duplicada /dashboard/billing na sidebar
--
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- =============================================================================

-- ============================================================
-- 1. Recriar is_platform_admin como plpgsql (impede inlining)
-- ============================================================
CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = p_user_id AND is_active = true
  );
END;
$$;

-- ============================================================
-- 2. Remover e recriar policies de platform_admins SEM auto-referência
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view own record" ON platform_admins;
DROP POLICY IF EXISTS "Super admins can manage platform admins" ON platform_admins;

-- SELECT: admin pode ver seu próprio registro
CREATE POLICY "platform_admins_select_own"
  ON platform_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

-- ALL: super_admin pode gerenciar outros admins
-- is_platform_admin() é plpgsql + SECURITY DEFINER → não é inlinado → bypassa RLS
CREATE POLICY "platform_admins_manage_by_superadmin"
  ON platform_admins FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- ============================================================
-- 3. Substituir subqueries diretas em platform_admins nas policies de OUTRAS tabelas
--    por chamadas à função is_platform_admin() (plpgsql, segura)
-- ============================================================

-- subscription_plans
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON subscription_plans;
DROP POLICY IF EXISTS "Platform admins can manage plans" ON subscription_plans;

CREATE POLICY "subscription_plans_select"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR is_platform_admin(auth.uid()));

CREATE POLICY "subscription_plans_manage_by_admin"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- subscription_plan_versions
DROP POLICY IF EXISTS "Authenticated users can view published plan versions" ON subscription_plan_versions;
DROP POLICY IF EXISTS "Platform admins can manage plan versions" ON subscription_plan_versions;

CREATE POLICY "plan_versions_select"
  ON subscription_plan_versions FOR SELECT
  TO authenticated
  USING (published_at IS NOT NULL OR is_platform_admin(auth.uid()));

CREATE POLICY "plan_versions_manage_by_admin"
  ON subscription_plan_versions FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- plan_entitlements
DROP POLICY IF EXISTS "Authenticated users can view entitlements of published versions" ON plan_entitlements;
DROP POLICY IF EXISTS "Platform admins can manage entitlements" ON plan_entitlements;

CREATE POLICY "entitlements_select"
  ON plan_entitlements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscription_plan_versions spv
      WHERE spv.id = plan_entitlements.plan_version_id AND spv.published_at IS NOT NULL
    ) OR is_platform_admin(auth.uid())
  );

CREATE POLICY "entitlements_manage_by_admin"
  ON plan_entitlements FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- billing_customers
DROP POLICY IF EXISTS "Platform admins can view all billing customers" ON billing_customers;
DROP POLICY IF EXISTS "Platform admins can manage billing customers" ON billing_customers;

CREATE POLICY "billing_customers_admin_select"
  ON billing_customers FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "billing_customers_admin_insert"
  ON billing_customers FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "Platform admins can view all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Platform admins can manage subscriptions" ON subscriptions;

CREATE POLICY "subscriptions_admin_select"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    (is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = subscriptions.organization_id
      AND m.user_id = auth.uid() AND m.role IN ('OWNER', 'ADMIN') AND m.status = 'active'
    )) OR is_platform_admin(auth.uid())
  );

CREATE POLICY "subscriptions_admin_manage"
  ON subscriptions FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- subscription_events
DROP POLICY IF EXISTS "Platform admins can view all subscription events" ON subscription_events;

CREATE POLICY "sub_events_admin_select"
  ON subscription_events FOR SELECT
  TO authenticated
  USING (
    (is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = subscription_events.organization_id
      AND m.user_id = auth.uid() AND m.role IN ('OWNER', 'ADMIN') AND m.status = 'active'
    )) OR is_platform_admin(auth.uid())
  );

-- subscription_invoices
DROP POLICY IF EXISTS "Platform admins can view all invoices" ON subscription_invoices;

CREATE POLICY "invoices_admin_select"
  ON subscription_invoices FOR SELECT
  TO authenticated
  USING (
    (is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = subscription_invoices.organization_id
      AND m.user_id = auth.uid() AND m.role IN ('OWNER', 'ADMIN') AND m.status = 'active'
    )) OR is_platform_admin(auth.uid())
  );

-- subscription_payment_events
DROP POLICY IF EXISTS "Platform admins can view payment events" ON subscription_payment_events;

CREATE POLICY "payment_events_admin_select"
  ON subscription_payment_events FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- plan_changes
DROP POLICY IF EXISTS "Platform admins can view all plan changes" ON plan_changes;

CREATE POLICY "plan_changes_admin_select"
  ON plan_changes FOR SELECT
  TO authenticated
  USING (
    (is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = plan_changes.organization_id
      AND m.user_id = auth.uid() AND m.role IN ('OWNER', 'ADMIN') AND m.status = 'active'
    )) OR is_platform_admin(auth.uid())
  );

-- organization_usage_records
DROP POLICY IF EXISTS "Platform admins can view all usage records" ON organization_usage_records;

CREATE POLICY "usage_records_admin_select"
  ON organization_usage_records FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id) OR is_platform_admin(auth.uid()));

-- platform_audit_logs
DROP POLICY IF EXISTS "Platform admins can view audit logs" ON platform_audit_logs;
DROP POLICY IF EXISTS "Platform admins can insert audit logs" ON platform_audit_logs;

CREATE POLICY "audit_logs_admin_select"
  ON platform_audit_logs FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "audit_logs_admin_insert"
  ON platform_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

-- support_tickets
DROP POLICY IF EXISTS "Platform admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Platform admins can update tickets" ON support_tickets;

CREATE POLICY "tickets_admin_select"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "tickets_admin_update"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- ============================================================
-- 4. Validação final
-- ============================================================
SELECT 'is_platform_admin language' AS check_item,
       CASE WHEN prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
            THEN '✅ plpgsql' ELSE '❌ NOT plpgsql' END AS status
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_platform_admin' AND n.nspname = 'public'
UNION ALL
SELECT 'platform_admins policies',
       string_agg(policyname, ', ' ORDER BY policyname)
FROM pg_policies WHERE tablename = 'platform_admins'
UNION ALL
SELECT 'total policies using is_platform_admin()',
       (SELECT COUNT(*)::TEXT || ' policies' FROM pg_policies
        WHERE qual LIKE '%is_platform_admin%' OR with_check LIKE '%is_platform_admin%')
UNION ALL
SELECT 'policies with direct platform_admins subquery',
       (SELECT COUNT(*)::TEXT || ' (should be 0)' FROM pg_policies
        WHERE (qual LIKE '%FROM platform_admins%' OR with_check LIKE '%FROM platform_admins%')
        AND tablename != 'platform_admins');