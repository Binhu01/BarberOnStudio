const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAndFix() {
  const email = 'admin.barberon.qa@gmail.com';
  console.log(`🔍 Buscando usuário com email: ${email}`);

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('❌ Erro ao listar usuários:', usersError.message);
    return;
  }

  const user = usersData.users.find(u => u.email === email);
  if (!user) {
    console.error(`❌ Usuário com email ${email} não encontrado.`);
    return;
  }

  console.log(`✅ Usuário encontrado! ID: ${user.id}`);

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', 'barber-on-studio')
    .single();

  if (orgError || !org) {
    console.error('❌ Organização "barber-on-studio" não encontrada.');
    return;
  }

  console.log(`✅ Organização encontrada! ID: ${org.id}, Nome: ${org.name}`);

  const { data: existingMembership, error: memCheckError } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .single();

  if (existingMembership) {
    console.log('✅ Vínculo já existe. Atualizando para garantir status active e role OWNER...');
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: 'OWNER', status: 'active' })
      .eq('id', existingMembership.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar vínculo:', updateError.message);
    } else {
      console.log('🚀 Vínculo atualizado com sucesso!');
    }
  } else {
    console.log('⚠️ Vínculo não encontrado. Criando novo vínculo...');
    const { error: insertError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        organization_id: org.id,
        role: 'OWNER',
        status: 'active'
      });

    if (insertError) {
      console.error('❌ Erro ao criar vínculo:', insertError.message);
    } else {
      console.log('🚀 Vínculo criado com sucesso!');
    }
  }

  const { data: finalCheck, error: finalError } = await supabase
    .from('memberships')
    .select('*, organizations(name, slug)')
    .eq('user_id', user.id);

  console.log('\n📊 Vínculos finais para este usuário:');
  console.log(JSON.stringify(finalCheck, null, 2));
}

checkAndFix();