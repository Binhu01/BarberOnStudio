# Barber-On Studio — Guia Completo de Deploy

**Última atualização:** 2026-11-14  
**Stack:** Next.js 16 + Supabase + Vercel  
**Migrations:** 26 arquivos SQL (001–026)  
**Pagamentos:** Presencial na loja (sem integração online)

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar projeto no Supabase](#2-criar-projeto-no-supabase)
3. [Aplicar migrations](#3-aplicar-migrations)
4. [Configurar variáveis de ambiente](#4-configurar-variáveis-de-ambiente)
5. [Habilitar extensões e cron](#5-habilitar-extensões-e-cron)
6. [Criar dados iniciais (seed)](#6-criar-dados-iniciais-seed)
7. [Deploy na Vercel](#7-deploy-na-vercel)
8. [Configurar WhatsApp Business API](#8-configurar-whatsapp-business-api-opcional)
9. [Verificação pós-deploy](#9-verificação-pós-deploy)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Pré-requisitos

### Ferramentas locais

```bash
# Node.js 20+ (recomendado: nvm)
nvm install 20
nvm use 20

# Supabase CLI
npm install -g supabase

# Git
git --version
```

### Contas necessárias

- **Supabase:** https://supabase.com (obrigatório)
- **Vercel:** https://vercel.com (obrigatório)
- **Meta Developers:** https://developers.facebook.com (opcional, para WhatsApp)
- **Resend:** https://resend.com (opcional, para email)

### Clonar o repositório

```bash
git clone <seu-repositorio> barber-on-studio
cd barber-on-studio
npm install
```

---

## 2. Criar projeto no Supabase

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em **New Project**
3. Preencha:
   - **Name:** `barber-on-studio` (ou nome da sua barbearia)
   - **Database Password:** senha forte (guarde em cofre de senhas)
   - **Region:** `South America (São Paulo)` — **importante para latência no Brasil**
   - **Plan:** Free (suficiente para começar) ou Pro ($25/mês)
4. Aguarde a criação (~2 minutos)
5. Copie as credenciais:
   - **Project URL:** `https://<project-id>.supabase.co`
   - **anon public key:** chave anônima (segura para frontend)
   - **service_role key:** chave administrativa (**NUNCA exponha no frontend**)

> ⚠️ **Região São Paulo (`sa-east-1`)** é essencial para latência aceitável no Brasil. A região padrão `us-east-1` adiciona ~200-400ms de latência.

---

## 3. Aplicar migrations

### Opção A: Supabase CLI (recomendada)

```bash
# Linkar o projeto local ao Supabase remoto
supabase link --project-ref <seu-project-id>

# Aplicar todas as 26 migrations em ordem
supabase db push
```

O CLI aplica automaticamente na ordem numérica (001 → 026). Se alguma migration falhar, ele para e mostra o erro exato.

### Opção B: SQL Editor manual

Se não puder usar o CLI:

1. Acesse **SQL Editor** no dashboard do Supabase
2. Abra cada arquivo de `supabase/migrations/` **na ordem numérica**
3. Cole o conteúdo e clique em **Run**
4. Repita para todos os 26 arquivos

**Ordem obrigatória:**

```
001_initial_schema.sql
002_crm_schema.sql
003_sales_schema.sql
004_inventory_schema.sql
005_financial_schema.sql
006_team_permissions.sql
007_bi_views.sql
008_purchases_schema.sql
009_tasks_calendar_notifications.sql
010_ai_intelligence.sql
011_billing_subscriptions_admin.sql
012_barber_services_schedules.sql
013_barber_commissions_cashflow.sql
014_public_bookings_blocks.sql
015_subscriptions_plans.sql
016_loyalty_reactivation.sql
017_notifications_whatsapp_recurring.sql
018_barber_performance_conflict_prevention.sql
019_appointment_status_flow.sql
020_comandas_payments_stock.sql
021_financial_closing_integration.sql
022_subscription_benefits_integration.sql
023_automation_triggers_campaigns.sql
024_complementary_modules.sql
025_query_receivables_aging.sql
026_fix_payment_rls_policies.sql
```

### Verificar aplicação

```bash
# Listar tabelas criadas (deve retornar 107 tabelas)
supabase db execute --file - <<'SQL'
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SQL

# Listar funções RPC (deve retornar 80+)
supabase db execute --file - <<'SQL'
SELECT count(*) FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
SQL
```

---

## 4. Configurar variáveis de ambiente

### Local (.env.local)

```bash
cp .env.example .env.local
```

Edite `.env.local` com seus valores reais:

```env
# === OBRIGATÓRIAS ===
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<sua-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# === OPCIONAIS ===
NEXT_PUBLIC_APP_NAME=Barber-On Studio
NEXT_PUBLIC_BARBER_SLUG=barber-on-studio

# WhatsApp (opcional, para módulo WhatsApp)
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
WHATSAPP_ACCESS_TOKEN=<access-token>
WHATSAPP_VERIFY_TOKEN=<verify-token-customizado>

# Email (opcional, para notificações por email)
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@seudominio.com

# IA (opcional, para assistente inteligente)
ANTHROPIC_API_KEY=sk-ant-xxxx...
```

> ⚠️ **NUNCA commite `.env.local`** — ele já está no `.gitignore`.

---

## 5. Habilitar extensões e cron

### No Dashboard do Supabase

1. Acesse **Database → Extensions**
2. Habilite:
   - ✅ **pg_cron** — agendamento de tarefas periódicas
   - ✅ **pgcrypto** — geração de UUIDs (geralmente já vem habilitada)
   - ✅ **uuid-ossp** — funções auxiliares de UUID

### Configurar jobs do pg_cron

Após habilitar a extensão, execute no **SQL Editor**:

```sql
-- Verificar assinaturas vencendo diariamente às 6h da manhã
SELECT cron.schedule(
  'check-subscription-expiry',
  '0 6 * * *',
  $$SELECT process_subscription_renewals_enhanced()$$
);

-- Limpar logs de auditoria antigos (>90 dias) semanalmente
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 2 * * 0',
  $$DELETE FROM audit_logs WHERE created_at < now() - interval '90 days'$$
);

-- Gerar fechamento mensal automático no dia 1º às 3h
SELECT cron.schedule(
  'monthly-financial-closing',
  '0 3 1 * *',
  $$SELECT generate_monthly_closing(
    (SELECT id FROM organizations LIMIT 1),
    EXTRACT(YEAR FROM CURRENT_DATE - interval '1 month'),
    EXTRACT(MONTH FROM CURRENT_DATE - interval '1 month')
  )$$
);
```

> 💡 Para múltiplas organizações, adapte o job de fechamento mensal para iterar sobre todas as orgs ativas.

---

## 6. Criar dados iniciais (seed)

O projeto ainda não tem `supabase/seed.sql`. Crie os dados iniciais manualmente via **SQL Editor**:

```sql
-- 1. Criar perfil do administrador
INSERT INTO profiles (id, full_name, email, avatar_url)
VALUES (auth.uid(), 'Administrador', 'admin@barbearia.com', NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar organização
INSERT INTO organizations (id, name, slug, industry, timezone)
VALUES (gen_random_uuid(), 'Minha Barbearia', 'minha-barbearia', 'barbershop', 'America/Sao_Paulo');

-- 3. Adicionar admin como owner
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'minha-barbearia'),
  auth.uid(),
  'owner'
);

-- 4. Criar conta financeira padrão
INSERT INTO financial_accounts (organization_id, name, account_type)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'minha-barbearia'),
  'Caixa Principal',
  'cash'
);

-- 5. Criar categorias financeiras padrão
INSERT INTO financial_categories (organization_id, name, category_type)
VALUES
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Serviços', 'income'),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Produtos', 'income'),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Assinaturas', 'income'),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Aluguel', 'expense'),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Salários', 'expense'),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Insumos', 'expense');

-- 6. Criar serviços padrão
INSERT INTO barber_services (organization_id, name, description, price, duration_minutes, is_active)
VALUES
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Corte Masculino', 'Corte tradicional com acabamento', 50.00, 30, true),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Barba', 'Aparar e modelar barba', 30.00, 20, true),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Corte + Barba', 'Combo completo', 70.00, 45, true),
  ((SELECT id FROM organizations WHERE slug = 'minha-barbearia'), 'Degradê', 'Corte degradê moderno', 55.00, 35, true);
```

> 💡 Substitua `'minha-barbearia'` pelo slug desejado. Os valores são exemplos — ajuste conforme sua barbearia.

---

## 7. Deploy na Vercel

### Passo 1: Conectar repositório

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório Git (GitHub/GitLab/Bitbucket)
3. Selecione o branch `main`

### Passo 2: Configurar framework

A Vercel detecta automaticamente Next.js. Confirme:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Node.js Version:** 20.x

### Passo 3: Configurar variáveis de ambiente

No painel da Vercel, adicione as variáveis:

| Variável | Valor | Ambiente |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-id>.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key>` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | Production apenas |
| `NEXT_PUBLIC_APP_URL` | `https://seu-dominio.vercel.app` | Production |
| `NEXT_PUBLIC_APP_NAME` | `Barber-On Studio` | Production + Preview |
| `NEXT_PUBLIC_BARBER_SLUG` | `<slug-da-barbearia>` | Production + Preview |
| `WHATSAPP_PHONE_NUMBER_ID` | `<id>` | Production (opcional) |
| `WHATSAPP_ACCESS_TOKEN` | `<token>` | Production (opcional) |
| `RESEND_API_KEY` | `re_xxxxx` | Production (opcional) |
| `ANTHROPIC_API_KEY` | `sk-ant-xxxx...` | Production (opcional) |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` deve estar marcada como "Production only"** — nunca exponha em preview/dev.

### Passo 4: Deploy

Clique em **Deploy**. O build leva ~2-4 minutos.

### Passo 5: Domínio personalizado (opcional)

1. Acesse **Settings → Domains**
2. Adicione seu domínio (ex: `app.barbearia.com.br`)
3. Configure o DNS conforme instruções da Vercel
4. Atualize `NEXT_PUBLIC_APP_URL` para o domínio personalizado

---

## 8. Configurar WhatsApp Business API (opcional)

> 💡 Esta seção é opcional. O sistema funciona sem WhatsApp — os lembretes e notificações serão exibidos apenas no dashboard.

### Passo 1: Meta Developer Portal

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie um app do tipo **Business**
3. Adicione o produto **WhatsApp Business Platform**
4. Configure o número de telefone (receba o `Phone Number ID`)
5. Gere um **Token de Acesso Permanente** com permissão `whatsapp_business_messaging`

### Passo 2: Aprovar templates

1. No **Meta Business Suite → WhatsApp Manager → Message Templates**
2. Crie e envie para aprovação os templates usados pelo sistema:
   - `appointment_reminder` — lembrete de agendamento
   - `appointment_confirmation` — confirmação
   - `birthday_greeting` — mensagem de aniversário
   - `reactivation` — reativação de cliente inativo

### Passo 3: Configurar variáveis

Adicione no painel da Vercel (ou no `.env.local` para desenvolvimento):

```env
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
WHATSAPP_ACCESS_TOKEN=<permanent-access-token>
WHATSAPP_VERIFY_TOKEN=<token-personalizado>
```

---

## 9. Verificação pós-deploy

### Checklist automatizado

```bash
# 1. Build passa sem erros
npm run build

# 2. Type-check passa
npm run type-check

# 3. App responde
curl -I https://seu-dominio.vercel.app

# 4. API do Supabase responde
curl https://<project-id>.supabase.co/rest/v1/ -H "apikey: <anon-key>"
```

### Checklist manual

- [ ] Acessar `/dashboard` — redireciona para login
- [ ] Fazer login com email/senha ou magic link
- [ ] Criar organização no onboarding
- [ ] Navegar pela sidebar — todas as páginas carregam
- [ ] Criar um serviço e um profissional
- [ ] Fazer um agendamento de teste
- [ ] Verificar se o agendamento aparece na agenda
- [ ] Acessar `/agendar/<slug>` — página pública funciona
- [ ] Registrar um pagamento presencial na comanda
- [ ] Verificar logs do Supabase: **Database → Logs**

---

## 10. Troubleshooting

### Build falha na Vercel

```
Error: Cannot find module 'next/dist/docs/...'
```

**Causa:** Next.js 16 requer versão específica.  
**Fix:** Verifique `"next": "16.4.6"` no `package.json` e limpe o cache:

```bash
# Na Vercel: Settings → General → Build & Development Settings
# Marque "Ignore Build Step" temporariamente, faça deploy, desmarque
```

### Migration falha com "relation already exists"

**Causa:** Migration foi aplicada parcialmente.  
**Fix:** Execute manualmente a migration problemática no SQL Editor, ignorando erros de `IF NOT EXISTS`.

### RLS bloqueia acesso legítimo

**Causa:** Usuário não é membro da organização.  
**Fix:** Verifique `organization_members`:

```sql
SELECT om.role, p.email
FROM organization_members om
JOIN profiles p ON p.id = om.user_id
WHERE om.organization_id = '<org-id>';
```

### Latência alta (>1s)

- Verifique se o Supabase está na região `sa-east-1` (São Paulo)
- Verifique se a Vercel está na região `gru1` (São Paulo)
- Considere adicionar Cloudflare CDN na frente da Vercel

### Página exibe "Loading..." infinito

**Causa:** Falta `export const instant = false` em página dinâmica.  
**Fix:** Adicione `export const instant = false;` no topo do arquivo da página.

### Erro de tipo TypeScript no build

**Causa:** Next.js 16 não permite exportar tipos/schemas de arquivos `"use server"`.  
**Fix:** Extraia schemas Zod e tipos para arquivos `schemas.ts` separados e importe nos actions.

---

## Referências

- [Supabase Docs — Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Vercel Docs — Next.js](https://vercel.com/docs/frameworks/nextjs)
- [WhatsApp Business API — Getting Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)

---

## Suporte

Para problemas específicos do Barber-On Studio:

1. Verifique os logs do Supabase: **Dashboard → Database → Logs**
2. Verifique os logs da Vercel: **Dashboard → Deployments → Inspect**
3. Consulte o [status da implementação](./BARBER_ON_STUDIO_IMPLEMENTATION_STATUS.md)
4. Consulte a [auditoria técnica](./BARBER_ON_STUDIO_TECHNICAL_AUDIT.md)