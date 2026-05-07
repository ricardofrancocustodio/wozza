# Documentacao completa do sistema Wozza

## Data

Criado em 2026-05-03. Ultima atualizacao: 2026-05-07.

## Visao geral

O Wozza e uma aplicacao web em Node.js/Express voltada para operacao social de empresas, com foco em:

- autenticacao do usuario no painel;
- escolha de plano e trial inicial;
- onboarding para conectar canais sociais;
- monitoramento de mensagens e alertas sociais;
- calendario/feed de postagens por canal;
- publicacao real no Instagram via Meta Graph API;
- base pronta para evoluir para publicacao nas demais redes, replies reais e cobranca integrada.

Hoje o projeto roda com frontend HTML estatico, backend unico em `server.js`, persistencia em Neon/PostgreSQL via `db.js` e deploy em Vercel.

## Stack tecnica

### Backend

- Node.js
- Express 5
- CommonJS
- `server.js` como entrypoint principal

### Banco de dados

- NeonDB / PostgreSQL
- Driver: `@neondatabase/serverless`
- Inicializacao e migrations leves em `ensureSchema()` dentro de `db.js`

### Frontend

- HTML estatico
- AdminLTE 3.2
- Bootstrap 4.6
- Font Awesome
- jQuery em paginas e scripts legados

### Deploy

- Vercel
- `vercel.json` roteando a aplicacao para `server.js`
- app exportado com `module.exports = app` quando nao executado como processo local

## Estrutura principal do projeto

### Arquivos centrais

- `server.js`: backend principal, rotas HTTP, OAuth, auth, billing, onboarding e monitor social
- `db.js`: schema, seeds, consultas SQL e funcoes de persistencia
- `package.json`: scripts e dependencias
- `vercel.json`: configuracao de deploy serverless
- `.env.example`: referencia de variaveis de ambiente

### Paginas HTML

- `index.html`: dashboard principal
- `login.html`: login do painel
- `forgot-password.html`: solicitacao de redefinicao de senha
- `reset-password.html`: redefinicao de senha por token
- `first-password.html`: criacao de primeira senha
- `plans.html`: escolha de plano
- `onboarding.html`: onboarding inicial apos ativacao do trial
- `billing.html`: status de assinatura e trial
- `social-monitor.html`: monitor social, conectores e feed/calendario
- `select-facebook-page.html`: selecao de pagina Facebook apos OAuth Meta
- `connect-system-user.html`: fluxo alternativo de conexao via System User Token Meta
- `privacy-policy.html`: politica de privacidade publica
- `terms-of-service.html`: termos de uso publicos
- `privacy-portal.html`: portal de privacidade

### Scripts frontend

- `public/dist/js/session.js`: validacao de sessao, redirect por billing e banner de trial
- `public/dist/js/social/social-monitor.js`: UI do monitor social, conectores, feed, upload de imagem e publicacao

### Documentacao existente

- `docs-implementacoes/2026-05-03-paginas-legais-portal-privacidade.md`
- `docs-implementacoes/2026-05-03-login-auth-wozza.md`
- `docs-implementacoes/2026-05-03-billing-fase1-fundacao.md`
- `docs-implementacoes/2026-05-03-plano-implementacao-planos-trial-onboarding.md`
- `docs-implementacoes/2026-05-04-publicacao-instagram-fase1.md`
- `docs-implementacoes/2026-05-04-publicacao-instagram-upload-blob.md`
- `docs-implementacoes/2026-05-06-corrige-isolamento-mensagens-monitor-social.md`
- este arquivo consolida a documentacao do sistema como um todo

## Como a aplicacao inicializa

### Local

Script principal:

```bash
npm start
```

Modo desenvolvimento:

```bash
npm run dev
```

Com `DATABASE_URL` configurado, o backend chama `ensureSchema()` antes de atender rotas dinamicas.

### Producao

No ambiente serverless da Vercel, a aplicacao:

- exporta o objeto `app`;
- inicializa o banco com `ensureDbReady()`;
- espera o schema ficar pronto antes de rotas dinamicas, evitando corrida com colunas novas.

## Variaveis de ambiente

### Basicas

- `PORT`: porta local HTTP; padrao `4000`
- `DATABASE_URL`: connection string do Neon/PostgreSQL
- `APP_URL`: URL base publica da aplicacao

### Meta / Instagram / Facebook

- `META_APP_ID`
- `META_APP_SECRET`
- `META_SCOPES`: opcional; sobrescreve os scopes Meta padrao
- `ENCRYPTION_KEY`: chave usada para cifrar credenciais sociais no banco

### Storage de imagens

- `BLOB_READ_WRITE_TOKEN`: token do Vercel Blob; obrigatorio para upload de imagens antes de publicar no Instagram

