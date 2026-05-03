# Páginas Legais e Portal da Privacidade

**Data:** 2026-05-03

## O que foi feito

- Reescrita completa da Política de Privacidade com conteúdo LGPD-compliant detalhado (definições, bases legais, tabelas, grid de direitos)
- Reescrita completa dos Termos de Serviço com estrutura abrangente (definições, obrigações, planos, propriedade intelectual, vigência, lei aplicável)
- Criação do **Portal da Privacidade** — nova página dedicada à transparência de dados, educação sobre LGPD e canal de solicitações dos titulares
- Footer do dashboard atualizado com links para os três documentos legais
- Rotas adicionadas no `server.js` para os três endpoints

## Arquivos alterados

- `privacy-policy.html` — reescrito completamente
- `terms-of-service.html` — reescrito completamente
- `privacy-portal.html` — criado (novo)
- `index.html` — footer com links legais adicionados
- `server.js` — 3 rotas novas

## Rotas novas

| Método | Path | Arquivo |
|--------|------|---------|
| GET | `/privacy-policy` | `privacy-policy.html` |
| GET | `/terms-of-service` | `terms-of-service.html` |
| GET | `/portal-privacidade` | `privacy-portal.html` |

## Conteúdo das páginas

### Política de Privacidade
11 seções: definições, dados coletados (cadastro, redes sociais, navegação, faturamento), finalidades, bases legais, compartilhamento, direitos dos titulares (grid de 8 cards), segurança, cookies, retenção, alterações, contato/DPO.

### Termos de Serviço
10 seções: referências, serviços (Monitor Social, IA, auto-reply), utilização, planos e pagamento, obrigações da Wozza, obrigações do usuário, propriedade intelectual, vigência/cancelamento, disposições gerais, lei aplicável (SP/BR).

### Portal da Privacidade
- Hero com CTA para direitos e formulário
- Nav sticky com scroll ativo entre seções
- Seção "Conheça a LGPD" — 6 cards educativos numerados
- Seção "Nosso compromisso" — 5 princípios + links para documentos
- Seção "Seus direitos" — grid de 8 cards de direitos LGPD
- Seção "Solicite" — formulário de solicitação (mailto)
- Seção "Fale conosco" — e-mail, política, link ANPD

## Critérios de aceite verificados

- Todas as páginas têm navbar com links entre si
- Rotas limpas (sem `.html`) funcionando via Express
- Footer do dashboard com link para Portal da Privacidade
- Design consistente (Bootstrap 4.6.2, paleta dark #1a1a2e)
- Conteúdo adaptado para o serviço da Wozza (social media monitoring)
- Conformidade com LGPD: bases legais, direitos dos titulares, DPO/contato, ANPD referenciada

## Pendências / próximos passos

- Definir e-mail definitivo de privacidade (`privacidade@wozza.app` está como placeholder)
- Formulário de solicitação usa `mailto:` — considerar backend de solicitações no futuro
- Adicionar banner de cookies se forem utilizados cookies analíticos de terceiros
