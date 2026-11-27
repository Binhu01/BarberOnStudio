-- =============================================================================
-- Migration 028: Fix Public Booking RPCs
-- Barber-On Studio — Corrige nomes de colunas nas funções de agendamento público
--
-- As funções check_public_availability e get_public_available_slots referenciavam
-- colunas start_time/end_time em calendar_events, mas os nomes corretos são
-- start_at/end_at. Esta migration recria as funções com os nomes corretos.
--
-- Execute no Supabase Dashboard → SQL Editor se a migration automática não rodar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX: check_public_availability
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_public_availability(
  p_org_id UUID,
  p_barber_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_of_week INT;
  v_has_schedule BOOLEAN;
  v_has_block BOOLEAN;
  v_has_conflict BOOLEAN;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_scheduled_at);

  -- 1. Verificar se o barbeiro trabalha neste dia
  SELECT EXISTS (
    SELECT 1 FROM barber_schedules
    WHERE membership_id = p_barber_id
      AND organization_id = p_org_id
      AND day_of_week = v_day_of_week
      AND is_working_day = true
      AND start_time <= p_scheduled_at::TIME
      AND end_time >= (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
  ) INTO v_has_schedule;

  IF NOT v_has_schedule THEN
    RETURN false;
  END IF;

  -- 2. Verificar bloqueios
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

  -- 3. Verificar conflitos com outros agendamentos (calendar_events usa start_at/end_at)
  SELECT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE organization_id = p_org_id
      AND assigned_barber_id = p_barber_id
      AND status NOT IN ('cancelled')
      AND start_at < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND end_at > p_scheduled_at
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RETURN false;
  END IF;

  -- 4. Verificar conflitos com outros bookings públicos
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
$$;

-- -----------------------------------------------------------------------------
-- 2. FIX: get_public_available_slots
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_available_slots(
  p_org_id UUID,
  p_service_id UUID,
  p_barber_id UUID,
  p_date DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_current := (p_date || ' ' || v_schedule.start_time)::TIMESTAMPTZ;
  v_end := (p_date || ' ' || v_schedule.end_time)::TIMESTAMPTZ;

  WHILE v_current + (v_duration || ' minutes')::INTERVAL <= v_end LOOP
    -- Pular horário de almoço
    IF v_schedule.lunch_start IS NOT NULL AND v_schedule.lunch_end IS NOT NULL THEN
      IF v_current::TIME >= v_schedule.lunch_start::TIME
         AND v_current::TIME < v_schedule.lunch_end::TIME THEN
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
$$;

-- Comentários
COMMENT ON FUNCTION check_public_availability IS 'Verifica se um horário está disponível considerando expediente, bloqueios e agendamentos (corrigido: usa start_at/end_at em calendar_events)';
COMMENT ON FUNCTION get_public_available_slots IS 'Retorna slots disponíveis para agendamento público em uma data (corrigido: usa start_at/end_at em calendar_events)';