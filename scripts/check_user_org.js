const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
 console.log('🔍 Verificando vínculos do usuário...');

 const userId = '4072691f-36ee-4209-b30c-90d8d2694959'; // Seu ID confirmado anteriormente

 // 1. Verificar se a membership existe
 const { data: membership, error: memError } = await supabase
 .from('memberships')
 .select('*, organizations ( id, name, slug )')
 .eq('user_id', userId)
 .single();

 if (memError || !membership) {
 console.error('❌ Nenhum vínculo encontrado para este usuário.');
 return;
 }

 console.log('✅ Vínculo encontrado!');
 console.log('Organização:', membership.organizations.name);
 console.log('Slug:', membership.organizations.slug);
 console.log('Role:', membership.role);
 console.log('Status:', membership.status);
}

check();