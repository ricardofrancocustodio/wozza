# 2026-05-10 - Corrige destino token system user

## Data
2026-05-10

## O que foi feito
- Ajustada a tela `connect-system-user.html` para deixar explicito se o token sera conectado como Facebook ou Instagram.
- Alterado o padrao da tela de token para Facebook quando a URL nao informa `platform`.
- Adicionado seletor visual entre Facebook e Instagram na propria tela de conexao por System User Token.
- Atualizada a lista de paginas para indicar quando a pagina sera salva como Facebook, mantendo o Instagram vinculado apenas como informacao relacionada.
- Ajustadas mensagens de carregamento e sucesso para a plataforma escolhida.
- Incluidas na orientacao de permissoes as permissoes `instagram_content_publish` e `pages_manage_posts`.

## Arquivos alterados
- `connect-system-user.html`

## Rotas novas ou alteradas
- Nenhuma rota backend alterada.

## Tabelas novas ou alteradas
- Nenhuma.

## Variaveis de ambiente novas
- Nenhuma.

## Criterios de aceite verificados
- `node --check server.js` executado com sucesso.
- Validacao sem erros em `connect-system-user.html`.
- Tela local `http://localhost:4000/connect-system-user?platform=FACEBOOK&school_id=wozza-default-school` abriu com titulo e destino Facebook.
- Alternancia local para Instagram atualizou titulo e query string para `platform=INSTAGRAM`.

## Pendencias ou proximos passos
- Apos deploy, conectar novamente o Facebook pelo seletor Facebook usando o mesmo token permanente.
- Se a Meta retornar erro de permissao, gerar novo token permanente garantindo `pages_manage_posts` e Full Control na pagina.