### Resend / emails transacionais

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`

### Login social do painel

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`

### Outros canais sociais

- `TIKTOK_APP_ID`
- `TIKTOK_APP_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`

## Modelo de dados

## Tabelas de autenticacao

### `app_users`

Armazena usuarios do painel.

Campos relevantes:

- `email`
- `name`
- `password_hash`
- `password_salt`
- `role`
- `school_id`
- `status`
- `auth_provider`
- `provider_id`
- `first_login_required`
- `default_account_id`
- `onboarding_completed`

### `auth_sessions`

Sessao do painel baseada em cookie HTTP-only `wozza_session`.

### `auth_password_tokens`

Tokens de primeira senha e redefinicao de senha.

## Tabelas de billing e onboarding

### `billing_plans`

Catalogo de planos disponiveis.

Seeds atuais:

- `mensal`: Wozza Mensal, R$ 49,90, ciclo mensal, 7 dias trial
- `anual`: Wozza Anual, R$ 358,80, ciclo anual, 7 dias trial

### `accounts`

Conta contratante da empresa/escola.

### `account_members`

Relaciona usuario a conta.

### `account_subscriptions`

Status da assinatura e trial.

Estados usados no sistema:

- `plan_required`
- `trialing`
- `active`
- `past_due`
- `canceled`
- `expired`

### `billing_events`

Reservada para historico de eventos de provedor de pagamento.

### `onboarding_steps`

Marca progresso do onboarding:

- plano escolhido
- trial iniciado
- primeira rede conectada
- primeira publicacao criada
- onboarding descartado ou concluido

## Tabelas sociais

### `social_channel_configs`

Config por plataforma e conta logica (`school_id`).

Campos relevantes:

- `platform`
- `enabled`
- `connection_status`
- `account_label`
- `allowed_channels`
- `metadata` (inclui `instagram_business_id`, `page_id`, `page_name`)
- `credentials_present`
- `credentials_encrypted`

### `social_inbox_messages`

Mensagens ingeridas do monitor social.

### `social_sensitive_alerts`

Alertas abertos para mensagens classificadas como sensiveis.

### `social_reply_configs`

Config de identidade do bot de resposta.

### `social_posts`

Armazena posts locais e sincronizados.

Campos relevantes:

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

Ha indice unico por `school_id + platform + external_id` para evitar duplicidade em sincronizacoes.

## Autenticacao e sessao

## Login por e-mail e senha

Fluxo:

1. usuario acessa `/login`;
2. backend valida credenciais em `POST /api/auth/login`;
3. backend cria sessao em `auth_sessions`;
4. cookie `wozza_session` e enviado;
5. frontend chama `/api/auth/me` para hidratar sessao e billing.

## Primeira senha

Fluxo:

1. usuario acessa `/first-password`;
2. backend cria token `FIRST_PASSWORD`;
3. se Resend estiver configurado, envia por e-mail;
4. sem Resend, em ambiente nao-producao a URL pode ser retornada no JSON/log;
5. usuario define senha via `POST /api/auth/reset-password` com `purpose=FIRST_PASSWORD`.

## Recuperacao de senha

Fluxo:

1. usuario acessa `/forgot-password`;
2. backend cria token `PASSWORD_RESET` para usuarios ativos;
3. usuario redefine a senha via `/reset-password`.

## Login social do painel

Atualmente suportado:

- Google (OAuth backend)
- Facebook (via Facebook SDK JavaScript — `POST /api/auth/facebook/login-sdk`)

Objetivo desse OAuth:

- autenticar o usuario no painel Wozza
- nao confundir com a conexao de canais sociais para operacao

## Billing e entitlement

O frontend usa `public/dist/js/session.js` para decidir o fluxo do usuario.

Regras atuais:

- se nao estiver autenticado, redireciona para `/login`
- se `billing.status = plan_required`, redireciona para `/plans` nas paginas protegidas
- se o usuario ja tiver plano/trial e tentar abrir `/plans`, redireciona para `/dashboard`
- se `billing.status = trialing`, exibe banner com dias restantes

## Fluxo comercial atual

1. usuario faz login ou cria primeira senha;
2. abre o painel;
3. se nao tiver plano, vai para `/plans`;
4. escolhe plano mensal ou anual;
5. trial e ativado;
6. usuario vai para `/onboarding`;
7. pode conectar rede social agora ou depois;
8. volta para dashboard e monitor social.

## Integracoes sociais

## Objetivo das integracoes

As conexoes sociais autorizam o Wozza a operar canais do cliente, nao a autenticar o usuario no painel.

Plataformas previstas:

- Meta / Instagram / Facebook
- TikTok
- LinkedIn

