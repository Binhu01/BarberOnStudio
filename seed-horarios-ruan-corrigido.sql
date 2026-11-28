-- =============================================================================
-- Seed: Horários de atendimento — Barber-On Studio (CORRIGIDO)
-- Usa o UID real do Ruan criado via Supabase Auth Dashboard
-- Seg-Qui: 09:00–19:00 | Sex-Sáb: 09:00–20:00
-- Terça e Quarta: pausa de almoço 12:00–13:00
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID := '9f912f7c-4360-4763-b274-de60c2b98b9a';
  v_ruan_membership UUID;
BEGIN
  -- Buscar membership do Ruan pelo UID real do Auth
  SELECT m.id INTO v_ruan_membership
  FROM memberships m
  WHERE m.organization_id = v_org_id
    AND m.user_id = '121f3b84-2ce3-4854-b588-261fa0b12800';

  -- Fallback: buscar por email se não encontrou pelo UID
  IF v_ruan_membership IS NULL THEN
    SELECT m.id INTO v_ruan_membership
    FROM memberships m
    JOIN profiles p ON p.id = m.user_id
    WHERE m.organization_id = v_org_id
      AND p.email = 'ruanpereiranunes1@gmail.com';
  END IF;

  IF v_ruan_membership IS NULL THEN
    RAISE EXCEPTION 'Membership do Ruan não encontrada! Verifique se o profile e membership foram criados.';
  END IF;

  RAISE NOTICE 'Encontrado membership do Ruan: %', v_ruan_membership;

  -- Domingo (0) — folga
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 0, '09:00', '19:00', NULL, NULL, false)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET is_working_day = false;

  -- Segunda (1) — 09:00–19:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 1, '09:00', '19:00', NULL, NULL, true)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

  -- Terça (2) — 09:00–19:00 com pausa 12:00–13:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 2, '09:00', '19:00', '12:00', '13:00', true)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = '12:00', lunch_end = '13:00', is_working_day = true;

  -- Quarta (3) — 09:00–19:00 com pausa 12:00–13:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 3, '09:00', '19:00', '12:00', '13:00', true)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = '12:00', lunch_end = '13:00', is_working_day = true;

  -- Quinta (4) — 09:00–19:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 4, '09:00', '19:00', NULL, NULL, true)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

  -- Sexta (5) — 09:00–20:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 5, '09:00', '20:00', NULL, NULL, true)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '20:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

  -- Sábado (6) — 09:00–20:00 sem pausa
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 6, '09:00', '20:00', NULL, NULL, true)
  ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '20:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

  RAISE NOTICE 'Horários configurados com sucesso para Ruan (membership: %)', v_ruan_membership;
END $$;

-- Verificação
SELECT p.full_name, bs.day_of_week,
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
WHERE bs.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
ORDER BY p.full_name, bs.day_of_week;