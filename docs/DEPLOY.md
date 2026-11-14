# Barber-On Studio — Guia Completo de Deploy

**Última atualização:** 2026-11-14  
**Stack:** Next.js 16 + Supabase + Vercel  
**Migrations:** 26 arquivos SQL (001–026)  
**Edge Functions:** 2 (`criar-pagamento`, `pagamento-webhook`)

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar projeto no Supabase](#2-criar-projeto-no-supabase)
3. [Aplicar migrations](#3-aplicar-migrations)
4. [Configurar variáveis de ambiente](#4-configurar-variáveis-de-ambiente)
5. [Habilitar extensões e cron](#5-habilitar-extensões-e-cron)
6. [Deploy das Edge Functions](#6-deploy-das-edge-functions)
7. [Configurar secrets do Supabase](#7-configurar-secrets-do-supabase)
8. [Criar dados iniciais (seed)](#8-criar-dados-iniciais-seed)
9. [Deploy na Vercel](#9-deploy-na-vercel)
10. [Configurar webhook do Mercado Pago](#10-configurar-webhook-do-mercado-pago)
11. [Configurar WhatsApp Business API](#11-configurar-whatsapp-business-api)
12. [Verificação pós-deploy](#12-verificação-pós-deploy)
13. [Troubleshooting](#13-troubleshooting)

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

# Conta no Supabase: https://supabase.com
# Conta na Vercel: https://vercel.com
# Conta no Mercado Pago: https://www.mercadopago.com.br/developers
# Conta Meta Developers: https://developers.facebook.com
# Conta Resend: https://resend.com
```

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

> ⚠️ **Região São Paulo (`sa-east-1`)** é essencial para latência aceitável com Mercado Pago e WhatsApp Business API no Brasil. A região padrão `us-east-1` adiciona ~200-400ms de latência.

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

# === OPCIONAIS (configurar quando for usar) ===
NEXT_PUBLIC_APP_NAME=Barber-On Studio
NEXT_PUBLIC_BARBER_SLUG=barber-on-studio

# WhatsApp (obrigatório para módulo WhatsApp)
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
WHATSAPP_ACCESS_TOKEN=<access-token>
WHATSAPP_VERIFY_TOKEN=<verify-token-customizado>

# Email (obrigatório para notificações por email)
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@seudominio.com

# Mercado Pago (obrigatório para pagamentos)
MP_ACCESS_TOKEN=APP_USR-xxxx...
MP_WEBHOOK_SECRET=<secret-gerado-no-MP>

# IA (obrigatório para assistente inteligente)
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

## 6. Deploy das Edge Functions

### Via Supabase CLI

```bash
# Deploy da função de criação de pagamento
supabase functions deploy criar-pagamento --no-verify-jwt

# Deploy da função de webhook
supabase functions deploy pagamento-webhook --no-verify-jwt
```

> ⚠️ `--no-verify-jwt` é necessário porque:
> - `criar-pagamento` recebe o JWT via header `Authorization` manualmente
> - `pagamento-webhook` é chamado pelo Mercado Pago (sem JWT do Supabase)

### Verificar URLs

Após o deploy, as funções estarão disponíveis em:

```
https://<project-id>.supabase.co/functions/v1/criar-pagamento
https://<project-id>.supabase.co/functions/v1/pagamento-webhook
```

Teste com curl:

```bash
# Health check do webhook (deve retornar "ok")
curl https://<project-id>.supabase.co/functions/v1/pagamento-webhook
```

---

## 7. Configurar secrets do Supabase

As Edge Functions leem variáveis de ambiente via `Deno.env.get()`. Configure os secrets:

```bash
# Secrets obrigatórios para pagamentos
supabase secrets set \
  MP_ACCESS_TOKEN="APP_USR-xxxx..." \
  MP_WEBHOOK_SECRET="seu-webhook-secret" \
  NEXT_PUBLIC_APP_URL="https://seu-dominio.vercel.app"

# Secrets opcionais (configure quando for usar)
supabase secrets set \
  WHATSAPP_PHONE_NUMBER_ID="1234567890" \
  WHATSAPP_ACCESS_TOKEN="EAAxxxx..." \
  RESEND_API_KEY="re_xxxxx" \
  ANTHROPIC_API_KEY="sk-ant-xxxx..."
```

> ⚠️ `SUPABASE_URL` e `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo runtime do Supabase — **não precisam ser configurados manualmente**.

Listar secrets configurados:

```bash
supabase secrets list
```

---

## 8. Criar dados iniciais (seed)

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

## 9. Deploy na Vercel

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

No painel da Vercel, adicione **todas** as variáveis do `.env.example`:

| Variável | Valor | Ambiente |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-id>.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key>` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | Production apenas |
| `NEXT_PUBLIC_APP_URL` | `https://seu-dominio.vercel.app` | Production |
| `MP_ACCESS_TOKEN` | `APP_USR-xxxx...` | Production |
| `MP_WEBHOOK_SECRET` | `<secret>` | Production |
| `WHATSAPP_PHONE_NUMBER_ID` | `<id>` | Production |
| `WHATSAPP_ACCESS_TOKEN` | `<token>` | Production |
| `RESEND_API_KEY` | `re_xxxxx` | Production |
| `ANTHROPIC_API_KEY` | `sk-ant-xxxx...` | Production |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` deve estar marcada como "Production only"** — nunca exponha em preview/dev.

### Passo 4: Deploy

Clique em **Deploy**. O build leva ~2-4 minutos.

### Passo 5: Domínio personalizado (opcional)

1. Acesse **Settings → Domains**
2. Adicione seu domínio (ex: `app.barbearia.com.br`)
3. Configure o DNS conforme instruções da Vercel
4. Atualize `NEXT_PUBLIC_APP_URL` para o domínio personalizado

---

## 10. Configurar webhook do Mercado Pago

1. Acesse [Mercado Pago Developers → Webhooks](https://www.mercadopago.com.br/developers/panel/app)
2. Selecione sua aplicação
3. Em **Webhooks**, configure:
   - **URL:** `https://<project-id>.supabase.co/functions/v1/pagamento-webhook`
   - **Eventos:** marque `Pagamentos` (payment.created, payment.updated)
4. Copie o **Webhook Secret** gerado
5. Atualize o secret no Supabase:

```bash
supabase secrets set MP_WEBHOOK_SECRET="<secret-copiado>"
```

### Testar webhook

Crie um pagamento de teste no sandbox do Mercado Pago e verifique nos logs da Edge Function:

```bash
supabase functions logs pagamento-webhook --limit 10
```

---

## 11. Configurar WhatsApp Business API

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
   - `payment_receipt` — recibo de pagamento
   - `birthday_greeting` — mensagem de aniversário
   - `reactivation` — reativação de cliente inativo

### Passo 3: Configurar no Supabase

```bash
supabase secrets set \
  WHATSAPP_PHONE_NUMBER_ID="<phone-number-id>" \
  WHATSAPP_ACCESS_TOKEN="<permanent-access-token>" \
  WHATSAPP_VERIFY_TOKEN="<token-personalizado>"
```

### Passo 4: Configurar webhook do WhatsApp

No Meta Developer Portal, configure o webhook:

- **Callback URL:** `https://<project-id>.supabase.co/functions/v1/whatsapp-webhook` (criar Edge Function adicional se necessário)
- **Verify Token:** mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- **Subscription Fields:** `messages`, `message_template_status_update`

---

## 12. Verificação pós-deploy

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

# 5. Edge Function responde
curl https://<project-id>.supabase.co/functions/v1/pagamento-webhook
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
- [ ] Verificar logs do Supabase: **Database → Logs**

---

## 13. Troubleshooting

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

### Edge Function retorna 500

```bash
# Ver logs detalhados
supabase functions logs criar-pagamento --limit 50

# Verificar se secrets estão configurados
supabase secrets list
```

### RLS bloqueia acesso legítimo

**Causa:** Usuário não é membro da organização.  
**Fix:** Verifique `organization_members`:

```sql
SELECT om.role, p.email
FROM organization_members om
JOIN profiles p ON p.id = om.user_id
WHERE om.organization_id = '<org-id>';
```

### Webhook do Mercado Pago não processa

1. Verifique se `MP_WEBHOOK_SECRET` está configurado
2. Verifique se a URL do webhook está correta no painel do MP
3. Cheque os logs: `supabase functions logs pagamento-webhook`
4. Teste com o [simulador de webhooks do MP](https://www.mercadopago.com.br/developers/pt/guides/webhooks/testing)

### Latência alta (>1s)

- Verifique se o Supabase está na região `sa-east-1` (São Paulo)
- Verifique se a Vercel está na região `gru1` (São Paulo)
- Considere adicionar Cloudflare CDN na frente da Vercel

---

## Referências

- [Supabase Docs — Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Docs — Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel Docs — Next.js](https://vercel.com/docs/frameworks/nextjs)
- [Mercado Pago — Webhooks](https://www.mercadopago.com.br/developers/pt/guides/webhooks)
- [WhatsApp Business API — Getting Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)

---

## Suporte

Para problemas específicos do Barber-On Studio:

1. Verifique os logs do Supabase: **Dashboard → Database → Logs**
2. Verifique os logs da Vercel: **Dashboard → Deployments → Inspect**
3. Consulte o [status da implementação](./BARBER_ON_STUDIO_IMPLEMENTATION_STATUS.md)
4. Consulte a [auditoria técnica](./BARBER_ON_STUDIO_TECHNICAL_AUDIT.md)