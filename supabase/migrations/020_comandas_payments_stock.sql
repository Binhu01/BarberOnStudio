-- =============================================================================
-- Migration 020: Comandas — Pagamentos Combinados, Estoque e Integração Agenda
-- Barber-On Studio — FASE 4: Comandas e Vendas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: ORDER_PAYMENTS (Pagamentos combinados / split payment)
-- Permite múltiplas formas de pagamento na mesma comanda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'pix', 'debit', 'credit', 'other')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  reference TEXT, -- ex: "PIX chave xxx", "Cartão final 1234"
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_org ON order_payments(organization_id);

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view order payments"
  ON order_payments FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert order payments"
  ON order_payments FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update order payments"
  ON order_payments FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete order payments"
  ON order_payments FOR DELETE
  USING (is_member_of(organization_id));

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPOS EM ORDERS PARA INTEGRAÇÃO COM AGENDA E ESTOQUE
-- -----------------------------------------------------------------------------
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS linked_appointment_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_calculated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_linked_appointment ON orders(linked_appointment_id);

-- -----------------------------------------------------------------------------
-- 3. TABELA: ORDER_ITEM_STOCK_RESERVATIONS
-- Reserva de estoque ao adicionar produto na comanda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_item_stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON order_item_stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product ON order_item_stock_reservations(product_id, status);

ALTER TABLE order_item_stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stock reservations"
  ON order_item_stock_reservations FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage stock reservations"
  ON order_item_stock_reservations FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_order_item_stock_reservations_updated_at
  BEFORE UPDATE ON order_item_stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. RPC: ADD_PAYMENT_TO_ORDER
-- Adiciona pagamento parcial/combinado à comanda e atualiza status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_payment_to_order(
  p_order_id UUID,
  p_payment_method TEXT,
  p_amount DECIMAL,
  p_change_amount DECIMAL DEFAULT 0,
  p_reference TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_total DECIMAL;
  v_paid DECIMAL;
BEGIN
  -- Buscar org e total da comanda
  SELECT o.organization_id, o.total INTO v_org_id, v_total
  FROM orders o WHERE o.id = p_order_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Comanda não encontrada: %', p_order_id;
  END IF;

  -- Inserir pagamento
  INSERT INTO order_payments (
    organization_id, order_id, payment_method, amount, change_amount, reference, created_by
  ) VALUES (
    v_org_id, p_order_id, p_payment_method, p_amount, COALESCE(p_change_amount, 0), p_reference, auth.uid()
  );

  -- Calcular total pago
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM order_payments WHERE order_id = p_order_id;

  -- Atualizar status da comanda baseado no total pago
  IF v_paid >= v_total THEN
    UPDATE orders SET
      payment_method = CASE
        WHEN (SELECT COUNT(*) FROM order_payments WHERE order_id = p_order_id) = 1
        THEN p_payment_method
        ELSE 'multiple'
      END,
      status = CASE WHEN status = 'open' OR status = 'in_progress' THEN 'completed' ELSE status END,
      completed_at = CASE WHEN status != 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
    WHERE id = p_order_id;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: RESERVE_STOCK_FOR_ORDER_ITEM
-- Reserva estoque ao adicionar produto na comanda
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_stock_for_order_item(
  p_order_item_id UUID,
  p_product_id UUID,
  p_quantity INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_current_stock INT;
BEGIN
  -- Buscar org do pedido
  SELECT o.organization_id INTO v_org_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.id = p_order_item_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado: %', p_order_item_id;
  END IF;

  -- Verificar estoque disponível
  SELECT COALESCE(stock_quantity, 0) INTO v_current_stock
  FROM products WHERE id = p_product_id AND organization_id = v_org_id;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto %. Disponível: %, Solicitado: %',
      p_product_id, v_current_stock, p_quantity;
  END IF;

  -- Criar reserva
  INSERT INTO order_item_stock_reservations (
    organization_id, order_id, order_item_id, product_id, quantity
  )
  SELECT v_org_id, oi.order_id, p_order_item_id, p_product_id, p_quantity
  FROM order_items oi WHERE oi.id = p_order_item_id;

  -- Decrementar estoque disponível
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE id = p_product_id AND organization_id = v_org_id;

  -- Marcar comanda como com estoque reservado
  UPDATE orders SET stock_reserved = true, updated_at = now()
  WHERE id = (SELECT order_id FROM order_items WHERE id = p_order_item_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: RELEASE_STOCK_FOR_ORDER
-- Libera estoque quando comanda é cancelada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_stock_for_order(
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT product_id, quantity
    FROM order_item_stock_reservations
    WHERE order_id = p_order_id AND status = 'reserved'
  LOOP
    -- Devolver estoque
    UPDATE products
    SET stock_quantity = stock_quantity + v_reservation.quantity,
        updated_at = now()
    WHERE id = v_reservation.product_id;

    -- Marcar reserva como liberada
    UPDATE order_item_stock_reservations
    SET status = 'released', updated_at = now()
    WHERE order_id = p_order_id
      AND product_id = v_reservation.product_id
      AND status = 'reserved';
  END LOOP;

  -- Desmarcar flag de estoque
  UPDATE orders SET stock_reserved = false, updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: CONSUME_STOCK_FOR_ORDER
-- Confirma consumo do estoque quando comanda é finalizada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_stock_for_order(
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_item_stock_reservations
  SET status = 'consumed', updated_at = now()
  WHERE order_id = p_order_id AND status = 'reserved';
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: LINK_APPOINTMENT_TO_ORDER
-- Vincula agendamento à comanda automaticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION link_appointment_to_order(
  p_order_id UUID,
  p_appointment_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET linked_appointment_id = p_appointment_id, updated_at = now()
  WHERE id = p_order_id;

  -- Atualizar status do agendamento para in_progress se estiver confirmed/arrived
  UPDATE calendar_events
  SET status = 'in_progress', updated_at = now()
  WHERE id = p_appointment_id
    AND status IN ('confirmed', 'arrived');
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. VIEW: V_ORDER_PAYMENTS_SUMMARY
-- Resumo de pagamentos por comanda
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_order_payments_summary AS
SELECT
  op.order_id,
  op.organization_id,
  COUNT(*) AS payment_count,
  SUM(op.amount) AS total_paid,
  SUM(op.change_amount) AS total_change,
  STRING_AGG(DISTINCT op.payment_method, ', ') AS payment_methods,
  MAX(op.created_at) AS last_payment_at
FROM order_payments op
GROUP BY op.order_id, op.organization_id;

-- -----------------------------------------------------------------------------
-- 10. MIGRAR DADOS EXISTENTES: criar order_payments para comandas já pagas
-- -----------------------------------------------------------------------------
INSERT INTO order_payments (organization_id, order_id, payment_method, amount, created_by)
SELECT
  o.organization_id,
  o.id,
  COALESCE(o.payment_method, 'other'),
  o.total,
  NULL
FROM orders o
WHERE o.status = 'completed'
  AND o.total > 0
  AND o.payment_method IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM order_payments op WHERE op.order_id = o.id
  );