-- =============================================================================
-- Migration 024: Complementary Modules — Integrations, Advanced Reports & Settings
-- Barber-On Studio — FASE 8: Módulos Complementares
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: INTEGRATION_CONNECTIONS (Conexões com serviços externos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'whatsapp_meta', 'resend', 'mercadopago', 'stripe', 'google_calendar',
    'instagram', 'tiktok', 'webhook_custom'
  )),
  name TEXT NOT NULL,
  config_encrypted JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ex: {"api_key": "...", "account_id": "...", "webhook_url": "..."}
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org ON integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status) WHERE status = 'connected';

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view integration connections"
  ON integration_connections FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Admins can manage integration connections"
  ON integration_connections FOR ALL
  USING (
    is_member_of(organization_id) AND
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = integration_connections.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    is_member_of(organization_id) AND
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = integration_connections.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE TRIGGER set_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA: WEBHOOK_EVENTS (Registro de eventos recebidos via webhook)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_connection_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view webhook events"
  ON webhook_events FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "System can insert webhook events"
  ON webhook_events FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. VIEW: V_REPORT_APPOINTMENTS_SUMMARY
-- Relatório detalhado de agendamentos por período
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_appointments_summary AS
SELECT
  ce.organization_id,
  DATE_TRUNC('month', ce.start_at) AS period,
  COUNT(*) FILTER (WHERE ce.status != 'cancelled') AS total_appointments,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS completed_appointments,
  COUNT(*) FILTER (WHERE ce.status = 'cancelled') AS cancelled_appointments,
  COUNT(*) FILTER (WHERE ce.status = 'no_show') AS no_show_appointments,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS total_revenue,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_ticket,
  COUNT(DISTINCT ce.customer_id) FILTER (WHERE ce.status = 'completed') AS unique_customers,
  COUNT(DISTINCT ce.assigned_barber_id) FILTER (WHERE ce.status = 'completed') AS active_barbers,
  ROUND(
    COUNT(*) FILTER (WHERE ce.status = 'completed')::numeric * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE ce.status != 'cancelled'), 0),
    2
  ) AS completion_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE ce.status = 'no_show')::numeric * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE ce.status != 'cancelled'), 0),
    2
  ) AS no_show_rate_pct
FROM calendar_events ce
GROUP BY ce.organization_id, DATE_TRUNC('month', ce.start_at);

-- -----------------------------------------------------------------------------
-- 4. VIEW: V_REPORT_BARBER_RANKING
-- Ranking de profissionais por desempenho
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_barber_ranking AS
SELECT
  ce.organization_id,
  DATE_TRUNC('month', ce.start_at) AS period,
  ce.assigned_barber_id,
  bp.full_name AS barber_name,
  bp.avatar_url AS barber_avatar,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS appointments_completed,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS revenue_generated,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_ticket,
  COUNT(DISTINCT ce.customer_id) FILTER (WHERE ce.status = 'completed') AS unique_customers_served,
  ROUND(
    COUNT(*) FILTER (WHERE ce.status = 'completed')::numeric * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE ce.assigned_barber_id IS NOT NULL AND ce.status != 'cancelled'), 0),
    2
  ) AS completion_rate_pct
FROM calendar_events ce
LEFT JOIN memberships bm ON bm.id = ce.assigned_barber_id
LEFT JOIN profiles bp ON bp.id = bm.user_id
WHERE ce.assigned_barber_id IS NOT NULL
GROUP BY ce.organization_id, DATE_TRUNC('month', ce.start_at), ce.assigned_barber_id, bp.full_name, bp.avatar_url;

-- -----------------------------------------------------------------------------
-- 5. VIEW: V_REPORT_SERVICE_POPULARITY
-- Serviços mais populares e rentáveis
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_service_popularity AS
SELECT
  ce.organization_id,
  DATE_TRUNC('month', ce.start_at) AS period,
  ce.barber_service_id,
  bs.name AS service_name,
  bs.duration_minutes,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS times_performed,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS total_revenue,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_price,
  SUM(bs.duration_minutes) FILTER (WHERE ce.status = 'completed') AS total_minutes_spent
FROM calendar_events ce
LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
WHERE ce.barber_service_id IS NOT NULL
GROUP BY ce.organization_id, DATE_TRUNC('month', ce.start_at), ce.barber_service_id, bs.name, bs.duration_minutes;

