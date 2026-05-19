# Scheduler — Agendamento de Posts

**Data:** 2026-05-19  
**Status:** Implementado e deployado

---

## O que foi feito

Implementação completa do scheduler de posts agendados, conforme especificado em `wozza-scheduler.md`.

---

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `db.js` | Tabela `scheduled_posts` no `ensureSchema()` + 6 funções DB + exports |
| `server.js` | Função `processDuePosts()` + 4 novas rotas + `setInterval` no modo local |
| `vercel.json` | Cron job configurado para `* * * * *` |
| `social-monitor.html` | Toggle "Agendar publicação" + campo `datetime-local` + seletor de fuso |
| `public/dist/js/social/social-monitor.js` | Lógica de agendamento em `publicarNasRedes()` + handler do toggle |

---

## Tabelas novas

### `scheduled_posts`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | SERIAL PK | |
| `school_id` | TEXT | Escola dona do post |
| `platform` | TEXT | INSTAGRAM / FACEBOOK / TIKTOK |
| `content` | TEXT | Texto do post |
| `media_url` | TEXT | URL pública da mídia |
| `media_type` | TEXT | IMAGE / VIDEO (default IMAGE) |
| `scheduled_for` | TIMESTAMPTZ | Horário alvo em UTC |
| `timezone` | TEXT | Fuso horário do usuário |
| `status` | TEXT | pending / published / failed / cancelled |
| `error_message` | TEXT | Mensagem de erro se falhou |
| `post_id` | TEXT | external_id retornado pela rede |
| `locale` | TEXT | default pt-BR |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Índice parcial em `(status, scheduled_for) WHERE status = 'pending'`.

---

## Rotas novas ou alteradas

| Método | Path | Descrição |
|---|---|---|
| `POST` | `/api/social/schedule-post` | Agenda um post (auth obrigatória) |
| `GET` | `/api/social/scheduled-posts` | Lista posts agendados por período (`from`, `to`) |
| `DELETE` | `/api/social/scheduled-posts/:id` | Cancela post pendente |
| `GET` | `/api/internal/run-scheduler` | Rota interna chamada pelo Vercel Cron; protegida por `CRON_SECRET` (Bearer token) |

---

## Variáveis de ambiente novas

| Variável | Propósito |
|---|---|
| `CRON_SECRET` | Autenticar chamadas do Vercel Cron via `Authorization: Bearer <secret>` |

---

## Fluxo de execução

```
Usuário marca "Agendar publicação" → define data/hora + fuso → clica botão
        ↓
POST /api/social/schedule-post → salva em scheduled_posts (status: pending)
        ↓
Vercel Cron dispara GET /api/internal/run-scheduler a cada minuto
        ↓
processDuePosts() → busca posts com scheduled_for <= NOW()
        ↓
Para cada post: chama publisher da plataforma (Instagram/Facebook/TikTok)
        ↓
Sucesso → status: published + post_id salvo
Falha   → status: failed + error_message salvo
```

---

## Critérios de aceite verificados

- [x] `db.js` carrega sem erros (`node -e "require('./db')"`)
- [x] `server.js` carrega sem erros (`node -e "require('./server')"` — Schema Neon OK)
- [x] Commit e push para `main` realizados com sucesso
- [x] Toggle "Agendar publicação" exibe/oculta campos de data/hora
- [x] Botão muda label conforme modo (Publicar agora / Agendar publicação)
- [x] Agendamento limita a 1 rede por vez (validação no frontend)
- [x] Vercel Cron configurado com schedule `* * * * *`
- [x] Rota interna protegida por `CRON_SECRET` (Bearer token)

---

## Pendências / próximos passos

- Adicionar `CRON_SECRET` nas variáveis de ambiente da Vercel (dashboard)
- Exibir posts agendados (status `pending`) no calendário com cor diferenciada
- Suporte a múltiplas redes no agendamento (atualmente 1 por vez)
- LinkedIn como plataforma adicional no scheduler
