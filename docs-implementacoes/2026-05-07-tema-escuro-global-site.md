# 2026-05-07 - Tema escuro global do site

## Data

2026-05-07

## O que foi feito

- Criado um tema escuro global com persistência em `localStorage` usando a chave `wozza-theme`.
- Adicionado um botão flutuante de liga/desliga do tema em todas as páginas principais do site.
- Implementado bootstrap inicial do tema no `head` das páginas para aplicar o modo salvo antes da renderização.
- Criado um stylesheet global com overrides para AdminLTE, Bootstrap, formulários, cards, tabelas, páginas de autenticação, páginas legais e Monitor Social.
- Mantida a compatibilidade com tema claro e com a preferência inicial do sistema quando não houver valor salvo.

## Arquivos alterados

- `public/dist/css/theme.css`
- `public/dist/js/theme.js`
- `index.html`
- `billing.html`
- `login.html`
- `forgot-password.html`
- `first-password.html`
- `reset-password.html`
- `onboarding.html`
- `plans.html`
- `connect-system-user.html`
- `select-facebook-page.html`
- `privacy-policy.html`
- `privacy-portal.html`
- `terms-of-service.html`
- `social-monitor.html`

## Rotas novas ou alteradas

- Nenhuma rota alterada.

## Tabelas novas ou alteradas

- Nenhuma.

## Variáveis de ambiente novas

- Nenhuma.

## Critérios de aceite verificados

- `node --check server.js`
- Diagnóstico do editor sem erros nos arquivos alterados.
- Validação em runtime em `/login` com alternância real do atributo `data-theme` e persistência em `localStorage`.

## Pendências ou próximos passos

- Validar visualmente páginas autenticadas após login para ajustar contrastes finos em componentes específicos, se necessário.
- Se o tema escuro virar padrão de produto, considerar mover o bootstrap do tema para um include comum de layout no futuro.
