# Auditoria de Permissões RLS — Barber-On QA

**Projeto Supabase:** `idymvdboboixjtywhdcd`  
**Data:** 2026-11-23  
**Responsável:** Claude Code (assistente de desenvolvimento)

---

## 1. INVESTIGAÇÃO

### 1.1 Diagnóstico Inicial
O erro `permission denied for table organizations` indica que a chave `anon` não tem permissão de `SELECT` nas tabelas do schema `public`. Isso ocorre porque:

- As migrations criaram as tabelas com RLS ativado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- As políticas RLS existentes restringem acesso apenas a membros autenticados da organização
- A chave `anon` (usada no frontend público/landing page) não consegue ler dados públicos como serviços, configurações e informações básicas da organização

### 1.2 Tabelas Analisadas
| Tabela | Status RLS | Acesso Anon Atual | Necessidade |
|--------|-----------|-------------------|-------------|
| `organizations` | Ativado | Bloqueado | Leitura pública (nome, slug) |
| `barber_services` | Ativado | Bloqueado | Leitura pública (serviços ativos) |
| `barbershop_settings` | Ativado | Bloqueado | Leitura pública (configurações) |
| `products` | Ativado | Bloqueado | Leitura pública (catálogo) |
| `profiles` | Ativado | Bloqueado | **PROTEGIDO** (não expor) |
| `memberships` | Ativado | Bloqueado | **PROTEGIDO** (não expor) |

### 1.3 Diferença entre GRANT e RLS
- **GRANT**: Concede privilégios SQL brutos (ex: `SELECT ON TABLE`)
- **RLS (Row Level Security)**: Filtra linhas acessíveis por usuário/role
- Ambos devem ser configurados corretamente: RLS sem GRANT resulta em "permission denied"

---

## 2. CORREÇÃO SEGURA

### Script SQL de Correção
O arquivo `supabase/fix_qa_rls.sql` foi criado com as seguintes alterações:

1. **Revoga concessões padrão inseguras** de todas as tabelas
2. **Concede GRANT SELECT explícito** antes das políticas RLS (crítico para PostgreSQL):
   - `GRANT SELECT ON organizations TO anon, authenticated`
   - `GRANT SELECT ON barber_services TO anon, authenticated`
   - `GRANT SELECT ON barbershop_settings TO anon, authenticated`
   - `GRANT SELECT ON products TO anon, authenticated`
3. **Cria políticas de leitura pública** APENAS para tabelas necessárias na landing page
4. **Protege dados sensíveis**:
   - `profiles` e `memberships` permanecem bloqueados para `anon`
   - Cria view segura `public_professionals` expondo apenas nome e avatar
5. **Função RPC segura** `get_public_org_data()`:
   - Usa `SECURITY DEFINER` com `search_path = public` (previne injeção)
   - Retorna dados agregados públicos de uma organização por slug
   - Revoga execução pública padrão, concede apenas a `anon` e `authenticated`

### Como Aplicar
1. Acesse [https://supabase.com/dashboard/project/idymvdboboixjtywhdcd/sql](https://supabase.com/dashboard/project/idymvdboboixjtywhdcd/sql)
2. Clique em **"New Query"**
3. Copie todo o conteúdo de `supabase/fix_qa_rls.sql`
4. Cole no editor e clique em **"Run"** (ou pressione Ctrl+Enter)
5. Verifique se todas as consultas retornaram sucesso

---

## 3. TESTES PÓS-CORREÇÃO

Após aplicar o script, execute os seguintes testes via API REST:

```bash
# Teste 1: Organizations (deve retornar JSON com dados)
curl -s "https://idymvdboboixjtywhdcd.supabase.co/rest/v1/organizations?limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeW12ZGJvYm9peGp0eXdoZGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NjQ1NTksImV4cCI6MjExMTA0MDU1OX0.lSgy03GyO1fiFBXJtcW0eH0ljlkp5Nmz5vb9tE3pKYk" \
  -H "Accept: application/json"

# Teste 2: Barber Services (deve retornar lista de serviços)
curl -s "https://idymvdboboixjtywhdcd.supabase.co/rest/v1/barber_services?limit=20" \
  -H "apikey: <ANON_KEY>" \
  -H "Accept: application/json"

# Teste 3: Barbershop Settings (deve retornar configurações)
curl -s "https://idymvdboboixjtywhdcd.supabase.co/rest/v1/barbershop_settings?limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Accept: application/json"

# Teste 4: Products (deve retornar array vazio [] se não houver produtos)
curl -s "https://idymvdboboixjtywhdcd.supabase.co/rest/v1/products?limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Accept: application/json"

# Teste 5: Profiles (DEVE FALHAR com 403/401 — protegido)
curl -s "https://idymvdboboixjtywhdcd.supabase.co/rest/v1/profiles?limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Accept: application/json"

# Teste 6: Memberships (DEVE FALHAR com 403/401 — protegido)
curl -s "https://idymvdboboixjtywhdcd.supabase.co/rest/v1/memberships?limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Accept: application/json"
```

### Resultado Esperado
- ✅ Tests 1-4: Retornam JSON válido (arrays ou objetos)
- ✅ Tests 5-6: Retornam erro `403 Forbidden` ou `401 Unauthorized` (protegidos)

---

## 4. VALIDAÇÃO FINAL

Após confirmar que os testes acima passaram:

1. **Atualize as variáveis de ambiente no Vercel** para o Preview da branch `qa/barber-on-e2e`:
   - `NEXT_PUBLIC_SUPABASE_URL=https://idymvdboboixjtywhdcd.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave_anon_real>`
   - `SUPABASE_SERVICE_ROLE_KEY=<chave_service_role_real>`

2. **Acesse a landing page do Preview** e verifique:
   - Nome da organização exibido
   - Lista de serviços ativos (espera-se 16 se cadastrados)
   - Perfis de profissionais visíveis (apenas nome e avatar)
   - Configurações públicas carregadas
   - Catálogo de produtos tratado corretamente (vazio ou preenchido)

3. **Confirme que dados administrativos NÃO estão expostos**:
   - Emails de usuários não aparecem
   - Informações financeiras não são acessíveis
   - Membros e permissões permanecem ocultos

---

## 5. NOTAS DE SEGURANÇA

- ✅ RLS permanece **ATIVADO** em todas as tabelas
- ✅ `service_role` **NUNCA** é usado no frontend
- ✅ Dados sensíveis (`profiles`, `memberships`) permanecem protegidos
- ✅ Função RPC usa `SECURITY DEFINER` com `search_path` fixo (previne injeção de schema)
- ✅ Projeto de produção **NÃO** foi alterado (todas as mudanças foram no QA)

---

*Documento gerado automaticamente durante a configuração do ambiente de QA.*