# Problema: Landing Page Barber-On Studio não exibe dados do Supabase no Vercel

## Resumo do Problema
O site https://barber-on-studio.vercel.app foi deployado com sucesso (status "Ready" no Vercel), mas a landing page mostra estados vazios:
- Seção Barbeiros: mostra "Profissional" genérico ao invés de "Administrador"
- Seção Produtos e Serviços: mostra "Catálogo sendo configurado pelo administrador"

**Porém**, o endpoint `/api/diag` confirma que os dados EXISTEM e são acessíveis via anon key do Supabase:
- 1 organização ("Minha Barbearia")
- 16 serviços ativos com preços corretos
- 1 membership (user_id: 2a98cfc0-f218-4ea5-a58c-d837e51531ba, role: OWNER)
- 1 profile (full_name: "Administrador")
- 1 barbershop_settings completo
- 0 produtos (esperado, não há produtos cadastrados)

## Stack Técnica
- **Next.js 16.4.6** com App Router, React 19, TypeScript strict, Turbopack
- **`cacheComponents: true`** e **`partialPrefetching: true`** em `next.config.ts`
- **Supabase** como backend (project: ghqgskyhfdlpqdclwhdq)
- Deploy no **Vercel** (branch main)
- Node.js 26.x no runtime do Vercel

## ⚠️ RESTRIÇÃO CRÍTICA DO NEXT.JS 16
Com `cacheComponents: true`, **NÃO é possível usar** `export const dynamic = "force-dynamic"` em páginas ou rotas. O build falha com:
```
Error: Route segment config "dynamic" is not compatible with `nextConfig.cacheComponents`. Please remove it.
```

A documentação oficial do Next.js 16 diz que para dados dinâmicos com `cacheComponents: true`, deve-se usar `<Suspense>` para streaming. A página foi refatorada para esse padrão, mas **os dados continuam não aparecendo**.

## Código Atual dos Arquivos Principais

### next.config.ts
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

### src/app/page.tsx (estrutura principal)
```tsx
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Scissors, CalendarDays, MapPin, Instagram, Box, ChevronRight, Star, ShieldCheck, Gem, Clock, Menu, X } from "lucide-react";
import { LandingBookingWidget } from "./_components/landing-booking-widget";
import { getLandingData } from "./actions";

export const metadata: Metadata = {
  title: "Barber On Studio | Estilo, Confiança e Atitude",
  // ...
};

async function LandingContent() {
  const data = await getLandingData();

  return (
    <div className="min-h-screen bg-bo-black text-bo-white font-sans selection:bg-bo-blue/30">
      {/* HEADER - navegação estática */}
      {/* HERO SECTION - conteúdo estático */}
      
      {/* BARBEIROS SECTION */}
      <section id="barbeiros" className="py-24">
        {data.barbers.length === 0 ? (
          <p>Equipe sendo cadastrada...</p>
        ) : (
          data.barbers.map((barber) => (/* renderiza cards */))
        )}
      </section>

      {/* AGENDAMENTO SECTION */}
      <section id="agendar">
        <LandingBookingWidget services={data.services} barbers={data.barbers} settings={data.settings} />
      </section>

      {/* PRODUTOS E SERVIÇOS SECTION */}
      <section id="produtos">
        {data.services.map((service) => (/* renderiza cards de serviço */))}
        {data.products.map((product) => (/* renderiza cards de produto */))}
        {data.services.length === 0 && data.products.length === 0 && (
          <p>Catálogo sendo configurado pelo administrador.</p>
        )}
      </section>

      {/* LOCALIZAÇÃO + INSTAGRAM - conteúdo estático */}
      {/* FOOTER - conteúdo estático */}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bo-black text-bo-white flex items-center justify-center"><p>Carregando...</p></div>}>
      <LandingContent />
    </Suspense>
  );
}
```

