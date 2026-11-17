-- =============================================================================
-- Fix DEFINITIVO v3: check_public_availability e get_public_available_slots
-- Usa DROP FUNCTION + CREATE FUNCTION (não CREATE OR REPLACE) para garantir
-- que versões antigas com colunas erradas sejam completamente removidas.
--
-- Schemas validados:
--   barber_schedules: membership_id, day_of_week, start_time (TIME), end_time (TIME),
--                     lunch_start (TIME), lunch_end (TIME), is_working_day
--   schedule_blocks:  organization_id, membership_id, start_at (TIMESTAMPTZ), end_at (TIMESTAMPTZ)
--   public_bookings:  organization_id, assigned_barber_id (→ memberships.id),
--                     scheduled_at (TIMESTAMPTZ), duration_minutes (INT), status (TEXT)
--   calendar_events:  NÃO possui assigned_barber_id nem status → NÃO usado aqui
--
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- Remover versões antigas das funções para evitar cache de definições incorretas
DROP FUNCTION IF EXISTS check_public_availability(UUID, UUID, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS get_public_available_slots(UUID, UUID, UUID, DATE);

-- =============================================================================
-- 1. check_public_availability
-- =============================================================================
CREATE FUNCTION check_public_availability(
  p_org_id UUID,
  p_barber_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_day_of_week INT;
  v_has_schedule BOOLEAN;
  v_has_block BOOLEAN;
  v_has_conflict BOOLEAN;
  v_slot_start TIME;
  v_slot_end TIME;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_scheduled_at);

  -- Extrair apenas a parte TIME do timestamp para comparar com barber_schedules
  v_slot_start := CAST(p_scheduled_at AS TIME);
  v_slot_end := CAST((p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL) AS TIME);

  -- 1. Verificar se o barbeiro trabalha neste dia e horário
  SELECT EXISTS (
    SELECT 1 FROM barber_schedules
    WHERE membership_id = p_barber_id
      AND organization_id = p_org_id
      AND day_of_week = v_day_of_week
      AND is_working_day = true
      AND start_time <= v_slot_start
      AND end_time >= v_slot_end
  ) INTO v_has_schedule;

  IF NOT v_has_schedule THEN
    RETURN false;
  END IF;

  -- 2. Verificar bloqueios de horário (schedule_blocks: start_at / end_at)
  SELECT EXISTS (
    SELECT 1 FROM schedule_blocks
    WHERE organization_id = p_org_id
      AND (membership_id IS NULL OR membership_id = p_barber_id)
      AND start_at < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND end_at > p_scheduled_at
  ) INTO v_has_block;

  IF v_has_block THEN
    RETURN false;
  END IF;

  -- 3. Verificar conflitos com outros agendamentos públicos
  SELECT EXISTS (
    SELECT 1 FROM public_bookings
    WHERE organization_id = p_org_id
      AND assigned_barber_id = p_barber_id
      AND status NOT IN ('cancelled')
      AND scheduled_at < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND (scheduled_at + (duration_minutes || ' minutes')::INTERVAL) > p_scheduled_at
  ) INTO v_has_conflict;

  RETURN NOT v_has_conflict;
END;
$fn$;

-- =============================================================================
-- 2. get_public_available_slots
-- =============================================================================
CREATE FUNCTION get_public_available_slots(
  p_org_id UUID,
  p_service_id UUID,
  p_barber_id UUID,
  p_date DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_duration INT;
  v_schedule RECORD;
  v_current TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_day_of_week INT;
BEGIN
  -- Buscar duração do serviço
  SELECT duration_minutes INTO v_duration
  FROM barber_services
  WHERE id = p_service_id AND organization_id = p_org_id;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date::TIMESTAMP);

  -- Buscar expediente do barbeiro para este dia
  SELECT * INTO v_schedule
  FROM barber_schedules
  WHERE membership_id = p_barber_id
    AND organization_id = p_org_id
    AND day_of_week = v_day_of_week
    AND is_working_day = true;

  IF v_schedule IS NULL THEN
    RETURN;
  END IF;

  -- Gerar slots a cada 30 minutos dentro do horário de trabalho
  v_current := (p_date::TEXT || ' ' || v_schedule.start_time::TEXT)::TIMESTAMPTZ;
  v_end := (p_date::TEXT || ' ' || v_schedule.end_time::TEXT)::TIMESTAMPTZ;

  WHILE v_current + (v_duration || ' minutes')::INTERVAL <= v_end LOOP
    -- Pular horário de almoço
    IF v_schedule.lunch_start IS NOT NULL AND v_schedule.lunch_end IS NOT NULL THEN
      IF CAST(v_current AS TIME) >= v_schedule.lunch_start
         AND CAST(v_current AS TIME) < v_schedule.lunch_end THEN
        v_current := v_current + INTERVAL '30 minutes';
        CONTINUE;
      END IF;
    END IF;

    -- Verificar disponibilidade
    IF check_public_availability(p_org_id, p_barber_id, v_current, v_duration) THEN
      slot_start := v_current;
      slot_end := v_current + (v_duration || ' minutes')::INTERVAL;
      RETURN NEXT;
    END IF;

    v_current := v_current + INTERVAL '30 minutes';
  END LOOP;
END;
$fn$;

-- =============================================================================
-- 3. Validação: confirmar que as funções foram criadas e testar execução
-- =============================================================================
SELECT 'check_public_availability' AS funcao,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname = 'check_public_availability' AND n.nspname = 'public'
       ) THEN '✅ OK' ELSE '❌ ERRO' END AS status
UNION ALL
SELECT 'get_public_available_slots',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname = 'get_public_available_slots' AND n.nspname = 'public'
       ) THEN '✅ OK' ELSE '❌ ERRO' END;

-- Teste rápido: buscar slots para amanhã (deve retornar resultados se seed foi executado)
-- Ajuste o service_id e barber_id conforme seu banco
-- SELECT * FROM get_public_available_slots(
--   '9f912f7c-4360-4763-b274-de60c2b98b9a'::UUID,
--   (SELECT id FROM barber_services WHERE organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a' LIMIT 1),
--   (SELECT m.id FROM memberships m JOIN profiles p ON p.id = m.user_id WHERE p.full_name = 'Lucas' AND m.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a' LIMIT 1),
--   CURRENT_DATE + 1
-- );