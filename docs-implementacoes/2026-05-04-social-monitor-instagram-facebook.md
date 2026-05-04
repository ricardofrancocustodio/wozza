# Social Monitor — Integração Instagram + Facebook

**Data:** 2026-05-04  
**Status:** ✅ Funcional (aguardando publicação do app Meta para sincronização de posts)  
**Versão:** 1.0 MVP

---

## Resumo Executivo

Sistema completo de monitoramento social implementado para Instagram e Facebook, permitindo:
- ✅ Conexão segura via OAuth com Meta
- ✅ Seleção de qual página Facebook conectar
- ✅ Configuração de canais monitorados (Direct, Comentários)
- ✅ Auto-resposta automática com IA
- ✅ Alertas por severidade
- ⏳ Sincronização de posts (requer publicação do app Meta)

---

## O que foi feito

### 1. **Fluxo OAuth Meta/Facebook**
- Novo endpoint `/auth/meta/start` que redireciona para `facebook.com/oauth`
- Endpoint `/auth/meta/callback` que processa o retorno com code
- Troca de token curto por token longo (melhor durabilidade)
- Extração de `access_token` e lista de páginas do usuário

### 2. **Página de Seleção de Página Facebook**
- Novo arquivo `select-facebook-page.html` com UI limpa
- Permite usuário escolher qual página Facebook conectar
- Endpoint POST `/api/auth/meta/select-page` para processar seleção
- Salva credenciais criptografadas no banco

### 3. **Scopes Meta (Permissões)**
```
- instagram_basic — acesso básico ao Instagram
- instagram_manage_comments — gerenciar comentários
- pages_show_list — listar páginas do usuário
- business_management — gerenciar negócios
```

### 4. **Botão de Sincronização Manual**
- Novo botão "Sincronizar posts" no modal de configuração
- Endpoint `/api/social/sync-posts` que força sincronização
- Feedback ao usuário com número de posts sincronizados
- Exibição de warnings se algo falhar

### 5. **Melhorias de Debugging**
- Endpoint `/api/debug/config` para verificar configuração salva
- Logs detalhados no servidor para diagnosticar problemas
- Extração melhorada de Instagram Business ID

---

## Arquivos alterados

### Backend
- `server.js`
  - Endpoints Meta OAuth: `/auth/meta/start`, `/auth/meta/callback`
  - Endpoint seleção página: `/api/auth/meta/select-page`
  - Endpoint debug: `/api/debug/config`
  - Função `syncMetaPostsForConfig()` — sincroniza posts
  - Remoção de Instagram Direct Login (estava quebrado)

### Frontend
- `social-monitor.html`
  - Botão "Sincronizar posts" no modal de configuração
  - Lógica JavaScript para chamar endpoint sync
  - Feedback com SweetAlert

### Novo
- `select-facebook-page.html` — página de seleção de página Facebook

### Configuração
- `.env.example` — documentação de variáveis

---

## Como funciona

### Fluxo de Conexão

```
1. User clica "Conectar com Meta (Instagram)" ou "Conectar com Meta (Facebook)"
   ↓
2. Redireciona para /auth/meta/start
   ↓
3. Meta OAuth: facebook.com/oauth?scope=...
   ↓
4. User autentica e autoriza
   ↓
5. Facebook redireciona para /auth/meta/callback?code=XXX
   ↓
6. Sistema troca code por access_token
   ↓
7. Se múltiplas páginas: mostra select-facebook-page.html
   ↓
8. User escolhe página e clica "Continuar"
   ↓
9. POST /api/auth/meta/select-page salva credenciais
   ↓
10. User vê "Conectado!" em social-monitor
```

### Fluxo de Sincronização

```
1. User abre modal de configuração do Instagram
   ↓
2. Clica "Sincronizar posts"
   ↓
3. POST /api/social/sync-posts
   ↓
4. Sistema busca posts da API Meta Graph
   ↓
5. Normaliza e salva no banco de dados
   ↓
6. Retorna número de posts sincronizados
```

---

## Variáveis de ambiente necessárias

```bash
# Meta Business App (para OAuth)
META_APP_ID=1522673759252887
META_APP_SECRET=<seu_secret>

# Banco de dados
DATABASE_URL=<sua_neon_db_url>

# Criptografia
ENCRYPTION_KEY=<chave_forte_256_bits>

# Email (opcional)
RESEND_API_KEY=<seu_resend_api_key>
AUTH_EMAIL_FROM=Wozza <no-reply@wozza.app>

# URL base
APP_URL=https://wozza.vercel.app (ou seu domínio)
```

---

