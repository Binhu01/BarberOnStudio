# Barber-On Studio — Landing Page

## Visão Geral

Landing page premium para **Barber-On Studio**, o sistema de gestão completo para barbearias. A página funciona como vitrine pública com agendamento online integrado ao Supabase, sem necessidade de login para clientes finais.

## Identidade Visual

| Token | Cor | Uso |
|-------|-----|-----|
| `bo-black` | `#08090B` | Fundo principal |
| `bo-graphite` | `#15171B` | Fundos secundários |
| `bo-blue` | `#0866E8` | Cor primária (CTAs, destaques) |
| `bo-blue-bright` | `#1684FF` | Hover, acentos brilhantes |
| `bo-silver` | `#C2C6CE` | Texto secundário, logo B |
| `bo-white` | `#FFFFFF` | Texto principal |
| `bo-gray` | `#A4A9B2` | Labels, placeholders |
| `bo-card` | `#11141C` | Cards e painéis |
| `bo-border` | `#232836` | Bordas e divisores |

### Logo SVG

Arquivo: `public/logo-bo.svg`
- **B** em gradiente prata (silver metallic)
- **O** em gradiente azul (#1684FF → #0866E8)
- Lâmina de navalha cortando horizontalmente entre as letras
- Texto "BARBER ON STUDIO" abaixo em Montserrat 800

## Estrutura de Seções (9 seções)

### 1. Header (Sticky)
- Logo SVG à esquerda
- Navegação desktop: Serviços, Profissionais, Agendar, Localização
- CTA "Agendar Online" em azul
- Menu hamburger mobile com overlay fullscreen

### 2. Hero
- Título: "Estilo, Confiança e Atitude"
- Subtítulo com proposta de valor
- Dois CTAs: "Agendar Agora" (azul) + "Ver Serviços" (outline)
- Background com gradientes radiais azuis sutis
- Stats bar: profissionais, serviços, avaliações

### 3. Barbeiros (Dinâmico)
- Cards com avatar, nome, cargo e link Instagram
- Dados reais do Supabase (profiles + memberships)
- Fallback visual com inicial quando sem avatar

### 4. Agendamento Online (Funcional)
Widget completo em 6 etapas integradas ao Supabase:
1. **Serviço** — lista de serviços ativos com preço e duração
2. **Profissional** — seleção de barbeiro ou "qualquer disponível"
3. **Data** — calendário horizontal com próximos N dias
4. **Horário** — slots disponíveis via RPC `get_public_available_slots`
5. **Dados** — nome, WhatsApp, e-mail, observações
6. **Confirmar** — resumo + botão de confirmação

Após confirmação: tela de sucesso com detalhes do agendamento.

### 5. Produtos e Serviços
- Grid de cards com imagem, nome, descrição e preço
- Serviços: dados de `barber_services` (ativos)
- Produtos: dados de `products` (ativos, limit 8)

### 6. Localização + Instagram
- Mapa embed do Google Maps (endereço real)
- QR Code estilizado para Instagram
- Informações de contato e horário

### 7. Footer
- Logo, links rápidos, redes sociais
- Copyright dinâmico

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/app/page.tsx` | Landing page completa (server component) |
| `src/app/actions.ts` | Server actions: `getLandingData`, `getAvailableSlotsForLanding`, `createPublicBookingFromLanding` |
| `src/app/_components/landing-booking-widget.tsx` | Widget de agendamento (client component, 6 etapas) |
| `src/app/layout.tsx` | Layout root com meta tags SEO e fontes |
| `src/app/globals.css` | Tokens CSS `bo-*` para landing page |
| `public/logo-bo.svg` | Logo SVG customizado |

## Integração Supabase

### Tabelas Utilizadas
- `organizations` — primeira organização ativa
- `profiles` — dados dos profissionais
- `memberships` — vínculo profissional-organização
- `barber_services` — serviços ativos com preço/duração
- `products` — produtos ativos
- `barbershop_settings` — configurações da barbearia
- `public_bookings` — agendamentos criados pela landing page

### RPC Functions
- `get_public_available_slots(p_org_id, p_barber_id, p_service_id, p_date)` — retorna horários livres
- `check_public_availability(p_org_id, p_barber_id, p_start_time, p_duration_minutes)` — verificação final anti-race-condition
- `log_audit(...)` — registro de auditoria (best effort)

### Segurança
- Agendamentos públicos não requerem autenticação
- RLS policies permitem INSERT anônimo em `public_bookings`
- Verificação dupla de disponibilidade (frontend + backend RPC)
- Audit log para rastreabilidade

## Responsividade

- Mobile-first com breakpoints Tailwind (`sm:`, `md:`, `lg:`)
- Menu mobile com overlay fullscreen
- Grid adaptativo: 1 col (mobile) → 2 cols (tablet) → 3-4 cols (desktop)
- Widget de agendamento responsivo com scroll horizontal nas datas

## SEO

- Meta tags completas (title, description, keywords, OG, Twitter)
- Canonical URL: `https://barberon.com.br`
- Structured data preparado para JSON-LD
- Semantic HTML5 (`<header>`, `<section>`, `<footer>`, `<nav>`)
- Alt text em imagens e aria-labels em botões

## Endereço

```
Rua Celina Sacramento da Silva, 20
Quadra B1 - Cidade Universitária
Maceió - AL, 57073-200
```