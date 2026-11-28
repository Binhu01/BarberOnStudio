# PROMPT PARA RESOLVER TELA PRETA DO DASHBOARD — BarberOnStudio

## Contexto do Problema

O dashboard da aplicação BarberOnStudio (`barber-on-studio.vercel.app`) mostra uma **tela completamente preta** quando o usuário faz login. O backend funciona perfeitamente (API `/api/diag` confirma que Supabase admin client, anon client, auth e queries estão todos OK). O problema é **exclusivamente client-side** — falha na hidratação do React ou erro JavaScript que impede a renderização.

## Stack Técnica

- **Next.js 16.4.6** com Turbopack e `cacheComponents: true` + `partialPrefetching: true`
- **React 19** (App Router)
- **Supabase** com `@supabase/ssr` e dois clientes: anon (RLS) e admin (service_role)
- **Tailwind CSS** com tema customizado (cores `barber-dark`, `barber-gold`, etc.)
- **Vercel** como host de produção
- **TypeScript**

## Arquivos Críticos da Cadeia de Renderização

### 1. `src/app/dashboard/layout.tsx` (Server Component)
```tsx
import { DashboardAuthGate } from "./_components/dashboard-auth-gate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardAuthGate>{children}</DashboardAuthGate>;
}
```

### 2. `src/app/dashboard/_components/dashboard-auth-gate.tsx` (Server Component)
Este componente já foi corrigido para usar APENAS o anon client (não depende mais do admin client):
```tsx
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations";
import { DashboardShell } from "../shell";
import { OrganizationProvider } from "../organization-context";

export async function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  await connection(); // Obrigatório com cacheComponents: true
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const activeData = await getActiveOrganization();
  if (!activeData) redirect("/dashboard/onboarding");
  
  let userName: string | null = null;
  let userAvatar: string | null = null;
  const { data: profile } = await supabase
    .from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle();
  userName = profile?.full_name ?? null;
  userAvatar = profile?.avatar_url ?? null;

  return (
    <OrganizationProvider org={activeData.org} allOrgs={activeData.allOrgs}>
      <DashboardShell
        user={{ id: user.id, name: userName, email: user.email ?? "", avatarUrl: userAvatar }}
        activeOrg={{ id: activeData.org.id, name: activeData.org.name, slug: activeData.org.slug, role: activeData.org.membership.role }}
        allOrgs={activeData.allOrgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}>
        {children}
      </DashboardShell>
    </OrganizationProvider>
  );
}
```

### 3. `src/app/dashboard/shell.tsx` ("use client") — **SUSPEITO PRINCIPAL**
Este é um componente client-side grande (~420 linhas) que renderiza toda a UI do dashboard (sidebar, header, navegação). Ele importa:
- `createClient` de `@/lib/supabase/client` (browser client — OK)
- `switchOrganization` de `./actions` (**"use server"** — importa `createAdminClient` e `requireAdminClient` de `@/lib/supabase/admin`)
- ~30 ícones de `lucide-react`
- Hooks: `useState`, `useTransition`, `usePathname`, `useRouter`

**Problema potencial**: A importação de `switchOrganization` de `./actions` pode estar causando problemas no bundle do cliente com `cacheComponents: true`, pois `actions.ts` importa módulos server-only (`cookies()` do `next/headers`, `requireAdminClient` que usa `process.env.SUPABASE_SERVICE_ROLE_KEY`).

### 4. `src/app/dashboard/actions.ts` ("use server")
```tsx
"use server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdminClient } from "@/lib/supabase/admin";

export async function switchOrganization(organizationId: string) {
  // ... usa admin client com fallback para anon
}
```

### 5. `src/app/dashboard/organization-context.tsx` ("use client") — **JÁ CORRIGIDO**
Foi corrigido para definir tipos localmente em vez de importar de `@/lib/organizations` (módulo server-only):
```tsx
"use client";
import { createContext, useContext, type ReactNode } from "react";

export interface ClientOrganization {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  membership: {
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    status: "active" | "suspended";
    created_at: string;
  };
}

interface OrganizationContextType {
  org: ClientOrganization;
  allOrgs: ClientOrganization[];
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error("useOrganization must be used within OrganizationProvider");
  return context;
}

export function OrganizationProvider({ children, org, allOrgs }: {
  children: ReactNode;
  org: ClientOrganization;
  allOrgs: ClientOrganization[];
}) {
  return (
    <OrganizationContext.Provider value={{ org, allOrgs }}>
      {children}
    </OrganizationContext.Provider>
  );
}
```

### 6. `src/app/dashboard/page.tsx` ("use client")
Página inicial do dashboard que usa `useOrganization()` do contexto. Se o contexto não estiver disponível, mostra "Carregando...".

### 7. `src/app/dashboard/error.tsx` ("use client")
Error boundary que deveria capturar erros de renderização, mas a tela preta sugere que o erro ocorre ANTES do React conseguir montar o error boundary.

### 8. `src/lib/supabase/admin.ts` (Server-only)
```tsx
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // NÃO é NEXT_PUBLIC_
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function requireAdminClient(): SupabaseClient {
  const client = createAdminClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada.");
  return client;
}
```

