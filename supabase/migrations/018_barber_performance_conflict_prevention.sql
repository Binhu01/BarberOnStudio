-- =============================================================================
-- Migration 018: Barber Performance Fields & Conflict Prevention RPC
-- Barber-On Studio — FASE 2: Cadastros e Disponibilidade
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADICIONAR CAMPOS DE DESEMPENHO E INSTAGRAM EM EMPLOYEE_PROFILES
-- -----------------------------------------------------------------------------
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS total_appointments INT NOT NULL DEFAULT 0 CHECK (total_appointments >= 0),
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) CHECK (avg_rating IS NULL OR (avg_rating >= 0 AND avg_rating <= 5)),
ADD COLUMN IF NOT EXISTS last_appointment_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_employee_profiles_instagram ON employee_profiles(organization_id, instagram) WHERE instagram IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_profiles_performance ON employee_profiles(organization_id, total_revenue DESC);

-- -----------------------------------------------------------------------------
-- 2. VIEW: V_BARBER_PERFORMANCE
-- Visão consolidada de desempenho por profissional
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_barber_performance AS
SELECT
  ep.id AS employee_profile_id,
  ep.organization_id,
  ep.membership_id,
  p.full_name,
  p.avatar_url,
  ep.job_title,
  ep.specialties,
  ep.instagram,
  ep.commission_type,
  ep.commission_rate,
  ep.is_available_for_booking,
  ep.total_appointments,
  ep.total_revenue,
  ep.avg_rating,
  ep.last_appointment_at,
  -- Métricas calculadas do mês atual
  COALESCE(monthly.stats_count, 0) AS monthly_appointments,
  COALESCE(monthly.stats_revenue, 0) AS monthly_revenue,
  COALESCE(monthly.stats_commission, 0) AS monthly_commission
FROM employee_profiles ep
JOIN memberships m ON m.id = ep.membership_id
JOIN profiles p ON p.id = m.user_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS stats_count,
    SUM(bc.commission_amount) AS stats_revenue,
    SUM(bc.commission_amount) AS stats_commission
  FROM barber_commissions bc
  WHERE bc.membership_id = ep.membership_id
    AND bc.organization_id = ep.organization_id
    AND bc.created_at >= date_trunc('month', CURRENT_DATE)
    AND bc.status != 'cancelled'
) monthly ON true;

