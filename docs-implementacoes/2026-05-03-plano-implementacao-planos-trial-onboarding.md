# Plano de implementacao - Planos, trial e onboarding Wozza

## Data
2026-05-03

## Decisao de produto
O Wozza deve operar sem freemium aberto. O modelo recomendado e:

1. Criacao de conta.
2. Escolha obrigatoria de plano.
3. Trial de 7 dias com recursos principais liberados.
4. Onboarding para conectar a primeira rede social.
5. Painel com monitoramento, publicacao multirrede e gestao de canais.
6. Conversao para cobranca ao final do trial.

A experiencia deve permitir que o usuario pule a conexao inicial de redes, mas nao pule a escolha de plano. Assim, o Wozza evita uso gratuito indefinido, reduz leads curiosos e ainda permite que o cliente experimente valor real antes da cobranca efetiva.

## Modelo comercial inicial

### Plano mensal
- Nome publico: Wozza Mensal.
- Preco: R$ 49,90 por mes.
- Cobranca: mensal.
- Trial: 7 dias.
- Cancelamento: antes da renovacao.

### Plano anual
- Nome publico: Wozza Anual.
- Preco comunicado: R$ 29,90 por mes.
- Valor anual: R$ 358,80 por ano.
- Cobranca: anual.
- Trial: 7 dias.
- Beneficio: melhor preco.

## Posicionamento recomendado

Texto base para a pagina de planos:

> Teste o Wozza por 7 dias com os principais recursos liberados. Escolha um plano agora e continue somente se fizer sentido para sua operacao.

CTA principal:

> Comecar teste de 7 dias

Microcopy de seguranca:

> Voce pode cancelar antes da cobranca. Durante o teste, conecte suas redes sociais e experimente o fluxo completo.

## Decisao sobre cartao no trial

### Recomendacao principal
Implementar trial de 7 dias com plano escolhido e preparacao para exigir cartao.

### Fase inicial opcional
Enquanto a integracao de pagamentos nao estiver pronta, permitir trial sem cartao, mas manter o estado de assinatura no banco. Isso facilita lancar rapidamente sem reescrever fluxo depois.

### Evolucao ideal
Quando o provedor de pagamento estiver configurado:

1. Usuario escolhe plano.
2. Informa cartao no checkout.
3. Trial fica ativo por 7 dias.
4. Cobranca inicia automaticamente se nao cancelar.
5. Webhook atualiza status da assinatura.

## Provedor de pagamento sugerido

### Prioridade 1: Stripe
Boa experiencia tecnica, checkout maduro, webhooks robustos, suporte a trial e planos recorrentes. Verificar disponibilidade/operacao para o CNPJ/conta usada.

### Prioridade 2: Mercado Pago ou Pagar.me
Alternativas fortes no Brasil. Podem ser melhores se a prioridade for Pix/cartao nacional e conciliacao brasileira.

### Abstracao recomendada
Criar camada `billingProvider` no backend para evitar acoplamento total a um unico provedor:

- `createCheckoutSession(account, plan)`
- `createCustomer(account)`
- `cancelSubscription(subscriptionId)`
- `handleWebhook(event)`
- `syncSubscriptionStatus(externalId)`

## Fluxo macro recomendado

```text
Visitante
  -> Login/Cadastro
  -> Escolher plano
  -> Ativar trial
  -> Onboarding
  -> Conectar primeira rede social ou pular
  -> Dashboard
  -> Monitor Social / Publicacao multirrede
  -> Banner de trial com dias restantes
  -> Conversao ou bloqueio ao fim do trial
```

## Separacao importante entre login e conexao social

O Wozza deve manter dois conceitos separados:

### Login social
Serve para autenticar o usuario no Wozza.

Exemplos:
- Entrar com Google.
- Entrar com Facebook.

### Conexao de canais sociais
Serve para autorizar o Wozza a operar recursos da conta/pagina/rede social do cliente.

Exemplos:
- Conectar Instagram/Facebook via Meta OAuth.
- Conectar TikTok.
- Conectar LinkedIn.

Isso evita confusao no onboarding e ajuda na revisao da Meta, pois as permissoes sensiveis sao solicitadas dentro do contexto correto: conectar canais para monitoramento e publicacao.

## Estados de acesso

