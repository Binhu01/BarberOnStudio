-- =============================================================================
-- Migration 022: Subscription Benefits, Appointment Integration & Recurring Payments
-- Barber-On Studio — FASE 6: Assinaturas Clientes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: SUBSCRIPTION_PLAN_BENEFITS (Benefícios configuráveis por plano)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plan_benefits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
 benefit_type TEXT NOT NULL CHECK (benefit_type IN ('service', 'product_discount', 'free_product', 'priority_booking', 'custom')),
 benefit_value JSONB NOT NULL DEFAULT '{}'::jsonb,
 -- Ex: {"barber_service_id": "uuid", "quantity_per_month": 2}
 -- Ex: {"discount_percentage": 15, "applies_to": "products"}
 -- Ex: {"product_id": "uuid", "quantity_per_month": 1}
 description TEXT,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_plan_benefits_plan ON subscription_plan_benefits(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_plan_benefits_org ON subscription_plan_benefits(organization_id);

ALTER TABLE subscription_plan_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription plan benefits"
 ON subscription_plan_benefits FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage subscription plan benefits"
 ON subscription_plan_benefits FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_subscription_plan_benefits_updated_at
 BEFORE UPDATE ON subscription_plan_benefits
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA: SUBSCRIPTION_SERVICE_USAGE (Registro de serviços usados por período)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_service_usage (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 client_subscription_id UUID NOT NULL REFERENCES client_subscriptions(id) ON DELETE CASCADE,
 calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
 barber_service_id UUID REFERENCES barber_services(id) ON DELETE SET NULL,
 service_name TEXT NOT NULL,
 used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_service_usage_sub ON subscription_service_usage(client_subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_service_usage_period ON subscription_service_usage(client_subscription_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sub_service_usage_event ON subscription_service_usage(calendar_event_id);

ALTER TABLE subscription_service_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription service usage"
 ON subscription_service_usage FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can insert subscription service usage"
 ON subscription_service_usage FOR INSERT
 WITH CHECK (is_member_of(organization_id));

-- -----------------------------------------------------------------------------
-- 3. ADICIONAR CAMPOS EM CLIENT_SUBSCRIPTIONS PARA INTEGRAÇÃO
-- -----------------------------------------------------------------------------
ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS linked_receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_renewal_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renewal_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_discount_pct DECIMAL(5,2) DEFAULT 0 CHECK (product_discount_pct >= 0 AND product_discount_pct <= 100);

CREATE INDEX IF NOT EXISTS idx_client_subs_receivable ON client_subscriptions(linked_receivable_id);
CREATE INDEX IF NOT EXISTS idx_client_subs_renewal ON client_subscriptions(next_billing_date) WHERE status = 'active' AND auto_renew = true;

-- -----------------------------------------------------------------------------
-- 4. RPC: RECORD_SUBSCRIPTION_SERVICE_USAGE
-- Registra uso de serviço quando agendamento é concluído para cliente assinante
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_subscription_service_usage(
 p_calendar_event_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_event RECORD;
 v_subscription RECORD;
 v_period_start DATE;
 v_period_end DATE;
BEGIN
 -- Buscar agendamento completado com cliente
 SELECT ce.id, ce.customer_id, ce.barber_service_id, ce.start_at, ce.organization_id,
 bs.name AS service_name
 INTO v_event
 FROM calendar_events ce
 LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
 WHERE ce.id = p_calendar_event_id
 AND ce.status = 'completed'
 AND ce.customer_id IS NOT NULL;

 IF v_event IS NULL THEN
 RETURN; -- Não é um agendamento elegível
 END IF;

 -- Buscar assinatura ativa do cliente
 SELECT cs.id, cs.current_period_start, cs.current_period_end,
 cs.services_used_this_period, sp.max_services_per_month
 INTO v_subscription
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.customer_profile_id = v_event.customer_id
 AND cs.organization_id = v_event.organization_id
 AND cs.status IN ('active', 'trial')
 AND cs.current_period_start <= v_event.start_at::date
 AND cs.current_period_end >= v_event.start_at::date
 LIMIT 1;

 IF v_subscription IS NULL THEN
 RETURN; -- Cliente não tem assinatura ativa
 END IF;

 v_period_start := v_subscription.current_period_start;
 v_period_end := v_subscription.current_period_end;

 -- Verificar se já registrou este evento
 IF EXISTS (
 SELECT 1 FROM subscription_service_usage
 WHERE calendar_event_id = p_calendar_event_id
 ) THEN
 RETURN; -- Já registrado
 END IF;

 -- Registrar uso
 INSERT INTO subscription_service_usage (
 organization_id, client_subscription_id, calendar_event_id,
 barber_service_id, service_name, period_start, period_end
 ) VALUES (
 v_event.organization_id, v_subscription.id, p_calendar_event_id,
 v_event.barber_service_id, COALESCE(v_event.service_name, 'Serviço'),
 v_period_start, v_period_end
 );

 -- Atualizar contador na assinatura
 UPDATE client_subscriptions
 SET services_used_this_period = services_used_this_period + 1,
 updated_at = now()
 WHERE id = v_subscription.id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGER: Auto-record service usage when appointment is completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_record_service_usage_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.customer_id IS NOT NULL THEN
 PERFORM record_subscription_service_usage(NEW.id);
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_complete_sub_usage ON calendar_events;
CREATE TRIGGER trg_appointment_complete_sub_usage
 AFTER UPDATE OF status ON calendar_events
 FOR EACH ROW
 WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
 EXECUTE FUNCTION trg_record_service_usage_on_completion();

-- -----------------------------------------------------------------------------
-- 6. RPC: GENERATE_SUBSCRIPTION_RECEIVABLE
-- Gera recebível automático para renovação de assinatura
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_subscription_receivable(
 p_subscription_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_receivable_id UUID;
BEGIN
 SELECT cs.*, sp.price, sp.name AS plan_name, cp.full_name AS customer_name
 INTO v_sub
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 LEFT JOIN profiles cp ON cp.id = cs.customer_profile_id
 WHERE cs.id = p_subscription_id;

 IF v_sub IS NULL THEN
 RAISE EXCEPTION 'Assinatura não encontrada: %', p_subscription_id;
 END IF;

 -- Criar recebível
 INSERT INTO receivables (
 organization_id,
 customer_id,
 description,
 original_amount,
 issue_date,
 due_date,
 status,
 category_id
 ) VALUES (
 v_sub.organization_id,
 v_sub.customer_profile_id,
 'Assinatura: ' || v_sub.plan_name || ' — ' || COALESCE(v_sub.customer_name, 'Cliente'),
 v_sub.price,
 CURRENT_DATE,
 v_sub.next_billing_date,
 'open',
 NULL
 ) RETURNING id INTO v_receivable_id;

 -- Vincular à assinatura
 UPDATE client_subscriptions
 SET linked_receivable_id = v_receivable_id,
 updated_at = now()
 WHERE id = p_subscription_id;

 RETURN v_receivable_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: PROCESS_SUBSCRIPTION_RENEWALS_ENHANCED
-- Versão melhorada que gera recebíveis e notificações
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_subscription_renewals_enhanced()
RETURNS TABLE(renewed_count INT, expired_count INT, receivables_created INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_new_end DATE;
 v_renewed INT := 0;
 v_expired INT := 0;
 v_receivables INT := 0;
BEGIN
 FOR v_sub IN
 SELECT cs.id, cs.subscription_plan_id, cs.current_period_end,
 cs.auto_renew, cs.next_billing_date,
 sp.billing_cycle, sp.trial_days
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.status IN ('active', 'trial')
 AND cs.current_period_end <= CURRENT_DATE
 LOOP
 IF v_sub.auto_renew THEN
 -- Calcular novo período
 v_new_end := v_sub.current_period_end;
 CASE v_sub.billing_cycle
 WHEN 'quarterly' THEN v_new_end := v_new_end + INTERVAL '3 months';
 WHEN 'annual' THEN v_new_end := v_new_end + INTERVAL '1 year';
 ELSE v_new_end := v_new_end + INTERVAL '1 month';
 END CASE;

 -- Renovar
 UPDATE client_subscriptions
 SET current_period_start = v_sub.current_period_end + 1,
 current_period_end = v_new_end,
 next_billing_date = v_new_end,
 services_used_this_period = 0,
 last_renewal_at = now(),
 renewal_count = renewal_count + 1,
 updated_at = now()
 WHERE id = v_sub.id;

 -- Gerar recebível
 PERFORM generate_subscription_receivable(v_sub.id);
 v_receivables := v_receivables + 1;

 -- Registrar histórico
 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type, notes
 )
 SELECT organization_id, v_sub.id, 'renewed',
 'Renovação automática — novo período até ' || v_new_end
 FROM client_subscriptions WHERE id = v_sub.id;

 v_renewed := v_renewed + 1;
 ELSE
 -- Expirar
 UPDATE client_subscriptions
 SET status = 'expired',
 cancelled_at = now(),
 updated_at = now()
 WHERE id = v_sub.id;

 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type, notes
 )
 SELECT organization_id, v_sub.id, 'expired',
 'Assinatura expirada — renovação automática desativada'
 FROM client_subscriptions WHERE id = v_sub.id;

 v_expired := v_expired + 1;
 END IF;
 END LOOP;

 RETURN QUERY SELECT v_renewed, v_expired, v_receivables;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. VIEW: V_SUBSCRIPTION_USAGE_SUMMARY
-- Resumo de uso de serviços por assinatura no período atual
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_subscription_usage_summary AS
SELECT
 cs.id AS client_subscription_id,
 cs.organization_id,
 cs.customer_profile_id,
 cs.services_used_this_period,
 sp.max_services_per_month,
 CASE WHEN sp.max_services_per_month > 0
 THEN ROUND((cs.services_used_this_period::numeric / sp.max_services_per_month) * 100, 1)
 ELSE NULL
 END AS usage_percentage,
 sp.max_services_per_month - cs.services_used_this_period AS remaining_services,
 cs.current_period_start,
 cs.current_period_end,
 COUNT(ssu.id) AS total_usage_records
FROM client_subscriptions cs
JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
LEFT JOIN subscription_service_usage ssu
 ON ssu.client_subscription_id = cs.id
 AND ssu.period_start = cs.current_period_start
WHERE cs.status IN ('active', 'trial')
GROUP BY cs.id, cs.organization_id, cs.customer_profile_id,
 cs.services_used_this_period, sp.max_services_per_month,
 cs.current_period_start, cs.current_period_end;