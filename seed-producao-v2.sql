-- =============================================================================
-- Seed CORRIGIDO v2 para PRODUÇÃO (barber-on-studio.vercel.app)
-- Usa os IDs REAIS encontrados no banco:
--   Org: 54f8c7ce-6bc1-40eb-b069-fcc71174ec07
--   Ruan profile/membership user_id: 2c27e308-725f-4196-87cf-39f1e0165d8a
--   Ruan membership id: f3298f2e-e995-4dcc-9f96-80b7c32f27b4
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID := '54f8c7ce-6bc1-40eb-b069-fcc71174ec07';
  v_ruan_membership UUID := 'f3298f2e-e995-4dcc-9f96-80b7c32f27b4';
BEGIN
  -- Verificar se a membership existe
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE id = v_ruan_membership AND organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Membership do Ruan não encontrada! ID esperado: %', v_ruan_membership;
  END IF;

  RAISE NOTICE 'Usando membership do Ruan: %', v_ruan_membership;

  -- Limpar schedules antigos do Ruan nesta org
  DELETE FROM barber_schedules
  WHERE organization_id = v_org_id AND membership_id = v_ruan_membership;

  -- Domingo (0) — folga
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 0, '09:00', '19:00', NULL, NULL, false);

  -- Segunda (1) — 09:00–19:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 1, '09:00', '19:00', NULL, NULL, true);

  -- Terça (2) — 09:00–19:00 com pausa 12:00–13:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 2, '09:00', '19:00', '12:00', '13:00', true);

  -- Quarta (3) — 09:00–19:00 com pausa 12:00–13:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 3, '09:00', '19:00', '12:00', '13:00', true);

  -- Quinta (4) — 09:00–19:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 4, '09:00', '19:00', NULL, NULL, true);

  -- Sexta (5) — 09:00–20:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 5, '09:00', '20:00', NULL, NULL, true);

  -- Sábado (6) — 09:00–20:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 6, '09:00', '20:00', NULL, NULL, true);

  RAISE NOTICE 'Horários configurados com sucesso para Ruan (membership: %)', v_ruan_membership;
END $$;

-- Verificação
SELECT p.full_name, m.role, bs.day_of_week,
  CASE bs.day_of_week
    WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça'
    WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta' WHEN 6 THEN 'Sábado'
  END AS dia,
  bs.start_time, bs.end_time,
  CASE WHEN bs.lunch_start IS NOT NULL THEN bs.lunch_start || '–' || bs.lunch_end ELSE '—' END AS almoco,
  bs.is_working_day
FROM barber_schedules bs
JOIN memberships m ON m.id = bs.membership_id
JOIN profiles p ON p.id = m.user_id
WHERE bs.organization_id = '54f8c7ce-6bc1-40eb-b069-fcc71174ec07'
ORDER BY p.full_name, bs.day_of_week;