### Usuario sem plano escolhido
- Pode acessar apenas telas de autenticacao e selecao de plano.
- Deve ser redirecionado para `/plans` apos login.

### Usuario com trial ativo
- Pode acessar dashboard, monitor social e conexoes.
- Deve ver banner com dias restantes.
- Pode trocar plano ou cancelar.

### Usuario com assinatura ativa
- Acesso completo conforme limites do plano.

### Usuario com trial expirado sem assinatura
- Pode acessar billing/configuracao de conta.
- Deve bloquear operacoes principais:
  - Conectar nova rede social.
  - Publicar em redes sociais.
  - Processar novas mensagens.
  - Usar IA/respostas automaticas.
- Deve mostrar CTA para assinar.

### Usuario com pagamento falho
- Periodo de tolerancia opcional: 3 dias.
- Depois, bloquear operacoes principais.

### Usuario cancelado
- Mantem acesso ate o fim do periodo pago, se aplicavel.
- Depois vira `expired`.

## Tabelas novas propostas

### billing_plans
Campos sugeridos:

- `id` TEXT PRIMARY KEY
- `code` TEXT UNIQUE NOT NULL
- `name` TEXT NOT NULL
- `billing_cycle` TEXT NOT NULL (`monthly` ou `annual`)
- `price_cents` INTEGER NOT NULL
- `currency` TEXT NOT NULL DEFAULT `BRL`
- `trial_days` INTEGER NOT NULL DEFAULT 7
- `max_social_channels` INTEGER
- `max_scheduled_posts` INTEGER
- `max_ai_interactions` INTEGER
- `active` BOOLEAN NOT NULL DEFAULT TRUE
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Registros iniciais:

| code | name | cycle | price_cents | trial_days |
|---|---|---|---:|---:|
| mensal | Wozza Mensal | monthly | 4990 | 7 |
| anual | Wozza Anual | annual | 35880 | 7 |

### accounts
Representa a empresa/escola/cliente contratante.

Campos sugeridos:

- `id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `document` TEXT
- `email` TEXT
- `phone` TEXT
- `status` TEXT NOT NULL DEFAULT `onboarding`
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Observacao: hoje `app_users.school_id` e `social_channel_configs.school_id` usam `wozza-default-school`. O ideal e evoluir para `account_id`, mantendo compatibilidade temporaria com `school_id`.

### account_members
Liga usuarios a contas.

Campos sugeridos:

- `id` TEXT PRIMARY KEY
- `account_id` TEXT NOT NULL REFERENCES accounts(id)
- `user_id` TEXT NOT NULL REFERENCES app_users(id)
- `role` TEXT NOT NULL DEFAULT `owner`
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- UNIQUE(account_id, user_id)

### account_subscriptions
Controla trial, plano e pagamento.

Campos sugeridos:

- `id` TEXT PRIMARY KEY
- `account_id` TEXT NOT NULL REFERENCES accounts(id)
- `plan_code` TEXT NOT NULL REFERENCES billing_plans(code)
- `status` TEXT NOT NULL
- `trial_starts_at` TIMESTAMPTZ
- `trial_ends_at` TIMESTAMPTZ
- `current_period_starts_at` TIMESTAMPTZ
- `current_period_ends_at` TIMESTAMPTZ
- `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT FALSE
- `provider` TEXT
- `provider_customer_id` TEXT
- `provider_subscription_id` TEXT
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Status esperados:

- `plan_required`
- `trialing`
- `active`
- `past_due`
- `canceled`
- `expired`

### billing_events
Guarda historico de eventos do provedor.

Campos sugeridos:

- `id` TEXT PRIMARY KEY
- `account_id` TEXT
- `provider` TEXT NOT NULL
- `event_type` TEXT NOT NULL
- `event_id` TEXT UNIQUE
- `payload` JSONB NOT NULL DEFAULT '{}'
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### onboarding_steps
Guarda progresso do onboarding.

Campos sugeridos:

