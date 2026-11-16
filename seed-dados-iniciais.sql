-- =============================================================================
-- BARBER-ON STUDIO — Dados Iniciais (Seed)
-- Execute este script no SQL Editor do Supabase
-- =============================================================================

-- 1. Criar perfil do administrador
INSERT INTO profiles (id, full_name, email, avatar_url)
VALUES ('2a98cfc0-f218-4ea5-a58c-d837e51531ba', 'Administrador', 'admin@barbearia.com', NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar organização
INSERT INTO organizations (id, name, slug, industry, timezone, created_by)
VALUES (
  gen_random_uuid(),
  'Minha Barbearia',
  'minha-barbearia',
  'barbershop',
  'America/Sao_Paulo',
  '2a98cfc0-f218-4ea5-a58c-d837e51531ba'
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Adicionar admin como OWNER
INSERT INTO memberships (organization_id, user_id, role)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'minha-barbearia'),
  '2a98cfc0-f218-4ea5-a58c-d837e51531ba',
  'OWNER'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. Criar conta financeira padrão
INSERT INTO financial_accounts (organization_id, name, account_type)
SELECT id, 'Caixa Principal', 'cash'
FROM organizations WHERE slug = 'minha-barbearia'
AND NOT EXISTS (
  SELECT 1 FROM financial_accounts fa
  WHERE fa.organization_id = organizations.id AND fa.name = 'Caixa Principal'
);

-- 5. Criar categorias financeiras padrão
INSERT INTO financial_categories (organization_id, name, category_type)
SELECT organizations.id, c.name, c.type
FROM organizations
CROSS JOIN (VALUES
  ('Serviços', 'income'),
  ('Produtos', 'income'),
  ('Assinaturas', 'income'),
  ('Aluguel', 'expense'),
  ('Salários', 'expense'),
  ('Insumos', 'expense')
) AS c(name, type)
WHERE organizations.slug = 'minha-barbearia'
AND NOT EXISTS (
  SELECT 1 FROM financial_categories fc
  WHERE fc.organization_id = organizations.id AND fc.name = c.name
);

-- 6. Criar serviços padrão
INSERT INTO barber_services (organization_id, name, description, price, duration_minutes, is_active)
SELECT organizations.id, s.name, s.desc, s.price, s.duration, true
FROM organizations
CROSS JOIN (VALUES
  ('Corte Masculino', 'Corte tradicional com acabamento', 50.00, 30),
  ('Barba', 'Aparar e modelar barba', 30.00, 20),
  ('Corte + Barba', 'Combo completo', 70.00, 45),
  ('Degradê', 'Corte degradê moderno', 55.00, 35)
) AS s(name, desc, price, duration)
WHERE organizations.slug = 'minha-barbearia'
AND NOT EXISTS (
  SELECT 1 FROM barber_services bs
  WHERE bs.organization_id = organizations.id AND bs.name = s.name
);

-- 7. Criar configurações da barbearia para agendamento público
INSERT INTO barbershop_settings (organization_id, shop_name, shop_description, shop_address, shop_phone, public_slug, primary_color)
SELECT id, 'Minha Barbearia', 'A melhor barbearia da cidade', 'Rua Exemplo, 123 - Centro', '(11) 99999-9999', 'minha-barbearia', '#C9A96E'
FROM organizations WHERE slug = 'minha-barbearia'
ON CONFLICT (organization_id) DO NOTHING;

-- =============================================================================
-- VERIFICAR RESULTADOS
-- =============================================================================
SELECT
  (SELECT count(*) FROM profiles) AS profiles,
  (SELECT count(*) FROM organizations) AS organizations,
  (SELECT count(*) FROM memberships) AS memberships,
  (SELECT count(*) FROM financial_accounts) AS accounts,
  (SELECT count(*) FROM financial_categories) AS categories,
  (SELECT count(*) FROM barber_services) AS services,
  (SELECT count(*) FROM barbershop_settings) AS settings;