-- =============================================================================
-- Migration 014: Public Bookings & Schedule Blocks
-- Barber-On Studio — Agendamento público e bloqueio de horários
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PUBLIC BOOKINGS (Agendamentos feitos por clientes sem login)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  barber_service_id UUID NOT NULL REFERENCES barber_services(id) ON DELETE CASCADE,
  assigned_barber_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  confirmation_token TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_bookings_org ON public_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_service ON public_bookings(barber_service_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_barber ON public_bookings(assigned_barber_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_status ON public_bookings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_public_bookings_date ON public_bookings(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_public_bookings_token ON public_bookings(confirmation_token);

ALTER TABLE public_bookings ENABLE ROW LEVEL SECURITY;

-- Política pública: qualquer pessoa pode criar booking (sem auth)
CREATE POLICY "Anyone can create public booking"
  ON public_bookings FOR INSERT
  WITH CHECK (true);

-- Política pública: confirmar/cancelar via token (sem auth)
CREATE POLICY "Anyone can confirm/cancel via token"
  ON public_bookings FOR UPDATE
  USING (confirmation_token IS NOT NULL)
  WITH CHECK (confirmation_token IS NOT NULL);

-- Membros da org podem ver e gerenciar todos os bookings
CREATE POLICY "Members can view public bookings"
  ON public_bookings FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage public bookings"
  ON public_bookings FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_public_bookings_updated_at
  BEFORE UPDATE ON public_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. SCHEDULE BLOCKS (Bloqueios de horário — folgas, férias, manutenção)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reason TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_days INT[], -- array of day_of_week (0-6)
  recurring_until TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_block_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_org ON schedule_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_member ON schedule_blocks(membership_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_dates ON schedule_blocks(organization_id, starts_at, ends_at);

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view schedule blocks"
  ON schedule_blocks FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage schedule blocks"
  ON schedule_blocks FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_schedule_blocks_updated_at
  BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. BARBERSHOP SETTINGS (Configurações da barbearia para agendamento público)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barbershop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  public_slug TEXT UNIQUE,
  shop_name TEXT NOT NULL,
  shop_description TEXT,
  shop_address TEXT,
  shop_phone TEXT,
  shop_logo_url TEXT,
  booking_enabled BOOLEAN NOT NULL DEFAULT true,
  advance_booking_days INT NOT NULL DEFAULT 30 CHECK (advance_booking_days >= 1 AND advance_booking_days <= 365),
  min_advance_hours INT NOT NULL DEFAULT 2 CHECK (min_advance_hours >= 0),
  auto_confirm BOOLEAN NOT NULL DEFAULT false,
  allow_barber_selection BOOLEAN NOT NULL DEFAULT true,
  whatsapp_reminder_hours INT NOT NULL DEFAULT 24,
  primary_color TEXT NOT NULL DEFAULT '#C9A96E',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE barbershop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barbershop settings"
  ON barbershop_settings FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barbershop settings"
  ON barbershop_settings FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barbershop_settings_updated_at
  BEFORE UPDATE ON barbershop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Verifica disponibilidade considerando expedientes + bloqueios + bookings existentes
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
      AND starts_at < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND ends_at > p_scheduled_at
  ) INTO v_has_block;

  IF v_has_block THEN
    RETURN false;
  END IF;

  -- 3. Verificar conflitos com outros agendamentos
  SELECT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE organization_id = p_org_id
      AND assigned_barber_id = p_barber_id
      AND status NOT IN ('cancelled')
      AND start_time < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND end_time > p_scheduled_at
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

-- Obtém horários disponíveis para um serviço/barbeiro em uma data
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

-- -----------------------------------------------------------------------------
-- 5. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('bookings.view', 'bookings', 'view', 'Visualizar agendamentos públicos'),
  ('bookings.manage', 'bookings', 'manage', 'Gerenciar agendamentos públicos'),
  ('blocks.view', 'blocks', 'view', 'Visualizar bloqueios de horário'),
  ('blocks.manage', 'blocks', 'manage', 'Gerenciar bloqueios de horário'),
  ('settings.barbershop', 'settings', 'barbershop', 'Configurar barbearia')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
  AND p.permission_key IN (
    'bookings.view', 'bookings.manage',
    'blocks.view', 'blocks.manage',
    'settings.barbershop'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant operational to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
  AND p.permission_key IN (
    'bookings.view', 'bookings.manage',
    'blocks.view', 'blocks.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to EMPLOYEE/BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
  AND p.permission_key IN ('bookings.view', 'blocks.view')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public_bookings IS 'Agendamentos feitos por clientes via página pública (sem login)';
COMMENT ON TABLE schedule_blocks IS 'Bloqueios de horário: folgas, férias, manutenção, eventos';
COMMENT ON TABLE barbershop_settings IS 'Configurações da barbearia para agendamento público e personalização';
COMMENT ON FUNCTION check_public_availability IS 'Verifica se um horário está disponível considerando expediente, bloqueios e agendamentos';
COMMENT ON FUNCTION get_public_available_slots IS 'Retorna slots disponíveis para agendamento público em uma data';