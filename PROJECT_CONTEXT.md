# Barber-On Studio — Contexto Completo do Projeto

## Visão Geral
SaaS de gestão para barbearias. Deploy em https://barber-on-studio.vercel.app

## Stack
- **Frontend**: Next.js 16.4.6, React 19, TypeScript strict, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel

## Arquitetura

### Tabelas Principais
- `organizations` — multi-tenancy (org_id em todas as queries)
- `memberships` — vincula users a orgs com roles (OWNER, ADMIN, MANAGER, EMPLOYEE)
- `profiles` — dados dos users (full_name, avatar_url, phone, email)
- `barber_services` — serviços oferecidos (name, price, duration_minutes, is_active)
- `barber_schedules` — horários de trabalho dos barbeiros (day_of_week 0-6, start_time TIME, end_time TIME, lunch_start TIME, lunch_end TIME, is_working_day)
- `schedule_blocks` — bloqueios de horário (start_at TIMESTAMPTZ, end_at TIMESTAMPTZ, membership_id nullable)
- `public_bookings` — agendamentos públicos (assigned_barber_id → memberships.id, scheduled_at TIMESTAMPTZ, duration_minutes INT, status TEXT, barber_service_id)
- `calendar_events` — agenda interna do dashboard (start_at, end_at, status, origin, assigned_barber_id, barber_service_id, customer_id, total_price)
- `products` — produtos para venda

### Conceito Crítico: membership_id vs user_id
- `user_id` vem de `profiles` (tabela auth.users)
- `membership_id` vem de `memberships` (vincula user à org)
- TODAS as RPCs e tabelas de agendamento usam `membership_id`
- Erro recorrente: passar `user_id` onde deveria ser `membership_id`

### RPCs Supabase
- `check_public_availability(p_org_id UUID, p_barber_id UUID, p_scheduled_at TIMESTAMPTZ, p_duration_minutes INT)` → BOOLEAN
- `get_public_available_slots(p_org_id UUID, p_service_id UUID, p_barber_id UUID, p_date DATE)` → TABLE(slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
- `get_appointments_with_details` — lista agendamentos da agenda interna
- `check_appointment_conflict` — verifica conflitos ao criar agendamento

## Estrutura de Arquivos

### Landing Page (pública)
- `src/app/page.tsx` — página principal com seções: hero, barbeiros, serviços, localização
- `src/app/_components/landing-booking-widget.tsx` — widget de agendamento público
- `src/app/_components/barber-cards-section.tsx` — cards de barbeiros com próximo horário
- `src/app/actions.ts` — server actions para dados da landing e agendamento público

### Dashboard (autenticado)
- `src/app/dashboard/agenda/page.tsx` — agenda principal (busca de `calendar_events`)
- `src/app/dashboard/agenda/actions.ts` — CRUD de agendamentos internos
- `src/app/dashboard/agenda-publica/page.tsx` — configuração do agendamento público
- `src/app/dashboard/agenda-publica/_components/public-agenda-manager.tsx` — gerenciar agenda pública

### Migrations Supabase
- `supabase/migrations/009_tasks_calendar_notifications.sql` — tabela calendar_events
- `supabase/migrations/012_barber_services_schedules.sql` — barber_schedules, schedule_blocks
- `supabase/migrations/014_public_bookings_blocks.sql` — public_bookings e RPCs

## Problemas Resolvidos

### 1. Horários não apareciam nos cards de barbeiros
**Causa**: `actions.ts` passava `user_id` para RPCs que esperam `membership_id`
**Fix**: Adicionado lookup de membership antes de cada chamada RPC (commits 0a9b9494)

### 2. "This page couldn't load" ao clicar em datas no widget
**Causa**: RPC retorna `{slot_start, slot_end}` como objetos, mas widget tratava como `string[]`
**Fix**: Corrigido tipo do state `availableSlots` e renderização com `new Date(slot.slot_start).toLocaleTimeString()`

### 3. React error #441 ao confirmar agendamento
**Causa 1**: Parâmetro RPC `p_start_time` → deveria ser `p_scheduled_at`
**Causa 2**: `check_public_availability` retorna BOOLEAN, código verificava `availability?.[0]?.is_available` (sempre undefined)
**Causa 3**: `assigned_barber_id` recebia `user_id` ao invés de `membership_id`
**Fix**: Todos corrigidos em commit 851d799d

### 4. Agendamentos públicos não apareciam na agenda do admin
**Causa**: `/dashboard/agenda` busca de `calendar_events`, mas agendamentos públicos só iam para `public_bookings`
**Fix**: `createPublicBookingFromLanding` agora insere em ambas as tabelas, com `origin: "landing_page"` em calendar_events (commit 183632bf)

## Arquivos SQL Auxiliares
- `seed-horarios.sql` — seed de horários de trabalho para Ruan e Lucas
- `fix-check-availability.sql` — recriação das funções SQL com nomes de colunas corretos

## Commits Recentes (branch: claude/youthful-maxwell-7cebc1, pushed to main)
- `e65775e6` — feat: próximo horário nos cards + seed de horários
- `0a9b9494` — fix: membership_id nas RPCs + cursor:pointer global
- `6e124ade` — fix: widget de agendamento + endereço do mapa + botão hero
- `851d799d` — fix: 3 bugs em createPublicBookingFromLanding
- `183632bf` — fix: sincronizar public_bookings com calendar_events

## URLs
- Landing page: https://barber-on-studio.vercel.app
- Dashboard: https://barber-on-studio.vercel.app/dashboard
- Git remote: `barberon` → https://github.com/Binhu01/BarberOnStudio.git
- Push pattern: `git push barberon HEAD:main`

## Estado Atual (possíveis problemas pendentes)
1. A aba "Agenda" do dashboard pode não exibir agendamentos corretamente (o usuário relatou que "nenhuma dessas abas funciona")
2. Possível necessidade de verificar se a RPC `get_appointments_with_details` existe e funciona
3. Possível necessidade de verificar se `calendar_events` tem todas as colunas necessárias
4. Verificar se as migrations foram aplicadas corretamente no Supabase

## Git / Push
- Remote: `barberon` (https://github.com/Binhu01/BarberOnStudio.git)
- Worktree branch: `claude/youthful-maxwell-7cebc1`
- Push command: `git push barberon HEAD:main`
- Attribution: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`