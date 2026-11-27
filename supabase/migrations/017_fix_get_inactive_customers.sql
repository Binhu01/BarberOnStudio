-- =============================================================================
-- Migration 017: Corrigir função get_inactive_customers
-- Correções:
-- 1. orders.total_amount → orders.total
-- 2. profiles.phone não existe → usar customers.phone / customers.name / customers.email
-- 3. orders.customer_id referencia customers(id), não profiles(id)
-- =============================================================================

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
    c.id,
    c.name,
    c.phone,
    c.email,
    MAX(o.created_at) AS last_visit_at,
    EXTRACT(DAY FROM (now() - MAX(o.created_at)))::INT AS days_inactive,
    COUNT(o.id)::INT AS total_visits,
    COALESCE(SUM(o.total), 0) AS total_spent
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id AND o.organization_id = p_org_id
  WHERE c.organization_id = p_org_id
    AND c.status = 'active'
  GROUP BY c.id, c.name, c.phone, c.email
  HAVING MAX(o.created_at) < now() - (p_inactive_days || ' days')::INTERVAL
  ORDER BY days_inactive DESC;
END;
$$;

COMMENT ON FUNCTION get_inactive_customers IS 'Lista clientes inativos há N dias para reativação (usa tabela customers com phone/name/email corretos)';