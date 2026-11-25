# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-validation.spec.ts >> QA Environment Validation - Barber-On Studio >> Create 5 appointments via public booking page and verify in Supabase
- Location: tests\e2e\qa-validation.spec.ts:30:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Corte|Barba|Sobrancelha/ }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [aria-hidden] [ref=e14]: "1"
          - generic [ref=e15]: "2"
        - generic [ref=e16]:
          - text: Issue
          - generic [aria-hidden] [ref=e17]: s
      - button "Collapse issues badge" [ref=e18]
  - generic [ref=e22]:
    - generic [ref=e23]: ⚠️
    - heading "Algo deu errado" [level=1] [ref=e25]
    - paragraph [ref=e26]: Ocorreu um erro inesperado. Nossa equipe já foi notificada. Tente novamente ou volte mais tarde.
    - paragraph [ref=e27]: "Ref: 3745799986"
    - generic [ref=e28]:
      - button "Tentar novamente" [ref=e29] [cursor=pointer]
      - link "Ir para Dashboard" [ref=e30] [cursor=pointer]:
        - /url: /dashboard
  - alert [ref=e31]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3000';
  4   | const ADMIN_EMAIL = 'admin.barberon.qa@gmail.com';
  5   | const ADMIN_PASSWORD = 'Admin@2026QA';
  6   | const SUPABASE_URL = 'https://idymvdboboixjtywhdcd.supabase.co';
  7   | // Chave anon extraída do .env.local para uso nos testes de API
  8   | const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NjQ1NTksImV4cCI6MjExMTA0MDU1OX0.lSgy03GyO1fiFBXJtcW0eH0ljlkp5Nmz5vb9tE3pKYk';
  9   | 
  10  | test.describe('QA Environment Validation - Barber-On Studio', () => {
  11  |   test('Landing page loads correctly', async ({ page }) => {
  12  |     await page.goto(BASE_URL);
  13  |     const title = await page.title();
  14  |     expect(title).toContain('Barber On Studio');
  15  |     await expect(page.locator('h1')).toContainText('ESTILO,', { timeout: 10000 });
  16  |     await expect(page.locator('text=Agendar seu horário')).toBeVisible({ timeout: 5000 });
  17  |   });
  18  | 
  19  |   test('Login page is accessible', async ({ page }) => {
  20  |     await page.goto(`${BASE_URL}/login`);
  21  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  22  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  23  |   });
  24  | 
  25  |   test('API health check endpoint returns response', async ({ request }) => {
  26  |     const response = await request.get(`${BASE_URL}/api/health`);
  27  |     expect(response.status()).toBeGreaterThanOrEqual(200);
  28  |   });
  29  | 
  30  |   test('Create 5 appointments via public booking page and verify in Supabase', async ({ page }) => {
  31  |     const customers = [
  32  |       { name: 'TESTE E2E 01', phone: '(11) 90000-0001' },
  33  |       { name: 'TESTE E2E 02', phone: '(11) 90000-0002' },
  34  |       { name: 'TESTE E2E 03', phone: '(11) 90000-0003' },
  35  |       { name: 'TESTE E2E 04', phone: '(11) 90000-0004' },
  36  |       { name: 'TESTE E2E 05', phone: '(11) 90000-0005' },
  37  |     ];
  38  | 
  39  |     // Navegar para a página de agendamento público com o slug correto
  40  |     const bookingUrl = `${BASE_URL}/agendar/barber-on-studio`;
  41  | 
  42  |     for (let i = 0; i < 5; i++) {
  43  |       await page.goto(bookingUrl);
  44  | 
  45  |       // Aguardar a página carregar completamente
  46  |       await page.waitForLoadState('networkidle');
  47  |       await page.waitForTimeout(2000);
  48  | 
  49  |       // Passo 1: Selecionar serviço
  50  |       const firstService = page.getByRole('button', { name: /Corte|Barba|Sobrancelha/ }).first();
> 51  |       await firstService.click({ timeout: 10000 });
      |                          ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  52  | 
  53  |       // Passo 2: Selecionar barbeiro (ou "Sem preferência")
  54  |       await page.waitForTimeout(1500);
  55  | 
  56  |       const noPreferenceBtn = page.getByRole('button', { name: /Sem preferência|Qualquer profissional/ });
  57  |       if (await noPreferenceBtn.count() > 0) {
  58  |         await noPreferenceBtn.click();
  59  |       } else {
  60  |         // Se houver barbeiros específicos, selecionar o primeiro
  61  |         const firstBarber = page.getByRole('button', { name: /[A-Z][a-z]+/ }).first();
  62  |         if (await firstBarber.count() > 0) {
  63  |           await firstBarber.click();
  64  |         }
  65  |       }
  66  | 
  67  |       // Passo 3: Selecionar data (amanhã)
  68  |       await page.waitForTimeout(1000);
  69  |       const tomorrow = new Date();
  70  |       tomorrow.setDate(tomorrow.getDate() + 1);
  71  |       const dateStr = tomorrow.toISOString().split('T')[0];
  72  | 
  73  |       // Aguardar o input de data aparecer
  74  |       const dateInput = page.locator('input[type="date"]');
  75  |       await dateInput.waitFor({ state: 'visible', timeout: 10000 });
  76  |       await dateInput.fill(dateStr);
  77  | 
  78  |       // Aguardar carregamento dos slots
  79  |       await page.waitForTimeout(2500);
  80  | 
  81  |       // Selecionar primeiro horário disponível
  82  |       const firstSlot = page.locator('.grid-cols-3 button, .grid-cols-4 button').first();
  83  |       if (await firstSlot.count() > 0) {
  84  |         await firstSlot.click();
  85  |       } else {
  86  |         console.log(`Nenhum horário disponível para o teste ${i+1}`);
  87  |         continue;
  88  |       }
  89  | 
  90  |       // Passo 4: Avançar para dados do cliente
  91  |       await page.waitForTimeout(500);
  92  |       const continueBtn = page.getByRole('button', { name: 'Continuar' });
  93  |       await continueBtn.click();
  94  | 
  95  |       // Preencher dados do cliente
  96  |       await page.waitForTimeout(500);
  97  |       await page.fill('input[placeholder*="nome completo"], input[placeholder*="Seu nome"]', customers[i].name);
  98  |       await page.fill('input[placeholder*="(11)"], input[placeholder*="(82)"], input[type="tel"]', customers[i].phone);
  99  | 
  100 |       // Confirmar agendamento
  101 |       const confirmBtn = page.getByRole('button', { name: 'Agendar|Confirmar' });
  102 |       await confirmBtn.click();
  103 |       await page.waitForTimeout(3000);
  104 | 
  105 |       // Verificar persistência no Supabase via API REST
  106 |       const response = await page.request.get(`${SUPABASE_URL}/rest/v1/public_bookings?customer_phone=eq.${customers[i].phone}`, {
  107 |         headers: {
  108 |           'apikey': ANON_KEY,
  109 |           'Authorization': `Bearer ${ANON_KEY}`,
  110 |           'Accept': 'application/json'
  111 |         }
  112 |       });
  113 | 
  114 |       expect(response.ok()).toBeTruthy();
  115 |       const data = await response.json();
  116 |       expect(data.length).toBeGreaterThan(0);
  117 |     }
  118 |   });
  119 | 
  120 |   test('Dashboard requires authentication', async ({ page }) => {
  121 |     await page.goto(`${BASE_URL}/dashboard`);
  122 |     await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });
  123 |   });
  124 | 
  125 |   test('Admin login and view appointments', async ({ page }) => {
  126 |     await page.goto(`${BASE_URL}/login`);
  127 |     await page.fill('input[type="email"]', ADMIN_EMAIL);
  128 |     await page.fill('input[type="password"]', ADMIN_PASSWORD);
  129 |     await page.locator('button[type="submit"]').click();
  130 | 
  131 |     // Aguardar redirecionamento para o dashboard
  132 |     await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  133 |     await expect(page.locator('text=Agendamentos')).toBeVisible({ timeout: 10000 });
  134 |   });
  135 | });
```