-- =============================================================================
-- BARBER-ON QA: Inserir barbeiro de teste
-- =============================================================================

-- PASSO 1: Verificar se já existe um membro/funcionário para a organização
-- Se não existir, criar um perfil e membership

-- Primeiro, garantir que temos um usuário na tabela auth.users (simulado)
-- Como não podemos inserir diretamente em auth.users via SQL simples,
-- vamos usar o user_id do admin que já criamos ou criar um novo via Supabase

-- Para testes E2E públicos, precisamos de um employee_profile com membership
-- Vamos criar usando o organization_id que já temos

DO $$
DECLARE
  v_org_id UUID := '6d73f153-5058-4849-8555-0d2948302b6c';
  v_user_id UUID;
  v_membership_id UUID;
BEGIN
  -- Verificar se já existe algum employee_profile para esta org
  IF NOT EXISTS (SELECT 1 FROM employee_profiles WHERE organization_id = v_org_id) THEN
    -- Criar um user_id simulado (em produção viria do auth)
    v_user_id := gen_random_uuid();

    -- Inserir na tabela profiles (se existir e não tiver constraint de FK rígida)
    INSERT INTO profiles (id, full_name, phone)
    VALUES (v_user_id, 'João Barbeiro Teste', '(11) 99999-9999')
    ON CONFLICT (id) DO NOTHING;

    -- Criar membership
    v_membership_id := gen_random_uuid();
    INSERT INTO memberships (id, user_id, organization_id, role, status)
    VALUES (v_membership_id, v_user_id, v_org_id, 'barber', 'active');

    -- Criar employee_profile
    INSERT INTO employee_profiles (membership_id, organization_id, bio, specialties, is_available_for_booking)
    VALUES (v_membership_id, v_org_id, 'Barbeiro profissional para testes', ARRAY['Corte', 'Barba'], true);

    RAISE NOTICE 'Barbeiro de teste criado com membership_id: %', v_membership_id;
  ELSE
    SELECT membership_id INTO v_membership_id
    FROM employee_profiles
    WHERE organization_id = v_org_id
    LIMIT 1;
    RAISE NOTICE 'Já existe barbeiro com membership_id: %', v_membership_id;
  END IF;
END $$;

-- Verificar o que foi criado
SELECT
  ep.membership_id,
  p.full_name,
  ep.bio,
  ep.specialties,
  ep.is_available_for_booking
FROM employee_profiles ep
JOIN memberships m ON ep.membership_id = m.id
LEFT JOIN profiles p ON m.user_id = p.id
WHERE ep.organization_id = '6d73f153-5058-4849-8555-0d2948302b6c';