# Barber-On Studio — Blueprint de Arquitetura

> Sistema de gestão completo para barbearia, transformado a partir da plataforma Nexora.

## 1. Visão Geral

**Nome:** Barber-On Studio  
**Base:** Nexora (Next.js 16 + Supabase + TypeScript)  
**Finalidade:** Gestão operacional de barbearia — agendamentos, clientes, profissionais, serviços, comandas, assinaturas, financeiro e automações.  
**Modelo:** Single-tenant inicial, com arquitetura multi-tenant preservada para expansão futura.

---

## 2. Identidade Visual

### Paleta de Cores (CSS Tokens)

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-barber-dark` | `#1A1A1A` | Fundo principal, sidebar |
| `--color-barber-graphite` | `#2D2D2D` | Superfícies secundárias, cards |
| `--color-barber-gold` | `#C9A96E` | Destaque, CTAs, ícones ativos |
| `--color-barber-copper` | `#B87333` | Acento secundário, hover |
| `--color-barber-white` | `#FFFFFF` | Texto primário sobre fundo escuro |
| `--color-barber-light` | `#F5F5F5` | Texto secundário, bordas claras |
| `--color-barber-muted` | `#9CA3AF` | Texto terciário, placeholders |
| `--color-barber-border` | `#3D3D3D` | Bordas sobre fundo escuro |
| `--color-barber-success` | `#22C55E` | Status positivo |
| `--color-barber-warning` | `#F59E0B` | Alertas |
| `--color-barber-error` | `#EF4444` | Erros, ações destrutivas |

### Tipografia
- **Display/Títulos:** Montserrat (mantida do Nexora)
- **Corpo:** Geist (via next/font/google)
- **Estilo:** Moderna, limpa, pesos 400/500/600/700

### Direção Visual
- Fundo escuro (preto/grafite) como padrão
- Dourado/cobre para elementos de destaque e interação
- Cards com fundo grafite sutil sobre fundo preto
- Ícones minimalistas (Lucide React)
- Bordas sutis, sombras suaves
- Interface premium e sofisticada

---

## 3. Módulos do Sistema

### Navegação Lateral (21 módulos)

| # | Módulo | Rota | Status Fase 1 |
|---|--------|------|---------------|
| 1 | Dashboard | `/dashboard` | ✅ Adaptar |
| 2 | Comandas | `/dashboard/comandas` | 🔨 Criar |
| 3 | Agendamentos | `/dashboard/agenda` | ✅ Adaptar |
| 4 | Financeiro | `/dashboard/financeiro` | ✅ Reutilizar |
| 5 | WhatsApp | `/dashboard/whatsapp` | 🔨 Criar |
| 6 | Contas | `/dashboard/contas` | ✅ Reutilizar |
| 7 | Recorrências | `/dashboard/recorrencias` | 🔨 Criar |
| 8 | Relatórios | `/dashboard/relatorios` | ✅ Adaptar |
| 9 | Assinaturas | `/dashboard/assinaturas` | 🔨 Criar |
| 10 | Profissionais | `/dashboard/profissionais` | 🔨 Criar |
| 11 | Clientes | `/dashboard/clientes` | ✅ Adaptar |
| 12 | Reativar | `/dashboard/reativar` | 🔨 Criar |
| 13 | Fidelidade | `/dashboard/fidelidade` | 🔨 Criar |
| 14 | Serviços | `/dashboard/servicos` | 🔨 Criar |
| 15 | Produtos | `/dashboard/produtos` | ✅ Reutilizar |
| 16 | Expedientes | `/dashboard/expedientes` | 🔨 Criar |
| 17 | Bloqueios | `/dashboard/bloqueios` | 🔨 Criar |
| 18 | Agenda Pública | `/agendar/[slug]` | 🔨 Criar |
| 19 | Logs | `/dashboard/logs` | ✅ Reutilizar |
| 20 | Configurações | `/dashboard/configuracoes` | 🔨 Criar |
| 21 | Integrações | `/dashboard/integracoes` | 🔨 Criar |

