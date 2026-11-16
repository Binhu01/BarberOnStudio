-- =============================================================================
-- BARBER-ON STUDIO - Atualizar tabela de servicos (precos reais da barbearia)
-- Execute este script no SQL Editor do Supabase
-- =============================================================================

-- 1. Remover servicos antigos
DELETE FROM barber_services
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'minha-barbearia');

-- 2. Inserir os 16 servicos reais da barbearia
INSERT INTO barber_services (
  organization_id,
  name,
  description,
  price,
  duration_minutes,
  is_active,
  commission_type,
  commission_value,
  display_order
)
SELECT
  org.id,
  s.nome,
  s.texto,
  s.preco,
  s.minutos,
  true,
  'percentage',
  0,
  s.ordem
FROM organizations org
CROSS JOIN (VALUES
  ('Corte social 1 pente',                       'Corte social com 1 pente',                                    20.00,  15,   1),
  ('Corte',                                      'Corte masculino tradicional',                                28.00,  20,   2),
  ('Corte e sobrancelha',                        'Corte com design de sobrancelha',                            30.00,  20,   3),
  ('Corte + Barba',                              'Corte masculino + barba completa',                           45.00,  30,   4),
  ('Corte + Hidratacao',                         'Corte + hidratacao capilar',                                 40.00,  30,   5),
  ('Corte + limpeza de pele',                    'Corte + limpeza de pele facial',                             45.00,  40,   6),
  ('Corte + Pigmentacao',                        'Corte + pigmentacao capilar',                                45.00,  35,   7),
  ('Cabelo e barba + pigmentacao',               'Corte + barba + pigmentacao',                                70.00,  45,   8),
  ('Corte + Alisamento',                         'Corte + alisamento capilar',                                 60.00,  40,   9),
  ('Corte + Barba + Alisamento',                 'Corte + barba + alisamento',                                 75.00,  55,  10),
  ('Corte + Progressiva',                        'Corte + escova progressiva',                                 80.00,  70,  11),
  ('Corte + Barba + Progressiva',                'Corte + barba + escova progressiva',                         100.00, 70,  12),
  ('Cabelo + Barba + Pigmentacao + Progressiva', 'Combo completo: corte, barba, pigmentacao e progressiva',   100.00, 70,  13),
  ('Reflexo + Corte',                            'Reflexo/mechas + corte masculino',                           80.00,  90,  14),
  ('CLUB ON PRATA 89,99',                        'Plano de assinatura mensal - Prata',                         0.01,   30,  15),
  ('CLUB ON OURO 109,99',                        'Plano de assinatura mensal - Ouro',                          0.01,   50,  16)
) AS s(nome, texto, preco, minutos, ordem)
WHERE org.slug = 'minha-barbearia';

-- 3. Verificar resultado
SELECT
  name AS servico,
  duration_minutes || ' min' AS duracao,
  'R$ ' || price::text AS preco,
  is_active AS ativo
FROM barber_services
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'minha-barbearia')
ORDER BY display_order;