### src/app/actions.ts (função getLandingData completa)
```typescript
"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }
  return createSupabaseClient(url, key);
}

export async function getLandingData() {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (e: any) {
    console.error("[getLandingData] Credenciais Supabase não configuradas:", e.message);
    return { barbers: [], services: [], products: [], settings: null };
  }

  // 1. Buscar organização
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .limit(1);

  if (orgError || !orgs || orgs.length === 0) {
    console.error("[getLandingData] Erro ao buscar organização:", orgError?.message);
    return { barbers: [], services: [], products: [], settings: null };
  }

  const org = orgs[0];

  // 2. Buscar membros da organização
  const { data: activeMembers, error: membersError } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", org.id);

  if (membersError) {
    console.error("[getLandingData] Erro ao buscar membros:", membersError.message);
  }

  const memberIds = (activeMembers ?? []).map((m: any) => m.user_id);
  const memberRoles: Record<string, string> = {};
  for (const m of activeMembers ?? []) {
    memberRoles[m.user_id] = m.role;
  }

  // 3. Buscar dados em paralelo usando Promise.allSettled
  const [barbersResult, servicesResult, productsResult, settingsResult] =
    await Promise.allSettled([
      memberIds.length > 0
        ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", memberIds).order("full_name")
        : Promise.resolve({ data: [], error: null }),
      supabase.from("barber_services").select("id, name, description, price, duration_minutes, image_url")
        .eq("organization_id", org.id).eq("is_active", true).order("display_order").order("name"),
      supabase.from("products").select("id, name, description, sale_price, image_url")
        .eq("organization_id", org.id).eq("is_active", true).order("name").limit(8),
      supabase.from("barbershop_settings").select("*").eq("organization_id", org.id).limit(1),
    ]);

  // Extrair resultados (tratamento de fulfilled/rejected)
  const barbersRes = barbersResult.status === "fulfilled" ? barbersResult.value : { data: [], error: { message: String(barbersResult.reason) } };
  const servicesRes = servicesResult.status === "fulfilled" ? servicesResult.value : { data: [], error: { message: String(servicesResult.reason) } };
  const productsRes = productsResult.status === "fulfilled" ? productsResult.value : { data: [], error: { message: String(productsResult.reason) } };
  const settingsRes = settingsResult.status === "fulfilled" ? settingsResult.value : { data: [], error: { message: String(settingsResult.reason) } };

  // Logs de erro
  if ((barbersRes as any).error) console.error("[getLandingData] Erro barbers:", (barbersRes as any).error.message);
  if ((servicesRes as any).error) console.error("[getLandingData] Erro services:", (servicesRes as any).error.message);
  if ((productsRes as any).error) console.error("[getLandingData] Erro products:", (productsRes as any).error.message);
  if ((settingsRes as any).error) console.error("[getLandingData] Erro settings:", (settingsRes as any).error.message);

  const settingsData = Array.isArray(settingsRes.data) ? settingsRes.data[0] : (settingsRes as any).data;

  return {
    barbers: ((barbersRes as any).data ?? []).map((b: any) => ({
      id: b.id, full_name: b.full_name || "Profissional", avatar_url: b.avatar_url,
      phone: null, role: memberRoles[b.id] ?? "Barbeiro", instagram: null,
    })),
    services: ((servicesRes as any).data ?? []).map((s: any) => ({
      id: s.id, name: s.name, description: s.description, price: s.price,
      duration_minutes: s.duration_minutes, image_url: s.image_url ?? null,
    })),
    products: ((productsRes as any).data ?? []).map((p: any) => ({
      id: p.id, name: p.name, description: p.description, price: p.sale_price,
      image_url: p.image_url ?? null,
    })),
    settings: settingsData ?? null,
  };
}
```

### src/app/api/diag/route.ts (endpoint de diagnóstico - FUNCIONA CORRETAMENTE)
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Variáveis de ambiente não configuradas" });
  }
  const supabase = createClient(url, anonKey);
  // Testa todas as tabelas e retorna JSON com contagens e dados
  // organizations: count 1, barber_services: count 16, memberships: count 1,
  // profiles: count 1, barbershop_settings: count 1, products: count 0
}
```

## Variáveis de Ambiente no Vercel
As seguintes variáveis ESTÃO configuradas no Vercel (o /api/diag prova isso):
- `NEXT_PUBLIC_SUPABASE_URL=https://ghqgskyhfdlpqdclwhdq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## RLS Policies do Supabase
Foram criadas políticas públicas (migration 027) para permitir SELECT sem autenticação nas tabelas:
- organizations, barber_services, products, barbershop_settings, profiles, memberships, public_bookings

A migration 028 corrigiu recursão infinita nas policies de memberships usando `is_member_of()` (SECURITY DEFINER).

## Diagnóstico: O Que Já Foi Tentado
1. ✅ Removido `export const dynamic = "force-dynamic"` do diag route (causava build failure)
2. ✅ Refatorado page.tsx para usar `<Suspense>` com componente `LandingContent` separado
3. ✅ Build local passa sem erros (página classificada como ◐ Partial Prerender)
4. ✅ Deploy no Vercel com status Ready
5. ✅ /api/diag retorna todos os dados corretamente
6. ❌ Landing page continua mostrando estados vazios

