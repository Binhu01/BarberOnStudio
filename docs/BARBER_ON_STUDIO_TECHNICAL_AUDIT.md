# Barber-On Studio — Auditoria Técnica Completa

**Data:** 2026-11-13
**Branch:** claude/youthful-maxwell-7cebc1
**Commit base:** 4109fc85

---

## 1. Arquitetura Existente

### Stack Tecnológica
| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 16.4.6 |
| UI | React + TypeScript strict | 19.3.0 |
| Estilização | Tailwind CSS v4 | 4.3.3 |
| Componentes | shadcn/ui + Lucide Icons | - |
| Backend/DB | Supabase (Auth, RLS, RPC) | 2.49.4 |
| Validação | Zod | 3.24.2 |
| Pagamentos | Mercado Pago | via adapter |
| IA | Anthropic Claude API | 1.8.0 |
| Mobile | React Native + Expo SDK 52 | apps/mobile/ |
| Testes | Vitest + Playwright | 5.1.0 / 1.65.0 |

### Estrutura de Rotas
```
src/app/
├── page.tsx                    # Landing page pública (bo-* tokens)
├── layout.tsx                  # Root layout (fontes, meta tags)
├── actions.ts                  # Server actions públicos (booking)
├── _components/                # Componentes da landing
│   └── landing-booking-widget.tsx
├── (public)/planos/            # Página comercial SaaS
├── admin/                      # Painel Nexora Admin (platform)
│   ├── audit/
│   ├── organizacoes/
│   ├── planos/
│   └── suporte/
├── agendar/[slug]/             # Agendamento público por org
├── api/
│   ├── auth/signout/
│   ├── billing/webhook/        # Mercado Pago SaaS
│   └── intelligence/chat/      # AI streaming SSE
├── cadastro/                   # Auth pages (legacy nexora tokens)
├── login/                      # Auth pages (legacy nexora tokens)
└── dashboard/                  # App principal multi-tenant
    ├── shell.tsx               # Sidebar + header (23 itens nav)
    ├── page.tsx                # Dashboard home
    ├── agenda/                 # Agendamentos internos
    ├── agenda-publica/         # Configuração booking público
    ├── assinaturas/            # Assinaturas clientes barbearia
    ├── bloqueios/              # Bloqueio de horários
    ├── caixa/                  # Caixa diário
    ├── clientes/               # CRM completo
    ├── comandas/               # Comandas e vendas
    ├── configuracoes/          # Settings barbearia
    ├── equipe/                 # Equipe, permissões, auditoria
    ├── expedientes/            # Horários de funcionamento
    ├── fidelidade/             # Programas de fidelidade
    ├── financeiro/             # Contas, fluxo, receber, pagar
    ├── intelligence/           # Assistente IA
    ├── leads/                  # Pipeline Kanban
    ├── notificacoes/           # Notificações in-app
    ├── onboarding/             # Setup inicial
    ├── perfil/                 # Perfil do usuário
    ├── profissionais/          # CRUD barbeiros
    ├── produtos/               # Catálogo produtos
    ├── reativar/               # Reativação clientes
    ├── recorrencias/           # Agendamentos recorrentes
    ├── relatorios/             # BI e relatórios
    ├── servicos/               # Catálogo serviços
    ├── tarefas/                # Tarefas e kanban
    └── vendas/                 # Pedidos e orçamentos
```

---

## 2. Banco de Dados — Migrations (16 total)

| # | Migration | Tabelas Principais | Status |
|---|-----------|-------------------|--------|
| 001 | initial_schema | organizations, memberships, profiles, roles, permissions | ✅ Implementado |
| 002 | crm_schema | customers, leads, lead_pipeline_stages, interactions | ✅ Implementado |
| 003 | sales_schema | orders, order_items, quotes, sales_channels | ✅ Implementado |
| 004 | inventory_schema | products, product_categories, warehouses, stock_movements | ✅ Implementado |
| 005 | financial_schema | financial_accounts, transactions, accounts_payable/receivable | ✅ Implementado |
| 006 | team_permissions | departments, job_titles, invitations, permission_overrides | ✅ Implementado |
| 007 | bi_views | Views materializadas (vendas, estoque, financeiro) | ✅ Implementado |
| 008 | purchases_schema | suppliers, purchase_orders, receipts | ✅ Implementado |
| 009 | tasks_calendar | tasks, calendar_events, notifications | ✅ Implementado |
| 010 | ai_intelligence | ai_conversations, ai_messages, ai_settings | ✅ Implementado |
| 011 | billing_subscriptions_admin | saas_plans, subscriptions, payment_events, entitlements | ✅ Implementado |
| 012 | barber_services_schedules | barber_services, barber_schedules | ✅ Implementado |
| 013 | barber_commissions_cashflow | barber_commissions, cash_registers, cash_register_entries, daily_closures | ✅ Implementado |
| 014 | public_bookings_blocks | public_bookings, schedule_blocks | ✅ Implementado |
| 015 | subscriptions_plans | subscription_plans, client_subscriptions, subscription_payments, subscription_usage | ✅ Implementado |
| 016 | loyalty_reactivation | loyalty_programs, loyalty_cards, loyalty_transactions, reactivation_campaigns, reactivation_recipients | ✅ Implementado |

