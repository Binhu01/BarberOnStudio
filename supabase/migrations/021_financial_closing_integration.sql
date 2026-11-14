-- =============================================================================
-- Migration 021: Financial Closing, Order→Receivable Integration & DRE View
-- Barber-On Studio — FASE 5: Financeiro
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: FINANCIAL_MONTHLY_CLOSINGS (Fechamento mensal automatizado)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_year INT NOT NULL CHECK (period_year >= 2020),
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  total_income DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_expense DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_flow DECIMAL(14,2) NOT NULL DEFAULT 0,
  receivables_received DECIMAL(14,2) NOT NULL DEFAULT 0,
  payables_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  commissions_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  appointments_count INT NOT NULL DEFAULT 0,
  closing_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed', 'reopened')),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_financial_closings_org ON financial_monthly_closings(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_closings_period ON financial_monthly_closings(organization_id, period_year DESC, period_month DESC);

ALTER TABLE financial_monthly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view financial closings"
  ON financial_monthly_closings FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage financial closings"
  ON financial_monthly_closings FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_financial_monthly_closings_updated_at
  BEFORE UPDATE ON financial_monthly_closings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPO EM ORDERS PARA MARCAR GERAÇÃO AUTOMÁTICA DE RECEBÍVEL
-- -----------------------------------------------------------------------------
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS receivable_generated BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_receivable_generated ON orders(receivable_generated) WHERE receivable_generated = false AND status = 'completed';

