-- =============================================================================
-- Atualizar fotos e nomes dos barbeiros Ruan e Lucas
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- Corrigir nomes (estavam em branco)
UPDATE profiles SET full_name = 'Ruan' WHERE email = 'ruan@barberon.local' AND (full_name IS NULL OR full_name = '');
UPDATE profiles SET full_name = 'Lucas' WHERE email = 'lucas@barberon.local' AND (full_name IS NULL OR full_name = '');

-- Atualizar fotos de perfil
UPDATE profiles SET avatar_url = '/avatars/ruan.webp' WHERE email = 'ruan@barberon.local';
UPDATE profiles SET avatar_url = '/avatars/lucas.webp' WHERE email = 'lucas@barberon.local';

-- Verificar resultado
SELECT full_name, email, avatar_url FROM profiles WHERE email IN ('ruan@barberon.local', 'lucas@barberon.local');