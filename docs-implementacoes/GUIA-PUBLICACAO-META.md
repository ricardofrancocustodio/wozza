# Guia: Publicar App Meta para Produção

**Objetivo:** Liberar permissões para sincronizar posts de Instagram/Facebook  
**Tempo estimado:** 3-7 dias (dependendo da verificação Meta)  
**Status:** Pronto para executar

---

## Pré-requisitos

- ✅ App Meta criado (wozza-app)
- ✅ Use case configurado ("Manage messaging & content on Instagram")
- ✅ Credenciais Meta App ID e Secret
- ✅ Página Facebook com Instagram vinculado
- ✅ URLs HTTPS configuradas (Privacy Policy, Terms of Service)

---

## Passo a Passo

### **Passo 1: Preencher informações obrigatórias**

1. Acesse: https://developers.facebook.com/apps
2. Abra o app **"wozza-app"**
3. Vá em **Settings > Basic**
4. Preencha/verifique:

| Campo | Valor |
|-------|-------|
| **Display name** | Wozza Social Monitor |
| **App domains** | wozza.vercel.app |
| **Privacy Policy URL** | https://wozza.vercel.app/privacy-policy |
| **Terms of Service URL** | https://wozza.vercel.app/terms-of-service |
| **Category** | Utility & Productivity |
| **Contact email** | desenvolvedor.ricardo@gmail.com |

5. Clique **"Save Changes"**

---

### **Passo 2: Fazer verificação da empresa (3-5 dias)**

1. Na mesma página de Settings, procure por **"Verification"**
2. Clique em **"Go to verification"**
3. Escolha seu tipo de negócio:
   - Se for freelancer/pessoa física: **"Individual"**
   - Se for empresa: **"Company/Organization"**
4. Preencha informações:
   - Nome
   - Email
   - Telefone
   - Endereço
5. Meta vai verificar (pode levar 3-5 dias)
6. Você receberá email quando aprovado

**Importante:** Sem essa verificação, não consegue publicar!

---

### **Passo 3: Preencher "Allowed usage"**

1. Vá em **Publish > Submit for App Review**
2. Clique na seção **"Allowed usage"** (se não estiver expandida)
3. Responda as perguntas sobre como seu app usa os dados:

**Exemplo de resposta:**
```
"Wozza Social Monitor permite que usuários conectem suas contas
do Instagram e Facebook para monitorar e responder mensagens,
comentários e gerenciar conteúdo. Os dados são usados apenas
para essa finalidade e armazenados com criptografia."
```

4. Clique **"Save"**

---

### **Passo 4: Preencher "Data handling"**

1. Na mesma página, clique em **"Data handling"**
2. Responda sobre como você trata dados:

**Exemplo:**
```
✓ Você coleta dados de usuários finais? SIM
✓ Os dados são criptografados? SIM (AES-256-GCM)
✓ Você compartilha dados com terceiros? NÃO
✓ Você deleta dados quando solicitado? SIM
✓ Você tem uma política de privacidade? SIM
  (https://wozza.vercel.app/privacy-policy)
```

3. Clique **"Save"**

---

### **Passo 5: Preencher "Reviewer instructions"** ⚠️ IMPORTANTE

1. Clique em **"Reviewer instructions"** (pode dizer "Needs your review")
2. Preencha com instruções passo a passo de como testar:

**Exemplo:**
```
INSTRUÇÕES PARA O REVISOR TESTAR O APP:

1. Acesse: https://wozza.vercel.app/social-monitor
2. Clique em "Conectar com Meta (Instagram)"
3. Faça login com uma conta Facebook que tenha permissão
   em uma página com Instagram Business vinculado
4. Selecione a página e clique "Continuar"
5. Você verá a página conectada com status "CONECTADO"
6. Abra o modal de configuração e clique "Sincronizar posts"
7. O sistema buscará posts do Instagram/Facebook
8. Se houver posts, eles aparecerão no dashboard

PERMISSÕES NECESSÁRIAS:
- instagram_basic: leitura básica do Instagram
- instagram_manage_comments: gerenciar comentários
- pages_show_list: listar páginas do usuário
- business_management: gerenciar negócios

DADOS COLETADOS:
- Access token (criptografado no banco)
- Informações da página (ID, nome)
- Posts (apenas título, descrição, mídia)
- Comentários (para monitoramento)

PRIVACIDADE:
- Credenciais são criptografadas com AES-256-GCM
- Dados não são compartilhados com terceiros
- Usuários podem desconectar a qualquer momento
```

