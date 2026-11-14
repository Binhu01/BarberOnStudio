/**
 * Script para capturar screenshots automáticos dos 8 testes do checklist
 * Requer: npm install -D playwright
 * Uso: node scripts/capture-checklist-screenshots.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function captureScreenshots() {
 // Garantir que o diretório existe
 if (!fs.existsSync(SCREENSHOTS_DIR)) {
 fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
 }

 console.log('🎬 Iniciando captura de screenshots...\n');

 let browser;
 try {
 browser = await chromium.launch({
 headless: true,
 args: [
 '--no-sandbox',
 '--disable-setuid-sandbox',
 '--disable-dev-shm-usage',
 '--disable-gpu',
 ],
 });
 } catch (launchError) {
 console.error('❌ Falha ao iniciar Chromium:', launchError.message);
 console.log('\n💡 Tentando com canal msedge como fallback...');
 try {
 browser = await chromium.launch({
 headless: true,
 channel: 'msedge',
 args: ['--no-sandbox', '--disable-setuid-sandbox'],
 });
 } catch (edgeError) {
 console.error('❌ Fallback Edge também falhou:', edgeError.message);
 console.log('\n⚠️ Captura automática indisponível neste ambiente.');
 console.log('📋 Use o guia manual abaixo para capturar as telas:\n');
 printManualGuide();
 process.exit(0);
 }
 }

 const context = await browser.newContext({
 viewport: { width: 1440, height: 900 },
 });
 const page = await context.newPage();

 const pages = [
 { name: '01-planos-comerciais', url: '/planos', desc: 'Página comercial de planos' },
 { name: '02-cadastro-org-trial', url: '/cadastro', desc: 'Cadastro de organização + trial' },
 { name: '03-login', url: '/login', desc: 'Tela de login' },
 { name: '04-dashboard-principal', url: '/dashboard', desc: 'Dashboard principal (redireciona se não logado)' },
 { name: '05-equipe-limite-usuarios', url: '/dashboard/equipe', desc: 'Equipe — testar limite de usuários' },
 { name: '06-billing-assinatura', url: '/dashboard/billing', desc: 'Minha Assinatura — upgrade/downgrade' },
 { name: '07-admin-dashboard', url: '/admin', desc: 'Nexora Admin — Dashboard' },
 { name: '08-admin-planos', url: '/admin/planos', desc: 'Nexora Admin — Catálogo de planos' },
 { name: '09-admin-organizacoes', url: '/admin/organizacoes', desc: 'Nexora Admin — Organizações' },
 { name: '10-admin-suporte', url: '/admin/suporte', desc: 'Nexora Admin — Suporte' },
 { name: '11-admin-audit', url: '/admin/audit', desc: 'Nexora Admin — Audit Log' },
 ];

 for (const p of pages) {
 try {
 console.log(`📸 Capturando ${p.url} (${p.desc})...`);
 await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
 await page.screenshot({
 path: path.join(SCREENSHOTS_DIR, `${p.name}.png`),
 fullPage: true,
 });
 console.log(` ✅ Salvo: ${p.name}.png\n`);
 } catch (err) {
 console.log(` ⚠️ Erro em ${p.url}: ${err.message}\n`);
 }
 }

 await browser.close();

 console.log('═══════════════════════════════════════════════════════════');
 console.log('✅ Captura concluída!');
 console.log(`📁 Screenshots salvos em: ${SCREENSHOTS_DIR}`);
 console.log('═══════════════════════════════════════════════════════════\n');
 console.log('Próximos passos:');
 console.log('1. Abra a pasta screenshots/ para ver todas as imagens');
 console.log('2. Para testar cenários autenticados (webhook, limite, etc):');
 console.log(' - Faça login manualmente no app');
 console.log(' - Execute as ações no navegador');
 console.log(' - Capture screenshots adicionais conforme necessário');
}

function printManualGuide() {
 console.log('═══════════════════════════════════════════════════════════');
 console.log('📋 GUIA MANUAL DE CAPTURA DE SCREENSHOTS');
 console.log('═══════════════════════════════════════════════════════════\n');
 console.log('Abra http://localhost:3000 no navegador e capture:');
 console.log('');
 console.log(' # | URL | Descrição');
 console.log('---|---------------------------|----------------------------------');
 console.log(' 1 | /planos | Página comercial de planos');
 console.log(' 2 | /cadastro | Cadastro de org + trial');
 console.log(' 3 | /login | Tela de login');
 console.log(' 4 | /dashboard | Dashboard principal');
 console.log(' 5 | /dashboard/equipe | Equipe (limite de usuários)');
 console.log(' 6 | /dashboard/billing | Minha Assinatura');
 console.log(' 7 | /admin | Nexora Admin Dashboard');
 console.log(' 8 | /admin/planos | Admin — Planos');
 console.log(' 9 | /admin/organizacoes | Admin — Organizações');
 console.log('10 | /admin/suporte | Admin — Suporte');
 console.log('11 | /admin/audit | Admin — Audit Log');
 console.log('');
 console.log('Salve as imagens na pasta screenshots/ do projeto.');
 console.log('═══════════════════════════════════════════════════════════');
}

captureScreenshots().catch((error) => {
 console.error('❌ Erro inesperado:', error);
 printManualGuide();
 process.exit(1);
});