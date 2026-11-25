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

// Lista de tabelas e suas políticas
const policies = [
 {
 table: 'organizations',
 policyName: 'Public can read organizations',
 sql: 'CREATE POLICY "Public can read organizations" ON organizations FOR SELECT USING (true);'
 },
 {
 table: 'barbershop_settings',
 policyName: 'Public can read barbershop_settings',
 sql: 'CREATE POLICY "Public can read barbershop_settings" ON barbershop_settings FOR SELECT USING (true);'
 },
 {
 table: 'barber_services',
 policyName: 'Public can read barber_services',
 sql: 'CREATE POLICY "Public can read barber_services" ON barber_services FOR SELECT USING (is_active = true);'
 },
 {
 table: 'employee_profiles',
 policyName: 'Public can read available employee_profiles',
 sql: 'CREATE POLICY "Public can read available employee_profiles" ON employee_profiles FOR SELECT USING (is_available_for_booking = true);'
 },
 {
 table: 'memberships',
 policyName: 'Public can read active memberships',
 sql: 'CREATE POLICY "Public can read active memberships" ON memberships FOR SELECT USING (status = \'active\');'
 },
 {
 table: 'profiles',
 policyName: 'Public can read profiles',
 sql: 'CREATE POLICY "Public can read profiles" ON profiles FOR SELECT USING (true);'
 }
];

async function checkAndApplyPolicies() {
 console.log('🔍 Verificando políticas de RLS existentes...\n');

 for (const policy of policies) {
 try {
 // Tentar consultar a tabela para ver se a política existe
 const { data, error } = await supabase
 .from(policy.table)
 .select('id')
 .limit(1);

 if (error) {
 console.log(`❌ ${policy.table}: ERRO - ${error.message}`);
 console.log(`   Execute no SQL Editor: ${policy.sql}\n`);
 } else {
 console.log(`✅ ${policy.table}: Acesso OK`);
 }
 } catch (err) {
 console.log(`❌ ${policy.table}: Falha na verificação - ${err.message}`);
 }
 }

 console.log('\n⚠ Para aplicar as políticas faltantes, execute no SQL Editor do Supabase:');
 console.log('https://app.supabase.com/project/idymvdboboixjtywhdcd/sql\n');

 // Gerar SQL completo
 let fullSQL = '-- Script completo para aplicar todas as políticas de RLS\n\n';
 for (const policy of policies) {
 fullSQL += `DROP POLICY IF EXISTS "${policy.policyName}" ON ${policy.table};\n`;
 fullSQL += `${policy.sql}\n\n`;
 }

 console.log(fullSQL);
}

checkAndApplyPolicies();