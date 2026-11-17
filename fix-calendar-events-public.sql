-- =============================================================================
-- Fix: Permitir calendar_events sem created_by (agendamentos públicos)
-- A coluna created_by era NOT NULL, impedindo inserts via cliente anon da landing.
-- Também garante que as colunas da migration 019 existam.
--
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Tornar created_by opcional para permitir agendamentos públicos
ALTER TABLE calendar_events
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Garantir que todas as colunas da migration 019 existam
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

-- 3. Índices úteis
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_barber ON calendar_events(assigned_barber_id, start_at) WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX IF NOT EXISTS idx_calendar_events_origin ON calendar_events(organization_id, origin);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_status ON calendar_events(organization_id, start_at, status);

-- 4. Criar RPC get_appointments_with_details se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_appointments_with_details' AND n.nspname = 'public'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION get_appointments_with_details(
        p_org_id UUID,
        p_start_date TIMESTAMPTZ DEFAULT NULL,
        p_end_date TIMESTAMPTZ DEFAULT NULL,
        p_barber_id UUID DEFAULT NULL,
        p_status TEXT DEFAULT NULL,
        p_limit INT DEFAULT 100
      ) RETURNS TABLE (
        event_id UUID, title TEXT, description TEXT,
        start_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
        status TEXT, origin TEXT, total_price DECIMAL,
        notes TEXT, confirmed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ, cancellation_reason TEXT,
        completed_at TIMESTAMPTZ,
        barber_name TEXT, barber_avatar TEXT,
        service_name TEXT, service_duration INT,
        customer_name TEXT, customer_phone TEXT,
        customer_email TEXT, creator_name TEXT
      )
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
      AS $body$
      BEGIN
        RETURN QUERY
        SELECT ce.id, ce.title, ce.description, ce.start_at, ce.end_at,
               ce.status, ce.origin, ce.total_price, ce.notes,
               ce.confirmed_at, ce.cancelled_at, ce.cancellation_reason, ce.completed_at,
               bp.full_name, bp.avatar_url,
               bs.name, bs.duration_minutes,
               cp.full_name, cp.phone, cp.email,
               crp.full_name
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
      $body$
    $fn$;
  END IF;
END $$;

-- 5. Validação
SELECT 'created_by nullable' AS check_item,
       CASE WHEN is_nullable = 'YES' THEN '✅ OK' ELSE '❌ ERRO' END AS status
FROM information_schema.columns
WHERE table_name = 'calendar_events' AND column_name = 'created_by'
UNION ALL
SELECT 'status column exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'calendar_events' AND column_name = 'status'
       ) THEN '✅ OK' ELSE '❌ ERRO' END
UNION ALL
SELECT 'origin column exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'calendar_events' AND column_name = 'origin'
       ) THEN '✅ OK' ELSE '❌ ERRO' END
UNION ALL
SELECT 'get_appointments_with_details RPC',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname = 'get_appointments_with_details' AND n.nspname = 'public'
       ) THEN '✅ OK' ELSE '❌ ERRO' END;