### Tabelas Existentes no Banco (resumo)
- **Core:** organizations, memberships, profiles, roles, permissions
- **CRM:** customers, leads, lead_pipeline_stages, interactions
- **Vendas:** orders, order_items, quotes, sales_channels
- **Estoque:** products, product_categories, warehouses, stock_movements
- **Financeiro:** financial_accounts, transactions, accounts_payable, accounts_receivable
- **Equipe:** departments, job_titles, invitations, permission_overrides
- **BI:** views materializadas
- **Compras:** suppliers, purchase_orders, purchase_order_items, receipts
- **Tarefas:** tasks, calendar_events, notifications
- **IA:** ai_conversations, ai_messages, ai_settings
- **SaaS Billing:** saas_plans, subscriptions, payment_events, entitlements
- **Barbearia:** barber_services, barber_schedules, barber_commissions, cash_registers, cash_register_entries, daily_closures, public_bookings, schedule_blocks
- **Assinaturas Clientes:** subscription_plans, client_subscriptions, subscription_payments, subscription_usage
- **Fidelidade:** loyalty_programs, loyalty_cards, loyalty_transactions, reactivation_campaigns, reactivation_recipients

---

## 3. Módulos do Dashboard — Status Atual

### Sidebar (shell.tsx) — 23 itens mapeados