### Módulos Ocultos (não fazem parte da experiência principal)
- Leads/Pipeline CRM (genérico demais para barbearia)
- Compras/Fornecedores (complexo excessivo para fase 1)
- Estoque multi-depósito (simplificar para single-location)
- Intelligence/IA (feature avançada, manter infraestrutura)
- Admin SaaS (painel Nexora interno)
- Minha Assinatura SaaS (billing da plataforma)

---

## 4. Mapeamento de Tabelas Existentes

### Tabelas a Reutilizar Diretamente
| Tabela Nexora | Uso em Barber-On | Adaptações Necessárias |
|---------------|------------------|----------------------|
| `profiles` | Contas de usuário/staff | Nenhuma |
| `organizations` | Barbearia (single-tenant) | Manter para expansão futura |
| `memberships` | Equipe da barbearia | Adicionar roles: BARBER, RECEPTIONIST |
| `customers` | Clientes da barbearia | Adicionar: preferred_barber_id, date_of_birth, hair_type, loyalty_points, last_visit_at |
| `calendar_events` | Agendamentos | Adaptar para: service_duration, barber_assignment, double-booking prevention |
| `products` | Produtos de revenda + Serviços | product_type='service' já existe |
| `product_categories` | Categorias de serviço/produto | Renomear categorias |
| `orders` | Comandas/Atendimentos | Adaptar status flow para barbearia |
| `order_items` | Serviços + produtos por atendimento | Vincular a profissional |
| `financial_accounts` | Caixa, contas bancárias | Nenhuma |
| `financial_categories` | Categorias financeiras | Adaptar para barbearia |
| `receivables` | Contas a receber | Nenhuma |
| `payables` | Contas a pagar | Nenhuma |
| `financial_payments` | Pagamentos | Nenhuma |
| `financial_transactions` | Ledger imutável | Nenhuma |
| `employee_profiles` | Perfis de barbeiros | Adicionar: specialties, commission_rate, commission_type |
| `departments` | Áreas de atuação | Simplificar |
| `audit_logs` | Logs de atividade | Nenhuma |
| `notifications` | Notificações in-app | Nenhuma |
| `tasks` | Tarefas operacionais | Adaptar tipos |
| `sales_channels` | Canais de atendimento | "Presencial", "WhatsApp", "Online" |

### Tabelas a Criar Novas (Migration 012+)
| Tabela | Finalidade |
|--------|-----------|
| `barber_services` | Catálogo de serviços com duração, preço, comissão |
| `barber_schedules` | Expedientes individuais por profissional |
| `schedule_blocks` | Bloqueios de horário (feriados, folgas, intervalos) |
| `membership_plans` | Planos de assinatura da barbearia (cliente) |
| `customer_memberships` | Assinaturas ativas dos clientes |
| `membership_payments` | Pagamentos de assinaturas |
| `loyalty_program` | Configuração do programa de fidelidade |
| `loyalty_transactions` | Histórico de pontos |
| `appointment_reminders` | Fila de notificações de vencimento |
| `whatsapp_templates` | Modelos de mensagem aprovados |
| `integration_settings` | Configurações de integrações por barbearia |

### Tabelas SaaS a Ignorar (Migration 011)
Todas as tabelas da migration 011 são específicas do billing SaaS da Nexora e NÃO devem ser reutilizadas:
- `subscription_plans`, `subscription_plan_versions`, `plan_entitlements`
- `billing_customers`, `subscriptions`, `subscription_events`
- `subscription_invoices`, `subscription_payment_events`
- `plan_changes`, `organization_usage_records`
- `platform_admins`, `platform_audit_logs`, `support_tickets`

---

## 5. Papéis de Acesso

