const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis do .env.local manualmente
const envPath = path.join(__dirname, '..', '.env.local');
try {
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

 if (envVars.NEXT_PUBLIC_SUPABASE_URL && envVars.SUPABASE_SERVICE_ROLE_KEY) {
 console.log('Credenciais carregadas do .env.local');
 } else {
 console.error('Credenciais não encontradas no .env.local');
 process.exit(1);
 }

 const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
 const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
 const supabase = createClient(supabaseUrl, serviceRoleKey);

 async function createBarbershopSettings() {
 console.log('Criando configuração da barbearia...');

 const orgId = '54f8c7ce-6bc1-40eb-b069-fcc71174ec07';

 // Verificar se já existe configuração
 const { data: existing } = await supabase
 .from('barbershop_settings')
 .select('*')
 .eq('organization_id', orgId)
 .single();

 if (existing) {
 console.log('Configuração já existe:', existing.public_slug);
 return;
 }

 // Criar nova configuração
 const { data, error } = await supabase
 .from('barbershop_settings')
 .insert({
 organization_id: orgId,
 public_slug: 'barber-on-studio',
 shop_name: 'Barber On Studio',
 booking_enabled: true,
 allow_barber_selection: true,
 min_advance_hours: 2,
 advance_booking_days: 30
 })
 .select()
 .single();

 if (error) {
 console.error('Erro ao criar configuração:', error);
 return;
 }

 console.log('Configuração criada com sucesso!');
 console.log('Slug público:', data.public_slug);
 }

 createBarbershopSettings();
} catch (err) {
 console.error('Erro ao ler .env.local:', err.message);
 process.exit(1);
}