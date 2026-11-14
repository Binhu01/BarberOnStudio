-- =============================================================================
-- Migration 015: Subscription Plans & Client Memberships
-- Barber-On Studio — Assinaturas mensais e controle de benefícios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SUBSCRIPTION PLANS (Planos de assinatura da barbearia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 description TEXT,
 price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
 billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
 trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
 max_services_per_month INT CHECK (max_services_per_month IS NULL OR max_services_per_month > 0),
 included_services JSONB DEFAULT '[]', -- array of barber_service_ids
 discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
 priority_booking BOOLEAN NOT NULL DEFAULT false,
 is_active BOOLEAN NOT NULL DEFAULT true,
 display_order INT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_org ON subscription_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(organization_id, is_active);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription plans"
 ON subscription_plans FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage subscription plans"
 ON subscription_plans FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_subscription_plans_updated_at
 BEFORE UPDATE ON subscription_plans
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. CLIENT SUBSCRIPTIONS (Assinaturas ativas dos clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'trial')),
 current_period_start DATE NOT NULL,
 current_period_end DATE NOT NULL,
 services_used_this_period INT NOT NULL DEFAULT 0,
 auto_renew BOOLEAN NOT NULL DEFAULT true,
 payment_method TEXT CHECK (payment_method IN ('cash', 'pix', 'debit', 'credit', 'other')),
 last_payment_at TIMESTAMPTZ,
 next_billing_date DATE,
 cancelled_at TIMESTAMPTZ,
 cancellation_reason TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT chk_period_dates CHECK (current_period_end >= current_period_start)
);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_org ON client_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_customer ON client_subscriptions(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_plan ON client_subscriptions(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_status ON client_subscriptions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_billing ON client_subscriptions(next_billing_date);

ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view client subscriptions"
 ON client_subscriptions FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage client subscriptions"
 ON client_subscriptions FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_client_subscriptions_updated_at
 BEFORE UPDATE ON client_subscriptions
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. SUBSCRIPTION HISTORY (Histórico de pagamentos e renovações)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 client_subscription_id UUID NOT NULL REFERENCES client_subscriptions(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL CHECK (event_type IN ('created', 'renewed', 'paused', 'resumed', 'cancelled', 'payment_received', 'service_used', 'plan_changed')),
 amount DECIMAL(12,2),
 payment_method TEXT,
 period_start DATE,
 period_end DATE,
 services_count INT,
 notes TEXT,
 created_by UUID REFERENCES memberships(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_sub ON subscription_history(client_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_event ON subscription_history(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_history_date ON subscription_history(created_at);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription history"
 ON subscription_history FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can create subscription history"
 ON subscription_history FOR INSERT
 WITH CHECK (is_member_of(organization_id));

-- APPEND-ONLY: no UPDATE/DELETE policies

-- -----------------------------------------------------------------------------
-- 4. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Registra uso de serviço por assinatura e incrementa contador
CREATE OR REPLACE FUNCTION record_subscription_service_usage(
 p_subscription_id UUID,
 p_service_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_plan RECORD;
BEGIN
 SELECT * INTO v_sub FROM client_subscriptions WHERE id = p_subscription_id;
 IF NOT FOUND THEN
 RAISE EXCEPTION 'Assinatura não encontrada: %', p_subscription_id;
 END IF;

 IF v_sub.status != 'active' AND v_sub.status != 'trial' THEN
 RAISE EXCEPTION 'Assinatura não está ativa (status: %)', v_sub.status;
 END IF;

 -- Verificar limite de serviços se houver
 SELECT * INTO v_plan FROM subscription_plans WHERE id = v_sub.subscription_plan_id;
 IF v_plan.max_services_per_month IS NOT NULL
 AND v_sub.services_used_this_period >= v_plan.max_services_per_month THEN
 RAISE EXCEPTION 'Limite de serviços atingido neste período (%/%)',
 v_sub.services_used_this_period, v_plan.max_services_per_month;
 END IF;

 -- Incrementar contador
 UPDATE client_subscriptions
 SET services_used_this_period = services_used_this_period + 1,
 updated_at = now()
 WHERE id = p_subscription_id;

 -- Registrar no histórico
 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type,
 services_count, notes
 ) VALUES (
 v_sub.organization_id, p_subscription_id, 'service_used',
 NULL, 'Serviço utilizado via assinatura'
 );
END;
$$;

-- Processa renovações automáticas de assinaturas vencidas
CREATE OR REPLACE FUNCTION process_subscription_renewals()
RETURNS TABLE (renewed_count INT, expired_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_renewed INT := 0;
 v_expired INT := 0;
 v_new_period_start DATE;
 v_new_period_end DATE;
BEGIN
 FOR v_sub IN
 SELECT cs.*, sp.price, sp.billing_cycle
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.status IN ('active', 'trial')
 AND cs.current_period_end < CURRENT_DATE
 LOOP
 IF v_sub.auto_renew THEN
 -- Calcular novo período
 v_new_period_start := v_sub.current_period_end + INTERVAL '1 day';
 CASE v_sub.billing_cycle
 WHEN 'monthly' THEN
 v_new_period_end := v_new_period_start + INTERVAL '1 month' - INTERVAL '1 day';
 WHEN 'quarterly' THEN
 v_new_period_end := v_new_period_start + INTERVAL '3 months' - INTERVAL '1 day';
 WHEN 'annual' THEN
 v_new_period_end := v_new_period_start + INTERVAL '1 year' - INTERVAL '1 day';
 ELSE
 v_new_period_end := v_new_period_start + INTERVAL '1 month' - INTERVAL '1 day';
 END CASE;

 -- Renovar
 UPDATE client_subscriptions
 SET current_period_start = v_new_period_start,
 current_period_end = v_new_period_end,
 services_used_this_period = 0,
 status = 'active',
 next_billing_date = v_new_period_end + INTERVAL '1 day',
 last_payment_at = now(),
 updated_at = now()
 WHERE id = v_sub.id;

 -- Histórico
 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type,
 amount, period_start, period_end, notes
 ) VALUES (
 v_sub.organization_id, v_sub.id, 'renewed',
 v_sub.price, v_new_period_start, v_new_period_end,
 'Renovação automática'
 );

 v_renewed := v_renewed + 1;
 ELSE
 -- Expirar
 UPDATE client_subscriptions
 SET status = 'expired',
 updated_at = now()
 WHERE id = v_sub.id;

 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type,
 notes
 ) VALUES (
 v_sub.organization_id, v_sub.id, 'cancelled',
 'Expirou sem renovação automática'
 );

 v_expired := v_expired + 1;
 END IF;
 END LOOP;

 renewed_count := v_renewed;
 expired_count := v_expired;
 RETURN NEXT;
END;
$$;

-- Obtém resumo de assinaturas da barbearia
CREATE OR REPLACE FUNCTION get_subscription_summary(p_org_id UUID)
RETURNS TABLE (
 total_active INT,
 total_paused INT,
 total_cancelled INT,
 monthly_revenue DECIMAL,
 upcoming_renewals_7d INT,
 avg_services_used DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 RETURN QUERY
 SELECT
 COUNT(*) FILTER (WHERE cs.status = 'active')::INT,
 COUNT(*) FILTER (WHERE cs.status = 'paused')::INT,
 COUNT(*) FILTER (WHERE cs.status IN ('cancelled', 'expired'))::INT,
 COALESCE(SUM(sp.price) FILTER (WHERE cs.status = 'active'), 0),
 COUNT(*) FILTER (WHERE cs.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INT,
 COALESCE(AVG(cs.services_used_this_period) FILTER (WHERE cs.status = 'active'), 0)
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.organization_id = p_org_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
 ('subscriptions.view', 'subscriptions', 'view', 'Visualizar assinaturas'),
 ('subscriptions.manage', 'subscriptions', 'manage', 'Gerenciar assinaturas de clientes'),
 ('subscriptions.plans', 'subscriptions', 'plans', 'Gerenciar planos de assinatura'),
 ('subscriptions.history', 'subscriptions', 'history', 'Visualizar histórico de assinaturas')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
 AND p.permission_key IN (
 'subscriptions.view', 'subscriptions.manage',
 'subscriptions.plans', 'subscriptions.history'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant operational to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
 AND p.permission_key IN (
 'subscriptions.view', 'subscriptions.manage', 'subscriptions.history'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to EMPLOYEE/BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
 AND p.permission_key IN ('subscriptions.view')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

COMMENT ON TABLE subscription_plans IS 'Planos de assinatura mensal/trimestral/anual oferecidos pela barbearia';
COMMENT ON TABLE client_subscriptions IS 'Assinaturas ativas dos clientes com controle de período e uso';
COMMENT ON TABLE subscription_history IS 'Histórico append-only de eventos: criação, renovação, pagamento, uso, cancelamento';
COMMENT ON FUNCTION record_subscription_service_usage IS 'Registra uso de serviço via assinatura e valida limites';
COMMENT ON FUNCTION process_subscription_renewals IS 'Processa renovações automáticas e expirações de assinaturas vencidas';
COMMENT ON FUNCTION get_subscription_summary IS 'Retorna resumo de assinaturas: ativas, receita, renovações próximas';