| Role | Descrição | Permissões Principais |
|------|-----------|----------------------|
| OWNER | Proprietário da barbearia | Acesso total, configurações, financeiro |
| ADMIN | Administrador | Tudo exceto configurações críticas |
| MANAGER | Gerente/Recepcionista | Agendamentos, clientes, comandas, relatórios |
| BARBER | Barbeiro | Própria agenda, próprios atendimentos |
| RECEPTIONIST | Recepcionista | Agendamentos, clientes, caixa |

---

## 6. Fluxo de Atendimento (Comanda)

```
Cliente chega → Abrir comanda → Selecionar profissional
→ Adicionar serviços → Adicionar produtos → Aplicar desconto
→ Registrar pagamento → Finalizar → Comissão calculada
→ Estoque atualizado → Receita registrada → Pontos fidelidade
```

---

## 7. Sistema de Assinaturas (Clientes)

### Estrutura Independente do Billing SaaS
- `membership_plans`: Planos da barbearia (Básico, Premium, VIP)
- `customer_memberships`: Assinatura ativa do cliente
- `membership_payments`: Histórico de pagamentos
- Automação: Notificação 3 dias antes do vencimento (WhatsApp + Email)
- Idempotência: Evitar notificações duplicadas

---

## 8. Integrações Planejadas

| Integração | Finalidade | Prioridade |
|-----------|-----------|-----------|
| WhatsApp Business API | Notificações, confirmações | Alta |
| Resend / Email | Notificações de vencimento | Alta |
| Mercado Pago | Pagamentos na comanda | Média |
| Supabase Cron | Rotinas automáticas | Alta |

---

## 9. Plano de Migrations

### Migration 012 — Barber-On Foundation
- Criar `barber_services`
- Criar `barber_schedules`
- Criar `schedule_blocks`
- Alterar `customers` (campos barbearia)
- Alterar `employee_profiles` (comissão, especialidades)
- Alterar `calendar_events` (campos de agendamento)
- Seed: categorias de serviço padrão, expediente padrão

### Migration 013 — Memberships & Loyalty
- Criar `membership_plans`
- Criar `customer_memberships`
- Criar `membership_payments`
- Criar `loyalty_program`
- Criar `loyalty_transactions`
- Criar `appointment_reminders`

### Migration 014 — Integrations
- Criar `whatsapp_templates`
- Criar `integration_settings`
- Funções de envio de notificação

---

## 10. Variáveis de Ambiente Novas

```env
# WhatsApp Business Cloud API
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token

# Email (Resend)
RESEND_API_KEY=re_xxxxx

# Barber-On Studio
NEXT_PUBLIC_APP_NAME=Barber-On Studio
NEXT_PUBLIC_BARBER_SLUG=barber-on-studio
```

---

## 11. Funcionalidades Existentes vs Ausentes

### ✅ Implementadas no Nexora (reutilizáveis)
- Autenticação Supabase Auth + SSR
- Multi-tenancy com RLS
- CRUD de clientes com timeline
- Sistema financeiro completo (contas, recebíveis, pagáveis, ledger)
- Catálogo de produtos com variantes
- Pedidos/comandas com itens
- Equipe com permissões granulares (~70 permissões)
- Audit log imutável
- Notificações in-app
- Tarefas e calendário
- Views BI (vendas, financeiro, estoque, equipe)
- Validação Zod em server actions
- Middleware de proteção de rotas

### 🔨 A Criar/Adaptar para Barber-On
- Catálogo de serviços especializado
- Agenda profissional com prevenção de conflitos
- Expedientes individuais por barbeiro
- Sistema de comandas adaptado
- Programa de fidelidade
- Assinaturas de clientes (independente do SaaS)
- Página pública de agendamento
- Automação de notificações (WhatsApp/Email)
- Dashboard especializado em barbearia
- Navegação lateral redesenhada
- Identidade visual premium (preto/dourado)

---

*Documento gerado como parte da Fase 1 de transformação Nexora → Barber-On Studio.*