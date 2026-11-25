-- =============================================================================
-- BARBER-ON QA: SETUP DEFINITIVO (Com created_by para satisfazer NOT NULL)
-- Project Reference: idymvdboboixjtywhdcd
-- =============================================================================

-- PASSO 1: Criar a organização "Barber On Studio" se ela não existir.
-- Incluindo o campo created_by para satisfazer a constraint NOT NULL da tabela.
INSERT INTO organizations (id, name, slug, created_by)
VALUES ('6d73f153-5058-4849-8555-0d2948302b6c', 'Barber On Studio', 'barber-on-studio', '6d73f153-5058-4849-8555-0d2948302b6c')
ON CONFLICT (slug) DO NOTHING;

-- PASSO 2: Inserir os serviços buscando o ID da organização pelo slug.
-- Esta query só insere se a organização for encontrada.
INSERT INTO barber_services (organization_id, name, description, price, duration_minutes, is_active)
SELECT
 o.id,
 v.name,
 v.description,
 v.price,
 v.duration_minutes,
 v.is_active
FROM organizations o
CROSS JOIN (
 VALUES
 ('Corte Masculino', 'Corte completo com acabamento profissional', 35.00, 30, true),
 ('Barba', 'Modelagem e acabamento da barba', 25.00, 20, true),
 ('Corte + Barba', 'Combo completo de corte e barba', 50.00, 45, true),
 ('Sobrancelha', 'Design e limpeza de sobrancelha', 15.00, 15, true)
) AS v(name, description, price, duration_minutes, is_active)
WHERE o.slug = 'barber-on-studio'
ON CONFLICT DO NOTHING;

-- PASSO 3: Verificar se tudo foi criado corretamente.
SELECT bs.name, bs.price, o.name as organization_name
FROM barber_services bs
JOIN organizations o ON bs.organization_id = o.id
WHERE o.slug = 'barber-on-studio';