-- =============================================================================
-- BARBER-ON QA: FIX SIMPLES E DIRETO (GRANT SELECT)
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
--
-- Este script concede APENAS as permissões básicas de SELECT para o usuário 'anon'.
-- Não altera RLS, não cria políticas novas. Apenas garante que o 'anon' possa ler.
-- =============================================================================

-- Conceder permissão de USO no esquema público
GRANT USAGE ON SCHEMA public TO anon;

-- Conceder permissão EXPLÍCITA de SELECT em TODAS as tabelas da página de agendamento
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT ON public.barbershop_settings TO anon;
GRANT SELECT ON public.barber_services TO anon;
GRANT SELECT ON public.employee_profiles TO anon;
GRANT SELECT ON public.memberships TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.public_bookings TO anon;

-- =============================================================================
-- APÓS EXECUTAR:
-- 1. Aguarde 2-3 segundos.
-- 2. Acesse http://localhost:3000/agendar/barber-on-studio
-- 3. A página deve carregar sem o erro 42501.
-- =============================================================================