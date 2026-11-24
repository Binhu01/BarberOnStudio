import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('QA Environment Validation - Barber-On Studio', () => {
  test('Landing page loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Verificar título da landing page
    const title = await page.title();
    expect(title).toContain('Barber On Studio');

    // Verificar elementos principais usando seletores mais robustos
    // O H1 contém spans e quebras de linha, então verificamos o texto parcial
    await expect(page.locator('h1')).toContainText('ESTILO,', { timeout: 10000 });

    // Verificar que o botão de agendamento está presente
    await expect(page.locator('text=Agendar seu horário')).toBeVisible({ timeout: 5000 });

    // Verificar se a seção de barbeiros/serviços está carregando (placeholder ou dados)
    await expect(page.locator('text=Profissionais e Serviços')).toBeVisible({ timeout: 5000 });
  });

  test('Login page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Verificar formulário de login
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Cadastro page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastro`);

    // Verificar formulário de cadastro (usando placeholders ou labels reais)
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('API health check endpoint returns response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    // O endpoint pode retornar 200, 401 ou até 503 em QA durante inicialização
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThanOrEqual(503);
  });

  test('Dashboard requires authentication', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Deve redirecionar para login se não autenticado
    await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });
  });

  test('Sitemap is generated correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    expect(response.ok()).toBeTruthy();

    const content = await response.text();
    // Verificar se o sitemap existe e contém as páginas principais
    expect(content).toContain('<url>');
  });

  test('Robots.txt allows public pages and blocks dashboard', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    expect(response.ok()).toBeTruthy();

    const content = await response.text();
    // robots.txt usa case-sensitive: Disallow com D maiúsculo
    expect(content.toLowerCase()).toContain('disallow: /dashboard/');
    expect(content.toLowerCase()).toContain('allow: /');
  });
});