### 9. `src/lib/supabase/client.ts` (Browser client)
```tsx
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 10. `next.config.ts`
```ts
// Tem cacheComponents: true e partialPrefetching: true
// IMPORTANTE: cacheComponents é INCOMPATÍVEL com export const dynamic = "force-dynamic"
```

## O Que Já Foi Tentado (NÃO FUNCIONOU)

1. ✅ Corrigir SUPABASE_SERVICE_ROLE_KEY na Vercel (confirmado funcionando via `/api/diag`)
2. ✅ Remover dependência do admin client no `DashboardAuthGate`
3. ✅ Adicionar `await connection()` para compatibilidade com `cacheComponents`
4. ✅ Remover import server-only do `organization-context.tsx`
5. ✅ Build passa sem erros
6. ✅ Deploy na Vercel é bem-sucedido
7. ✅ Middleware autentica corretamente e encontra memberships
8. ❌ **Tela preta PERSISTE**

## Hipóteses Restantes (Investigar Nesta Ordem)

### Hipótese 1: Import de server action no shell.tsx causa falha no bundle client
O `shell.tsx` importa `switchOrganization` de `./actions`. Embora `actions.ts` tenha `"use server"`, com `cacheComponents: true` o Next.js pode estar tentando avaliar as importações transitivas (`requireAdminClient`, `cookies()`) no bundle do cliente, causando erro silencioso.

**Teste**: Substituir a importação direta por um wrapper que usa `useTransition` + chamada inline, ou mover `switchOrganization` para um arquivo separado que NÃO importa `admin.ts`.

### Hipótese 2: Tailwind CSS não está carregando
A tela é preta porque o fundo é `bg-barber-dark` (#1a1a2e) e nenhum conteúdo é visível. Se o CSS não carregar, todos os elementos ficam invisíveis contra o fundo escuro.

**Teste**: Adicionar um elemento com inline style (não Tailwind) no `shell.tsx` para verificar se algo aparece. Ex: `<div style={{color:'red',fontSize:'24px'}}>TESTE</div>` no topo do componente.

### Hipótese 3: Erro de hidratação/mismatch entre SSR e CSR
O servidor renderiza HTML com dados reais, mas o cliente tenta renderizar com dados diferentes (ou vazios), causando mismatch silencioso do React 19.

**Teste**: Verificar se o `OrganizationProvider` recebe props serializáveis corretamente. O tipo `ClientOrganization` deve ser estruturalmente idêntico ao que o servidor passa.

### Hipótese 4: Erro em componente filho antes do error boundary montar
Algum componente dentro do `DashboardShell` (ex: ícone lucide mal importado, hook usado incorretamente) lança erro durante a fase de montagem do React, antes do error boundary poder capturá-lo.

**Teste**: Simplificar o `shell.tsx` temporariamente para renderizar apenas `{children}` sem sidebar/header, e ver se o `page.tsx` aparece.

### Hipótese 5: `cacheComponents: true` causa comportamento inesperado
O `cacheComponents: true` do Next.js 16 pode estar causando caching agressivo de componentes client, resultando em stale state ou falha na re-hidratação.

**Teste**: Desativar temporariamente `cacheComponents` no `next.config.ts` e fazer deploy para ver se resolve.

## Instruções para Resolução

1. **Comece pela Hipótese 2** (mais rápida de testar): adicione um `<div style={{...}}>TESTE VISÍVEL</div>` no topo do `shell.tsx` e faça deploy. Se aparecer, o problema é JS/hidratação. Se NÃO aparecer, é CSS.

2. **Se for JS**: simplifique o `shell.tsx` para renderizar apenas `{children}` sem nenhuma lógica de sidebar/org-switcher. Faça deploy. Se o `page.tsx` aparecer, o problema está em alguma parte do shell. Reintroduza partes gradualmente até encontrar a que quebra.

3. **Se for a importação de actions**: crie um novo arquivo `src/app/dashboard/org-switch-action.ts` com APENAS a função `switchOrganization` usando somente o anon client (sem importar admin.ts), e atualize o shell.tsx para importar desse novo arquivo.

4. **Se nada funcionar**: desative `cacheComponents: true` no `next.config.ts`, faça deploy e teste. Se resolver, o problema é incompatibilidade entre cacheComponents e algum padrão do código.

5. **Sempre verifique o console do navegador** (DevTools → Console) após cada deploy — erros de hidratação do React aparecem lá.

## Repositório e Ambiente

- **Repo**: `github.com/Binhu01/BarberOnStudio`
- **Branch**: `main`
- **Remote**: `barberon` (NÃO é `origin`)
- **Produção**: `barber-on-studio.vercel.app`
- **Worktree local**: `C:\Users\glaub\OneDrive\Desktop\Barber-On\.claude\worktrees\youthful-maxwell-7cebc1`
- **Push**: `git push barberon main`
- **Deploy**: automático via Vercel ao pushar no main

## Resultado Esperado

O dashboard deve mostrar:
- Sidebar lateral escura com itens de navegação
- Header com nome do usuário e seletor de organização
- Conteúdo principal com cards de informação ("Olá, Bem-vindo!", nome da org, papel, status)
- Tudo funcional: troca de org, navegação entre páginas

Atualmente mostra apenas fundo escuro (#1a1a2e) sem nenhum conteúdo visível.