- `account_id` TEXT PRIMARY KEY REFERENCES accounts(id)
- `plan_selected` BOOLEAN NOT NULL DEFAULT FALSE
- `trial_started` BOOLEAN NOT NULL DEFAULT FALSE
- `first_social_connected` BOOLEAN NOT NULL DEFAULT FALSE
- `first_post_created` BOOLEAN NOT NULL DEFAULT FALSE
- `dismissed_connect_social` BOOLEAN NOT NULL DEFAULT FALSE
- `completed_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

## Alteracoes em tabelas existentes

### app_users
Adicionar futuramente:

- `default_account_id` TEXT
- `onboarding_completed` BOOLEAN DEFAULT FALSE

### social_channel_configs
Adicionar futuramente:

- `account_id` TEXT

Manter `school_id` durante transicao para nao quebrar o monitor social atual.

## Rotas backend propostas

### Planos

`GET /api/billing/plans`

Retorna planos ativos.

Resposta esperada:

```json
{
  "plans": [
    {
      "code": "mensal",
      "name": "Wozza Mensal",
      "price_cents": 4990,
      "billing_cycle": "monthly",
      "trial_days": 7
    }
  ]
}
```

### Selecao de plano

`POST /api/billing/select-plan`

Entrada:

```json
{
  "plan_code": "mensal",
  "account_name": "Escola Exemplo"
}
```

Responsabilidade:

- Criar `account`, se ainda nao existir.
- Criar `account_members` com usuario atual como `owner`.
- Criar/atualizar `account_subscriptions` como `trialing`.
- Definir `trial_starts_at` e `trial_ends_at`.
- Marcar `onboarding_steps.plan_selected = true` e `trial_started = true`.

### Status de assinatura

`GET /api/billing/status`

Retorna:

- Plano atual.
- Status.
- Dias restantes do trial.
- Se o usuario pode usar recursos principais.
- Motivo de bloqueio, se houver.

### Checkout externo

`POST /api/billing/checkout`

Fase com provedor de pagamento:

- Cria sessao de checkout.
- Retorna URL externa.

### Portal de cobranca

`POST /api/billing/portal`

Fase com provedor de pagamento:

- Cria link para gerenciar assinatura/cartao.

### Webhook de pagamento

`POST /webhook/billing/:provider`

Responsabilidade:

- Validar assinatura do webhook.
- Gravar `billing_events`.
- Atualizar `account_subscriptions`.
- Evitar processamento duplicado por `event_id`.

### Onboarding

`GET /api/onboarding/status`

Retorna progresso:

- Plano escolhido.
- Trial ativo.
- Primeira rede conectada.
- Primeira publicacao criada.
- Proximo passo recomendado.

`POST /api/onboarding/dismiss-connect-social`

Permite pular a conexao inicial.

`POST /api/onboarding/complete`

Marca onboarding como concluido quando requisitos minimos forem atingidos.

## Middleware de autorizacao por assinatura

Criar helper no backend:

`requireActiveEntitlement(req, res, next)`

Usar em rotas que geram custo ou dependem do plano:

- `/auth/meta/start`
- `/auth/tiktok/start`
- `/auth/linkedin/start`
- `/api/social-monitor/ingest`
- `/api/social/post-multi`
- Futuras rotas de IA e agendamento.

Comportamento:

- Se status `trialing` ou `active`: permitir.
- Se `plan_required`: retornar 402 com `PLAN_REQUIRED`.
- Se `expired`: retornar 402 com `TRIAL_EXPIRED`.
- Se `past_due`: retornar 402 com `PAYMENT_REQUIRED`.

Resposta padrao:

```json
{
  "error": "TRIAL_EXPIRED",
  "message": "Seu teste terminou. Escolha um plano para continuar usando o Wozza.",
  "redirectTo": "/plans"
}
```

## Telas novas propostas

### `/plans`
Tela de escolha de plano.

Componentes:

- Header simples com marca Wozza.
- Card Mensal.
- Card Anual em destaque.
- Comparativo breve.
- Informacao de trial de 7 dias.
- CTA `Comecar teste de 7 dias`.

Campos opcionais:

- Nome da empresa/escola.
- Telefone.

### `/onboarding`
Tela apos escolha de plano.

Estados:

1. Boas-vindas.
2. Conectar primeira rede social.
3. Pular por enquanto.
4. Confirmacao de sucesso.

CTA principal:

- `Conectar Instagram/Facebook`

CTA secundario:

- `Configurar depois`

### Banner de trial no dashboard
Exibir no topo das paginas protegidas:

- Status: `Teste gratis`.
- Dias restantes.
- Plano escolhido.
- CTA: `Assinar agora` ou `Gerenciar plano`.

### Estado vazio do Monitor Social
Se nenhuma rede conectada:

- Mostrar valor do produto.
- CTA para conectar rede social.
- Explicar que a conexao autoriza monitoramento de mensagens/comentarios.

### Tela `/billing`
Area de conta e cobranca.

Conteudo:

- Plano atual.
- Status.
- Vencimento/trial.
- Botao para alterar plano.
- Botao para cancelar.
- Link para portal do provedor quando existir.

## Fluxos detalhados

### Fluxo A - Cadastro com trial e conexao imediata

```text
Usuario acessa /login
  -> cria/entra na conta
  -> sistema detecta sem plano
  -> redireciona /plans
  -> escolhe Mensal ou Anual
  -> trial inicia
  -> redireciona /onboarding
  -> conecta Instagram/Facebook
  -> Meta callback salva credenciais/config
  -> redireciona /social-monitor
