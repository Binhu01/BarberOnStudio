const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verify() {
  console.log('Verificando organização no Supabase...');

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', 'barber-on-studio');

  if (error) {
    console.error('❌ Erro ao consultar organização:', error.message);
  } else if (data && data.length > 0) {
    console.log('✅ Organização encontrada com sucesso!');
    console.log('Dados:', data[0]);
  } else {
    console.log('⚠️ Organização não encontrada. O script SQL pode não ter sido executado corretamente.');
  }
}

verify();