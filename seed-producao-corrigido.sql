-- =============================================================================
-- Seed CORRIGIDO para PRODUÇÃO (barber-on-studio.vercel.app)
-- Projeto Supabase: idymvdboboixjtywhdcd
-- Org ID real: 54f8c7ce-6bc1-40eb-b069-fcc71174ec07
--
-- IMPORTANTE: Execute este SQL no Supabase Dashboard → SQL Editor
-- do projeto conectado à barber-on-studio.vercel.app
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID := '54f8c7ce-6bc1-40eb-b069-fcc71174ec07';
  v_ruan_uid UUID := '121f3b84-2ce3-4854-b588-261fa0b12800';
  v_ruan_membership UUID;
BEGIN
  -- Verificar se Ruan já tem membership nesta org
  SELECT m.id INTO v_ruan_membership
  FROM memberships m
  WHERE m.organization_id = v_org_id
    AND m.user_id = v_ruan_uid;

  -- Se não existe, criar profile e membership para Ruan
  IF v_ruan_membership IS NULL THEN
    -- Garantir que o profile existe
    INSERT INTO profiles (id, email, full_name)
    VALUES (v_ruan_uid, 'ruanpereiranunes1@gmail.com', 'Ruan')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

    -- Criar membership como OWNER (dono da barbearia)
    INSERT INTO memberships (organization_id, user_id, role, status)
    VALUES (v_org_id, v_ruan_uid, 'OWNER', 'active')
    ON CONFLICT (organization_id, user_id) DO NOTHING
    RETURNING id INTO v_ruan_membership;

    -- Se ainda null (conflito), buscar novamente
    IF v_ruan_membership IS NULL THEN
      SELECT m.id INTO v_ruan_membership
      FROM memberships m
      WHERE m.organization_id = v_org_id AND m.user_id = v_ruan_uid;
    END IF;

    RAISE NOTICE 'Membership do Ruan criada/encontrada: %', v_ruan_membership;
  ELSE
    RAISE NOTICE 'Membership do Ruan já existe: %', v_ruan_membership;
  END IF;

  -- Limpar schedules antigos do Ruan nesta org (se houver)
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