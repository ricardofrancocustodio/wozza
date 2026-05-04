# Monitor Social - aba de canais e modal por rede

**Data:** 2026-05-04  
**Status:** Concluido

## O que foi feito

- movida a seção de canais conectados da aba `Monitoramento` para uma nova aba `Canais`;
- reorganizada a modal de configuração de conectores em blocos visuais:
  - configurações gerais;
  - referências da rede;
  - webhook e autenticação;
- adicionada filtragem visual de campos por plataforma para evitar exibir IDs e segredos de redes não relacionadas;
- ajustado o grid dos cards de conectores para melhor aproveitamento da nova aba.

## Arquivos alterados

- `social-monitor.html`
- `public/dist/js/social/social-monitor.js`

## Regras e comportamento

- o container `#sm-connectors-list` foi preservado para manter compatibilidade com o `renderConnectors()` existente;
- os IDs dos inputs da modal foram preservados para não quebrar `openConfigModal()` e `saveConnectorConfig()`;
- a filtragem por plataforma é apenas visual e acontece ao abrir a modal.

## Critérios de aceite verificados

- sem erros em `social-monitor.html` no VS Code Problems;
- sem erros em `public/dist/js/social/social-monitor.js` no VS Code Problems;
- diff confirmado com remoção do card de conectores da aba `Monitoramento` e criação da nova aba `Canais`.

## Pendências

- validar visualmente no navegador se a distribuição dos blocos da modal está adequada para desktop e mobile;
- caso necessário, refinar espaçamentos e ordem dos campos por plataforma após teste manual.