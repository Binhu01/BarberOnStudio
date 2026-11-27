-- =============================================================================
-- Migration 017: Corrigir função get_inactive_customers
-- A coluna orders.total_amount não existe; o nome correto é orders.total
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

COMMENT ON FUNCTION get_inactive_customers IS 'Lista clientes inativos há N dias para reativação (corrigido: orders.total em vez de orders.total_amount)';