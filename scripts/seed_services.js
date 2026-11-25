const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idymvdboboixjtywhdcd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTQ2NDU1OSwiZXhwIjoyMTExMDQwNTU5fQ.ez-PsweMT8hWq5hjcsr1lPxJrLFA9WAdWp0B0eeNKic';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedServices() {
  console.log('Criando serviços de barbearia para testes E2E...');

  const services = [
    {
      name: 'Corte Masculino',
      description: 'Corte completo com acabamento',
      price: 35.00,
      duration_minutes: 30,
      is_active: true
    },
    {
      name: 'Barba',
      description: 'Modelagem e acabamento da barba',
      price: 25.00,
      duration_minutes: 20,
      is_active: true
    },
    {
      name: 'Corte + Barba',
      description: 'Combo completo de corte e barba',
      price: 50.00,
      duration_minutes: 45,
      is_active: true
    },
    {
      name: 'Sobrancelha',
      description: 'Design e limpeza de sobrancelha',
      price: 15.00,
      duration_minutes: 15,
      is_active: true
    }
  ];

  const { data, error } = await supabase
    .from('barber_services')
    .insert(services)
    .select();

  if (error) {
    console.error('Erro ao criar serviços:', error);
    return;
  }

  console.log(`${data.length} serviços criados com sucesso:`);
  data.forEach(s => console.log(`  - ${s.name} (R$ ${s.price})`));
  console.log('\nAgora você pode executar os testes E2E.');
}

seedServices();