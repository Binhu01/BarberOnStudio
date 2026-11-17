-- =============================================================================
-- Seed: Horários de atendimento padrão — Barber-On Studio
-- Seg-Qui: 09:00–19:00 | Sex-Sáb: 09:00–20:00
-- Terça e Quarta: pausa de almoço 12:00–13:00
-- Intervalo entre slots: 30 minutos (já configurado na função get_public_available_slots)
-- Execute no Supabase Dashboard → SQL Editor após o setup-barberon.sql
-- =============================================================================

-- IDs dos barbeiros (ajuste se necessário)
DO $$
DECLARE
  v_org_id UUID := '9f912f7c-4360-4763-b274-de60c2b98b9a';
  v_ruan_membership UUID;
  v_lucas_membership UUID;
BEGIN
  -- Buscar membership IDs
  SELECT m.id INTO v_ruan_membership
  FROM memberships m JOIN profiles p ON p.id = m.user_id
  WHERE m.organization_id = v_org_id AND p.email = 'ruan@barberon.local';

  SELECT m.id INTO v_lucas_membership
  FROM memberships m JOIN profiles p ON p.id = m.user_id
  WHERE m.organization_id = v_org_id AND p.email = 'lucas@barberon.local';

  -- Se não encontrou, tenta pelo nome
  IF v_ruan_membership IS NULL THEN
    SELECT m.id INTO v_ruan_membership
    FROM memberships m JOIN profiles p ON p.id = m.user_id
    WHERE m.organization_id = v_org_id AND p.full_name = 'Ruan';
  END IF;

  IF v_lucas_membership IS NULL THEN
    SELECT m.id INTO v_lucas_membership
    FROM memberships m JOIN profiles p ON p.id = m.user_id
    WHERE m.organization_id = v_org_id AND p.full_name = 'Lucas';
  END IF;

  -- =========================================================================
  -- RUAN — Horários
  -- =========================================================================
  IF v_ruan_membership IS NOT NULL THEN
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
  END IF;

  -- =========================================================================
  -- LUCAS — Mesmos horários
  -- =========================================================================
  IF v_lucas_membership IS NOT NULL THEN
    -- Domingo (0) — folga
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 0, '09:00', '19:00', NULL, NULL, false)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET is_working_day = false;

    -- Segunda (1)
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 1, '09:00', '19:00', NULL, NULL, true)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

    -- Terça (2) — pausa 12:00–13:00
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 2, '09:00', '19:00', '12:00', '13:00', true)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = '12:00', lunch_end = '13:00', is_working_day = true;

    -- Quarta (3) — pausa 12:00–13:00
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 3, '09:00', '19:00', '12:00', '13:00', true)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = '12:00', lunch_end = '13:00', is_working_day = true;

    -- Quinta (4)
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 4, '09:00', '19:00', NULL, NULL, true)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '19:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

    -- Sexta (5) — até 20:00
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 5, '09:00', '20:00', NULL, NULL, true)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '20:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;

    -- Sábado (6) — até 20:00
    INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
    VALUES (v_org_id, v_lucas_membership, 6, '09:00', '20:00', NULL, NULL, true)
    ON CONFLICT (membership_id, day_of_week) DO UPDATE SET start_time = '09:00', end_time = '20:00', lunch_start = NULL, lunch_end = NULL, is_working_day = true;
  END IF;

  RAISE NOTICE 'Horários configurados: Ruan=%, Lucas=%', v_ruan_membership IS NOT NULL, v_lucas_membership IS NOT NULL;
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