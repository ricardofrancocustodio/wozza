# 2026-05-06 - Corrige isolamento de mensagens no Monitor Social

## Data

2026-05-06

## O que foi feito

- Bloqueado o carregamento do overview do Monitor Social para aceitar apenas o `school_id` do usuário autenticado.
- Aplicada a mesma validação de posse do `school_id` nas rotas de configuração, personalização de respostas, ingestão manual e ação manual sobre mensagens.
- Escopada a atualização manual de mensagens por `id + school_id`, impedindo alteração de registros de outra escola.
- Removida da tela do Monitor Social a sobrescrita de `sessionStorage.SCHOOL_ID` com o `school_id` vindo na query string do OAuth.

## Arquivos alterados

- `server.js`
- `db.js`
- `social-monitor.html`

## Rotas novas ou alteradas

- `GET /api/social-monitor/overview` - agora exige usuário autenticado e valida que o `school_id` pertence à sessão.
- `GET /api/social-monitor/config` - agora exige usuário autenticado e valida posse do `school_id`.
- `POST /api/social-monitor/config` - agora exige usuário autenticado e valida posse do `school_id`.
- `GET /api/social-monitor/reply-config` - agora exige usuário autenticado e valida posse do `school_id`.
- `POST /api/social-monitor/reply-config` - agora exige usuário autenticado e valida posse do `school_id`.
- `POST /api/social-monitor/ingest` - agora exige usuário autenticado e valida posse do `school_id`.
- `POST /api/social-monitor/messages/:id/manual-action` - agora exige usuário autenticado e limita a atualização à escola da sessão.

## Tabelas novas ou alteradas

- Nenhuma tabela alterada.

## Variáveis de ambiente novas

- Nenhuma.

## Critérios de aceite verificados

- `node --check server.js`
- Diagnóstico de editor sem erros em `server.js`, `db.js` e `social-monitor.html`

## Pendências ou próximos passos

- Validar em navegador autenticado que o monitor continua carregando normalmente para a escola correta.
- Se houver outros endpoints multi-tenant legados fora do monitor social, aplicar o mesmo padrão de autorização por `user.school_id`.