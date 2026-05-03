# Billing Fase 1 — Fundação de planos, trial e onboarding

## Data
2026-05-03

## O que foi feito

Implementação completa da Fase 1 do plano de billing: fluxo comercial sem provedor de pagamento externo.
Usuário autenticado sem plano é redirecionado para `/plans`, escolhe Mensal ou Anual, trial de 7 dias é ativado no banco, e um banner mostra os dias restantes em todas as páginas protegidas.

## Arquivos alterados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `db.js` | Modificado | Novas tabelas, seed de planos, funções de billing |
| `server.js` | Modificado | Novas rotas de billing/onboarding; `/api/auth/me` inclui billing |
| `public/dist/js/session.js` | Modificado | Redirect `plan_required → /plans`; banner de trial |
| `plans.html` | Novo | Página de escolha de plano |
| `onboarding.html` | Novo | Tela de boas-vindas pós-plano |
| `billing.html` | Novo | Página de status da assinatura |
| `CLAUDE.md` | Novo | Instruções de projeto para Claude |

## Tabelas novas

### `billing_plans`
Catálogo de planos disponíveis.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | TEXT PK | uuid |
| `code` | TEXT UNIQUE | ex: `mensal`, `anual` |
| `name` | TEXT | Nome público |
| `billing_cycle` | TEXT | `monthly` ou `annual` |
| `price_cents` | INTEGER | Preço em centavos (BRL) |
| `trial_days` | INTEGER | Padrão: 7 |
| `active` | BOOLEAN | Padrão: true |

**Seed inicial:**
- `mensal` — Wozza Mensal — R$ 49,90/mês — 7 dias trial
- `anual` — Wozza Anual — R$ 358,80/ano — 7 dias trial

### `accounts`
Empresa/escola contratante.

| Campo | Tipo |
|---|---|
| `id` | TEXT PK |
| `name` | TEXT |
| `status` | TEXT (`onboarding`, `active`) |

### `account_members`
Liga usuários a contas (UNIQUE account_id + user_id).

### `account_subscriptions`
Controla trial e plano ativo (UNIQUE account_id — uma assinatura ativa por conta).

| Campo | Tipo | Observação |
|---|---|---|
| `status` | TEXT | `plan_required`, `trialing`, `active`, `past_due`, `canceled`, `expired` |
| `trial_starts_at` | TIMESTAMPTZ | |
| `trial_ends_at` | TIMESTAMPTZ | Calculado: `now() + trial_days` |
| `provider` | TEXT | Futuro: `stripe`, `mercadopago` |

### `billing_events`
Histórico de eventos de webhook (para fase 4).

### `onboarding_steps`
Progresso do onboarding por conta.

| Campo | Tipo |
|---|---|
| `plan_selected` | BOOLEAN |
| `trial_started` | BOOLEAN |
| `first_social_connected` | BOOLEAN |
| `first_post_created` | BOOLEAN |
| `dismissed_connect_social` | BOOLEAN |

## Alterações em tabelas existentes

### `app_users`
- `ADD COLUMN default_account_id TEXT`
- `ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE`

## Rotas novas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/billing/plans` | Lista planos ativos (público) |
| POST | `/api/billing/select-plan` | Cria account + subscription trialing |
| GET | `/api/billing/status` | Status da assinatura do usuário logado |
| GET | `/api/onboarding/status` | Progresso do onboarding |
| POST | `/api/onboarding/dismiss-connect-social` | Pula conexão de rede no onboarding |
| GET | `/plans` | Página de escolha de plano |
| GET | `/onboarding` | Tela de boas-vindas pós-plano |
| GET | `/billing` | Página de status da assinatura |

## Rotas alteradas

| Método | Rota | O que mudou |
|---|---|---|
| GET | `/api/auth/me` | Resposta inclui campo `billing` com status completo |

## Variáveis de ambiente novas

Nenhuma nesta fase. As variáveis de pagamento (Stripe etc.) serão adicionadas na Fase 4.

## Fluxo implementado

```
Login/Cadastro
  → /api/auth/me retorna billing.status = "plan_required"
  → session.js redireciona para /plans
  → Usuário escolhe Mensal ou Anual
  → POST /api/billing/select-plan cria account + subscription trialing
  → Redirect para /onboarding
  → Usuário conecta rede social ou clica "Configurar depois"
  → Dashboard com banner de trial (N dias restantes)
```

## Critérios de aceite verificados

- [x] `GET /api/billing/plans` retorna os dois planos seeded
- [x] `GET /api/auth/me` inclui campo `billing` na resposta
- [x] Schema aplicado sem erros no NeonDB de produção (`Schema Neon OK`)
- [x] `db.js` e `server.js` sem erros de sintaxe (node -e require OK)
- [x] Commit e push para `main` concluídos

## Pendências / próximos passos

- **Fase 2**: Página `/onboarding` completa com integração ao OAuth Meta; marcar `first_social_connected` quando callback concluir
- **Fase 3**: Middleware `requireActiveEntitlement` protegendo OAuth de canais, ingestão e publicação multirrede
- **Fase 4**: Integração com provedor de pagamento (Stripe recomendado); webhook; portal de cobrança
- **Melhoria futura**: migrar `school_id` para `account_id` nas tabelas de monitor social
- **Melhoria futura**: expirar automaticamente trials vencidos via cron ou lazy check no `getUserBillingStatus`
