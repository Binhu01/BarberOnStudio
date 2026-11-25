const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function resetPassword() {
  const userId = '6d73f153-5058-4849-8555-0d2948302b6c';

  console.log('Redefinindo senha do administrador...');
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: 'Admin@123456'
  });

  if (error) {
    console.error('❌ Erro ao atualizar senha:', error.message);
  } else {
    console.log('✅ Senha atualizada com sucesso para:', data.user.email);
    console.log('🔑 Nova senha: Admin@123456');
  }
}

resetPassword();