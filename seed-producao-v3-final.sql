-- =============================================================================
-- Seed DEFINITIVO v3 — Auto-descritivo, sem IDs hardcoded
-- Funciona em qualquer projeto Supabase: descobre a org e o Ruan automaticamente
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID;
  v_ruan_uid UUID;
  v_ruan_membership UUID;
BEGIN
  -- 1. Encontrar a organização (usa a primeira disponível)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada! Crie uma organização primeiro.';
  END IF;

  RAISE NOTICE 'Organização encontrada: %', v_org_id;

  -- 2. Encontrar o Ruan pelo email no profiles
  SELECT id INTO v_ruan_uid
  FROM profiles
  WHERE email = 'ruanpereiranunes1@gmail.com'
  LIMIT 1;

  IF v_ruan_uid IS NULL THEN
    RAISE EXCEPTION 'Profile do Ruan não encontrado com email ruanpereiranunes1@gmail.com!';
  END IF;

  RAISE NOTICE 'UID do Ruan encontrado: %', v_ruan_uid;

  -- 3. Encontrar a membership do Ruan nesta org
  SELECT id INTO v_ruan_membership
  FROM memberships
  WHERE organization_id = v_org_id
    AND user_id = v_ruan_uid
  LIMIT 1;

  IF v_ruan_membership IS NULL THEN
    RAISE EXCEPTION 'Membership do Ruan não encontrada na org %! Verifique se o Ruan foi adicionado à organização.', v_org_id;
  END IF;

  RAISE NOTICE 'Membership do Ruan: %', v_ruan_membership;

  -- 4. Limpar schedules antigos
  DELETE FROM barber_schedules
  WHERE organization_id = v_org_id AND membership_id = v_ruan_membership;

  -- 5. Inserir horários
  -- Domingo (0) — folga
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 0, '09:00', '19:00', NULL, NULL, false);

  -- Segunda (1) — 09:00–19:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 1, '09:00', '19:00', NULL, NULL, true);

  -- Terça (2) — 09:00–19:00 com pausa 12:00–13:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 2, '09:00', '19:00', '12:00', '13:00', true);

  -- Quarta (3) — 09:00–19:00 com pausa 12:00–13:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 3, '09:00', '19:00', '12:00', '13:00', true);

  -- Quinta (4) — 09:00–19:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 4, '09:00', '19:00', NULL, NULL, true);

  -- Sexta (5) — 09:00–20:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 5, '09:00', '20:00', NULL, NULL, true);

  -- Sábado (6) — 09:00–20:00
  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES (v_org_id, v_ruan_membership, 6, '09:00', '20:00', NULL, NULL, true);

  RAISE NOTICE '✅ Horários configurados com sucesso para Ruan!';
END $$;

-- Verificação
SELECT p.full_name, m.role, bs.day_of_week,
  CASE bs.day_of_week
    WHEN 0 THEN 'Dom' WHEN 1 THEN 'Seg' WHEN 2 THEN 'Ter'
    WHEN 3 THEN 'Qua' WHEN 4 THEN 'Qui' WHEN 5 THEN 'Sex' WHEN 6 THEN 'Sáb'
  END AS dia,
  bs.start_time, bs.end_time, bs.is_working_day
FROM barber_schedules bs
JOIN memberships m ON m.id = bs.membership_id
JOIN profiles p ON p.id = m.user_id
WHERE p.email = 'ruanpereiranunes1@gmail.com'
ORDER BY bs.day_of_week;