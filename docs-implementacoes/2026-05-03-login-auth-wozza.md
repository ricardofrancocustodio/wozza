# Implementacao - Login e autenticacao Wozza

## Data
2026-05-03

## Resumo
Implementado fluxo de autenticacao para o painel Wozza, adaptando o padrao visual e funcional observado no projeto Qnexy para a stack atual do Wozza com Express, AdminLTE 3, Vercel e Neon DB.

## Funcionalidades entregues
- Pagina de login em `/login` com e-mail/senha, lembrar sessao e login social Google/Facebook.
- Fluxo de esqueci senha em `/forgot-password`.
- Fluxo de redefinicao de senha em `/reset-password?token=...`.
- Fluxo de primeira senha em `/first-password`, incluindo bootstrap do primeiro usuario admin quando a tabela de usuarios ainda estiver vazia.
- Sessao via cookie HTTP-only (`wozza_session`) e tabela `auth_sessions`.
- Hash de senha com `crypto.pbkdf2Sync` e salt unico por usuario.
- Tabelas Neon para `app_users`, `auth_sessions` e `auth_password_tokens`.
- API `/api/auth/me`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/first-password`, `/api/auth/reset-password` e `/api/auth/social/status`.
- OAuth de login do painel via Google e Facebook, separado do OAuth Meta usado para conectar canais sociais do monitor.
- Protecao do dashboard e do monitor social via `public/dist/js/session.js`.

## Variaveis de ambiente adicionadas
- `RESEND_API_KEY`: opcional para envio real dos links por e-mail.
- `AUTH_EMAIL_FROM`: remetente usado no Resend.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: login social Google.
- `FACEBOOK_CLIENT_ID` e `FACEBOOK_CLIENT_SECRET`: login social Facebook.

## Observacoes operacionais
Quando `RESEND_API_KEY` nao estiver configurada, os links de primeira senha e recuperacao sao registrados nos logs do servidor para desenvolvimento. Em producao, configure Resend ou outro provedor equivalente antes de depender do fluxo por e-mail.

O primeiro usuario pode ser iniciado pela pagina `/first-password`: se ainda nao houver nenhum usuario em `app_users`, o e-mail informado recebe um token de primeira senha e vira usuario `admin` da escola padrao `wozza-default-school`.

## Validacao
A validacao local deve incluir `node --check server.js`, `node --check db.js` e inicializacao com `npm start`/`node server.js` quando as variaveis de banco estiverem disponiveis.
