-- ============================================================================
-- BARBER-ON STUDIO — FUNÇÃO RPC: query_receivables_aging
-- Retorna contas a receber agrupadas por faixa de atraso (aging buckets)
-- para o dashboard financeiro / relatórios.
-- ============================================================================

CREATE OR REPLACE FUNCTION query_receivables_aging(p_org_id UUID)
RETURNS TABLE (
  aging_bucket TEXT,
  outstanding_amount NUMERIC,
  receivable_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se o usuário autenticado é membro da organização
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN r.due_date >= CURRENT_DATE THEN 'current'
      WHEN CURRENT_DATE - r.due_date <= 30 THEN '1_30_days'
      WHEN CURRENT_DATE - r.due_date <= 60 THEN '31_60_days'
      WHEN CURRENT_DATE - r.due_date <= 90 THEN '61_90_days'
      ELSE '90_plus_days'
    END AS aging_bucket,
    SUM(r.original_amount - r.amount_received) AS outstanding_amount,
    COUNT(*)::BIGINT AS receivable_count
  FROM receivables r
  WHERE r.organization_id = p_org_id
    AND r.status NOT IN ('cancelled', 'received')
    AND (r.original_amount - r.amount_received) > 0.01
  GROUP BY
    CASE
      WHEN r.due_date >= CURRENT_DATE THEN 'current'
      WHEN CURRENT_DATE - r.due_date <= 30 THEN '1_30_days'
      WHEN CURRENT_DATE - r.due_date <= 60 THEN '31_60_days'
      WHEN CURRENT_DATE - r.due_date <= 90 THEN '61_90_days'
      ELSE '90_plus_days'
    END
  ORDER BY
    CASE
      WHEN r.due_date >= CURRENT_DATE THEN 0
      WHEN CURRENT_DATE - r.due_date <= 30 THEN 1
      WHEN CURRENT_DATE - r.due_date <= 60 THEN 2
      WHEN CURRENT_DATE - r.due_date <= 90 THEN 3
      ELSE 4
    END;
END;
$$;

-- Revogar execução pública e conceder apenas para authenticated
REVOKE ALL ON FUNCTION query_receivables_aging(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION query_receivables_aging(UUID) TO authenticated;

COMMENT ON FUNCTION query_receivables_aging(UUID) IS
  'Retorna contas a receber em aberto agrupadas por faixa de atraso (aging buckets): current, 1_30_days, 31_60_days, 61_90_days, 90_plus_days. Escopo multi-tenant via p_org_id + verificação de membership.';