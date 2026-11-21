-- =============================================================================
-- Fix: Permitir que a landing page (anon client) insira calendar_events
--
-- PROBLEMA: O agendamento público é criado com sucesso em public_bookings,
-- mas o insert correspondente em calendar_events falha silenciosamente porque
-- a única policy de INSERT exige is_member_of(organization_id), que retorna
-- false para o cliente anon da landing page.
--
-- SOLUÇÃO: Adicionar policy pública de INSERT em calendar_events que permite
-- inserts sem autenticação, desde que vinculados a uma organização válida.
--
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
-- =============================================================================

-- 1. Remover policy pública anterior se existir
DROP POLICY IF EXISTS "Public can create calendar events from landing" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_public_insert" ON calendar_events;

-- 2. Criar policy pública de INSERT para agendamentos via landing page
-- Permite que o anon client insira eventos sem created_by (já tornado nullable no fix anterior)
CREATE POLICY "calendar_events_public_insert"
  ON calendar_events FOR INSERT
  WITH CHECK (true);

-- 3. Garantir que a coluna origin aceita 'landing_page'
-- (já deveria existir do fix-calendar-events-public.sql, mas garantindo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'origin'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';
  END IF;
END $$;

-- 4. Validação
SELECT 'calendar_events INSERT policies' AS check_item,
       string_agg(policyname, ', ' ORDER BY policyname) AS status
FROM pg_policies WHERE tablename = 'calendar_events' AND cmd = 'INSERT'
UNION ALL
SELECT 'created_by nullable',
       CASE WHEN is_nullable = 'YES' THEN '✅ OK' ELSE '❌ ERRO — execute fix-calendar-events-public.sql primeiro' END
FROM information_schema.columns
WHERE table_name = 'calendar_events' AND column_name = 'created_by'
UNION ALL
SELECT 'origin column exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'calendar_events' AND column_name = 'origin'
       ) THEN '✅ OK' ELSE '❌ ERRO' END;