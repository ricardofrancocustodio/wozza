Atualize a documentação completa do sistema Wozza em `docs-implementacoes/2026-05-03-documentacao-completa-sistema-wozza.md`.

Para fazer isso, leia os seguintes arquivos em paralelo:
- `server.js` — todas as rotas (`app.get`, `app.post`, etc.), funções utilitárias e integrações
- `db.js` — schema de tabelas, campos e queries
- `package.json` — dependências atuais
- Execute `git log --oneline -20` para ver os commits recentes

Com base no estado atual do código (não em memória ou suposições), atualize o documento com:

1. **Visão geral** — ajuste se o foco do produto mudou
2. **Stack técnica** — dependências novas ou removidas de `package.json`
3. **Variáveis de ambiente** — novas vars (compare com `.env.example`)
4. **Modelo de dados** — tabelas novas, campos adicionados, tabelas removidas (leia `db.js`)
5. **Rotas HTTP** — lista completa e atualizada de todas as rotas do `server.js`
6. **Integrações sociais** — estado atual de cada plataforma (implementado / parcial / stub)
7. **Estado atual por módulo** — o que está estável, parcial ou não implementado
8. **Próximos passos** — ajuste conforme o que ainda falta implementar

Regras:
- Baseie-se exclusivamente no código atual — não invente status
- Se uma rota retorna apenas `{ received: true }` ou `{ success: true }` sem lógica real, marque como stub
- Se uma funcionalidade tem lógica real implementada, marque como estável ou funcional
- Mantenha o documento em português, sem acentos (o arquivo usa português sem acentos por compatibilidade)
- Atualize o campo "Ultima atualizacao" para a data de hoje
- Não crie um novo arquivo — atualize o existente

Após atualizar a documentação, faça commit e push:
```
git add docs-implementacoes/2026-05-03-documentacao-completa-sistema-wozza.md
git commit -m "docs: atualiza documentacao completa do sistema"
git push origin main
```
