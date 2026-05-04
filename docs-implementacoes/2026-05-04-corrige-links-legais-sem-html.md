# Correcao dos links legais sem extensao .html

**Data:** 2026-05-04  
**Status:** Concluido

## O que foi feito

- corrigidos os links de `Privacidade` e `Termos` na tela de login para usar as rotas limpas sem extensao `.html`;
- adicionados redirects `301` no backend para compatibilizar acessos antigos a:
  - `/privacy-policy.html`
  - `/terms-of-service.html`
  - `/privacy-portal.html`

## Arquivos alterados

- `login.html`
- `server.js`
- `vercel.json`

## Criterios de aceite verificados

- `node --check server.js` sem erro;
- VS Code Problems sem erro em `login.html` e `server.js`;
- VS Code Problems sem erro em `vercel.json`;
- rotas antigas agora possuem redirect configurado no backend e na camada de roteamento da Vercel para as rotas publicas sem extensao.

## Objetivo da correcao

- evitar exibicao de links com `.html` na navegacao publica;
- manter compatibilidade com links antigos, bookmarks ou caches ainda apontando para URLs com extensao.