3. Clique **"Save"**

---

### **Passo 6: Revisar tudo**

1. Vá em **Publish > Submit for App Review**
2. Verifique todas as seções:
   - ✅ App settings (verde)
   - ✅ Verification (completa? Aguarde email)
   - ⭕ Allowed usage (preenchido)
   - ⭕ Data handling (preenchido)
   - ⭕ Reviewer instructions (preenchido)

---

### **Passo 7: Enviar para revisão**

1. Se tudo estiver verde/amarelo, clique **"Submit for App Review"**
2. Aceite os termos do Meta
3. Clique **"Submit"**

**Status esperado:** "Pending Review" (pode levar 3-7 dias)

---

## O que esperar depois de enviar

### **Cenário 1: Aprovado** ✅
- Meta envia email: "Your app has been approved"
- Sincronização de posts passa a funcionar
- Clientes podem usar a plataforma normalmente

### **Cenário 2: Rejeitado** ❌
- Meta envia email: "Your app submission was rejected"
- Motivo: falta de permissão, dados incompletos, etc.
- **Solução:** Corrigir e reenviar

### **Cenário 3: Mais informações** ⚠️
- Meta pede mais detalhes
- **Solução:** Responder com evidências (screenshots, vídeo, etc.)

---

## Se for rejeitado (common reasons)

| Erro | Solução |
|------|---------|
| "Incomplete verification" | Aguarde email de verificação da Meta |
| "Vague use case description" | Seja mais específico no "Reviewer instructions" |
| "Privacy policy outdated" | Atualize a URL ou crie uma nova |
| "Cannot test the app" | Forneça credenciais de teste ou link funcional |

**Se rejeitar:** Clique "Appeal" ou "Resubmit" após corrigir.

---

## Timeline esperada

```
Dia 1: Você envia para App Review
       ↓
Dias 1-3: Meta verifica sua verificação de empresa
         ↓
Dias 3-5: Meta revisa seu app (Reviewer instructions importantíssimo)
         ↓
Dia 5-7: Aprovado ou com feedback
```

---

## Checklist final

Antes de clicar "Submit for App Review":

- [ ] Display name preenchido
- [ ] App domains configurado
- [ ] Privacy Policy URL válida e HTTPS
- [ ] Terms of Service URL válida e HTTPS
- [ ] Contact email correto
- [ ] Verification completa ou em andamento
- [ ] Allowed usage preenchido (mínimo 50 caracteres)
- [ ] Data handling respondido (todas as perguntas)
- [ ] Reviewer instructions com passo a passo claro
- [ ] Use case "Manage messaging & content on Instagram" adicionado
- [ ] Você fez login em https://wozza.vercel.app e viu "Conectado"

---

## Contato Meta durante revisão

Se Meta pedir mais informações:

1. Responda rápido (no máximo 48h)
2. Seja específico e inclua screenshots/vídeos
3. Forneça acesso de teste se pedirem
4. **Não minta** sobre o que seu app faz

---

## Depois que for aprovado

1. **Teste a sincronização:**
   - Conecte uma conta
   - Clique "Sincronizar posts"
   - Verifique se posts aparecem

2. **Comunique aos clientes:**
   - "Sincronização de posts agora disponível!"
   - Instruções de como usar

3. **Monitore:**
   - Erros no servidor
   - Feedback de clientes
   - Performance

---

## Suporte Meta

Se tiver dúvidas durante o processo:
- Email: da Meta Developer Support
- Forum: https://developers.facebook.com/community/
- Docs: https://developers.facebook.com/docs/app-review

---

**Última atualização:** 2026-05-04  
**Status:** Pronto para enviar  
**Tempo estimado até produção:** 5-10 dias
