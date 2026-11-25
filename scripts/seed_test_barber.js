const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedTestBarber() {
  console.log('Criando barbeiro de teste para QA...');

  const orgId = '6d73f153-5058-4849-8555-0d2948302b6c';

  // Verificar se já existe um employee_profile
  const { data: existingProfiles } = await supabase
    .from('employee_profiles')
    .select('membership_id')
    .eq('organization_id', orgId)
    .limit(1);

  if (existingProfiles && existingProfiles.length > 0) {
    console.log(`Já existe barbeiro com membership_id: ${existingProfiles[0].membership_id}`);
    return;
  }

  // Criar user_id simulado
  const userId = crypto.randomUUID();

  // Inserir profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userId, full_name: 'João Barbeiro Teste', phone: '(11) 99999-9999' });

  if (profileError) {
    console.error('Erro ao criar profile:', profileError);
  } else {
    console.log('Profile criado.');
  }

  // Criar membership
  const membershipId = crypto.randomUUID();
  const { error: membershipError } = await supabase
    .from('memberships')
    .insert({
      id: membershipId,
      user_id: userId,
      organization_id: orgId,
      role: 'barber',
      status: 'active'
    });

  if (membershipError) {
    console.error('Erro ao criar membership:', membershipError);
    return;
  }

  // Criar employee_profile
  const { error: empError } = await supabase
    .from('employee_profiles')
    .insert({
      membership_id: membershipId,
      organization_id: orgId,
      bio: 'Barbeiro profissional para testes E2E',
      specialties: ['Corte', 'Barba'],
      is_available_for_booking: true
    });

  if (empError) {
    console.error('Erro ao criar employee_profile:', empError);
    return;
  }

  console.log(`Barbeiro de teste criado com membership_id: ${membershipId}`);
}

seedTestBarber();