-- -----------------------------------------------------------------------------
-- 3. RPC: GENERATE_RECEIVABLE_FROM_COMPLETED_ORDER
-- Cria recebível automaticamente ao finalizar comanda (se não existir)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_receivable_from_completed_order(
  p_order_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_receivable_id UUID;
  v_customer_name TEXT;
BEGIN
  -- Buscar comanda completada
  SELECT o.*, c.full_name AS customer_name_display
  INTO v_order
  FROM orders o
  LEFT JOIN profiles c ON c.id = o.customer_id
  WHERE o.id = p_order_id
    AND o.status = 'completed'
    AND o.receivable_generated = false
    AND o.total > 0;

  IF v_order IS NULL THEN
    RETURN NULL; -- Já gerado ou não elegível
  END IF;

  v_customer_name := COALESCE(v_order.customer_name_display, 'Cliente avulso');

  -- Criar recebível
  INSERT INTO receivables (
    organization_id,
    customer_id,
    order_id,
    description,
    original_amount,
    issue_date,
    due_date,
    status,
    created_by
  ) VALUES (
    v_order.organization_id,
    v_order.customer_id,
    v_order.id,
    'Comanda #' || LEFT(v_order.id::text, 8) || ' — ' || v_customer_name,
    v_order.total,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    CASE WHEN v_order.payment_method IN ('cash', 'pix', 'debit') THEN 'received' ELSE 'open' END,
    v_order.created_by
  ) RETURNING id INTO v_receivable_id;

  -- Se pagamento foi à vista, criar alocação automática
  IF v_order.payment_method IN ('cash', 'pix', 'debit') THEN
    INSERT INTO payment_allocations (
      organization_id,
      receivable_id,
      amount,
      allocated_at
    ) VALUES (
      v_order.organization_id,
      v_receivable_id,
      v_order.total,
      now()
    );

    UPDATE receivables
    SET amount_received = v_order.total,
        status = 'received',
        received_at = now()
    WHERE id = v_receivable_id;
  END IF;

  -- Marcar ordem como processada
  UPDATE orders
  SET receivable_generated = true,
      receivable_id = v_receivable_id,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN v_receivable_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC: GENERATE_MONTHLY_CLOSING
-- Gera/Atualiza fechamento mensal com todos os totais agregados
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_monthly_closing(
  p_org_id UUID,
  p_year INT,
  p_month INT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closing_id UUID;
  v_start DATE;
  v_end DATE;
  v_total_income DECIMAL;
  v_total_expense DECIMAL;
  v_receivables_received DECIMAL;
  v_payables_paid DECIMAL;
  v_commissions_total DECIMAL;
  v_orders_count INT;
  v_appointments_count INT;
  v_closing_balance DECIMAL;
BEGIN
  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + INTERVAL '1 month') - INTERVAL '1 day';

  -- Total income (transações positivas no período)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_income
  FROM financial_transactions
  WHERE organization_id = p_org_id
    AND amount > 0
    AND occurred_at >= v_start::timestamptz
    AND occurred_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Total expense (transações negativas no período)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_expense
  FROM financial_transactions
  WHERE organization_id = p_org_id
    AND amount < 0
    AND occurred_at >= v_start::timestamptz
    AND occurred_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Recebíveis recebidos no período
  SELECT COALESCE(SUM(amount_received), 0) INTO v_receivables_received
  FROM receivables
  WHERE organization_id = p_org_id
    AND status IN ('received', 'partially_received')
    AND received_at >= v_start::timestamptz
    AND received_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Pagáveis pagos no período
  SELECT COALESCE(SUM(amount_paid), 0) INTO v_payables_paid
  FROM payables
  WHERE organization_id = p_org_id
    AND status IN ('paid', 'partially_paid')
    AND paid_at >= v_start::timestamptz
    AND paid_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Comissões totais no período
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_commissions_total
  FROM barber_commissions
  WHERE organization_id = p_org_id
    AND created_at >= v_start::timestamptz
    AND created_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Contagem de pedidos completados
  SELECT COUNT(*) INTO v_orders_count
  FROM orders
  WHERE organization_id = p_org_id
    AND status = 'completed'
    AND completed_at >= v_start::timestamptz
    AND completed_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Contagem de agendamentos completados
  SELECT COUNT(*) INTO v_appointments_count
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND status = 'completed'
    AND completed_at >= v_start::timestamptz
    AND completed_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Saldo de fechamento = saldo acumulado até o fim do período
  SELECT COALESCE(SUM(amount), 0) INTO v_closing_balance
  FROM financial_transactions
  WHERE organization_id = p_org_id
    AND occurred_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Upsert do fechamento
  INSERT INTO financial_monthly_closings (
    organization_id, period_year, period_month,
    total_income, total_expense, net_flow,
    receivables_received, payables_paid, commissions_total,
    orders_count, appointments_count, closing_balance
  ) VALUES (
    p_org_id, p_year, p_month,
    v_total_income, v_total_expense, v_total_income - v_total_expense,
    v_receivables_received, v_payables_paid, v_commissions_total,
    v_orders_count, v_appointments_count, v_closing_balance
  )
  ON CONFLICT (organization_id, period_year, period_month)
  DO UPDATE SET
    total_income = EXCLUDED.total_income,
    total_expense = EXCLUDED.total_expense,
    net_flow = EXCLUDED.net_flow,
    receivables_received = EXCLUDED.receivables_received,
    payables_paid = EXCLUDED.payables_paid,
    commissions_total = EXCLUDED.commissions_total,
    orders_count = EXCLUDED.orders_count,
    appointments_count = EXCLUDED.appointments_count,
    closing_balance = EXCLUDED.closing_balance,
    updated_at = now()
  RETURNING id INTO v_closing_id;

  RETURN v_closing_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. VIEW: V_FINANCIAL_DRE (Demonstração do Resultado do Exercício mensal)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_financial_dre AS
SELECT
  fmc.organization_id,
  fmc.period_year,
  fmc.period_month,
  TO_CHAR(make_date(fmc.period_year, fmc.period_month, 1), 'YYYY-MM') AS period_label,
  fmc.total_income,
  fmc.total_expense,
  fmc.net_flow,
  fmc.commissions_total,
  fmc.receivables_received,
  fmc.payables_paid,
  fmc.orders_count,
  fmc.appointments_count,
  fmc.closing_balance,
  fmc.status,
  -- Margem líquida (%)
  CASE WHEN fmc.total_income > 0
    THEN ROUND((fmc.net_flow / fmc.total_income) * 100, 2)
    ELSE 0
  END AS net_margin_pct,
  -- Ticket médio
  CASE WHEN fmc.orders_count > 0
    THEN ROUND(fmc.total_income / fmc.orders_count, 2)
    ELSE 0
  END AS avg_ticket
FROM financial_monthly_closings fmc;

-- -----------------------------------------------------------------------------
-- 6. TRIGGER: Auto-generate receivable when order is completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_auto_generate_receivable_on_order_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.total > 0 THEN
    PERFORM generate_receivable_from_completed_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_complete_generate_receivable ON orders;
CREATE TRIGGER trg_order_complete_generate_receivable
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION trg_auto_generate_receivable_on_order_complete();

-- -----------------------------------------------------------------------------
-- 7. MIGRAR DADOS EXISTENTES: gerar recebíveis para comandas já completadas
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id FROM orders
    WHERE status = 'completed'
      AND total > 0
      AND receivable_generated = false
    LIMIT 500
  LOOP
    PERFORM generate_receivable_from_completed_order(v_order.id);
  END LOOP;
END;
$$;