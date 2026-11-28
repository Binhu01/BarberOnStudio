-- =============================================================================
-- Seed DEFINITIVO v4 — Para o projeto Supabase CORRETO (idymvdboboixjtywhdcd)
-- IMPORTANTE: Execute este SQL no Supabase Dashboard do projeto cuja URL
-- termina com "idymvdboboixjtywhdcd" — é o mesmo que a produção Vercel usa.
-- =============================================================================

DO $$
DECLARE
 v_org_id UUID;
 v_ruan_uid UUID;
 v_ruan_membership UUID;
 v_lucas_uid UUID;
 v_lucas_membership UUID;
BEGIN
 -- 1. Encontrar a organização
 SELECT id INTO v_org_id FROM organizations LIMIT 1;

 IF v_org_id IS NULL THEN
 RAISE EXCEPTION 'Nenhuma organização encontrada!';
 END IF;

 RAISE NOTICE 'Organização: %', v_org_id;

 -- 2. Encontrar o Ruan pelo email
 SELECT id INTO v_ruan_uid
 FROM profiles
 WHERE email = 'ruanpereiranunes1@gmail.com'
 LIMIT 1;

 IF v_ruan_uid IS NULL THEN
 RAISE EXCEPTION 'Profile do Ruan não encontrado!';
 END IF;

 RAISE NOTICE 'UID do Ruan: %', v_ruan_uid;

 -- 3. Encontrar/criar membership do Ruan
 SELECT id INTO v_ruan_membership
 FROM memberships
 WHERE organization_id = v_org_id AND user_id = v_ruan_uid
 LIMIT 1;

 IF v_ruan_membership IS NULL THEN
 INSERT INTO memberships (organization_id, user_id, role, status)
 VALUES (v_org_id, v_ruan_uid, 'OWNER', 'active')
 RETURNING id INTO v_ruan_membership;
 RAISE NOTICE 'Membership do Ruan CRIADA: %', v_ruan_membership;
 ELSE
 RAISE NOTICE 'Membership do Ruan encontrada: %', v_ruan_membership;
 END IF;

 -- 4. Limpar schedules antigos do Ruan
 DELETE FROM barber_schedules
 WHERE organization_id = v_org_id AND membership_id = v_ruan_membership;

 -- 5. Inserir horários do Ruan
 INSERT INTO barber_schedules (organization_id, membership_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_working_day)
 VALUES
 (v_org_id, v_ruan_membership, 0, '09:00', '19:00', NULL, NULL, false),
 (v_org_id, v_ruan_membership, 1, '09:00', '19:00', NULL, NULL, true),
 (v_org_id, v_ruan_membership, 2, '09:00', '19:00', '12:00', '13:00', true),
 (v_org_id, v_ruan_membership, 3, '09:00', '19:00', '12:00', '13:00', true),
 (v_org_id, v_ruan_membership, 4, '09:00', '19:00', NULL, NULL, true),
 (v_org_id, v_ruan_membership, 5, '09:00', '20:00', NULL, NULL, true),
 (v_org_id, v_ruan_membership, 6, '09:00', '20:00', NULL, NULL, true);

 RAISE NOTICE '✅ Horários do Ruan configurados!';
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
ORDER BY p.full_name, bs.day_of_week;