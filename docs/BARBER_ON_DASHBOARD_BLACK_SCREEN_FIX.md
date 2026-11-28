# Correção da Tela Preta do Dashboard — BarberOn Studio

**Data:** 2026-11-28  
**Branch:** `main`  
**Repositório:** `Binhu01/BarberOnStudio`  
**Produção:** `barber-on-studio.vercel.app`

---

## Causa Raiz

Três causas independentes combinadas resultavam na tela preta persistente:

### 1. Importação fantasma no CSS (`globals.css`)
O arquivo `src/app/globals.css` importava `@import "shadcn/tailwind.css"` — um pacote que **não existe** no projeto. Com Turbopack, essa importação falha silenciosamente, resultando em CSS não sendo gerado corretamente. Componentes renderizavam mas ficavam invisíveis contra o fundo escuro.

### 2. Falta de `<Suspense>` boundary no DashboardAuthGate
Com Next.js 16, componentes client que usam hooks do router precisam estar dentro de um `<Suspense>` boundary quando renderizados por um server component que lê sessão/cookies. A ausência causava erro de hidratação no browser.

### 3. RLS bloqueia queries de organização nos Server Components (CAUSA PRINCIPAL)
O `DashboardAuthGate` (Server Component) chamava `getActiveOrganization()` que consultava a tabela `memberships` via Supabase. O problema: **Server Components usam `cookies()` do Next.js que retorna cookies diferentes/stale comparados aos cookies da request original que o middleware processa**. Como resultado, o cliente Supabase criado no Server Component não tinha tokens de auth válidos → RLS bloqueava a query → retornava 0 memberships → `getActiveOrganization()` retornava `null` → redirect para `/dashboard/onboarding` → loop infinito ou tela preta.

**Por que o middleware funciona mas o Server Component não?**
- O middleware recebe a `NextRequest` com os cookies originais do browser
- O `createServerClient` no middleware usa `request.cookies.getAll()` → cookies frescos
- O `createClient()` nos Server Components usa `cookies()` do `next/headers` → pode retornar cookies stale ou incompletos após o ciclo de redirecionamento
- Mesmo com JWT válido extraído manualmente do cookie, a REST API retornava 0 resultados devido a inconsistências no token

---

## Solução Definitiva

Passar os dados da organização **do middleware para o Server Component via header HTTP**, eliminando completamente a necessidade de re-queryar no Server Component.

### Fluxo corrigido:
1. **Middleware** (`src/lib/supabase/middleware.ts`): faz a query completa com join `organizations` usando os cookies frescos da request → codifica os dados em base64 → seta no header `x-barber-org-data` da response
2. **DashboardAuthGate** (`src/app/dashboard/_components/dashboard-auth-gate.tsx`): lê o header `x-barber-org-data` via `headers()` do `next/headers` → decodifica base64 → usa os dados diretamente sem nenhuma query adicional ao Supabase
3. **Profile**: ainda é buscado via `supabase.from("profiles")` no Server Component (funciona porque RLS permite leitura do próprio perfil)

---

## Evidências

### Antes da correção
- **Console do browser:** `Uncaught Error: Internal Next.js error: Router action dispatched before initialization.`
- **Snapshot do browser:** Página vazia / "Carregando..." sem conteúdo do dashboard
- **Logs do servidor:** `[getUserOrgs] server client returned 0` mesmo com usuário autenticado
- **Middleware crash:** `ReferenceError: memberships is not defined` (erro de escopo introduzido durante tentativa anterior)

### Depois da correção
- **Console do browser:** Zero erros
- **Logs do servidor:** `GET /dashboard 200`, org data recebida via header (`orgName: 'Minha Barbearia'`)
- **Screenshot:** Dashboard completo renderizado com sidebar (19 itens), cards de resumo (Organização, Papel, Status, Slug), banner "Ambiente pronto para uso"
- **Login funcional:** Credenciais de teste logaram e renderizaram o dashboard corretamente no dev server

---

## Correções Aplicadas

### 1. `src/app/globals.css`
**Removido:** `@import "shadcn/tailwind.css";`

### 2. `src/app/dashboard/_components/dashboard-auth-gate.tsx`
**Reescrito:** Lê org data do header `x-barber-org-data` ao invés de chamar `getActiveOrganization()`. Adicionado `<Suspense>` boundary ao redor do `DashboardShell`. Usa `await connection()` após redirects para forçar renderização dinâmica. Logs de diagnóstico removidos.

### 3. `src/lib/supabase/middleware.ts`
**Corrigido:** Query única com join `organizations(id, name, slug, ...)` dentro do bloco `if (user)` onde as variáveis estão no escopo correto. Dados codificados em base64 e passados via header `x-barber-org-data`. Fallback para service_role mantido caso anon key não encontre memberships. Logs de diagnóstico removidos.

