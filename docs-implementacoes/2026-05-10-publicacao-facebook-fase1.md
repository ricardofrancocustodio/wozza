# 2026-05-10 - Publicacao Facebook fase 1

## Data
2026-05-10

## O que foi feito
- Implementada publicacao real no Facebook no endpoint `POST /api/social/post-multi`.
- Adicionada funcao de backend para publicar em pagina do Facebook usando `page_access_token` salvo na conexao Meta.
- Suporte a publicacao com imagem via `/{page_id}/photos` e sem imagem via `/{page_id}/feed`.
- Persistencia local da postagem publicada no Facebook no historico sincronizado.
- Inclusao do escopo Meta `pages_manage_posts` no fluxo OAuth padrao.

## Arquivos alterados
- `server.js`

## Rotas novas ou alteradas
- `POST /api/social/post-multi` - agora publica de fato no Facebook quando `destinos` inclui `FACEBOOK`.
- `GET /auth/meta/start` - passa a solicitar tambem o escopo `pages_manage_posts` via `DEFAULT_META_SCOPES`.

## Tabelas novas ou alteradas
- Nenhuma tabela alterada.

## Variaveis de ambiente novas
- Nenhuma.

## Criterios de aceite verificados
- `node --check server.js` executado com sucesso.
- Analise do fluxo confirmou que o erro anterior era causado por retorno fixo de funcionalidade nao implementada para Facebook.

## Pendencias ou proximos passos
- Canais Facebook conectados antes desta mudanca precisam ser reconectados para conceder o escopo `pages_manage_posts`.
- Validar em ambiente real uma publicacao com imagem e uma sem imagem usando uma pagina com permissao de administrador total.
- Se houver necessidade de videos ou multiplas imagens, implementar endpoints especificos do Graph API para esses formatos.