```

### Fluxo B - Cadastro com trial e conexao depois

```text
Usuario acessa /login
  -> cria/entra na conta
  -> escolhe plano em /plans
  -> trial inicia
  -> /onboarding
  -> clica Configurar depois
  -> /dashboard
  -> dashboard mostra CTA de conectar rede
```

### Fluxo C - Trial expirado

```text
Usuario acessa /dashboard
  -> session valida usuario
  -> billing status retorna expired
  -> dashboard mostra bloqueio
  -> usuario vai para /plans ou /billing
  -> ativa assinatura
  -> acesso liberado
```

### Fluxo D - Login social sem plano

```text
Usuario entra com Google/Facebook
  -> app cria usuario ativo
  -> app verifica billing
  -> sem assinatura/trial
  -> redireciona /plans
```

## Limites iniciais do trial

Recomendacao para comecar:

- 1 conta/empresa.
- Ate 3 canais sociais conectados.
- Ate 30 postagens no trial.
- Ate 500 mensagens/comentarios processados no trial.
- IA/respostas automaticas com limite operacional.

Esses limites devem ser armazenados em `billing_plans` para permitir ajuste sem mudar codigo.

## Ordem de implementacao recomendada

### Fase tecnica imediata - Meta Sync Fase 1
Objetivo: fazer a conexao Meta gerar valor operacional real logo apos o OAuth, preenchendo o calendario/feed com postagens reais do Instagram/Facebook autorizados pelo cliente.

Escopo desta entrega:

- Salvar credenciais Meta de forma criptografada em `social_channel_configs.credentials_encrypted`.
- Adicionar a variavel `ENCRYPTION_KEY` para cifrar tokens de canais sociais.
- Guardar metadados uteis da conexao Meta:
  - `page_id`
  - `page_name`
  - `instagram_business_id`
  - `last_sync_at`
  - resumo da ultima sincronizacao
- Expandir `social_posts` para armazenar postagens reais por rede:
  - `platform`
  - `external_id`
  - `content`
  - `media_url`
  - `thumbnail_url`
  - `permalink`
  - `media_type`
  - `like_count`
  - `comments_count`
  - `account_username`
  - `account_avatar`
  - `synced_at`
- Criar upsert por `school_id + platform + external_id`, evitando duplicar postagens em sincronizacoes repetidas.
- Sincronizar posts iniciais automaticamente ao concluir `/auth/meta/callback`.
- Criar endpoint manual `POST /api/social/sync-posts` para atualizar o calendario quando necessario.
- Manter `/api/social/posts` como fonte unica do calendario/feed, agora retornando tambem posts sincronizados da Meta.

Fora do escopo desta entrega:

- Publicacao real em Facebook/Instagram.
- Edicao/exclusao real de legenda/post na Meta.
- Busca completa de comentarios e respostas reais.
- Webhooks Meta com validacao e ingestao automatica.
- Renovacao/rotacao automatica de tokens.

Comportamento esperado:

```text
Usuario conecta Instagram/Facebook
  -> Meta OAuth retorna token
  -> Wozza troca por token de longa duracao quando possivel
  -> Wozza busca paginas e conta Instagram Business
  -> Wozza salva credencial criptografada
  -> Wozza sincroniza posts recentes
  -> Usuario volta para o Monitor Social
  -> Calendario/feed exibe postagens reais sincronizadas
