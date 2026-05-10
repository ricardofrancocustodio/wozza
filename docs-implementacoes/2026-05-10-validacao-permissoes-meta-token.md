# 2026-05-10 - Validacao permissoes Meta token

## Data
2026-05-10

## O que foi feito
- Adicionada inspecao de permissoes do System User Token via `debug_token` da Meta.
- A validacao do token agora retorna permissoes ausentes para a plataforma escolhida.
- A conexao por System User Token passa a bloquear tokens sem permissao de publicacao para a plataforma escolhida.
- A tela de conexao exibe aviso quando faltam `pages_manage_posts` para Facebook ou `instagram_content_publish` para Instagram.
- Mensagens de erro de publicacao da Meta foram traduzidas para orientar a geracao de novo token ou App Review quando a permissao nao estiver disponivel.

## Arquivos alterados
- `server.js`
- `connect-system-user.html`

## Rotas novas ou alteradas
- `POST /api/auth/system-user/validate` - passa a aceitar `platform` e retornar dados de permissoes do token.
- `POST /api/auth/system-user/connect` - passa a rejeitar conexoes cujo token nao tenha permissao de publicacao para a plataforma escolhida.
- `POST /api/social/post-multi` - mensagens de erro Meta agora ficam mais claras quando faltam permissoes.

## Tabelas novas ou alteradas
- Nenhuma.

## Variaveis de ambiente novas
- Nenhuma. A validacao usa `META_APP_ID` e `META_APP_SECRET` ja existentes.

## Criterios de aceite verificados
- `node --check server.js` executado com sucesso.
- Validacao sem erros em `server.js` e `connect-system-user.html`.

## Pendencias ou proximos passos
- Gerar novo System User Token no Meta Business marcando `pages_manage_posts` e `instagram_content_publish`.
- Se `pages_manage_posts` nao aparecer ao gerar token, habilitar/solicitar a permissao no App Review do app Meta.
