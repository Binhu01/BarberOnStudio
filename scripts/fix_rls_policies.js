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
 console.error('Credenciais não encontradas no .env.local');
 process.exit(1);
}

// SQL para criar políticas de RLS públicas
const sql = `
-- Permitir leitura pública das organizações
DROP POLICY IF EXISTS "Public can read organizations" ON organizations;
CREATE POLICY "Public can read organizations" ON organizations FOR SELECT USING (true);

-- Permitir leitura pública das configurações da barbearia
DROP POLICY IF EXISTS "Public can read barbershop_settings" ON barbershop_settings;
CREATE POLICY "Public can read barbershop_settings" ON barbershop_settings FOR SELECT USING (true);

-- Permitir leitura pública dos serviços ativos
DROP POLICY IF EXISTS "Public can read barber_services" ON barber_services;
CREATE POLICY "Public can read barber_services" ON barber_services FOR SELECT USING (is_active = true);

-- Permitir leitura pública dos perfis disponíveis
DROP POLICY IF EXISTS "Public can read available employee_profiles" ON employee_profiles;
CREATE POLICY "Public can read available employee_profiles" ON employee_profiles FOR SELECT USING (is_available_for_booking = true);
`;

async function fixRLSPolicies() {
 console.log('Aplicando políticas de RLS para acesso público...');

 // Usar fetch direto para executar SQL via endpoint REST do Supabase
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

 // Nota: O Supabase não permite executar SQL arbitrário via REST API diretamente.
 // Precisamos usar o dashboard web ou o CLI do Supabase.
 // Como alternativa, vamos verificar se as políticas já existem e criar via interface.

 console.log('\n⚠ IMPORTANTE: O Supabase não permite executar DDL (CREATE POLICY) via API REST.');
 console.log('Para aplicar estas políticas, você precisa:');
 console.log('1. Abrir o dashboard do Supabase em: https://app.supabase.com/project/idymvdboboixjtywhdcd');
 console.log('2. Ir em SQL Editor');
 console.log('3. Executar o seguinte SQL:\n');
 console.log(sql);
 console.log('\nOu alternativamente, use o comando:');
 console.log(`npx supabase db push --db-url "${supabaseUrl.replace('https://', 'postgresql://postgres:')}"`);
}

fixRLSPolicies();