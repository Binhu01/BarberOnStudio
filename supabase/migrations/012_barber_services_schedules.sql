-- =============================================================================
-- Migration 012: Barber Services, Schedules & Blocks
-- Barber-On Studio — Sistema de gestão para barbearias
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BARBER SERVICES (Catálogo de serviços)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes INTEGER DEFAULT 0 CHECK (buffer_minutes >= 0),
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed', 'none')),
  commission_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_barber_services_org ON barber_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_category ON barber_services(category_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_active ON barber_services(organization_id, is_active);

ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barber services"
  ON barber_services FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barber services"
  ON barber_services FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barber_services_updated_at
  BEFORE UPDATE ON barber_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. BARBER SCHEDULES (Expedientes individuais por profissional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lunch_start TIME,
  lunch_end TIME,
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(membership_id, day_of_week),
  CHECK (end_time > start_time),
  CHECK (lunch_start IS NULL OR (lunch_end IS NOT NULL AND lunch_end > lunch_start)),
  CHECK (lunch_start IS NULL OR (lunch_start >= start_time AND lunch_end <= end_time))
);

CREATE INDEX IF NOT EXISTS idx_barber_schedules_org ON barber_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_barber_schedules_member ON barber_schedules(membership_id);

ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barber schedules"
  ON barber_schedules FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barber schedules"
  ON barber_schedules FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barber_schedules_updated_at
  BEFORE UPDATE ON barber_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. SCHEDULE BLOCKS (Bloqueios, folgas, feriados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('holiday', 'day_off', 'vacation', 'personal', 'maintenance', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_org ON schedule_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_member ON schedule_blocks(membership_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(organization_id, start_at, end_at);

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
-- 4. ALTER EMPLOYEE PROFILES (Adicionar campos de barbearia)
-- -----------------------------------------------------------------------------
ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS specialties TEXT[],
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed', 'none')),
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_available_for_booking BOOLEAN DEFAULT true;

-- -----------------------------------------------------------------------------
-- 5. ALTER CALENDAR EVENTS (Adicionar campos de agendamento)
-- -----------------------------------------------------------------------------
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS barber_service_id UUID REFERENCES barber_services(id),
  ADD COLUMN IF NOT EXISTS assigned_barber_id UUID REFERENCES memberships(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show')),
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_events_barber ON calendar_events(assigned_barber_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_service ON calendar_events(barber_service_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer ON calendar_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(organization_id, status);

-- -----------------------------------------------------------------------------
-- 6. SEED DEFAULT BARBER SERVICES
-- -----------------------------------------------------------------------------
INSERT INTO product_categories (organization_id, name, description, is_active)
SELECT id, 'Cortes', 'Serviços de corte de cabelo', true
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories
  WHERE organization_id = organizations.id AND name = 'Cortes'
)
LIMIT 1;

-- -----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('barber_services.view', 'barber_services', 'view', 'Visualizar serviços da barbearia'),
  ('barber_services.create', 'barber_services', 'create', 'Criar novos serviços'),
  ('barber_services.update', 'barber_services', 'update', 'Atualizar serviços existentes'),
  ('barber_services.delete', 'barber_services', 'delete', 'Remover serviços'),
  ('barber_schedules.view', 'barber_schedules', 'view', 'Visualizar expedientes'),
  ('barber_schedules.manage', 'barber_schedules', 'manage', 'Gerenciar expedientes de profissionais'),
  ('schedule_blocks.view', 'schedule_blocks', 'view', 'Visualizar bloqueios de agenda'),
  ('schedule_blocks.manage', 'schedule_blocks', 'manage', 'Gerenciar bloqueios e folgas')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant to OWNER and ADMIN roles
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
  AND p.permission_key IN (
    'barber_services.view', 'barber_services.create', 'barber_services.update', 'barber_services.delete',
    'barber_schedules.view', 'barber_schedules.manage',
    'schedule_blocks.view', 'schedule_blocks.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to MANAGER and BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('MANAGER', 'EMPLOYEE')
  AND p.permission_key IN (
    'barber_services.view',
    'barber_schedules.view',
    'schedule_blocks.view'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Function to check if a time slot is available for a barber
CREATE OR REPLACE FUNCTION check_barber_availability(
  p_org_id UUID,
  p_barber_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_event_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  -- Check for overlapping events
  SELECT COUNT(*) INTO v_conflict_count
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND assigned_barber_id = p_barber_id
    AND id != COALESCE(p_exclude_event_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND status NOT IN ('cancelled', 'no_show')
    AND (
      (start_at < p_end_time AND end_at > p_start_time)
    );

  -- Check for schedule blocks
  SELECT COUNT(*) INTO v_conflict_count
  FROM schedule_blocks
  WHERE organization_id = p_org_id
    AND (membership_id = p_barber_id OR membership_id IS NULL)
    AND (
      (start_at < p_end_time AND end_at > p_start_time)
    );

  RETURN v_conflict_count = 0;
END;
$$;

-- Function to get available time slots for a barber on a specific date
CREATE OR REPLACE FUNCTION get_barber_available_slots(
  p_org_id UUID,
  p_barber_id UUID,
  p_date DATE
)
RETURNS TABLE (
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule barber_schedules%ROWTYPE;
  v_day_of_week INTEGER;
  v_current_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Get schedule for this day
  SELECT * INTO v_schedule
  FROM barber_schedules
  WHERE organization_id = p_org_id
    AND membership_id = p_barber_id
    AND day_of_week = v_day_of_week
    AND is_working_day = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Generate time slots (every 30 minutes)
  v_current_time := p_date + v_schedule.start_time::TIME;
  v_end_time := p_date + v_schedule.end_time::TIME;

  WHILE v_current_time < v_end_time LOOP
    -- Check if this slot is available
    IF check_barber_availability(p_org_id, p_barber_id, v_current_time, v_current_time + INTERVAL '30 minutes') THEN
      RETURN QUERY SELECT v_current_time, v_current_time + INTERVAL '30 minutes';
    END IF;
    v_current_time := v_current_time + INTERVAL '30 minutes';
  END LOOP;
END;
$$;

COMMENT ON TABLE barber_services IS 'Catálogo de serviços da barbearia com duração, preço e comissão';
COMMENT ON TABLE barber_schedules IS 'Expedientes semanais individuais por profissional';
COMMENT ON TABLE schedule_blocks IS 'Bloqueios de agenda: feriados, folgas, férias, manutenção';
COMMENT ON FUNCTION check_barber_availability IS 'Verifica se um horário está disponível para um barbeiro';
COMMENT ON FUNCTION get_barber_available_slots IS 'Retorna slots de horário disponíveis para um barbeiro em uma data';