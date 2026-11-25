const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setupAdmin() {
  console.log('Configurando administrador e permissões...');

  // 1. Criar Organização
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert([
      {
        name: 'Barber On Studio',
        slug: 'barber-on-studio',
        created_by: '6d73f153-5058-4849-8555-0d2948302b6c'
      }
    ])
    .select();

  if (orgError && orgError.code !== '23505') { // 23505 é unique_violation (já existe)
    console.error('Erro ao criar organização:', orgError);
    return;
  }
  console.log('Organização criada ou já existente.');

  // 2. Criar Perfil
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: '6d73f153-5058-4849-8555-0d2948302b6c',
      full_name: 'Administrador QA',
      email: 'admin.barberon.qa@gmail.com'
    });

  if (profileError) console.error('Erro ao criar perfil:', profileError);
  else console.log('Perfil criado/atualizado.');

  // 3. Criar Membership
  const { error: memberError } = await supabase
    .from('memberships')
    .insert({
      organization_id: orgData ? orgData[0].id : null, // Precisamos do ID real se não foi criado agora
      user_id: '6d73f153-5058-4849-8555-0d2948302b6c',
      role: 'OWNER',
      status: 'active'
    });

  if (memberError) console.error('Erro ao criar membership:', memberError);
  else console.log('Membership criado.');

  console.log('Configuração finalizada!');
}

setupAdmin();