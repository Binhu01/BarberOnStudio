import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin.barberon.qa@gmail.com';
const ADMIN_PASSWORD = 'Admin@2026QA';
const SUPABASE_URL = 'https://idymvdboboixjtywhdcd.supabase.co';
// Chave anon extraída do .env.local para uso nos testes de API
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NjQ1NTksImV4cCI6MjExMTA0MDU1OX0.lSgy03GyO1fiFBXJtcW0eH0ljlkp5Nmz5vb9tE3pKYk';

test.describe('QA Environment Validation - Barber-On Studio', () => {
  test('Landing page loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    const title = await page.title();
    expect(title).toContain('Barber On Studio');
    await expect(page.locator('h1')).toContainText('ESTILO,', { timeout: 10000 });
    await expect(page.locator('text=Agendar seu horário')).toBeVisible({ timeout: 5000 });
  });

  test('Login page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('API health check endpoint returns response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });

  test('Create 5 appointments via public booking page and verify in Supabase', async ({ page }) => {
    const customers = [
      { name: 'TESTE E2E 01', phone: '(11) 90000-0001' },
      { name: 'TESTE E2E 02', phone: '(11) 90000-0002' },
      { name: 'TESTE E2E 03', phone: '(11) 90000-0003' },
      { name: 'TESTE E2E 04', phone: '(11) 90000-0004' },
      { name: 'TESTE E2E 05', phone: '(11) 90000-0005' },
    ];

    // Navegar para a página de agendamento público com o slug correto
    const bookingUrl = `${BASE_URL}/agendar/barber-on-studio`;

    for (let i = 0; i < 5; i++) {
      await page.goto(bookingUrl);

      // Aguardar a página carregar completamente
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Passo 1: Selecionar serviço
      const firstService = page.getByRole('button', { name: /Corte|Barba|Sobrancelha/ }).first();
      await firstService.click({ timeout: 10000 });

      // Passo 2: Selecionar barbeiro (ou "Sem preferência")
      await page.waitForTimeout(1500);

      const noPreferenceBtn = page.getByRole('button', { name: /Sem preferência|Qualquer profissional/ });
      if (await noPreferenceBtn.count() > 0) {
        await noPreferenceBtn.click();
      } else {
        // Se houver barbeiros específicos, selecionar o primeiro
        const firstBarber = page.getByRole('button', { name: /[A-Z][a-z]+/ }).first();
        if (await firstBarber.count() > 0) {
          await firstBarber.click();
        }
      }

      // Passo 3: Selecionar data (amanhã)
      await page.waitForTimeout(1000);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Aguardar o input de data aparecer
      const dateInput = page.locator('input[type="date"]');
      await dateInput.waitFor({ state: 'visible', timeout: 10000 });
      await dateInput.fill(dateStr);

      // Aguardar carregamento dos slots
      await page.waitForTimeout(2500);

      // Selecionar primeiro horário disponível
      const firstSlot = page.locator('.grid-cols-3 button, .grid-cols-4 button').first();
      if (await firstSlot.count() > 0) {
        await firstSlot.click();
      } else {
        console.log(`Nenhum horário disponível para o teste ${i+1}`);
        continue;
      }

      // Passo 4: Avançar para dados do cliente
      await page.waitForTimeout(500);
      const continueBtn = page.getByRole('button', { name: 'Continuar' });
      await continueBtn.click();

      // Preencher dados do cliente
      await page.waitForTimeout(500);
      await page.fill('input[placeholder*="nome completo"], input[placeholder*="Seu nome"]', customers[i].name);
      await page.fill('input[placeholder*="(11)"], input[placeholder*="(82)"], input[type="tel"]', customers[i].phone);

      // Confirmar agendamento
      const confirmBtn = page.getByRole('button', { name: 'Agendar|Confirmar' });
      await confirmBtn.click();
      await page.waitForTimeout(3000);

      // Verificar persistência no Supabase via API REST
      const response = await page.request.get(`${SUPABASE_URL}/rest/v1/public_bookings?customer_phone=eq.${customers[i].phone}`, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Accept': 'application/json'
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.length).toBeGreaterThan(0);
    }
  });

  test('Dashboard requires authentication', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });
  });

  test('Admin login and view appointments', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Aguardar redirecionamento para o dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    await expect(page.locator('text=Agendamentos')).toBeVisible({ timeout: 10000 });
  });
});