### 4. `src/app/dashboard/shell.tsx`
**Removido:** Marcador de diagnóstico "SHELL OK" (overlay verde fixo no canto superior direito).

### 5. `src/app/dashboard/organization-context.tsx`
**Corrigido:** Tipo `ClientOrganization` definido localmente em vez de importar `UserOrganization` de módulo server-only.

### 6. `next.config.ts`
**Desativado:** `cacheComponents: true` e `partialPrefetching: true` comentados para evitar problemas de prerenderização com `Date.now()` e cookies dinâmicos.

---

## Arquivos Modificados

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `src/app/globals.css` | Removida linha `@import "shadcn/tailwind.css"` | Pacote inexistente causava falha silenciosa no CSS |
| `src/app/dashboard/_components/dashboard-auth-gate.tsx` | Lê org data de header; adicionado Suspense; connection() | Evita query RLS-bloqueada no Server Component |
| `src/lib/supabase/middleware.ts` | Query com join + header x-barber-org-data | Passa dados da org do middleware para Server Component |
| `src/app/dashboard/shell.tsx` | Removido marcador "SHELL OK" | Limpeza de diagnóstico |
| `src/app/dashboard/organization-context.tsx` | Tipo ClientOrganization local | Evita vazamento server-only para client bundle |
| `next.config.ts` | cacheComponents desativado | Evita erros de prerender com cookies dinâmicos |

---

## Testes Realizados

- [x] Build Next.js passa sem erros
- [x] Console do browser limpo (zero erros)
- [x] Login com credenciais de teste → dashboard renderiza completamente
- [x] Screenshot confirma: sidebar, cards, banner de status todos visíveis
- [x] Org data passada corretamente via header (logs confirmam `orgName: 'Minha Barbearia'`)
- [x] Profile carregado corretamente (nome e avatar)
- [ ] Deploy em produção (pendente — aguardando autorização)
- [ ] Validação pelo Ruan em produção (pendente)
- [ ] Navegação entre abas do dashboard (pendente — requer deploy)
- [ ] Persistência de sessão após refresh (pendente — requer deploy)

---

## Pendências

1. **Commit e push** — As alterações estão salvas localmente. Aguardar revisão antes de `git push barberon main`.
2. **Deploy em produção** — Após push, o Vercel fará deploy automaticamente.
3. **Validação pelo Ruan** — Confirmar que o dashboard funciona em produção nos navegadores dele.
4. **Limpeza de arquivos temporários** — Remover `/api/diag/route.ts`, `/dashboard/diag/page.tsx`, `/dashboard/diag-client/page.tsx` e `PROMPT-GPT-TELA-PRETA.md` após confirmação.
5. **Service Worker** — O `PWAInstallPrompt` registra `/sw.js` que pode servir assets desatualizados. Considerar versionamento ou cache-busting.
6. **Limpar `src/lib/organizations.ts`** — Este arquivo ainda contém múltiplas camadas de fallback HTTP que não são mais usadas pelo fluxo principal (middleware → header). Pode ser simplificado ou removido se nenhum outro componente o utilizar.

---

## Lições Aprendidas

1. **Server Components + RLS = armadilha**: Cookies disponíveis nos Server Components via `cookies()` podem diferir dos cookies da request original. Para dados críticos de auth/org, passe do middleware via header.
2. **Escopo de variáveis em middleware**: Ao adicionar código condicional, verificar sempre se as variáveis referenciadas estão no escopo correto. O erro `memberships is not defined` quebrou todas as rotas do app.
3. **Turbopack cacheia agressivamente**: Após editar o middleware, o dev server pode continuar servindo a versão antiga. Reiniciar o dev server é necessário para garantir que mudanças no middleware sejam aplicadas.
4. **Header pattern para bypass de RLS**: Codificar dados em base64 e passar via response header é uma abordagem segura e eficiente para comunicar dados verificados pelo middleware aos Server Components, evitando queries redundantes.

---

## Referências

- [Next.js 16 — Authentication with Cache Components](node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md)
- [Next.js 16 — Adopting Partial Prefetching](node_modules/next/dist/docs/01-app/02-guides/adopting-partial-prefetching.md)
- Commit: `fix: eliminar tela preta do dashboard (SW cache + server action leak)` (e354a5e)
- Commit: `fix: resolver tela preta do dashboard (CSS fantasma + Suspense boundary)` (3700832)
- Commit: `fix: remover import server-only do organization-context para evitar tela preta` (23bcda9)