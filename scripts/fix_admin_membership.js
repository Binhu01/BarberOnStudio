const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixMembership() {
  console.log('🔍 Buscando organização e usuário...');

  // 1. Pegar o ID da organização
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'barber-on-studio')
    .single();

  if (!org) {
    console.error('❌ Organização não encontrada.');
    return;
  }

  // 2. Pegar o ID do usuário pelo email
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'glaubercavalcanti04@gmail.com');

  if (!user) {
    console.error('❌ Usuário não encontrado.');
    return;
  }

  console.log(`✅ Organização: ${org.id}`);
  console.log(`✅ Usuário: ${user.id}`);

  // 3. Criar ou atualizar o vínculo (membership)
  const { error } = await supabase
    .from('memberships')
    .upsert({
      organization_id: org.id,
      user_id: user.id,
      role: 'OWNER',
      status: 'active'
    }, { onConflict: 'organization_id,user_id' });

  if (error) {
    console.error('❌ Erro ao criar vínculo:', error.message);
  } else {
    console.log('🚀 Vínculo de administrador criado com sucesso!');
    console.log('Agora você pode fazer login e acessar o dashboard.');
  }
}

fixMembership();