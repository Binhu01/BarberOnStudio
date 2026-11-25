-- =============================================================================
-- BARBER-ON QA: Fix RLS para acesso público às informações da organização
-- =============================================================================

-- Permitir leitura pública das organizações (necessário para página de agendamento)
DROP POLICY IF EXISTS "Public can read organizations" ON organizations;

CREATE POLICY "Public can read organizations"
  ON organizations FOR SELECT
  USING (true);

-- Permitir leitura pública das configurações da barbearia
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON barbershop_settings;

CREATE POLICY "Public can read barbershop_settings"
  ON barbershop_settings FOR SELECT
  USING (true);

-- Permitir leitura pública dos serviços de barbearia
DROP POLICY IF EXISTS "Public can read barber_services" ON barber_services;

CREATE POLICY "Public can read barber_services"
  ON barber_services FOR SELECT
  USING (is_active = true);

-- Permitir leitura pública dos perfis de funcionários disponíveis
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON employee_profiles;

CREATE POLICY "Public can read available employee_profiles"
  ON employee_profiles FOR SELECT
  USING (is_available_for_booking = true);

-- Verificar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles')
ORDER BY tablename, policyname;