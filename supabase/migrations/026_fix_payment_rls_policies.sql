-- ============================================================================
-- BARBER-ON STUDIO — FIX: RLS Policies para order_payments e financial_payments
-- Adiciona policies faltantes identificadas na auditoria de segurança.
-- ============================================================================

-- ============================================================================
-- 1. ORDER_PAYMENTS — Tabela tinha RLS ativado mas ZERO policies (I4)
-- ============================================================================

-- Policies idempotentes: drop + recreate
DO $$
BEGIN
  -- ORDER_PAYMENTS SELECT
  DROP POLICY IF EXISTS "order_payments_select_member" ON order_payments;
  CREATE POLICY "order_payments_select_member"
    ON order_payments FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_payments.order_id
          AND is_member_of(o.organization_id)
      )
    );

  -- ORDER_PAYMENTS UPDATE
  DROP POLICY IF EXISTS "order_payments_update_member" ON order_payments;
  CREATE POLICY "order_payments_update_member"
    ON order_payments FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_payments.order_id
          AND is_member_of(o.organization_id)
      )
    );

  -- ORDER_PAYMENTS DELETE
  DROP POLICY IF EXISTS "order_payments_delete_admin" ON order_payments;
  CREATE POLICY "order_payments_delete_admin"
    ON order_payments FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        JOIN memberships m ON m.organization_id = o.organization_id
        WHERE o.id = order_payments.order_id
          AND m.user_id = auth.uid()
          AND m.role IN ('OWNER', 'ADMIN')
      )
    );

  -- FINANCIAL_PAYMENTS UPDATE
  DROP POLICY IF EXISTS "financial_payments_update_member" ON financial_payments;
  CREATE POLICY "financial_payments_update_member"
    ON financial_payments FOR UPDATE
    TO authenticated
    USING (is_member_of(organization_id));

  -- FINANCIAL_PAYMENTS DELETE
  DROP POLICY IF EXISTS "financial_payments_delete_admin" ON financial_payments;
  CREATE POLICY "financial_payments_delete_admin"
    ON financial_payments FOR DELETE
    TO authenticated
    USING (
      is_member_of(organization_id)
      AND EXISTS (
        SELECT 1 FROM memberships
        WHERE organization_id = financial_payments.organization_id
          AND user_id = auth.uid()
          AND role IN ('OWNER', 'ADMIN')
      )
    );
END $$;

-- ============================================================================
-- 3. Garantir que a coluna external_payment_id existe em order_payments
--    (usada pelo webhook do Mercado Pago como chave de upsert)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_payments' AND column_name = 'external_payment_id'
  ) THEN
    ALTER TABLE order_payments ADD COLUMN external_payment_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_external_id
      ON order_payments(external_payment_id)
      WHERE external_payment_id IS NOT NULL;
  END IF;
END $$;

-- Garantir que paid_at existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_payments' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE order_payments ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
END $$;