| # | Item Sidebar | Rota | Página Existe? | Funcional? | Observações |
|---|-------------|------|---------------|------------|-------------|
| 1 | Dashboard | /dashboard | ✅ | ⚠️ Parcial | KPIs precisam conectar a queries reais |
| 2 | Comandas | /dashboard/comandas | ✅ | ⚠️ Parcial | CRUD existe, integração com agenda pendente |
| 3 | Agendamentos | /dashboard/agenda | ✅ | ⚠️ Parcial | CRUD básico, falta validação de conflitos robusta |
| 4 | Financeiro | /dashboard/financeiro/* | ✅ | ⚠️ Parcial | Subrotas existem, comissões não integradas |
| 5 | WhatsApp | /dashboard/whatsapp | ❌ | ❌ Não iniciado | comingSoon: true — módulo inteiro ausente |
| 6 | Recorrências | /dashboard/recorrencias | ✅ | ⚠️ Parcial | Interface existe, geração de ocorrências pendente |
| 7 | Relatórios | /dashboard/relatorios/* | ✅ | ⚠️ Parcial | Faltam relatórios de assinaturas, comissões, estoque |
| 8 | Assinaturas | /dashboard/assinaturas | ✅ | ⚠️ Parcial | Plans CRUD ok, controle de benefícios pendente |
| 9 | Profissionais | /dashboard/profissionais | ✅ | ⚠️ Parcial | CRUD básico, falta comissão/desempenho integrado |
| 10 | Clientes | /dashboard/clientes | ✅ | ✅ Funcional | CRM completo com timeline |
| 11 | Reativar Clientes | /dashboard/reativar | ✅ | ⚠️ Parcial | Campanhas existem, envio WhatsApp/email pendente |
| 12 | Fidelidade | /dashboard/fidelidade | ✅ | ⚠️ Parcial | Programas/cartões ok, resgate automático pendente |
| 13 | Serviços | /dashboard/servicos | ✅ | ✅ Funcional | CRUD completo com comissão |
| 14 | Produtos | /dashboard/produtos | ✅ | ✅ Funcional | CRUD + categorias + estoque |
| 15 | Expedientes | /dashboard/expedientes | ✅ | ⚠️ Parcial | Interface existe, validação de conflitos pendente |
| 16 | Bloquear Horários | /dashboard/bloqueios | ✅ | ⚠️ Parcial | Blocos existem, integração com booking precisa teste |
| 17 | Agenda Pública | /dashboard/agenda-publica | ✅ | ✅ Funcional | Configuração + widget landing integrados |
| 18 | Logs | /dashboard/equipe/auditoria | ✅ | ✅ Funcional | Audit log imutável via RPC |
| 19 | Configurações | /dashboard/configuracoes | ✅ | ⚠️ Parcial | Settings form existe, submenus pendentes |
| 20 | Integrações | /dashboard/integracoes | ❌ | ❌ Não iniciado | comingSoon: true |
| 21 | Meu plano | /dashboard/billing | ✅ | ✅ Funcional | Billing SaaS Nexora (não confundir com assinaturas clientes) |
| 22 | Renovar assinatura | - | ⚠️ | ⚠️ Pendente | Precisa integrar com Mercado Pago checkout |
| 23 | Contas | /dashboard/financeiro/contas | ✅ | ✅ Funcional | Contas financeiras múltiplas |

### Submenus Solicitados vs. Existentes

#### Financeiro (solicitado: 9 sub-itens)
| Solicitado | Existe? | Rota |
|-----------|---------|------|
| Visão geral | ✅ | /dashboard/financeiro |
| Fluxo de caixa | ✅ | /dashboard/financeiro/fluxo |
| Receitas | ⚠️ Via transações | /dashboard/financeiro/transacoes |
| Despesas | ⚠️ Via transações | /dashboard/financeiro/transacoes |
| Contas a pagar | ✅ | /dashboard/financeiro/pagar |
| Contas a receber | ✅ | /dashboard/financeiro/receber |
| Fechamento de caixa | ⚠️ Via caixa | /dashboard/caixa |
| Comissões | ❌ Ausente | Precisa criar rota |
| Histórico financeiro | ⚠️ Via transações | /dashboard/financeiro/transacoes |

#### WhatsApp (solicitado: 7 sub-itens)
| Solicitado | Existe? |
|-----------|---------|
| Central de mensagens | ❌ |
| Modelos de mensagens | ❌ |
| Lembretes de agendamento | ❌ |
| Notificações de vencimento | ❌ |
| Campanhas | ❌ |
| Histórico de envios | ❌ |
| Configurações | ❌ |

**Módulo WhatsApp inteiro NÃO INICIADO.** Requer integração com WhatsApp Business Cloud API.

#### Relatórios (solicitado: 9 sub-itens)
| Solicitado | Existe? | Rota |
|-----------|---------|------|
| Financeiro | ✅ | /dashboard/relatorios/financeiro |
| Agendamentos | ❌ | Precisa criar |
| Profissionais | ✅ | /dashboard/relatorios/equipe |
| Serviços | ❌ | Precisa criar |
| Produtos | ❌ | Precisa criar |
| Clientes | ❌ | Precisa criar |
| Assinaturas | ❌ | Precisa criar |
| Comissões | ❌ | Precisa criar |
| Estoque | ✅ | /dashboard/relatorios/estoque |

#### Assinaturas (solicitado: 8 sub-itens)
| Solicitado | Existe? |
|-----------|---------|
| Visão geral | ⚠️ Página única |
| Planos disponíveis | ⚠️ Na mesma página |
| Assinaturas ativas | ⚠️ Na mesma página |
| Assinaturas pendentes | ❌ |
| Próximos vencimentos | ❌ |
| Pagamentos | ❌ |
| Cancelamentos | ❌ |
| Renovações | ❌ |

#### Configurações (solicitado: 8 sub-itens)
| Solicitado | Existe? |
|-----------|---------|
| Dados da barbearia | ⚠️ Form único |
| Horários de funcionamento | ⚠️ Em expedientes |
| Preferências de agendamento | ⚠️ Em agenda-publica |
| Usuários e permissões | ⚠️ Em equipe |
| Notificações | ⚠️ Em notificacoes |
| Formas de pagamento | ❌ |
| Configurações da landing page | ⚠️ Em agenda-publica |
| Preferências gerais | ⚠️ Form único |

---

## 4. Integrações

### Funcionais
- ✅ Supabase Auth (SSR middleware)
- ✅ Supabase Database + RLS
- ✅ Supabase RPC functions
- ✅ Mercado Pago webhook (billing SaaS)
- ✅ Anthropic Claude AI chat
- ✅ Landing page → Supabase booking

### Pendentes / Incompletas
- ⚠️ WhatsApp Business Cloud API — **NÃO CONFIGURADO**
- ⚠️ Resend (email) — **NÃO CONFIGURADO**
- ⚠️ Mercado Pago para pagamentos de clientes (comandas/assinaturas) — adapter existe mas não integrado ao fluxo de comanda
- ⚠️ Supabase Cron para automações — **NÃO CONFIGURADO**
- ⚠️ Edge Functions para notificações assíncronas — **NÃO CRIADAS**

---

## 5. Problemas Identificados

### Críticos
1. **Referências Nexora em arquivos legados** — `cadastro/page.tsx`, `login/page.tsx`, `dashboard/actions.ts` usam tokens `nexora-*` e cookie `nexora_active_org`. Precisam ser migrados para `barber-*`.
2. **WhatsApp não implementado** — Módulo inteiro ausente. É requisito obrigatório para automação de vencimentos.
3. **Integrações não configuradas** — Sem credenciais de WhatsApp, Resend ou MP cliente, as automações não funcionarão.

### Importantes
4. **Dashboard com dados parciais** — KPIs podem estar usando dados estáticos ou queries incompletas.
5. **Relatórios insuficientes** — Apenas 4 de 9 relatórios solicitados existem.
6. **Assinaturas clientes incompletas** — Controle de benefícios, pagamentos e renovações pendentes.
7. **Comissões não integradas ao financeiro** — Tabela `barber_commissions` existe mas não há rota dedicada nem integração com fechamento de caixa.
8. **Conflitos de agendamento** — Validação de sobreposição depende de RPC que precisa ser testada em produção.
9. **Configurações centralizadas** — Submenus de configurações espalhados entre múltiplas rotas em vez de unificados.

### Menores
10. **README desatualizado** — Ainda referencia "Nexora" como nome principal e lista apenas 13 fases.
11. **Sidebar tem `border-nexora-border`** — Linha 204 do shell.tsx usa token legado.
12. **Mobile app desatualizado** — Apps/mobile pode não refletir módulos barber-specific.

---

## 6. Plano de Implementação por Fases

### FASE 0 — Auditoria ✅ COMPLETA
Este documento.

### FASE 1 — Fundação do Backend
- [ ] Criar migration 017: tabelas ausentes (notification_templates, notification_logs, recurring_appointments, whatsapp_config)
- [ ] Criar RPC functions para validação de conflitos de agendamento
- [ ] Migrar tokens nexora → barber em arquivos legados
- [ ] Atualizar README.md

### FASE 2 — Cadastros e Disponibilidade
- [ ] Completar CRUD de profissionais (comissão, desempenho, especialidades)
- [ ] Validar expedições individuais contra expediente geral
- [ ] Integrar bloqueios recorrentes à consulta de disponibilidade
- [ ] Testar prevenção de conflitos transacional

### FASE 3 — Agendamentos
- [ ] Implementar visualizações semanal/mensal
- [ ] Implementar status flow completo (pendente → confirmado → em atendimento → concluído)
- [ ] Integrar public_bookings com agenda interna
- [ ] Implementar remarcação e cancelamento com audit
- [ ] Reserva temporária com expiração automática

### FASE 4 — Comandas e Vendas
- [ ] Integrar comanda ↔ agendamento (importar serviços/cliente/profissional)
- [ ] Adicionar produtos à comanda com baixa de estoque
- [ ] Pagamentos combinados (dinheiro + cartão + PIX)
- [ ] Snapshot de preços no momento da venda
- [ ] Prevenção de duplicidade

### FASE 5 — Financeiro
- [ ] Criar rota /dashboard/financeiro/comissoes
- [ ] Integrar barber_commissions com fechamento de caixa
- [ ] Conciliação automática comanda → transação financeira
- [ ] Estornos e cancelamentos com registro

### FASE 6 — Assinaturas Clientes
- [ ] Subpáginas: ativas, pendentes, vencimentos, pagamentos, cancelamentos
- [ ] Controle de benefícios (subscription_usage)
- [ ] Validação de utilização contra limites do plano
- [ ] Integração com Mercado Pago para cobrança recorrente

### FASE 7 — Automações (WhatsApp + Email)
- [ ] Criar módulo WhatsApp completo (7 subpáginas)
- [ ] Integrar WhatsApp Business Cloud API
- [ ] Configurar Resend para emails
- [ ] Criar Edge Function para avisos de vencimento (3 dias antes)
- [ ] Implementar fila de notificações com idempotência
- [ ] Supabase Cron para execução periódica

### FASE 8 — Módulos Complementares
- [ ] Completar relatórios (agendamentos, serviços, produtos, clientes, assinaturas, comissões)
- [ ] Fidelidade: resgate automático, validade de pontos
- [ ] Reativação: campanhas com envio real via WhatsApp/email
- [ ] Recorrências: geração automática de ocorrências
- [ ] Integrações: página de configuração de APIs
- [ ] Configurações: submenus unificados

### FASE 9 — Testes e Estabilização
- [ ] Testar todos os fluxos críticos (booking, comanda, estoque, assinatura, notificação)
- [ ] Testar segurança (RLS, permissões, cross-tenant isolation