```

Criterio de aceite:

- Sem `ENCRYPTION_KEY`, o backend nao deve salvar token social em texto puro.
- Ao conectar Meta com permissoes validas, `social_channel_configs.credentials_encrypted` deve ser preenchido.
- Ao conectar Meta, posts recentes devem ser inseridos/atualizados em `social_posts`.
- Reexecutar a sincronizacao nao deve duplicar posts.
- `/api/social/posts` deve continuar compatível com o calendario atual.
- Falhas parciais da API Meta devem aparecer como warning, sem derrubar o monitor inteiro.

Validacoes planejadas:

- `node --check server.js`
- `node --check db.js`
- Checagem de erros do VS Code nos arquivos alterados.
- Teste local do endpoint de status/rotas sem exigir leitura de `.env`.
- Teste real de OAuth/sync apenas quando as variaveis Meta e `ENCRYPTION_KEY` estiverem configuradas no ambiente.

Observacao pos-deploy:

- Em ambiente Vercel serverless, as rotas dinamicas devem aguardar `ensureSchema()` antes de consultar tabelas com colunas novas. Sem esse guard, uma primeira chamada pode executar antes da migration automatica terminar e retornar erro de coluna inexistente.
- As variaveis OAuth devem ser sanitizadas com `trim()` antes de montar URLs e trocar tokens. Isso evita erros como `Invalid App ID` na Meta quando `META_APP_ID` ou outro segredo e salvo com quebra de linha/espaco acidental no ambiente.

### Fase 1 - Fundacao de billing sem provedor externo
Objetivo: colocar o fluxo comercial dentro do produto, mesmo sem cobranca automatica.

Tarefas:

- Criar tabelas `billing_plans`, `accounts`, `account_members`, `account_subscriptions`, `onboarding_steps`.
- Popular planos Mensal e Anual no `ensureSchema`.
- Criar APIs `/api/billing/plans`, `/api/billing/select-plan`, `/api/billing/status`.
- Criar `/plans`.
- Redirecionar usuario autenticado sem plano para `/plans`.
- Criar banner de trial.
- Criar documentacao da fase.

Criterio de aceite:

- Usuario novo consegue escolher plano.
- Trial de 7 dias e criado.
- Dashboard exibe trial ativo.
- Usuario sem plano nao acessa monitor social direto.

### Fase 2 - Onboarding de primeira rede
Objetivo: transformar usuario cadastrado em usuario ativado.

Tarefas:

- Criar `/onboarding`.
- Criar APIs `/api/onboarding/status` e dismiss.
- Redirecionar apos escolha de plano para onboarding.
- Integrar botao `Conectar Instagram/Facebook` ao OAuth Meta existente.
- Marcar `first_social_connected` quando callback Meta concluir.
- Ajustar estado vazio do monitor social.

Criterio de aceite:

- Usuario com trial ativo ve onboarding.
- Pode conectar Meta ou pular.
- Se conecta, cai no monitor social.
- Se pula, cai no dashboard com CTA.

### Fase 3 - Bloqueios por entitlement
Objetivo: impedir uso operacional sem trial/assinatura valida.

Tarefas:

- Criar helper `getCurrentAccountAndSubscription`.
- Criar middleware `requireActiveEntitlement`.
- Proteger OAuth de canais, ingestao, publicacao multirrede e rotas de IA futuras.
- Implementar respostas 402 padronizadas.
- Ajustar frontend para tratar 402 e mandar para `/plans`.

Criterio de aceite:

- Trial ativo pode usar recursos.
- Trial expirado nao conecta redes nem publica.
- Mensagem de bloqueio e clara.

### Fase 4 - Integracao com pagamento
Objetivo: automatizar cobranca e conversao.

Tarefas:

- Escolher provedor: Stripe, Mercado Pago ou Pagar.me.
- Adicionar variaveis de ambiente.
- Criar camada `billingProvider`.
- Implementar checkout.
- Implementar webhook.
- Implementar portal/cancelamento.
- Sincronizar status de assinatura.

Criterio de aceite:

- Usuario escolhe plano e vai para checkout.
- Webhook ativa trial/assinatura.
- Pagamento falho muda status para `past_due`.
- Cancelamento reflete no painel.

### Fase 5 - Polimento comercial e metricas
Objetivo: medir ativacao e melhorar conversao.

Tarefas:

- Registrar eventos de funil:
  - conta criada
  - plano escolhido
  - trial iniciado
  - rede conectada
  - primeira postagem
  - primeira mensagem processada
  - assinatura ativada
- Criar tela simples de admin/relatorio interno.
- Melhorar copy de planos.
- A/B testar destaque do anual.

Criterio de aceite:

- E possivel acompanhar funil basico.
- Conversao trial -> assinatura fica mensuravel.

## Arquivos provaveis a alterar

- `server.js`: rotas, middleware e fluxo de redirecionamento.
- `db.js`: schema e funcoes de billing/onboarding.
- `public/dist/js/session.js`: carregar status de billing e redirecionar quando necessario.
- `index.html`: banner de trial e CTA.
- `social-monitor.html`: estado vazio e tratamento de bloqueio.
- `package.json`: dependencias do provedor de pagamento quando escolhido.
- `.env.example`: variaveis de billing/pagamento.
- `docs-implementacoes/`: documentacao por fase.

Arquivos tambem previstos para a Meta Sync Fase 1:

- `server.js`: criptografia de credenciais, callback Meta e endpoint manual de sincronizacao.
- `db.js`: colunas enriquecidas de `social_posts` e upsert por post externo.
- `.env.example`: `ENCRYPTION_KEY`.
- `docs-implementacoes/2026-05-03-plano-implementacao-planos-trial-onboarding.md`: acompanhamento desta fase tecnica.

Arquivos novos previstos:

- `plans.html`
- `onboarding.html`
- `billing.html`
- `public/dist/js/billing.js`
- `public/dist/js/onboarding.js`
- opcional: `billing-provider.js`

## Variaveis de ambiente futuras

Para credenciais sociais criptografadas:

- `ENCRYPTION_KEY`: chave secreta forte usada para cifrar tokens OAuth de canais sociais.

Para Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY_ID`
- `STRIPE_PRICE_ANNUAL_ID`
- `BILLING_PROVIDER=stripe`

