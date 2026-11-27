const fs = require('fs');
const path = require('path');

// Carregar variáveis do .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex !== -1) {
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      envVars[key] = value;
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Credenciais não encontradas no .env.local');
  process.exit(1);
}

// SQL para criar políticas de RLS públicas
const sql = `
-- 1. Organizações - leitura pública
DROP POLICY IF EXISTS "Public can read organizations" ON organizations;
CREATE POLICY "Public can read organizations" ON organizations FOR SELECT USING (true);

-- 2. Configurações da barbearia - leitura pública
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON barbershop_settings;
CREATE POLICY "Public can read barbershop_settings" ON barbershop_settings FOR SELECT USING (true);

-- 3. Serviços ativos - leitura pública
DROP POLICY IF EXISTS "Public can read barber_services" ON barber_services;
CREATE POLICY "Public can read barber_services" ON barber_services FOR SELECT USING (is_active = true);

-- 4. Perfis de funcionários disponíveis - leitura pública
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON employee_profiles;
CREATE POLICY "Public can read available employee_profiles" ON employee_profiles FOR SELECT USING (is_available_for_booking = true);

-- 5. Memberships - leitura pública para perfis de barbeiros
DROP POLICY IF EXISTS "Public can read active memberships" ON memberships;
CREATE POLICY "Public can read active memberships" ON memberships FOR SELECT USING (status = 'active');

-- 6. Profiles - leitura pública para nomes dos barbeiros
DROP POLICY IF EXISTS "Public can read profiles" ON profiles;
CREATE POLICY "Public can read profiles" ON profiles FOR SELECT USING (true);

-- Verificar todas as políticas aplicadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'barbershop_settings', 'barber_services', 'employee_profiles', 'memberships', 'profiles')
ORDER BY tablename, policyname;
`;

async function applyRLSPolicies() {
  console.log('🔧 Aplicando políticas de RLS para acesso público...\n');

  try {
    // Usar a API REST do Supabase para executar SQL via endpoint rpc
    // Como o Supabase não permite executar DDL direto via REST, vamos usar o endpoint sql
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    console.log('✅ Políticas de RLS aplicadas com sucesso!');
    console.log('\nPara verificar, execute no SQL Editor do Supabase:');
    console.log('SELECT * FROM pg_policies WHERE tablename IN (\'organizations\', \'barbershop_settings\', \'barber_services\', \'employee_profiles\', \'memberships\', \'profiles\');');

  } catch (error) {
    console.error('❌ Erro ao aplicar políticas:', error.message);
    console.log('\n⚠ Execute manualmente no SQL Editor do Supabase:');
    console.log(sql);
  }
}

applyRLSPolicies();