## OAuth Meta

Rotas:

- `GET /auth/meta/start`
- `GET /auth/meta/callback`
- `POST /api/auth/meta/select-page`

Comportamento atual:

- usa scopes Meta business por padrao;
- aceita override por `META_SCOPES`;
- cifra token com `ENCRYPTION_KEY`;
- busca paginas e conta Instagram Business via Graph API;
- grava `credentials_encrypted` e `metadata` em `social_channel_configs`;
- dispara sincronizacao inicial de posts.

Scopes padrao atuais:

- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`
- `pages_show_list`
- `business_management`
- `pages_manage_posts`
- `pages_read_engagement`
- `instagram_business_search`

## System User Token Meta (alternativa ao OAuth)

Rotas:

- `GET /connect-system-user` (pagina)
- `POST /api/auth/system-user/validate`
- `POST /api/auth/system-user/connect`

Fluxo alternativo para conectar o Instagram/Facebook Business sem OAuth interativo,
usando credenciais de System User do Meta Business Manager.

## OAuth TikTok

Rotas:

- `GET /auth/tiktok/start`
- `GET /auth/tiktok/callback`

Estado atual:

- callback marca canal como conectado;
- integracao operacional ainda parcial.

## OAuth LinkedIn

Rotas:

- `GET /auth/linkedin/start`
- `GET /auth/linkedin/callback`

Estado atual:

- callback marca canal como conectado;
- operacao real ainda parcial.

## Monitor social

## Objetivo

Concentrar configuracao de canais, ingestao de mensagens, alertas sensiveis, feed/calendario de posts e acoes manuais.

## APIs principais do monitor

- `GET /api/social-monitor/overview`
- `GET /api/social-monitor/config`
- `POST /api/social-monitor/config`
- `GET /api/social-monitor/reply-config`
- `POST /api/social-monitor/reply-config`
- `POST /api/social-monitor/ingest`
- `POST /api/social-monitor/messages/:id/manual-action`

## Regras de classificacao

O backend classifica texto em categorias como:

- `RISCO`
- `RECLAMACAO`
- `CRITICA`
- `ELOGIO`
- `SUGESTAO`
- `DUVIDA_TECNICA`
- `NEUTRO`

E toma decisoes como:

- `SENSITIVE`
- `AUTO_REPLY`
- `MIXED`

## Feed, calendario e posts

Rotas:

- `POST /api/social/post-multi` — publica em multiplas redes; Instagram implementado e funcional
- `POST /api/social/upload-image` — faz upload de imagem para Vercel Blob, retorna URL publica
- `POST /api/social/sync-posts` — sincroniza posts ja publicados do Meta
- `GET /api/social/posts` — lista posts sincronizados por data range
- `GET /api/social/posts/:postId/interactions` — retorna interacoes (stub)
- `POST /api/social/comments/:commentId/reply` — responde comentario (stub)
- `POST /api/social/posts/:externalId/caption` — edita legenda (stub)
- `DELETE /api/social/posts/:externalId` — deleta post (stub)

Estado atual:

- `GET /api/social/posts` ja entrega dados do feed/calendario;
- `POST /api/social/sync-posts` executa sincronizacao manual de posts Meta conectados;
- sincronizacao inicial Meta ja popula `social_posts`;
- **publicacao no Instagram: implementada e funcional** — cria container de midia, publica e salva em `social_posts`;
- upload de imagem via `POST /api/social/upload-image`: aceita JPG/PNG/WEBP ate 8MB, sobe para Vercel Blob, retorna URL publica;
- publicacao em Facebook, TikTok, LinkedIn: stubs, nao implementado;
- interacoes, edicao de legenda, exclusao e replies: stubs em todas as plataformas.

## Paginas publicas e protegidas

## Publicas

- `/login`
- `/forgot-password`
- `/reset-password`
- `/first-password`
- `/privacy-policy`
- `/terms-of-service`
- `/portal-privacidade`

## Protegidas por sessao

- `/dashboard`
- `/social-monitor`
- `/plans`
- `/onboarding`
- `/billing`

Observacao:

- `/plans`, `/onboarding` e `/billing` exigem sessao, mas sao isentas do bloqueio por `plan_required`.

## Rotas HTTP do backend

## Auth

- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/first-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/social/status`
- `POST /api/auth/facebook/login-sdk`

## OAuth e conexao Meta

- `GET /auth/google/start`
- `GET /auth/google/callback`
- `GET /auth/facebook/start`
- `GET /auth/facebook/callback`
- `GET /auth/meta/start`
- `GET /auth/meta/callback`
- `POST /api/auth/meta/select-page`
- `POST /api/auth/system-user/validate`
- `POST /api/auth/system-user/connect`
- `POST /api/social/refresh-instagram-id`
- `GET /auth/tiktok/start`
- `GET /auth/tiktok/callback`
- `GET /auth/linkedin/start`
- `GET /auth/linkedin/callback`
- `GET /api/oauth/status`

