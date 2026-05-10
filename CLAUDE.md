# Wozza — instruções para Claude

## Stack

- **Backend**: Express.js 5 + Node.js v24
- **Banco de dados**: NeonDB (`@neondatabase/serverless`) — SQL template literals via `neon()` singleton em `db.js`
- **Frontend**: AdminLTE 3.2 (Bootstrap 4) + jQuery 3.6 — Bootstrap 4.6.2 via CDN
- **Deploy**: Vercel serverless — `vercel.json` roteia tudo para `server.js`; exportar `module.exports = app` quando não for `require.main`
- **Auth**: cookie `wozza_session` + tabela `auth_sessions`; sem biblioteca de sessão externa
- **Billing**: tabelas `billing_plans`, `accounts`, `account_members`, `account_subscriptions`, `onboarding_steps`

## Variáveis de ambiente

Ver `.env.example`. O `.env` local nunca deve ser versionado.  
Em produção, as variáveis são configuradas no dashboard da Vercel.

## Branches

- `main` — branch principal, conectada ao deploy automático da Vercel
- Commits devem ir para `main` (ou PR se houver revisão)

## Padrões de código

- Sem comentários desnecessários — só quando o "por quê" não é óbvio
- Sem abstrações prematuras — três linhas similares é melhor que abstração prematura
- Sem error handling para cenários impossíveis
- Validação apenas em boundaries externos (input do usuário, APIs externas)
- SQL: usar template literals do neon — `sql\`SELECT ...\``; nunca concatenar strings

## Processo ao final de cada implementação ou atualização

Após concluir qualquer tarefa de implementação ou atualização, executar **sempre** os três passos abaixo, nessa ordem:

Observação operacional: neste repositório, assumir por padrão que o mantenedor trabalha sozinho e que `git push` para `main` e a validação do deploy na Vercel fazem parte do fluxo automático normal após validação local, exceto quando a tarefa envolver risco operacional extraordinário, secrets ou migrations destrutivas.

### 1. Commit + push para o repositório

```bash
git add <arquivos alterados>
git commit -m "mensagem descritiva"
git push origin main
```

- Nunca usar `git add -A` ou `git add .` sem revisar o que está sendo adicionado
- Nunca commitar `.env`, `.env.local`, segredos ou arquivos de build
- Mensagem de commit deve descrever o **por quê**, não o que
- Incluir `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` no commit

### 2. Deploy para a Vercel

O push para `main` já dispara o deploy automático na Vercel.  
Após o push, verificar se o deploy concluiu com sucesso:

```bash
vercel --prod   # apenas se o deploy automático não estiver configurado
```

Validar ao menos uma rota em produção (`https://wozza.vercel.app`) para confirmar que não há erro 500 ou 404 inesperado.

### 3. Atualizar documentação do sistema

Atualizar (ou criar) o arquivo correspondente em `docs-implementacoes/` com:

- **Data** da implementação
- **O que foi feito** — lista objetiva das mudanças
- **Arquivos alterados** — com caminho relativo
- **Rotas novas ou alteradas** — método + path + descrição
- **Tabelas novas ou alteradas** — nome + campos adicionados
- **Variáveis de ambiente novas** — nome + propósito
- **Critérios de aceite verificados** — o que foi testado e passou
- **Pendências ou próximos passos** — o que ficou fora do escopo

Nome do arquivo: `YYYY-MM-DD-<slug-descritivo>.md`

Se a implementação atualizar um doc existente (ex: continuação de uma fase), atualizar o arquivo original ao invés de criar um novo.