-- -----------------------------------------------------------------------------
-- 6. VIEW: V_REPORT_CUSTOMER_RETENTION
-- Análise de retenção e frequência de clientes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_customer_retention AS
SELECT
  ce.organization_id,
  ce.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS total_visits,
  MIN(ce.start_at) FILTER (WHERE ce.status = 'completed') AS first_visit,
  MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') AS last_visit,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS lifetime_value,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_ticket,
  CASE
    WHEN MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
    WHEN MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') >= CURRENT_DATE - INTERVAL '90 days' THEN 'at_risk'
    ELSE 'churned'
  END AS retention_status,
  EXTRACT(DAY FROM MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') - MIN(ce.start_at) FILTER (WHERE ce.status = 'completed')) /
    NULLIF(COUNT(*) FILTER (WHERE ce.status = 'completed') - 1, 0) AS avg_days_between_visits
FROM calendar_events ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE ce.customer_id IS NOT NULL
GROUP BY ce.organization_id, ce.customer_id, c.name, c.phone;

-- -----------------------------------------------------------------------------
-- 7. VIEW: V_REPORT_PRODUCT_SALES
-- Vendas de produtos integradas às comandas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_product_sales AS
SELECT
  o.organization_id,
  DATE_TRUNC('month', o.completed_at) AS period,
  oi.product_id,
  p.name AS product_name,
  pc.name AS category,
  SUM(oi.quantity) AS units_sold,
  COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total_revenue,
  ROUND(AVG(oi.unit_price), 2) AS avg_unit_price,
  COUNT(DISTINCT o.id) AS orders_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN products p ON p.id = oi.product_id
LEFT JOIN product_categories pc ON pc.id = p.category_id
WHERE o.status = 'completed'
  AND oi.product_id IS NOT NULL
  AND o.completed_at IS NOT NULL
GROUP BY o.organization_id, DATE_TRUNC('month', o.completed_at), oi.product_id, p.name, pc.name;

-- -----------------------------------------------------------------------------
-- 8. RPC: GET_DASHBOARD_KPIs
-- KPIs consolidados para dashboard principal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_org_id UUID)
RETURNS TABLE (
  today_appointments BIGINT,
  week_appointments BIGINT,
  month_revenue DECIMAL,
  month_new_customers BIGINT,
  pending_receivables DECIMAL,
  overdue_receivables DECIMAL,
  low_stock_products BIGINT,
  active_subscriptions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := CURRENT_DATE::timestamptz;
  v_week_start TIMESTAMPTZ := (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int)::timestamptz;
  v_month_start TIMESTAMPTZ := DATE_TRUNC('month', CURRENT_DATE)::timestamptz;
BEGIN
  -- Agendamentos hoje
  SELECT COUNT(*) INTO today_appointments
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND start_at >= v_today_start
    AND start_at < v_today_start + INTERVAL '1 day'
    AND status NOT IN ('cancelled', 'no_show');

  -- Agendamentos esta semana
  SELECT COUNT(*) INTO week_appointments
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND start_at >= v_week_start
    AND start_at < v_week_start + INTERVAL '7 days'
    AND status NOT IN ('cancelled', 'no_show');

  -- Receita do mês
  SELECT COALESCE(SUM(total), 0) INTO month_revenue
  FROM orders
  WHERE organization_id = p_org_id
    AND status = 'completed'
    AND completed_at >= v_month_start;

  -- Novos clientes no mês
  SELECT COUNT(*) INTO month_new_customers
  FROM profiles
  WHERE organization_id = p_org_id
    AND created_at >= v_month_start;

  -- Recebíveis pendentes
  SELECT COALESCE(SUM(original_amount - COALESCE(amount_received, 0)), 0) INTO pending_receivables
  FROM receivables
  WHERE organization_id = p_org_id
    AND status IN ('open', 'partially_received');

  -- Recebíveis atrasados
  SELECT COALESCE(SUM(original_amount - COALESCE(amount_received, 0)), 0) INTO overdue_receivables
  FROM receivables
  WHERE organization_id = p_org_id
    AND status IN ('open', 'partially_received')
    AND due_date < CURRENT_DATE;

  -- Produtos com estoque baixo
  SELECT COUNT(*) INTO low_stock_products
  FROM products
  WHERE organization_id = p_org_id
    AND is_active = true
    AND stock_quantity <= min_stock_level;

  -- Assinaturas ativas
  SELECT COUNT(*) INTO active_subscriptions
  FROM client_subscriptions
  WHERE organization_id = p_org_id
    AND status = 'active';

  RETURN NEXT;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. ADICIONAR CAMPOS EM BARBERSHOP_SETTINGS PARA CONFIGURAÇÕES UNIFICADAS
-- -----------------------------------------------------------------------------
ALTER TABLE barbershop_settings
ADD COLUMN IF NOT EXISTS auto_confirm_bookings BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_percentage DECIMAL(5,2) DEFAULT 0 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100),
ADD COLUMN IF NOT EXISTS cancellation_policy_hours INT NOT NULL DEFAULT 2 CHECK (cancellation_policy_hours >= 0),
ADD COLUMN IF NOT EXISTS max_advance_booking_days INT NOT NULL DEFAULT 30 CHECK (max_advance_booking_days > 0),
ADD COLUMN IF NOT EXISTS allow_online_booking BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_prices_online BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS default_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR';