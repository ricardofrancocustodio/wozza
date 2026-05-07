# 2026-05-04 - publicacao-instagram-upload-blob

## Data

2026-05-04

## O que foi feito

- Implementado upload opcional de imagem para postagem social usando Vercel Blob.
- Criado endpoint autenticado `POST /api/social/upload-image` para receber a imagem em base64, validar tipo/tamanho e devolver uma URL pública.
- A aba "Criar postagem" agora permite selecionar um arquivo local, enviar para o Blob e preencher automaticamente a URL pública da imagem.
- Mantido o fallback de colar manualmente a URL da imagem quando o storage não estiver configurado.

## Atualização posterior

- A URL manual deixou de ser exibida na interface.
- O upload de arquivo passou a ser o caminho principal da UI para publicar no Instagram.
- A URL pública continua existindo apenas internamente, preenchida automaticamente após o upload.

## Arquivos alterados

- `server.js`
- `social-monitor.html`
- `public/dist/js/social/social-monitor.js`
- `.env.example`
- `package.json`
- `package-lock.json`

## Rotas novas ou alteradas

- `POST /api/social/upload-image`
  - Exige usuário autenticado.
  - Exige `school_id` do usuário autenticado.
  - Exige `data_url` com imagem JPG, PNG ou WEBP.
  - Limite de 8 MB.
  - Retorna URL pública do Blob para ser usada na publicação do Instagram.

## Tabelas novas ou alteradas

- Nenhuma.

## Variáveis de ambiente novas

- `BLOB_READ_WRITE_TOKEN`: token Read/Write do Vercel Blob usado para armazenar imagens e gerar URL pública antes da publicação no Instagram.

## Critérios de aceite verificados

- Fluxo mantém compatibilidade com a URL manual já implementada.
- Backend valida autenticação, tipo de imagem e tamanho do arquivo.
- Frontend preenche automaticamente a URL pública após upload bem-sucedido.
- Frontend impede publicação no Instagram sem imagem enviada.

## Pendências ou próximos passos

- Validar o upload em ambiente com `BLOB_READ_WRITE_TOKEN` configurado.
- Adicionar barra de progresso de upload no frontend.
- Suportar múltiplas imagens/carrossel quando o escopo de postagem evoluir.