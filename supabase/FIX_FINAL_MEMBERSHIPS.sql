-- =============================================================================
-- BARBER-ON QA: FIX FINAL - PERMISSÕES DE MEMBERSHIPS
-- Executar no SQL Editor do Supabase: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql/new
-- =============================================================================

-- 1. Garantir que usuários autenticados possam ler a tabela memberships
GRANT SELECT ON TABLE public.memberships TO authenticated;

-- 2. Criar política para usuários verem seus próprios memberships
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 3. Manter a política pública para leitura de memberships ativos (para o site)
DROP POLICY IF EXISTS "Public can read active memberships" ON public.memberships;
CREATE POLICY "Public can read active memberships" ON public.memberships
FOR SELECT TO anon
USING (status = 'active');

-- 4. Verificar se o vínculo do administrador existe e está ativo
SELECT
    m.id,
    m.user_id,
    m.organization_id,
    m.role,
    m.status,
    o.name as organization_name,
    o.slug as organization_slug
FROM memberships m
JOIN organizations o ON m.organization_id = o.id
WHERE m.user_id = '4072691f-36ee-4209-b30c-90d8d2694959'
AND m.status = 'active';

-- =============================================================================
-- APÓS EXECUTAR: Faça logout completo, limpe os cookies do navegador e faça login novamente.
-- =============================================================================