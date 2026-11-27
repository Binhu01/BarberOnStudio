-- =============================================================================
-- Migration 016: Loyalty Programs & Customer Reactivation
-- Barber-On Studio — Sistema de fidelidade e reativação de clientes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. LOYALTY PROGRAMS (Programas de fidelidade da barbearia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_per_real DECIMAL(10,2) NOT NULL DEFAULT 1.0 CHECK (points_per_real > 0),
  points_per_visit INT NOT NULL DEFAULT 0 CHECK (points_per_visit >= 0),
  redemption_threshold INT NOT NULL DEFAULT 100 CHECK (redemption_threshold > 0),
  reward_type TEXT NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'free_service', 'product', 'cashback')),
  reward_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (reward_value >= 0),
  reward_service_id UUID REFERENCES barber_services(id),
  expiry_days INT CHECK (expiry_days IS NULL OR expiry_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_org ON loyalty_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_active ON loyalty_programs(organization_id, is_active);

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view loyalty programs"
  ON loyalty_programs FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage loyalty programs"
  ON loyalty_programs FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_loyalty_programs_updated_at
  BEFORE UPDATE ON loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. LOYALTY CARDS (Cartões de fidelidade dos clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  current_points INT NOT NULL DEFAULT 0 CHECK (current_points >= 0),
  lifetime_points INT NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  total_visits INT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  last_visit_at TIMESTAMPTZ,
  card_status TEXT NOT NULL DEFAULT 'active' CHECK (card_status IN ('active', 'inactive', 'expired', 'blocked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_program UNIQUE (customer_profile_id, loyalty_program_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_org ON loyalty_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_customer ON loyalty_cards(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_program ON loyalty_cards(loyalty_program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_status ON loyalty_cards(card_status);

ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view loyalty cards"
  ON loyalty_cards FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage loyalty cards"
  ON loyalty_cards FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_loyalty_cards_updated_at
  BEFORE UPDATE ON loyalty_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. LOYALTY TRANSACTIONS (Histórico de pontos ganhos/resgatados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loyalty_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn_purchase', 'earn_visit', 'earn_bonus', 'redeem', 'expire', 'adjustment')),
  points_change INT NOT NULL,
  balance_after INT NOT NULL,
  reference_id UUID, -- order_id, booking_id, etc.
  reference_type TEXT, -- 'order', 'booking', 'manual', 'campaign'
  description TEXT,
  created_by UUID REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_org ON loyalty_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_card ON loyalty_transactions(loyalty_card_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON loyalty_transactions(created_at);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can create loyalty transactions"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (is_member_of(organization_id));

-- APPEND-ONLY: no UPDATE/DELETE policies

-- -----------------------------------------------------------------------------
-- 4. REACTIVATION CAMPAIGNS (Campanhas de reativação de clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactivation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'inactive_clients' CHECK (campaign_type IN ('inactive_clients', 'birthday', 'custom_segment', 'win_back')),
  inactive_days_threshold INT NOT NULL DEFAULT 30 CHECK (inactive_days_threshold > 0),
  target_count INT,
  sent_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  conversion_count INT NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email', 'push')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  created_by UUID REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_campaigns_org ON reactivation_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_campaigns_status ON reactivation_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_reactivation_campaigns_scheduled ON reactivation_campaigns(scheduled_at);

ALTER TABLE reactivation_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactivation campaigns"
  ON reactivation_campaigns FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage reactivation campaigns"
  ON reactivation_campaigns FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_reactivation_campaigns_updated_at
  BEFORE UPDATE ON reactivation_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. REACTIVATION RECIPIENTS (Clientes alvo de cada campanha)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactivation_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES reactivation_campaigns(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  last_visit_at TIMESTAMPTZ,
  days_inactive INT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'converted', 'failed')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_recipients_campaign ON reactivation_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_recipients_customer ON reactivation_recipients(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_recipients_status ON reactivation_recipients(status);

ALTER TABLE reactivation_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactivation recipients"
  ON reactivation_recipients FOR SELECT
  USING (is_member_of((SELECT organization_id FROM reactivation_campaigns WHERE id = campaign_id)));

CREATE POLICY "Members can manage reactivation recipients"
  ON reactivation_recipients FOR ALL
  USING (is_member_of((SELECT organization_id FROM reactivation_campaigns WHERE id = campaign_id)))
  WITH CHECK (is_member_of((SELECT organization_id FROM reactivation_campaigns WHERE id = campaign_id)));

-- -----------------------------------------------------------------------------
-- 6. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Adiciona pontos a um cartão de fidelidade
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_card_id UUID,
  p_points INT,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_new_balance INT;
BEGIN
  SELECT * INTO v_card FROM loyalty_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão de fidelidade não encontrado: %', p_card_id;
  END IF;

  IF v_card.card_status != 'active' THEN
    RAISE EXCEPTION 'Cartão não está ativo (status: %)', v_card.card_status;
  END IF;

  v_new_balance := v_card.current_points + p_points;

  -- Atualizar cartão
  UPDATE loyalty_cards
  SET current_points = v_new_balance,
      lifetime_points = lifetime_points + GREATEST(p_points, 0),
      updated_at = now()
  WHERE id = p_card_id;

  -- Registrar transação
  INSERT INTO loyalty_transactions (
    organization_id, loyalty_card_id, transaction_type,
    points_change, balance_after, reference_id, reference_type, description
  ) VALUES (
    v_card.organization_id, p_card_id, p_transaction_type,
    p_points, v_new_balance, p_reference_id, p_reference_type, p_description
  );
END;
$$;

-- Resgata pontos de um cartão de fidelidade
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_card_id UUID,
  p_points INT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_new_balance INT;
BEGIN
  SELECT * INTO v_card FROM loyalty_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão de fidelidade não encontrado: %', p_card_id;
  END IF;

  IF v_card.current_points < p_points THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_card.current_points, p_points;
  END IF;

  v_new_balance := v_card.current_points - p_points;

  -- Atualizar cartão
  UPDATE loyalty_cards
  SET current_points = v_new_balance,
      updated_at = now()
  WHERE id = p_card_id;

  -- Registrar transação
  INSERT INTO loyalty_transactions (
    organization_id, loyalty_card_id, transaction_type,
    points_change, balance_after, reference_id, reference_type, description
  ) VALUES (
    v_card.organization_id, p_card_id, 'redeem',
    -p_points, v_new_balance, p_reference_id, 'manual', p_description
  );
END;
$$;

-- Obtém resumo de fidelidade da organização
CREATE OR REPLACE FUNCTION get_loyalty_summary(p_org_id UUID)
RETURNS TABLE (
  total_programs INT,
  active_cards INT,
  total_points_issued BIGINT,
  avg_points_per_card DECIMAL,
  redemptions_this_month INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT lp.id)::INT,
    COUNT(lc.id)::INT,
    COALESCE(SUM(lc.lifetime_points), 0)::BIGINT,
    COALESCE(AVG(lc.current_points), 0),
    COUNT(lt.id) FILTER (WHERE lt.transaction_type = 'redeem' AND lt.created_at >= date_trunc('month', CURRENT_DATE))::INT
  FROM loyalty_programs lp
  LEFT JOIN loyalty_cards lc ON lc.loyalty_program_id = lp.id AND lc.card_status = 'active'
  LEFT JOIN loyalty_transactions lt ON lt.loyalty_card_id = lc.id
  WHERE lp.organization_id = p_org_id AND lp.is_active = true;
END;
$$;

-- Obtém clientes inativos para reativação
CREATE OR REPLACE FUNCTION get_inactive_customers(
  p_org_id UUID,
  p_inactive_days INT DEFAULT 30
)
RETURNS TABLE (
  customer_id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  last_visit_at TIMESTAMPTZ,
  days_inactive INT,
  total_visits INT,
  total_spent DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.phone,
    p.email,
    MAX(o.created_at) AS last_visit_at,
    EXTRACT(DAY FROM (now() - MAX(o.created_at)))::INT AS days_inactive,
    COUNT(o.id)::INT AS total_visits,
    COALESCE(SUM(o.total), 0) AS total_spent
  FROM profiles p
  JOIN memberships m ON m.user_id = p.id AND m.organization_id = p_org_id
  LEFT JOIN orders o ON o.customer_id = p.id AND o.organization_id = p_org_id
  WHERE p.id IN (
    SELECT DISTINCT customer_id FROM orders WHERE organization_id = p_org_id
  )
  GROUP BY p.id, p.full_name, p.phone, p.email
  HAVING MAX(o.created_at) < now() - (p_inactive_days || ' days')::INTERVAL
  ORDER BY days_inactive DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('loyalty.view', 'loyalty', 'view', 'Visualizar programa de fidelidade'),
  ('loyalty.manage', 'loyalty', 'manage', 'Gerenciar programas e cartões de fidelidade'),
  ('loyalty.transactions', 'loyalty', 'transactions', 'Registrar e visualizar transações de pontos'),
  ('reactivation.view', 'reactivation', 'view', 'Visualizar campanhas de reativação'),
  ('reactivation.manage', 'reactivation', 'manage', 'Criar e gerenciar campanhas de reativação')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
  AND p.permission_key IN (
    'loyalty.view', 'loyalty.manage', 'loyalty.transactions',
    'reactivation.view', 'reactivation.manage'
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
    'loyalty.view', 'loyalty.manage', 'loyalty.transactions',
    'reactivation.view', 'reactivation.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to EMPLOYEE/BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
  AND p.permission_key IN ('loyalty.view', 'loyalty.transactions')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

COMMENT ON TABLE loyalty_programs IS 'Programas de fidelidade configurados pela barbearia';
COMMENT ON TABLE loyalty_cards IS 'Cartões de fidelidade individuais dos clientes';
COMMENT ON TABLE loyalty_transactions IS 'Histórico append-only de transações de pontos';
COMMENT ON TABLE reactivation_campaigns IS 'Campanhas de reativação de clientes inativos';
COMMENT ON TABLE reactivation_recipients IS 'Clientes alvo e status de envio de cada campanha';
COMMENT ON FUNCTION add_loyalty_points IS 'Adiciona pontos a um cartão e registra transação';
COMMENT ON FUNCTION redeem_loyalty_points IS 'Resgata pontos de um cartão e registra transação';
COMMENT ON FUNCTION get_loyalty_summary IS 'Retorna resumo do programa de fidelidade da organização';
COMMENT ON FUNCTION get_inactive_customers IS 'Lista clientes inativos há N dias para reativação';