-- -----------------------------------------------------------------------------
-- 3. RPC: CHECK_APPOINTMENT_CONFLICT
-- Verifica conflitos de horário antes de criar/editar agendamento
-- Retorna tabela vazia se não houver conflito, ou detalhes do conflito
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_org_id UUID,
  p_barber_membership_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_appointment_id UUID DEFAULT NULL
) RETURNS TABLE (
  conflict_type TEXT,
  conflicting_id UUID,
  conflicting_title TEXT,
  conflicting_start TIMESTAMPTZ,
  conflicting_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Verificar agendamentos existentes no mesmo horário
  RETURN QUERY
  SELECT
    'appointment'::TEXT,
    ce.id,
    ce.title,
    ce.start_at,
    ce.end_at
  FROM calendar_events ce
  WHERE ce.organization_id = p_org_id
    AND ce.assigned_barber_id = p_barber_membership_id
    AND ce.id != COALESCE(p_exclude_appointment_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND ce.start_at < p_end_time
    AND ce.end_at > p_start_time
    AND ce.status NOT IN ('cancelled', 'no_show');

  IF FOUND THEN RETURN; END IF;

  -- 2. Verificar bloqueios de horário
  RETURN QUERY
  SELECT
    'block'::TEXT,
    sb.id,
    sb.title,
    sb.starts_at,
    sb.ends_at
  FROM schedule_blocks sb
  WHERE sb.organization_id = p_org_id
    AND (sb.membership_id = p_barber_membership_id OR sb.membership_id IS NULL)
    AND sb.starts_at < p_end_time
    AND sb.ends_at > p_start_time;

  IF FOUND THEN RETURN; END IF;

  -- 3. Verificar expediente do profissional
  DECLARE
    v_day_of_week INT;
    v_has_schedule BOOLEAN;
    v_in_working_hours BOOLEAN;
    v_in_lunch_break BOOLEAN;
  BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_start_time);

    SELECT
      COUNT(*) > 0,
      BOOL_OR(
        bs.is_working_day
        AND p_start_time::TIME >= bs.start_time
        AND p_end_time::TIME <= bs.end_time
      ),
      BOOL_OR(
        bs.lunch_start IS NOT NULL
        AND p_start_time::TIME < bs.lunch_end
        AND p_end_time::TIME > bs.lunch_start
      )
    INTO v_has_schedule, v_in_working_hours, v_in_lunch_break
    FROM barber_schedules bs
    WHERE bs.membership_id = p_barber_membership_id
      AND bs.day_of_week = v_day_of_week;

    IF v_has_schedule AND NOT v_in_working_hours THEN
      conflict_type := 'outside_working_hours';
      conflicting_id := NULL;
      conflicting_title := 'Fora do horário de expediente';
      conflicting_start := p_start_time;
      conflicting_end := p_end_time;
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_in_lunch_break THEN
      conflict_type := 'lunch_break';
      conflicting_id := NULL;
      conflicting_title := 'Horário de almoço';
      conflicting_start := p_start_time;
      conflicting_end := p_end_time;
      RETURN NEXT;
      RETURN;
    END IF;
  END;

  -- 4. Verificar disponibilidade do profissional
  DECLARE
    v_is_available BOOLEAN;
  BEGIN
    SELECT is_available_for_booking INTO v_is_available
    FROM employee_profiles
    WHERE membership_id = p_barber_membership_id
      AND organization_id = p_org_id;

    IF v_is_available = false THEN
      conflict_type := 'barber_unavailable';
      conflicting_id := NULL;
      conflicting_title := 'Profissional indisponível para agendamento';
      conflicting_start := p_start_time;
      conflicting_end := p_end_time;
      RETURN NEXT;
      RETURN;
    END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC: CREATE_APPOINTMENT_WITH_CONFLICT_CHECK
-- Cria agendamento com verificação transacional de conflitos
-- Previne race conditions usando advisory lock
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_appointment_with_conflict_check(
  p_org_id UUID,
  p_title TEXT,
  p_barber_membership_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_total_price DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'scheduled'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict RECORD;
  v_lock_key BIGINT;
BEGIN
  -- Advisory lock baseado no barbeiro + data para prevenir race conditions
  v_lock_key := hashtext(p_barber_membership_id::TEXT || p_start_time::DATE::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Verificar conflitos
  FOR v_conflict IN
    SELECT * FROM check_appointment_conflict(
      p_org_id, p_barber_membership_id, p_start_time, p_end_time
    )
  LOOP
    RAISE EXCEPTION 'Conflito detectado: % (%)', v_conflict.conflict_type, v_conflict.conflicting_title;
  END LOOP;

  -- Criar o agendamento
  INSERT INTO calendar_events (
    organization_id, title, description, start_at, end_at, all_day,
    barber_service_id, assigned_barber_id, customer_id, status,
    total_price, notes, created_by, color
  ) VALUES (
    p_org_id, p_title, NULL, p_start_time, p_end_time, false,
    p_service_id, p_barber_membership_id, p_customer_id, p_status,
    p_total_price, p_notes, COALESCE(p_created_by, auth.uid()), '#0866E8'
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGER: ATUALIZAR MÉTRICAS DE DESEMPENHO AO FINALIZAR AGENDAMENTO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_barber_performance_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE employee_profiles
    SET
      total_appointments = total_appointments + 1,
      total_revenue = total_revenue + COALESCE(NEW.total_price, 0),
      last_appointment_at = NEW.end_at,
      updated_at = now()
    WHERE membership_id = NEW.assigned_barber_id
      AND organization_id = NEW.organization_id;
  ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    -- Reverter métricas se status mudou de completed para outro
    UPDATE employee_profiles
    SET
      total_appointments = GREATEST(0, total_appointments - 1),
      total_revenue = GREATEST(0, total_revenue - COALESCE(OLD.total_price, 0)),
      updated_at = now()
    WHERE membership_id = OLD.assigned_barber_id
      AND organization_id = OLD.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_barber_performance ON calendar_events;
CREATE TRIGGER trg_update_barber_performance
  AFTER UPDATE OF status ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_barber_performance_on_completion();

-- -----------------------------------------------------------------------------
-- 6. RPC: VALIDATE_SCHEDULE_AGAINST_GENERAL
-- Valida expediente individual contra regras gerais da barbearia
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_schedule_against_general(
  p_org_id UUID,
  p_membership_id UUID,
  p_day_of_week INT,
  p_start_time TIME,
  p_end_time TIME,
  p_lunch_start TIME DEFAULT NULL,
  p_lunch_end TIME DEFAULT NULL
) RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
BEGIN
  -- Buscar configurações gerais da barbearia
  SELECT * INTO v_settings
  FROM barbershop_settings
  WHERE organization_id = p_org_id;

  -- Se não há settings configurados, validar apenas consistência interna
  IF v_settings IS NULL THEN
    IF p_end_time <= p_start_time THEN
      is_valid := false;
      error_message := 'Horário final deve ser posterior ao inicial';
      RETURN NEXT;
      RETURN;
    END IF;
    is_valid := true;
    error_message := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Validar horário mínimo e máximo geral
  IF v_settings.opening_time IS NOT NULL AND p_start_time < v_settings.opening_time THEN
    is_valid := false;
    error_message := format('Horário inicial (%s) é anterior à abertura da barbearia (%s)', p_start_time, v_settings.opening_time);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_settings.closing_time IS NOT NULL AND p_end_time > v_settings.closing_time THEN
    is_valid := false;
    error_message := format('Horário final (%s) é posterior ao fechamento da barbearia (%s)', p_end_time, v_settings.closing_time);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Validar intervalo de almoço
  IF p_lunch_start IS NOT NULL AND p_lunch_end IS NOT NULL THEN
    IF p_lunch_end <= p_lunch_start THEN
      is_valid := false;
      error_message := 'Fim do almoço deve ser posterior ao início';
      RETURN NEXT;
      RETURN;
    END IF;
    IF p_lunch_start < p_start_time OR p_lunch_end > p_end_time THEN
      is_valid := false;
      error_message := 'Intervalo de almoço deve estar dentro do expediente';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  is_valid := true;
  error_message := NULL;
  RETURN NEXT;
END;
$$;