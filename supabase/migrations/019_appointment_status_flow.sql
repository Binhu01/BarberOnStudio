-- =============================================================================
-- Migration 019: Appointment Status Flow, History & Temporary Reservations
-- Barber-On Studio — FASE 3: Agendamentos completos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADICIONAR CAMPOS DE AGENDAMENTO EM CALENDAR_EVENTS
-- -----------------------------------------------------------------------------
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
  'scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'
)),
ADD COLUMN IF NOT EXISTS barber_service_id UUID REFERENCES barber_services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_barber_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) CHECK (total_price >= 0),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'landing_page', 'recurring', 'whatsapp')),
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_barber ON calendar_events(assigned_barber_id, start_at) WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer ON calendar_events(customer_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_service ON calendar_events(barber_service_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_origin ON calendar_events(organization_id, origin);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_status ON calendar_events(organization_id, start_at, status);

-- -----------------------------------------------------------------------------
-- 2. TABELA: APPOINTMENT_STATUS_HISTORY (Histórico imutável de mudanças de status)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_status_history_event ON appointment_status_history(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_appt_status_history_org ON appointment_status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_appt_status_history_created ON appointment_status_history(organization_id, created_at DESC);

ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view appointment status history"
  ON appointment_status_history FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "System can insert appointment status history"
  ON appointment_status_history FOR INSERT
  WITH CHECK (is_member_of(organization_id));

-- Append-only: sem UPDATE ou DELETE

-- -----------------------------------------------------------------------------
-- 3. TABELA: TEMPORARY_RESERVATIONS (Reservas temporárias com expiração)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS temporary_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  barber_service_id UUID NOT NULL REFERENCES barber_services(id) ON DELETE CASCADE,
  assigned_barber_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'cancelled')),
  converted_booking_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temp_reservations_org ON temporary_reservations(organization_id);
CREATE INDEX IF NOT EXISTS idx_temp_reservations_expires ON temporary_reservations(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_temp_reservations_slot ON temporary_reservations(organization_id, assigned_barber_id, scheduled_at) WHERE status = 'active';

ALTER TABLE temporary_reservations ENABLE ROW LEVEL SECURITY;

-- Política pública: qualquer pessoa pode criar reserva temporária (sem auth)
CREATE POLICY "Anyone can create temporary reservation"
  ON temporary_reservations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update own temporary reservation"
  ON temporary_reservations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Members can view temporary reservations"
  ON temporary_reservations FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage temporary reservations"
  ON temporary_reservations FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_temporary_reservations_updated_at
  BEFORE UPDATE ON temporary_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. RPC: CHANGE_APPOINTMENT_STATUS
-- Altera status com registro automático no histórico e validação de transições
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION change_appointment_status(
  p_event_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_org_id UUID;
  v_valid_transitions TEXT[];
BEGIN
  -- Buscar status atual e org
  SELECT status, organization_id INTO v_current_status, v_org_id
  FROM calendar_events
  WHERE id = p_event_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_event_id;
  END IF;

  -- Validar transições permitidas
  CASE v_current_status
    WHEN 'scheduled' THEN v_valid_transitions := ARRAY['confirmed', 'cancelled', 'no_show'];
    WHEN 'confirmed' THEN v_valid_transitions := ARRAY['arrived', 'cancelled', 'no_show', 'scheduled'];
    WHEN 'arrived' THEN v_valid_transitions := ARRAY['in_progress', 'cancelled', 'no_show'];
    WHEN 'in_progress' THEN v_valid_transitions := ARRAY['completed', 'cancelled'];
    WHEN 'completed' THEN v_valid_transitions := ARRAY['cancelled']; -- permite estorno
    WHEN 'cancelled' THEN v_valid_transitions := ARRAY['scheduled']; -- permite reabrir
    WHEN 'no_show' THEN v_valid_transitions := ARRAY['scheduled']; -- permite reabrir
    ELSE v_valid_transitions := ARRAY[]::TEXT[];
  END CASE;

  IF NOT (p_new_status = ANY(v_valid_transitions)) THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Permitido: %', v_current_status, p_new_status, array_to_string(v_valid_transitions, ', ');
  END IF;

  -- Atualizar status e timestamps
  UPDATE calendar_events
  SET
    status = p_new_status,
    confirmed_at = CASE WHEN p_new_status = 'confirmed' AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' AND cancelled_at IS NULL THEN now() ELSE cancelled_at END,
    cancellation_reason = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(p_reason, cancellation_reason) ELSE cancellation_reason END,
    completed_at = CASE WHEN p_new_status = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_event_id;

  -- Registrar no histórico
  INSERT INTO appointment_status_history (
    organization_id, calendar_event_id, previous_status, new_status, changed_by, reason
  ) VALUES (
    v_org_id, p_event_id, v_current_status, p_new_status, COALESCE(p_changed_by, auth.uid()), p_reason
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: GET_APPOINTMENTS_WITH_DETAILS
-- Retorna agendamentos com dados completos do barbeiro, serviço e cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_appointments_with_details(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_barber_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
) RETURNS TABLE (
  event_id UUID,
  title TEXT,
  description TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  origin TEXT,
  total_price DECIMAL,
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  barber_name TEXT,
  barber_avatar TEXT,
  service_name TEXT,
  service_duration INT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  creator_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.title,
    ce.description,
    ce.start_at,
    ce.end_at,
    ce.status,
    ce.origin,
    ce.total_price,
    ce.notes,
    ce.confirmed_at,
    ce.cancelled_at,
    ce.cancellation_reason,
    ce.completed_at,
    bp.full_name AS barber_name,
    bp.avatar_url AS barber_avatar,
    bs.name AS service_name,
    bs.duration_minutes AS service_duration,
    cp.full_name AS customer_name,
    cp.phone AS customer_phone,
    cp.email AS customer_email,
    crp.full_name AS creator_name
  FROM calendar_events ce
  LEFT JOIN memberships bm ON bm.id = ce.assigned_barber_id
  LEFT JOIN profiles bp ON bp.id = bm.user_id
  LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
  LEFT JOIN profiles cp ON cp.id = ce.customer_id
  LEFT JOIN profiles crp ON crp.id = ce.created_by
  WHERE ce.organization_id = p_org_id
    AND (p_start_date IS NULL OR ce.start_at >= p_start_date)
    AND (p_end_date IS NULL OR ce.start_at <= p_end_date)
    AND (p_barber_id IS NULL OR ce.assigned_barber_id = p_barber_id)
    AND (p_status IS NULL OR ce.status = p_status)
  ORDER BY ce.start_at ASC
  LIMIT p_limit;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: CONVERT_PUBLIC_BOOKING_TO_APPOINTMENT
-- Converte um public_booking em calendar_event interno
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION convert_public_booking_to_appointment(
  p_booking_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_event_id UUID;
  v_membership_id UUID;
BEGIN
  -- Buscar booking
  SELECT * INTO v_booking
  FROM public_bookings
  WHERE id = p_booking_id;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking não encontrado: %', p_booking_id;
  END IF;

  -- Resolver membership_id do barbeiro (se atribuído)
  IF v_booking.assigned_barber_id IS NOT NULL THEN
    v_membership_id := v_booking.assigned_barber_id;
  END IF;

  -- Buscar nome do serviço para o título
  DECLARE
    v_service_name TEXT;
    v_customer_name TEXT;
  BEGIN
    SELECT name INTO v_service_name FROM barber_services WHERE id = v_booking.barber_service_id;
    v_customer_name := v_booking.customer_name;

    -- Criar calendar_event
    INSERT INTO calendar_events (
      organization_id, title, start_at, end_at, all_day,
      barber_service_id, assigned_barber_id, customer_id,
      status, total_price, notes, origin, color,
      confirmed_at, created_by
    ) VALUES (
      v_booking.organization_id,
      COALESCE(v_service_name, 'Serviço') || ' — ' || v_customer_name,
      v_booking.scheduled_at,
      v_booking.scheduled_at + (v_booking.duration_minutes || ' minutes')::INTERVAL,
      false,
      v_booking.barber_service_id,
      v_membership_id,
      NULL, -- customer_id será resolvido via phone/email se existir profile
      CASE WHEN v_booking.status = 'confirmed' THEN 'confirmed' ELSE 'scheduled' END,
      (SELECT price FROM barber_services WHERE id = v_booking.barber_service_id),
      v_booking.notes,
      'landing_page',
      '#0866E8',
      v_booking.confirmed_at,
      auth.uid()
    ) RETURNING id INTO v_event_id;

    -- Registrar no histórico
    INSERT INTO appointment_status_history (
      organization_id, calendar_event_id, previous_status, new_status, reason
    ) VALUES (
      v_booking.organization_id, v_event_id, NULL,
      CASE WHEN v_booking.status = 'confirmed' THEN 'confirmed' ELSE 'scheduled' END,
      'Convertido de agendamento público #' || v_booking.id
    );

    RETURN v_event_id;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: CLEANUP_EXPIRED_RESERVATIONS
-- Expira reservas temporárias que passaram do prazo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE temporary_reservations
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. MIGRAR DADOS EXISTENTES: definir status baseado em datas
-- -----------------------------------------------------------------------------
UPDATE calendar_events
SET
  status = CASE
    WHEN end_at < now() THEN 'completed'
    ELSE 'scheduled'
  END
WHERE status = 'scheduled'
  AND (barber_service_id IS NOT NULL OR assigned_barber_id IS NOT NULL);