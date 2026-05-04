# Correção de Scopes Meta para OAuth Instagram Business

**Data:** 2026-05-03  
**Status:** Concluído  
**Commit:** be75527

## O que foi feito

Atualizadas as scopes OAuth solicitadas ao Meta para versões corretas e compatíveis com a configuração atual da API Instagram Business.

### Problema
- Scopes desatualizadas (`instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`) causavam erro `Invalid Scopes` ao tentar conectar contas Instagram.
- Essas scopes não estão registradas ou habilitadas na configuração atual do aplicativo Meta.

### Solução
Substituição das scopes por versões corretas:
- ~~`instagram_business_basic`~~ → `instagram_basic`
- ~~`instagram_business_manage_messages`~~ → removido (não necessário para listagem)
- ~~`instagram_business_manage_comments`~~ → `instagram_manage_comments`
- ✅ `pages_show_list` (mantido)
- ✅ `pages_read_engagement` (adicionado)
- ✅ `business_management` (mantido)

## Arquivos alterados
- `server.js` (linhas 634-640): Array `DEFAULT_META_SCOPES`

## Rotas afetadas
- `GET /auth/meta/start` — usa as novas scopes para iniciar OAuth
- `GET /auth/meta/callback` — processa token com as novas scopes

## Variáveis de ambiente
Nenhuma alteração. Continua usando:
- `META_APP_ID`
- `META_APP_SECRET`

## Critérios de aceite verificados
- ✅ Commit e push para main executado
- ✅ Deploy automático Vercel concluído
- ✅ Rota `/api/oauth/status` respondendo normalmente em produção

## Próximos passos / Pendências
1. **Testar conexão no frontend** — Tentar conectar conta Instagram `oculos.calibre` em https://wozza.vercel.app/social-monitor
2. **Monitorar erros** — Se persistir erro de scopes inválidas, pode ser necessário habilitá-las no dashboard Meta (https://developers.facebook.com/apps)

## Notas técnicas
As scopes antigas com prefixo `business_` foram descontinuadas ou renomeadas pela Meta. As novas scopes acompanham as mudanças na documentação do Instagram Platform API (v19.0) para 2026.
