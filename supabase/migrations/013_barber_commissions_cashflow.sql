-- =============================================================================
-- Migration 013: Barber Commissions, Cash Register & Daily Close
-- Barber-On Studio — Sistema de gestão para barbearias
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BARBER COMMISSIONS (Registro de comissões por atendimento)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_commissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
 membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
 barber_service_id UUID REFERENCES barber_services(id),
 service_name TEXT NOT NULL,
 service_price DECIMAL(12,2) NOT NULL CHECK (service_price >= 0),
 commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed', 'none')),
 commission_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
 commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
 paid_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barber_commissions_org ON barber_commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_order ON barber_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_member ON barber_commissions(membership_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_status ON barber_commissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_date ON barber_commissions(organization_id, created_at);

ALTER TABLE barber_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barber commissions"
 ON barber_commissions FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barber commissions"
 ON barber_commissions FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barber_commissions_updated_at
 BEFORE UPDATE ON barber_commissions
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. CASH REGISTERS (Caixas da barbearia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_registers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 description TEXT,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_org ON cash_registers(organization_id);

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash registers"
 ON cash_registers FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage cash registers"
 ON cash_registers FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_cash_registers_updated_at
 BEFORE UPDATE ON cash_registers
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. CASH SESSIONS (Sessões de caixa — abertura e fechamento diário)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
 opened_by UUID NOT NULL REFERENCES memberships(id),
 closed_by UUID REFERENCES memberships(id),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 closed_at TIMESTAMPTZ,
 opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
 closing_amount DECIMAL(12,2) CHECK (closing_amount IS NULL OR closing_amount >= 0),
 expected_amount DECIMAL(12,2),
 difference DECIMAL(12,2),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
 notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_org ON cash_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register ON cash_sessions(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_date ON cash_sessions(organization_id, opened_at);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash sessions"
 ON cash_sessions FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage cash sessions"
 ON cash_sessions FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_cash_sessions_updated_at
 BEFORE UPDATE ON cash_sessions
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. CASH MOVEMENTS (Movimentações dentro de uma sessão de caixa)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
 movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'refund', 'withdrawal', 'deposit', 'adjustment')),
 amount DECIMAL(12,2) NOT NULL,
 description TEXT,
 reference_type TEXT,
 reference_id UUID,
 payment_method TEXT CHECK (payment_method IN ('cash', 'pix', 'debit', 'credit', 'other')),
 created_by UUID NOT NULL REFERENCES memberships(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_org ON cash_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_movements(organization_id, movement_type);

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash movements"
 ON cash_movements FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can create cash movements"
 ON cash_movements FOR INSERT
 WITH CHECK (is_member_of(organization_id));

-- APPEND-ONLY: no UPDATE/DELETE policies

-- -----------------------------------------------------------------------------
-- 5. ALTER ORDERS (Vincular comanda ao caixa e barbeiro)
-- -----------------------------------------------------------------------------
ALTER TABLE orders
 ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(id),
 ADD COLUMN IF NOT EXISTS assigned_barber_id UUID REFERENCES memberships(id),
 ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES calendar_events(id);

CREATE INDEX IF NOT EXISTS idx_orders_cash_session ON orders(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_barber ON orders(assigned_barber_id);
CREATE INDEX IF NOT EXISTS idx_orders_appointment ON orders(appointment_id);

-- -----------------------------------------------------------------------------
-- 6. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Calcula e registra comissões ao finalizar uma comanda
CREATE OR REPLACE FUNCTION calculate_order_commissions(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_order RECORD;
 v_item RECORD;
 v_barber RECORD;
 v_commission_amount DECIMAL(12,2);
BEGIN
 -- Buscar dados do pedido
 SELECT * INTO v_order FROM orders WHERE id = p_order_id;
 IF NOT FOUND THEN
 RAISE EXCEPTION 'Pedido não encontrado: %', p_order_id;
 END IF;

 -- Para cada item do pedido que tem serviço/barbeiro vinculado
 FOR v_item IN
 SELECT oi.*, bs.commission_type, bs.commission_value, bs.duration_minutes
 FROM order_items oi
 LEFT JOIN barber_services bs ON oi.description = bs.name
 AND bs.organization_id = v_order.organization_id
 WHERE oi.order_id = p_order_id
 LOOP
 -- Se tem barbeiro atribuído ao pedido e serviço encontrado
 IF v_order.assigned_barber_id IS NOT NULL AND v_item.commission_type IS NOT NULL THEN
 -- Buscar perfil do barbeiro para override de comissão
 SELECT * INTO v_barber FROM employee_profiles
 WHERE membership_id = v_order.assigned_barber_id
 AND organization_id = v_order.organization_id;

 -- Calcular comissão
 IF v_barber IS NOT NULL AND v_barber.commission_type != 'none' THEN
 -- Usar comissão do barbeiro (override)
 IF v_barber.commission_type = 'percentage' THEN
 v_commission_amount := v_item.total * (v_barber.commission_rate / 100.0);
 ELSIF v_barber.commission_type = 'fixed' THEN
 v_commission_amount := v_barber.commission_rate;
 ELSE
 v_commission_amount := 0;
 END IF;
 ELSE
 -- Usar comissão do serviço
 IF v_item.commission_type = 'percentage' THEN
 v_commission_amount := v_item.total * (v_item.commission_value / 100.0);
 ELSIF v_item.commission_type = 'fixed' THEN
 v_commission_amount := v_item.commission_value;
 ELSE
 v_commission_amount := 0;
 END IF;
 END IF;

 -- Registrar comissão
 IF v_commission_amount > 0 THEN
 INSERT INTO barber_commissions (
 organization_id, order_id, order_item_id, membership_id,
 barber_service_id, service_name, service_price,
 commission_type, commission_value, commission_amount
 ) VALUES (
 v_order.organization_id, p_order_id, v_item.id, v_order.assigned_barber_id,
 NULL, v_item.description, v_item.unit_price,
 COALESCE(v_barber.commission_type, v_item.commission_type),
 COALESCE(v_barber.commission_rate, v_item.commission_value),
 v_commission_amount
 );
 END IF;
 END IF;
 END LOOP;
END;
$$;

-- Obtém resumo de caixa do dia
CREATE OR REPLACE FUNCTION get_daily_cash_summary(
 p_org_id UUID,
 p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
 total_sales DECIMAL,
 total_refunds DECIMAL,
 total_withdrawals DECIMAL,
 total_deposits DECIMAL,
 net_amount DECIMAL,
 orders_count BIGINT,
 commissions_pending DECIMAL,
 commissions_paid DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 RETURN QUERY
 SELECT
 COALESCE(SUM(CASE WHEN cm.movement_type = 'sale' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type = 'refund' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type = 'withdrawal' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type = 'deposit' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type IN ('sale', 'deposit') THEN cm.amount
 WHEN cm.movement_type IN ('refund', 'withdrawal') THEN -cm.amount
 ELSE 0 END), 0),
 (SELECT COUNT(*) FROM orders o
 WHERE o.organization_id = p_org_id
 AND o.issued_at::DATE = p_date
 AND o.status IN ('completed', 'confirmed')),
 COALESCE((SELECT SUM(bc.commission_amount) FROM barber_commissions bc
 WHERE bc.organization_id = p_org_id
 AND bc.status = 'pending'
 AND bc.created_at::DATE = p_date), 0),
 COALESCE((SELECT SUM(bc.commission_amount) FROM barber_commissions bc
 WHERE bc.organization_id = p_org_id
 AND bc.status = 'paid'
 AND bc.paid_at::DATE = p_date), 0)
 FROM cash_sessions cs
 LEFT JOIN cash_movements cm ON cm.cash_session_id = cs.id
 WHERE cs.organization_id = p_org_id
 AND cs.opened_at::DATE = p_date;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
 ('commissions.view', 'commissions', 'view', 'Visualizar comissões'),
 ('commissions.manage', 'commissions', 'manage', 'Gerenciar comissões'),
 ('commissions.pay', 'commissions', 'pay', 'Marcar comissões como pagas'),
 ('cash_register.view', 'cash_register', 'view', 'Visualizar caixas'),
 ('cash_register.manage', 'cash_register', 'manage', 'Gerenciar caixas'),
 ('cash_session.open', 'cash_session', 'open', 'Abrir sessão de caixa'),
 ('cash_session.close', 'cash_session', 'close', 'Fechar sessão de caixa'),
 ('cash_movement.create', 'cash_movement', 'create', 'Registrar movimentação de caixa')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
 AND p.permission_key IN (
 'commissions.view', 'commissions.manage', 'commissions.pay',
 'cash_register.view', 'cash_register.manage',
 'cash_session.open', 'cash_session.close',
 'cash_movement.create'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to MANAGER, operations to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
 AND p.permission_key IN (
 'commissions.view', 'commissions.manage', 'commissions.pay',
 'cash_register.view',
 'cash_session.open', 'cash_session.close',
 'cash_movement.create'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant basic view to BARBER and EMPLOYEE
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
 AND p.permission_key IN (
 'commissions.view',
 'cash_register.view',
 'cash_session.open',
 'cash_movement.create'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. SEED
-- -----------------------------------------------------------------------------
INSERT INTO cash_registers (organization_id, name, description, is_active)
SELECT id, 'Caixa Principal', 'Caixa principal da barbearia', true
FROM organizations
WHERE NOT EXISTS (
 SELECT 1 FROM cash_registers
 WHERE organization_id = organizations.id AND name = 'Caixa Principal'
)
LIMIT 1;

COMMENT ON TABLE barber_commissions IS 'Registro de comissões por atendimento/serviço';
COMMENT ON TABLE cash_registers IS 'Caixas físicos ou virtuais da barbearia';
COMMENT ON TABLE cash_sessions IS 'Sessões de abertura e fechamento de caixa';
COMMENT ON TABLE cash_movements IS 'Movimentações financeiras dentro de uma sessão de caixa (APPEND-ONLY)';
COMMENT ON FUNCTION calculate_order_commissions IS 'Calcula e registra comissões automaticamente ao finalizar uma comanda';
COMMENT ON FUNCTION get_daily_cash_summary IS 'Retorna resumo financeiro do dia: vendas, comissões e movimentações';