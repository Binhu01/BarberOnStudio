const { createClient } = require('@supabase/supabase-js');
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

// Criar cliente com service role key (bypassa RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyRLSPolicies() {
 console.log('🔧 Aplicando políticas de RLS diretamente...\n');

 const tables = [
 'organizations',
 'barbershop_settings',
 'barber_services',
 'employee_profiles',
 'memberships',
 'profiles'
 ];

 for (const table of tables) {
 try {
 // Habilitar RLS na tabela
 await supabase.rpc('pg_catalog.set_config', {
 setting_name: 'row_security',
 setting_value: 'on',
 is_local: true
 });

 // Criar política de SELECT para anon
 const policyName = `Public can read ${table}`;

 // Usar query direta via RPC não é possível, então vamos verificar se a tabela existe
 const { data, error } = await supabase
 .from(table)
 .select('*')
 .limit(1);

 if (error && error.code === '42501') {
 console.log(`❌ ${table}: Permissão negada - política não aplicada`);
 } else if (error) {
 console.log(`❌ ${table}: Erro - ${error.message}`);
 } else {
 console.log(`✅ ${table}: Acesso OK`);
 }
 } catch (err) {
 console.log(`❌ ${table}: Falha - ${err.message}`);
 }
 }

 console.log('\n⚠ IMPORTANTE: As políticas devem ser aplicadas via SQL Editor do Supabase.');
 console.log('Acesse: https://app.supabase.com/project/idymvdboboixjtywhdcd/sql');
 console.log('\nExecute o SQL abaixo:\n');

 // Gerar SQL completo
 let sql = '-- Script para aplicar TODAS as políticas de RLS\n\n';
 for (const table of tables) {
 sql += `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;\n`;
 sql += `DROP POLICY IF EXISTS "Public can read ${table}" ON ${table};\n`;

 let condition = 'true';
 if (table === 'barber_services') condition = 'is_active = true';
 if (table === 'employee_profiles') condition = 'is_available_for_booking = true';
 if (table === 'memberships') condition = "status = 'active'";

 sql += `CREATE POLICY "Public can read ${table}" ON ${table} FOR SELECT USING (${condition});\n\n`;
 }

 console.log(sql);
}

applyRLSPolicies();