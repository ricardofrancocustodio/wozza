# Wozza - Guia para agentes

## Produto
Wozza e uma aplicacao web em Node.js/Express com interface AdminLTE 3 e funcionalidades iniciais de dashboard e monitor social. O backend atual concentra rotas em `server.js` e usa armazenamento em memoria para os dados do monitor social, com preparacao para evoluir para PostgreSQL/Neon DB.

## Stack
- Backend: Node.js >=18 + Express 5 em `server.js`.
- UI: AdminLTE 3, Bootstrap 4 e Font Awesome servidos a partir de `node_modules`.
- Banco planejado: Neon DB/PostgreSQL via variavel de ambiente, sem secrets versionados.
- Frontend atual: HTML estatico na raiz e arquivos em `public/` quando aplicavel.
- Deploy: Vercel via push na branch `main`; validar o deploy publicado apos o push quando houver alteracao relevante.

## Estrutura principal
- `/server.js`: entry point do backend, configuracao Express, assets estaticos e rotas da aplicacao.
- `/index.html`: dashboard AdminLTE inicial servido pela rota principal.
- `/social-monitor.html`: tela do monitor social, quando usada pelo fluxo atual.
- `/public/`: assets e arquivos estaticos da aplicacao.
- `/views/`: arquivos de view quando existirem no fluxo do backend.
- `/.qodo/`: configuracoes e automacoes auxiliares do projeto, se aplicavel.
- `/package.json`: dependencias, scripts e metadados do projeto Node.js.

## Regras gerais
1. Responder e documentar em pt-BR, salvo pedido contrario.
2. Antes de alterar, leia arquivos proximos e siga os padroes existentes.
3. Nao refatorar, renomear ou reorganizar fora do escopo pedido.
4. Nao exponha secrets; use variaveis de ambiente e nao leia `.env` sem necessidade explicita.
5. Para Neon/PostgreSQL, manter connection string em variavel de ambiente, por exemplo `DATABASE_URL`.
6. Backend: manter rotas simples em `server.js`; extrair logica para servicos apenas quando houver complexidade real.
7. Frontend: preservar AdminLTE 3, Bootstrap 4 e Font Awesome, evitando trocar a stack visual sem pedido.
8. Se criar ou alterar implementacao, criar tambem um arquivo `.md` de documentacao da implementacao quando aplicavel.
9. Escrever teste quando houver base clara; se nao houver framework, usar validacao minima com comando relevante e informar o resultado.
10. Validar com comandos relevantes e informar o que foi ou nao testado.

## Comandos
- Instalar dependencias: `npm install`.
- Rodar backend: `node server.js`.
- Porta local atual: `4000`, ou `process.env.PORT` quando definido.
- Testes: ainda nao ha suite configurada em `package.json`.

## Variaveis esperadas
- `PORT`: porta HTTP do Express. Padrao atual: `4000`.
- `DATABASE_URL`: connection string do Neon DB/PostgreSQL, quando a integracao com banco estiver habilitada.

## Contextos especificos
- Backend e rotas: revisar `server.js`.
- Interface principal: revisar `index.html` e arquivos em `public/`.
- Monitor social: revisar `social-monitor.html` e rotas relacionadas em `server.js`.

## Post-change workflow

Sempre que houver implementacao ou alteracao de codigo, avaliar se e necessario executar:

1. Atualizar documentacao do sistema ou criar documento `.md` da implementacao.
2. Rodar validacoes locais relevantes.
3. Rodar migrations SQL, se houver alteracao de banco.
4. Fazer deploy do frontend, se houver alvo configurado e alteracao de front.
5. Fazer deploy do backend, se houver alvo configurado e alteracao de backend.
6. Subir o codigo para o repositorio remoto, quando a alteracao estiver validada.

Regra operacional adicional:

- A cada implementacao ou atualizacao, o agente deve avaliar o que mudou e, se necessario para teste e validacao, executar tambem o deploy e o push do codigo ja validado, alem de atualizar a documentacao correspondente.
- Quando a alteracao impactar comportamento que precisa ser testado em ambiente publicado, priorizar push + deploy da mudanca validada no mesmo fluxo de entrega.
- Considerar que apenas o mantenedor atual trabalha neste sistema; por padrao, nao e necessario pedir confirmacao adicional antes de `git push` ou da validacao do deploy apos alteracoes concluidas e validadas.

**Instrucao obrigatoria:**

Antes de executar migrations SQL destrutivas, informe ao usuario o que sera feito e por que.

`git push` e validacao do deploy podem ser executados automaticamente ao final do fluxo, desde que a alteracao tenha sido validada e nao envolva secrets, migrations destrutivas ou risco operacional fora do escopo pedido.

## Arquivos e pastas a serem ignorados pelo agente

O agente NAO deve ler, analisar ou processar os seguintes diretorios e arquivos, tanto na raiz quanto em subpastas:

- `node_modules/`
- `public/node_modules/`
- `public/dist/assets/`
- `dist/`
- `build/`
- `*.log`
- `logs/`
- `.env`
- `.env.*`
- `.cache/`
- `.tmp/`

Esses diretorios e arquivos sao dependencias, builds, assets pesados, logs, arquivos de ambiente e cache temporario. O foco deve ser apenas em codigo-fonte e arquivos de configuracao relevantes para o funcionamento e evolucao do sistema.
