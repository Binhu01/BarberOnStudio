-- =============================================================================
-- Seed DEFINITIVO v5 — Para o projeto Supabase de PRODUÇÃO REAL
-- Project ID: ghqgskyhfdlpqdclwhdq
-- Org ID real: 9f912f7c-4360-4763-b274-de60c2b98b9a
--
-- IMPORTANTE: Execute este SQL no Supabase Dashboard → SQL Editor
-- do projeto BarberOn com project ID ghqgskyhfdlpqdclwhdq
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID := '9f912f7c-4360-4763-b274-de60c2b98b9a';
  v_ruan_membership UUID := '689e8019-c11a-4d6b-95b5-7521ce834c11';
  v_lucas_membership UUID := '3647d9cb-14db-4f46-aec2-3765356aa810';
BEGIN
  -- Verificar se a membership do Ruan existe
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

  RAISE NOTICE '✅ Horários do Ruan configurados com sucesso!';

  -- Também configurar horários para Lucas (membership 3647d9cb)
  DELETE FROM barber_schedules
  WHERE organization_id = v_org_id AND membership_id = v_lucas_membership;

  INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
  VALUES
    (v_org_id, v_lucas_membership, 0, '09:00', '19:00', NULL, NULL, false),
    (v_org_id, v_lucas_membership, 1, '09:00', '19:00', NULL, NULL, true),
    (v_org_id, v_lucas_membership, 2, '09:00', '19:00', '12:00', '13:00', true),
    (v_org_id, v_lucas_membership, 3, '09:00', '19:00', '12:00', '13:00', true),
    (v_org_id, v_lucas_membership, 4, '09:00', '19:00', NULL, NULL, true),
    (v_org_id, v_lucas_membership, 5, '09:00', '20:00', NULL, NULL, true),
    (v_org_id, v_lucas_membership, 6, '09:00', '20:00', NULL, NULL, true);

  RAISE NOTICE '✅ Horários do Lucas configurados com sucesso!';
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
WHERE bs.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
ORDER BY p.full_name, bs.day_of_week;