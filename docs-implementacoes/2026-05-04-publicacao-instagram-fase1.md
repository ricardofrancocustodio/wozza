# 2026-05-04 - publicacao-instagram-fase1

## Data

2026-05-04

## O que foi feito

- Implementada a primeira fase de publicação real no Instagram via Meta Graph API.
- A rota `POST /api/social/post-multi` deixou de retornar sucesso mockado para Instagram e passou a criar o contêiner de mídia e publicar a imagem.
- A aba "Criar postagem" passou a aceitar `URL pública da imagem` para envio inicial ao Instagram.
- A postagem publicada no Instagram agora é persistida em `social_posts`, permitindo exibição imediata no feed/calendário local.
- Redes diferentes de Instagram continuam explicitamente marcadas como não implementadas para publicação real nesta fase.

## Arquivos alterados

- `server.js`
- `db.js`
- `social-monitor.html`
- `public/dist/js/social/social-monitor.js`

## Rotas novas ou alteradas

- `POST /api/social/post-multi`
  - Agora exige usuário autenticado.
  - Para destino `INSTAGRAM`, publica imagem real via Meta Graph API.
  - Exige `conteudo.media.image_url` ou `conteudo.media.url` com URL pública HTTP/HTTPS.

## Tabelas novas ou alteradas

- Nenhuma tabela nova.
- Uso ampliado da tabela `social_posts` para salvar publicações originadas pelo próprio Wozza com metadados de Instagram.

## Variáveis de ambiente novas

- Nenhuma nova.

## Critérios de aceite verificados

- Backend atualizado para usar credenciais criptografadas já existentes do canal Instagram.
- Fluxo preparado para salvar a postagem publicada e exibi-la no feed local.
- Validação de URL pública de imagem adicionada no backend e no frontend.

## Pendências ou próximos passos

- Implementar upload direto de arquivo/imagem, sem exigir URL pública manual.
- Implementar publicação real em Facebook.
- Implementar polling/refresh mais robusto do feed após publicar.
- Implementar edição e exclusão reais na Meta para os endpoints já existentes no feed.
- Validar publicação ponta a ponta em ambiente com app Meta aprovado e conta Instagram Professional conectada.