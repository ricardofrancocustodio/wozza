# 2026-05-10 - Ajuste workflow push deploy automatico

## Data
2026-05-10

## O que foi feito
- Atualizadas as instrucoes do repositório para tratar `git push` e validacao de deploy como parte do fluxo automatico padrao.
- Removida a exigencia de confirmacao explicita previa para `git push` e validacao de deploy em alteracoes comuns ja validadas.
- Mantida a exigencia de aviso previo apenas para migrations SQL destrutivas e cenarios de maior risco operacional.

## Arquivos alterados
- `AGENTS.md`
- `CLAUDE.md`

## Rotas novas ou alteradas
- Nenhuma.

## Tabelas novas ou alteradas
- Nenhuma.

## Variaveis de ambiente novas
- Nenhuma.

## Criterios de aceite verificados
- Validacao sem erros em `AGENTS.md`.
- Validacao sem erros em `CLAUDE.md`.
- Preferencia do usuario registrada na memoria persistente para reutilizacao futura.

## Pendencias ou proximos passos
- Em tarefas futuras neste projeto, aplicar automaticamente commit/push e validacao de deploy quando o fluxo fizer sentido e nao houver restricoes de risco fora do escopo.
