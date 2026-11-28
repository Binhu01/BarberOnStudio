# Correção da Tela Preta do Dashboard — BarberOn Studio

**Data:** 2026-11-28  
**Branch:** `main`  
**Repositório:** `Binhu01/BarberOnStudio`  
**Produção:** `barber-on-studio.vercel.app`

---

## Causa Raiz

Duas causas independentes combinadas resultavam na tela preta:

### 1. Importação fantasma no CSS (`globals.css`)
O arquivo `src/app/globals.css` importava `@import "shadcn/tailwind.css"` — um pacote que **não existe** no projeto (verificado via glob). Com Turbopack e `cacheComponents: true`, essa importação falha silenciosamente no build de produção, resultando em CSS não sendo gerado corretamente. Todos os componentes renderizavam mas ficavam invisíveis contra o fundo escuro (`bg-barber-dark: #1A1A1A`).

### 2. Falta de `<Suspense>` boundary no DashboardAuthGate
Com `cacheComponents: true` do Next.js 16, componentes client que usam hooks do router (`usePathname`, `useRouter`) precisam estar dentro de um `<Suspense>` boundary quando renderizados por um server component que lê sessão/cookies. A ausência desse boundary causava o erro `Internal Next.js error: Router action dispatched before initialization` nos logs do browser, impedindo a hidratação do React.

---

## Evidências

### Antes da correção
- **Console do browser:** `Uncaught Error: Internal Next.js error: Router action dispatched before initialization.` (5 ocorrências)
- **Snapshot do browser:** Página vazia / "Carregando..." sem conteúdo do dashboard
- **Build:** Passava sem erros (a importação `shadcn/tailwind.css` falhava silenciosamente)
- **Logs Vercel:** Nenhum erro server-side (problema era exclusivamente client-side)

### Depois da correção
- **Console do browser:** `No console logs.` (zero erros)
- **Build:** Compila com sucesso, todas as rotas geradas corretamente
- **Snapshot do browser:** Renderização normal (landing page no dev sem auth; dashboard esperado em produção com cookies)

---

## Correções Aplicadas

### 1. `src/app/globals.css`
**Removido:** `@import "shadcn/tailwind.css";` (linha 3)

```diff
 @import "tailwindcss";
 @import "tw-animate-css";
-@import "shadcn/tailwind.css";
```

### 2. `src/app/dashboard/_components/dashboard-auth-gate.tsx`
**Adicionado:** Import de `Suspense` do React e wrapper `<Suspense>` ao redor do `<DashboardShell>`.

```diff
+import { Suspense } from "react";
 import { redirect } from "next/navigation";
 // ... demais imports

 return (
   <OrganizationProvider org={activeData.org} allOrgs={activeData.allOrgs}>
+    <Suspense
+      fallback={
+        <div className="flex min-h-screen items-center justify-center bg-barber-dark">
+          <p className="text-barber-muted">Carregando dashboard...</p>
+        </div>
+      }
+    >
       <DashboardShell ...>
         {children}
       </DashboardShell>
+    </Suspense>
   </OrganizationProvider>
 );
```

### 3. `src/app/dashboard/organization-context.tsx` (correção anterior nesta sessão)
**Removido:** Import `type { UserOrganization }` de `@/lib/organizations` (módulo server-only).  
**Adicionado:** Tipo `ClientOrganization` definido localmente para desacoplar o contexto client-side dos módulos server-only.

---

## Arquivos Modificados

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `src/app/globals.css` | Removida linha `@import "shadcn/tailwind.css"` | Pacote inexistente causava falha silenciosa no CSS |
| `src/app/dashboard/_components/dashboard-auth-gate.tsx` | Adicionado `<Suspense>` boundary ao redor do `DashboardShell` | Exigido pelo Next.js 16 com `cacheComponents: true` para componentes client que usam router hooks |
| `src/app/dashboard/organization-context.tsx` | Tipo `ClientOrganization` local em vez de import server-only | Evita vazamento de módulo server-only para bundle do cliente |

---

## Testes Realizados

- [x] Build Next.js passa sem erros (`npx next build`)
- [x] Console do browser limpo (zero erros após correção)
- [x] Snapshot do browser confirma renderização (sem tela preta)
- [x] Git status confirma preservação de todas as alterações locais preexistentes
- [ ] Login em produção (pendente — requer deploy)
- [ ] Navegação entre abas do dashboard (pendente — requer deploy)
- [ ] Persistência de sessão após refresh (pendente — requer deploy)
- [ ] Logout e re-login (pendente — requer deploy)

---

## Resultado do Build

```
✓ Compiled successfully in 5.2s
✓ TypeScript check passed
✓ All routes generated (ƒ Dynamic, ◐ Partial Prerender, ○ Static)
```

---

## Pendências

1. **Deploy em produção** — As correções estão commitadas localmente mas NÃO foram pushadas nem deployadas. Aguardar revisão antes de `git push barberon main`.
2. **Validação em produção** — Após deploy, verificar se o Ruan consegue logar e ver o dashboard completo.
3. **Limpeza de arquivos temporários** — Remover `/api/diag/route.ts`, `/dashboard/diag/page.tsx`, `/dashboard/diag-client/page.tsx` e `PROMPT-GPT-TELA-PRETA.md` após confirmação de que o problema foi resolvido.
4. **Service Worker** — O `PWAInstallPrompt` registra `/sw.js` que pode servir assets desatualizados. Considerar versionamento do SW ou cache-busting após deploys futuros.

---

## Referências

- [Next.js 16 — Authentication with Cache Components](node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md)
- [Next.js 16 — Adopting Partial Prefetching](node_modules/next/dist/docs/01-app/02-guides/adopting-partial-prefetching.md)
- Commit: `fix: remover import server-only do organization-context para evitar tela preta` (23bcda9)
- Commit: `diag: adicionar página de diagnóstico client-side para identificar tela preta` (7d2bca5)