## Hipóteses a Investigar
1. **Cache do Vercel/CDN**: A página pode estar servindo uma versão cacheda anterior ao fix do Suspense
2. **`"use server"` em actions.ts**: Pode conflitar com o modelo de cache do Next.js 16 quando usado dentro de `<Suspense>`
3. **Variáveis de ambiente em runtime**: O `process.env.NEXT_PUBLIC_*` pode não estar disponível no contexto de Server Components com `cacheComponents: true`
4. **Erro silencioso no getLandingData()**: O try/catch pode estar engolindo um erro específico do runtime Vercel
5. **Partial Prerendering**: O shell estático pode estar sendo servido sem esperar o streaming completar
6. **Middleware/proxy deprecated**: O aviso sobre middleware pode indicar que algo no fluxo de request está interferindo

## O Que Precisa Ser Feito
Corrigir a landing page para que os dados do Supabase (16 serviços, 1 barbeiro "Administrador", settings) apareçam corretamente no site em produção no Vercel, respeitando as restrições do Next.js 16 com `cacheComponents: true`.

## Repositório e Acesso ao Código
- **GitHub**: https://github.com/Binhu01/BarberOnStudio (branch `main`)
- O GPT **não tem acesso direto** ao repositório nem ao Vercel. Todo o código relevante está incluído neste documento.
- Se precisar de algum arquivo que não está aqui, peça ao usuário para colar o conteúdo.

## Como o GPT Deve Resolver Este Problema

### Formato Esperado da Resposta
Para cada solução proposta, entregue:
1. **Diagnóstico**: qual das 6 hipóteses acima é a causa raiz (ou uma nova hipótese)
2. **Arquivo(s) a modificar**: nome exato do caminho (`src/app/page.tsx`, `src/app/actions.ts`, etc.)
3. **Código completo do arquivo modificado**: não envie diffs ou trechos parciais — envie o arquivo inteiro pronto para copiar e colar, pois o usuário não tem experiência técnica avançada
4. **Instruções de aplicação**: passo a passo simples (ex: "substitua todo o conteúdo de `src/app/page.tsx` pelo código abaixo")
5. **Como validar**: o que o usuário deve ver no site após aplicar a mudança

### Restrições Obrigatórias
- ❌ **NÃO sugerir** `export const dynamic = "force-dynamic"` — isso quebra o build com `cacheComponents: true`
- ❌ **NÃO sugerir** desativar `cacheComponents` — é requisito do projeto
- ❌ **NÃO sugerir** trocar para `createServerClient` do `@supabase/ssr` — já testamos e falha no Vercel serverless
- ✅ **DEVE** respeitar o padrão `<Suspense>` + componente async separado (Next.js 16 Cache Components)
- ✅ **DEVE** usar `createClient` direto do `@supabase/supabase-js`
- ✅ **DEVE** manter `"use server"` no topo do `actions.ts`
- ✅ **DEVE** considerar que o `/api/diag` FUNCIONA (prova que credenciais e RLS estão corretos)

### Abordagem Recomendada
A causa mais provável é que o `getLandingData()` está falhando silenciosamente no runtime do Vercel (hipótese #4), retornando arrays vazios que ativam os estados de fallback na UI. Para diagnosticar:

1. Adicionar um endpoint temporário `/api/test-landing` que chama `getLandingData()` e retorna o resultado bruto como JSON — assim o usuário pode acessar no navegador e ver exatamente o que a função retorna em produção
2. OU adicionar logging visível na própria página (renderizar `JSON.stringify(data)` em um `<pre>` temporário) para ver o que chega ao componente
3. Com base no resultado real, corrigir a causa específica

Se o problema for cache (hipótese #1), a solução pode ser adicionar headers de `Cache-Control: no-store` via `metadata` ou `headers()` do Next.js.

Se o problema for `"use server"` conflitando com Suspense (hipótese #2), a solução pode ser mover a lógica de fetch para dentro do componente async diretamente, sem a diretiva.

## Links Úteis
- Site: https://barber-on-studio.vercel.app
- Diag: https://barber-on-studio.vercel.app/api/diag
- GitHub: https://github.com/Binhu01/BarberOnStudio
- Docs Next.js 16 Caching: `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
- Docs Cache Components: `node_modules/next/dist/docs/app/api-reference/config/next-config-js/cacheComponents.md`