## Billing e onboarding

- `GET /api/billing/plans`
- `POST /api/billing/select-plan`
- `GET /api/billing/status`
- `GET /api/onboarding/status`
- `POST /api/onboarding/dismiss-connect-social`

## Social monitor e feed

- `GET /api/social-monitor/overview`
- `GET /api/social-monitor/config`
- `POST /api/social-monitor/config`
- `GET /api/social-monitor/reply-config`
- `POST /api/social-monitor/reply-config`
- `POST /api/social-monitor/ingest`
- `POST /api/social-monitor/messages/:id/manual-action`
- `POST /api/social/post-multi`
- `POST /api/social/upload-image`
- `POST /api/social/sync-posts`
- `GET /api/social/posts`
- `GET /api/social/posts/:postId/interactions`
- `POST /api/social/comments/:commentId/reply`
- `POST /api/social/posts/:externalId/caption`
- `DELETE /api/social/posts/:externalId`

## Webhooks

- `POST /webhook/social/meta`
- `POST /webhook/social/tiktok`
- `POST /webhook/social/linkedin`

Estado atual dos webhooks:

- stubs operacionais que apenas respondem `{ received: true }`

## Seguranca e decisoes tecnicas importantes

- cookie de sessao HTTP-only
- hash de senha com `pbkdf2Sync`
- tokens de auth salvos como hash SHA-256
- credenciais sociais salvas cifradas com AES-256-GCM
- sanitizacao de variaveis de ambiente OAuth com `trim()`
- fallback de `redirect_uri` para o host real da requisicao em producao
- inicializacao do schema antes de atender rotas dinamicas serverless
- limite de payload JSON aumentado para 12MB para suportar upload de imagens em base64
- imagens validadas (tipo MIME + tamanho) antes de enviar ao Vercel Blob

## Estado atual por modulo

## Estavel

- login por e-mail/senha
- primeira senha
- reset de senha
- login social do painel (Google + Facebook SDK)
- billing Fase 1
- onboarding inicial
- paginas legais (com redirect 301 para URLs sem .html)
- sincronizacao inicial e manual de posts Meta
- **publicacao real no Instagram via Meta Graph API**
- upload de imagem para Vercel Blob

## Parcial

- conexao Meta via System User Token
- conexao operacional TikTok
- conexao operacional LinkedIn
- webhooks sociais reais

## Nao implementado completamente

- publicacao real no Facebook, TikTok e LinkedIn
- replies e interacoes reais por plataforma
- edicao de legenda e exclusao de post
- cobranca com Stripe/Mercado Pago/Pagar.me
- webhook de billing
- portal de cobranca
- entitlement completo no backend para bloquear operacoes por status de plano
- painel administrativo de metricas/funil

## Como rodar localmente

1. instalar dependencias:

```bash
npm install
```

2. configurar variaveis a partir de `.env.example`

3. iniciar localmente:

```bash
npm start
```

ou:

```bash
npm run dev
```

4. abrir:

```text
http://localhost:4000
```

## Como publicar

Fluxo atual de deploy:

1. alterar codigo;
2. validar localmente;
3. commitar em `main`;
4. `git push origin main`;
5. Vercel faz deploy automaticamente;
6. validar rota publica e APIs basicas.

## Principais testes uteis

- `node --check .\server.js`
- `node --check .\db.js`
- `curl https://wozza.vercel.app/api/oauth/status`
- `curl https://wozza.vercel.app/api/social/posts?school_id=wozza-default-school`

## Limitacoes e atencoes atuais

- o sistema ainda usa `school_id` como chave logica principal no monitor social
- o app depende de configuracao correta no Meta Developers para OAuth e scopes
- publicacao real, replies e webhooks ainda nao estao completos em todas as plataformas
- `BLOB_READ_WRITE_TOKEN` ausente impede upload de imagens e bloqueia publicacao no Instagram
- `RESEND_API_KEY` ausente faz o sistema cair em modo de envio simulado/log em ambiente nao-producao
- a pasta `.env` e secrets nunca devem ser versionados

## Proximos passos recomendados

1. implementar publicacao real no Facebook via Meta Graph API (credenciais ja disponiveis)
2. implementar replies e interacoes reais por plataforma
3. concluir conexao operacional TikTok e LinkedIn
4. implementar webhooks reais para receber eventos de cada rede
5. proteger operacoes sociais com middleware de entitlement por assinatura
6. integrar provedor de pagamento e webhook