Para Mercado Pago/Pagar.me, substituir pelos tokens equivalentes.

## Pontos de atencao

- Nao bloquear paginas legais: privacy policy e terms devem continuar publicas.
- Nao misturar OAuth de login com OAuth de conexao de canais.
- Nao solicitar permissoes da Meta antes de explicar claramente o motivo.
- Evitar trial ilimitado por criacao de varias contas com o mesmo dominio/e-mail.
- Planejar migracao de `school_id` para `account_id` com cuidado.
- Garantir que `.env.local`, `.vercel` e secrets nunca sejam versionados.
- Confirmar se o provedor de pagamento escolhido suporta trial e webhooks no modelo desejado.

## Checklist de acompanhamento

### Produto
- [ ] Confirmar se trial exigira cartao na primeira versao.
- [ ] Confirmar provedor de pagamento.
- [ ] Confirmar limites do trial.
- [ ] Confirmar copy final de planos.

### Backend
- [ ] Criar schema de billing.
- [ ] Criar seed dos planos.
- [ ] Criar APIs de planos/status.
- [ ] Criar middleware de entitlement.
- [ ] Salvar credenciais Meta criptografadas.
- [ ] Sincronizar posts reais da Meta no calendario.
- [ ] Criar endpoint manual de sincronizacao social.
- [ ] Integrar provedor de pagamento.
- [ ] Implementar webhooks.

### Frontend
- [ ] Criar pagina `/plans`.
- [ ] Criar pagina `/onboarding`.
- [ ] Criar pagina `/billing`.
- [ ] Criar banner de trial.
- [ ] Criar estado vazio do monitor social.
- [ ] Tratar bloqueios 402.

### Operacao
- [ ] Configurar variaveis na Vercel.
- [ ] Testar fluxo completo em producao.
- [ ] Configurar produtos/precos no provedor.
- [ ] Validar webhooks em ambiente real.
- [ ] Atualizar politicas se houver dados de pagamento/processador.

## Recomendacao final
Implementar em fases. Primeiro colocar `plans + trial + onboarding` sem cobranca externa para validar o comportamento do usuario. Depois integrar pagamento com checkout e webhooks. Essa ordem reduz risco tecnico e permite testar o funil comercial rapidamente.