## Rotas implementadas

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/auth/meta/start` | Inicia OAuth com Meta |
| GET | `/auth/meta/callback` | Callback do OAuth |
| POST | `/api/auth/meta/select-page` | Seleciona qual página conectar |
| POST | `/api/social/sync-posts` | Sincroniza posts manualmente |
| GET | `/api/oauth/status` | Status dos OAuth providers |
| GET | `/api/debug/config` | Debug: mostra config salva |
| GET | `/select-facebook-page` | Página de seleção de página |

---

## Status atual

### ✅ Funcionando

- **Autenticação OAuth** com Meta/Facebook
- **Seleção de página** Facebook (se múltiplas)
- **Salvamento de credenciais** criptografadas
- **Configuração de canais** (Direct, Comentários)
- **Auto-resposta** baseada em IA
- **Alertas** por severidade
- **Detecção de contas** (Facebook, Instagram, TikTok, LinkedIn)

### ⏳ Bloqueado (Requer publicação do app Meta)

- **Sincronização automática de posts** — falta permissão `pages_read_engagement`
- **Extração de Instagram Business ID** — API Meta não retorna quando app não publicado

### ❌ Removido

- **Instagram Direct Login** (`api.instagram.com/oauth`) — retornava erro "Invalid platform app"

---

## Próximos passos para produção

### 1. **Publicar o app Meta** (3-7 dias)
```
Dashboard Meta → Publish → Preencher formulário → Submit for App Review
```

**Campos obrigatórios:**
- Verification (verificação da empresa — pode levar 3-5 dias)
- Allowed usage (descrição de uso)
- Data handling (como você trata dados)
- Reviewer instructions (como testar)

**O que colocar no formulário:**
- **App name:** Wozza Social Monitor
- **Use case:** Gerenciar mensagens e conteúdo no Instagram/Facebook
- **Privacy Policy:** https://wozza.vercel.app/privacy-policy
- **Terms of Service:** https://wozza.vercel.app/terms-of-service
- **Data handling:** Credenciais criptografadas no banco. Não compartilhamos dados.

### 2. **Depois de aprovado**
- A sincronização de posts funcionará automaticamente
- Usuários poderão ver posts no dashboard
- Sistema estará 100% pronto para produção

---

## Testando localmente

### 1. **Conectar conta**
```
1. Ir para /social-monitor
2. Clicar "Conectar com Meta (Instagram)" ou "Conectar com Meta (Facebook)"
3. Fazer login com conta Facebook
4. Selecionar página (se múltiplas)
5. Ver "Conectado!" no dashboard
```

### 2. **Sincronizar posts**
```
1. Abrir modal de configuração do Instagram
2. Clicar "Sincronizar posts"
3. Ver feedback (pode dizer "0 posts" se app não for publicado)
```

### 3. **Debugar**
```
Acessar: /api/debug/config?school_id=wozza-default-school&platform=INSTAGRAM

Verificar se `instagram_business_id` tem valor. Se null:
- App Meta não foi publicado ainda
- Página Facebook não tem Instagram vinculado
```

---

## Arquitetura

```
┌─────────────────────────────────────┐
│         Frontend (HTML/JS)          │
│  - social-monitor.html              │
│  - Botões OAuth e Sincronização     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Backend Express (Node.js)      │
│  - /auth/meta/start & callback      │
│  - /api/auth/meta/select-page       │
│  - /api/social/sync-posts           │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼─────┐    ┌──────▼──────┐
│ Meta Graph │    │  NeonDB SQL │
│    API     │    │   Database  │
└────────────┘    └─────────────┘
```

---

## Segurança

- ✅ Credenciais criptografadas com AES-256-GCM
- ✅ Tokens armazenados como hash SHA256 no banco
- ✅ Validação de state/nonce em OAuth
- ✅ HTTPS obrigatório em produção
- ✅ HttpOnly cookies para sessão

---

## Limitações atuais

1. **Posts não sincronizam automaticamente** até app ser publicado
2. **Instagram Business ID não é extraído** enquanto app não publicado
3. **Webhook não implementado** (receber posts em tempo real)
4. **Apenas um Instagram por página** (não suporta múltiplas contas)

---

## Commits relacionados

- `be75527` — Corrige scopes Meta para OAuth Instagram Business
- `78f67bb` — Remove pages_read_engagement scope not enabled
- `122a2bf` — Adiciona Instagram Direct Login (depois removido)
- `1855852` — Corrige provider Instagram para usar endpoint direto
- `a3faf99` — Adiciona verificação de status Instagram no OAuth
- `2c3e8ac` — Adiciona seleção de página Facebook no OAuth Meta
- `2a707fd` — Adiciona botão de sincronização manual de posts
- `2023dd5` — Corrige extração do Instagram Business ID das páginas
- `61ffa8f` — Remove Instagram Direct Login que estava quebrando
- `61a6110` — Remove pages_read_engagement que não é válida para este app

---

## Testado com

- ✅ Página Facebook: Óculos Calibre
- ✅ Conta Instagram: oculos.calibre (Professional)
- ✅ Página Facebook: Fazendinha do Boo
- ✅ Chrome, Firefox, Safari
- ✅ iOS Safari (mobile)

---

## Referências

- [Meta Graph API Docs](https://developers.facebook.com/docs/graph-api/)
- [Instagram Platform Overview](https://developers.facebook.com/docs/instagram-platform/overview/)
- [Facebook Login Permissions](https://developers.facebook.com/docs/permissions/)
- [App Review & Submission](https://developers.facebook.com/docs/app-review)

---

## Próximas melhorias (após publicação)

- [ ] Webhook para receber posts em tempo real
- [ ] Suporte a múltiplas contas Instagram por página
- [ ] Agendamento de posts
- [ ] Analytics de engajamento
- [ ] Integração com TikTok (já tem estrutura)
- [ ] Integração com LinkedIn (já tem estrutura)

---

**Atualizado em:** 2026-05-04  
**Responsável:** Ricardo Franco Custódio  
**Status:** Pronto para publicação no Meta App Review
