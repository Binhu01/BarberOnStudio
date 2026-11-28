# Relatório de Diagnóstico: "Database error querying schema" no Login

## Resumo do Problema

Ao tentar fazer login em `https://barber-on-studio.vercel.app/login` com:
- **Email:** `ruanpereiranunes1@gmail.com`
- **Senha:** `Barberon2026`

O sistema retorna o erro: **"Database error querying schema"**

Este erro vem do **GoTrue (Supabase Auth)**, não do código da aplicação Next.js.

---

## Stack Tecnológica

- **Frontend/Backend:** Next.js 16.4.6 com Turbopack e `cacheComponents: true`
- **Banco de Dados:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth (GoTrue)
- **Deploy:** Vercel (produção em `barber-on-studio.vercel.app`)
- **Repositório:** `Binhu01/BarberOnStudio` no GitHub

---

## O que JÁ FUNCIONA

| Página | Status | Detalhes |
|--------|--------|----------|
| Landing page (`/`) | ✅ HTTP 200 | Widget de agendamento integrado funcionando |
| Login (`/login`) | ✅ HTTP 200 | Página renderiza, form envia, mas auth falha |
| Agendamento público (`/agendar/minha-barbearia`) | ✅ HTTP 200 | RPCs corrigidos (migration 028) |
| Dashboard (`/dashboard`) | ✅ HTTP 307 | Redirect esperado sem auth |

---

## O que NÃO FUNCIONA

**Login com email/senha** → retorna "Database error querying schema"

---

## Fluxo de Autenticação

### 1. Frontend (`src/app/login/page.tsx`)
```typescript
"use client";
import { createClient } from "@/lib/supabase/client";

async function onSubmit(data: LoginForm) {
  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (signInError) {
    setError(signInError.message); // ← Mostra "Database error querying schema"
    return;
  }
  router.push("/dashboard");
}
```

### 2. Cliente Supabase (`src/lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 3. Middleware (`src/lib/supabase/middleware.ts`)
```typescript
export async function updateSession(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() {...}, setAll(cookiesToSet) {...} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  // ... redirect logic
}
```

---

## Estrutura do Banco de Dados (tabelas relevantes)

### `auth.users` (tabela interna do Supabase Auth)
O usuário foi criado via **Dashboard → Authentication → Add User** com:
- **UID:** `121f3b84-2ce3-4854-b588-261fa0b12800`
- **Email:** `ruanpereiranunes1@gmail.com`
- **Senha:** `Barberon2026` (definida pelo Dashboard)
- **Auto Confirm User:** ✅ marcado

### `profiles` (tabela pública)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `memberships` (tabela pública)
```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
```

---

## Trigger que pode estar causando o erro

```sql
-- Migration 001_initial_schema.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Tentativa de correção (já executada, sem efeito):**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## Histórico de Tentativas de Correção

### Tentativa 1: Criar usuário via SQL direto (FALHOU)
```sql
INSERT INTO auth.users (id, instance_id, email, encrypted_password, ...)
SELECT gen_random_uuid(), '00000000-...', 'ruanpereiranunes1@gmail.com',
       crypt('Barberon2026', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ruanpereiranunes1@gmail.com');
```
**Resultado:** Usuário criado mas Supabase Auth não reconhece o hash.

### Tentativa 2: Criar via Dashboard Auth (SUCESSO parcial)
- Criado em Authentication → Users → Add User
- UID: `121f3b84-2ce3-4854-b588-261fa0b12800`
- Auto Confirm User marcado
- **Mas:** Login ainda retorna "Database error querying schema"

### Tentativa 3: Corrigir trigger handle_new_user (SEM EFEITO)
- Adicionado `ON CONFLICT (id) DO NOTHING`
- Trigger recriado com sucesso
- Login continua falhando

### Tentativa 4: Desabilitar trigger (BLOQUEADO)
```sql
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
```
**Erro:** `must be owner of table users` — não temos permissão para alterar triggers em `auth.users`.

### Tentativa 5: Limpar registros duplicados (PENDENTE)
```sql
DELETE FROM auth.users
WHERE email = 'ruanpereiranunes1@gmail.com'
  AND id != '121f3b84-2ce3-4854-b588-261fa0b12800';
```

---

## Hipóteses sobre a Causa Raiz

### Hipótese A: Registros duplicados em `auth.users`
O usuário pode ter sido inserido DUAS vezes:
1. Via SQL direto (hash inválido para GoTrue)
2. Via Dashboard Auth (hash correto)

O GoTrue tenta resolver o email e encontra múltiplos registros → falha com "querying schema".

### Hipótese B: Trigger falhando silenciosamente
O trigger `on_auth_user_created` pode estar falhando durante o processo de login (não apenas signup), causando erro interno no GoTrue.

### Hipótese C: Schema incompatível com GoTrue
Alguma coluna ou constraint em `profiles` ou `auth.users` pode estar em estado inconsistente, fazendo o GoTrue falhar ao consultar o schema.

### Hipótese D: `SUPABASE_SERVICE_ROLE_KEY` ausente na Vercel
A variável `SUPABASE_SERVICE_ROLE_KEY` NÃO está configurada na Vercel. O código tem fallback para anon client, mas o GoTrue pode precisar dela internamente para operações de auth.

---

## Queries de Diagnóstico para Executar no Supabase SQL Editor

```sql
-- 1. Quantos registros existem para o email do Ruan?
SELECT id, email, created_at, email_confirmed_at, encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = 'ruanpereiranunes1@gmail.com';

-- 2. Verificar se o profile existe e está correto
SELECT p.id, p.full_name, p.email, m.role, m.status
FROM profiles p
LEFT JOIN memberships m ON m.user_id = p.id
WHERE p.email = 'ruanpereiranunes1@gmail.com';

-- 3. Verificar triggers ativos em auth.users
SELECT tgname, tgtype, tgfoid::regproc
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- 4. Verificar se a função handle_new_user está correta
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 5. Verificar RLS policies em profiles
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 6. Verificar organização
SELECT id, name, slug
FROM organizations
WHERE slug = 'minha-barbearia';
```

---

## Variáveis de Ambiente na Vercel

| Variável | Status |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **NÃO configurada** |

---

## Próximos Passos Sugeridos

1. **Executar as queries de diagnóstico** acima para entender o estado do banco
2. **Se houver duplicatas em auth.users**, remover as extras
3. **Se o trigger estiver falhando**, tentar recriar a função sem o trigger (via API do Supabase Auth)
4. **Configurar `SUPABASE_SERVICE_ROLE_KEY`** na Vercel (Settings → Environment Variables)
5. **Alternativa:** deletar o usuário do Auth e recriar usando a API REST do Supabase Auth (`POST /auth/v1/admin/users` com service_role key)

---

## Arquivos Relevantes do Projeto

- `src/app/login/page.tsx` — Página de login (client component)
- `src/lib/supabase/client.ts` — Cliente Supabase para browser
- `src/lib/supabase/server.ts` — Cliente Supabase para server components
- `src/lib/supabase/admin.ts` — Cliente admin (retorna null sem service role key)
- `src/lib/supabase/middleware.ts` — Middleware de autenticação
- `src/lib/organizations.ts` — getUserOrganizations com fallback anon
- `supabase/migrations/001_initial_schema.sql` — Schema inicial com trigger
- `supabase/migrations/027_public_landing_policies.sql` — Policies públicas
- `supabase/migrations/028_fix_public_booking_rpcs.sql` — Fix RPCs de agendamento