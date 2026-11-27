-- Migration 030: RPC SECURITY DEFINER para criar calendar_event junto com booking público
-- Contorna RLS da tabela calendar_events quando o booking é criado via anon key na landing page
-- created_by requer UUID de profiles(id), então passamos o user_id do barbeiro

CREATE OR REPLACE FUNCTION create_public_calendar_event(
  p_organization_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_barber_service_id UUID,
  p_assigned_barber_id UUID,
  p_total_price NUMERIC,
  p_status TEXT,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO calendar_events (
    organization_id,
    title,
    description,
    start_at,
    end_at,
    all_day,
    barber_service_id,
    assigned_barber_id,
    total_price,
    status,
    origin,
    notes,
    confirmed_at,
    created_by
  ) VALUES (
    p_organization_id,
    p_title,
    p_description,
    p_start_at,
    p_end_at,
    false,
    p_barber_service_id,
    p_assigned_barber_id,
    p_total_price,
    p_status,
    'landing_page',
    p_notes,
    now(),
    p_created_by
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;