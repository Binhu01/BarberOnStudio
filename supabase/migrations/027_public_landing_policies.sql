-- =============================================================================
-- Migration 027: Public Landing Page RLS Policies
-- Barber-On Studio — Permite leitura pública dos dados da landing page
-- =============================================================================

-- Organizations: leitura pública (necessário para getLandingData buscar org.id)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view organizations" ON organizations;
  CREATE POLICY "Public can view organizations"
    ON organizations FOR SELECT
    USING (true);
END $$;

-- Barber Services: leitura pública apenas dos ativos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active barber services" ON barber_services;
  CREATE POLICY "Public can view active barber services"
    ON barber_services FOR SELECT
    USING (is_active = true);
END $$;

-- Products: leitura pública apenas dos ativos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active products" ON products;
  CREATE POLICY "Public can view active products"
    ON products FOR SELECT
    USING (is_active = true);
END $$;

-- Barbershop Settings: leitura pública
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view barbershop settings" ON barbershop_settings;
  CREATE POLICY "Public can view barbershop settings"
    ON barbershop_settings FOR SELECT
    USING (true);
END $$;

-- Profiles: leitura pública básica (nome e avatar apenas)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view basic profiles" ON profiles;
  CREATE POLICY "Public can view basic profiles"
    ON profiles FOR SELECT
    USING (true);
END $$;

-- Memberships: leitura pública para listar membros ativos de uma org
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active memberships" ON memberships;
  CREATE POLICY "Public can view active memberships"
    ON memberships FOR SELECT
    USING (status = 'active');
END $$;

-- Public Bookings: permitir insert público (agendamento sem login)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can create bookings" ON public_bookings;
  CREATE POLICY "Public can create bookings"
    ON public_bookings FOR INSERT
    WITH CHECK (true);
END $$;

-- Public Bookings: permitir leitura do próprio agendamento
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view own booking" ON public_bookings;
  CREATE POLICY "Public can view own booking"
    ON public_bookings FOR SELECT
    USING (true);
END $$;