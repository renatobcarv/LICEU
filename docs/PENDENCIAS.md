# Pendências para colocar tudo no ar

O código está pronto e testado. O que falta depende de contas, aprovações e chaves que só você (dono da empresa) pode criar. **Nenhum token vai no chat nem no código**: todos entram em Supabase › Project Settings › Edge Functions › Secrets.

## 1. Banco (5 minutos) · você
- [ ] Supabase › SQL Editor: rodar `supabase/schema.sql` (se ainda não rodou) e depois **`supabase/migrations/002_saas.sql`**.
- [ ] Conferir em Table Editor que existem `plans`, `wa_connections`, `org_domains`.
- [ ] Se for agência: `update orgs set tipo = 'agencia', plano = 'agencia' where nome = '<sua empresa>';` (a plataforma define o plano; não há cobrança ligada).

## 2. Chave de cifra dos tokens (2 minutos) · você
- [ ] Gerar 32 bytes aleatórios em base64 (no terminal: `openssl rand -base64 32`) e salvar como segredo **`WA_ENC_KEY`**. Guarde uma cópia segura: sem ela os tokens salvos não abrem.

## 3. WhatsApp da escola, número único (1 a 3 dias) · você
Serve para começar já, sem esperar a aprovação do Embedded Signup.
- [ ] business.facebook.com: verificar a empresa (CNPJ, documento, site). Prazo da Meta: de horas a alguns dias.
- [ ] developers.facebook.com: criar App tipo **Business**, adicionar o produto **WhatsApp**, registrar o número da escola.
- [ ] Criar **Usuário do sistema** com token permanente (`whatsapp_business_messaging`, `whatsapp_business_management`).
- [ ] Segredos: `WA_TOKEN`, `WA_PHONE_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` (você inventa), `ORG_ID` (id da sua empresa na tabela `orgs`).
- [ ] Publicar: `npx supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref kqaqccjsoqdpbnnyyemw` e `npx supabase functions deploy whatsapp-send --project-ref kqaqccjsoqdpbnnyyemw`.
- [ ] No App da Meta › WhatsApp › Configuração: webhook `https://kqaqccjsoqdpbnnyyemw.supabase.co/functions/v1/whatsapp-webhook`, token = `WA_VERIFY_TOKEN`, assinar **messages**.
- [ ] No app: Configurações › Integrações › marcar **WhatsApp oficial**.
- [ ] Teste: mandar "oi" de outro celular → o lead aparece no Funil; responder pelo botão WhatsApp do cartão.

## 4. WhatsApp para clientes conectarem sozinhos: Embedded Signup (2 a 6 semanas) · você + Meta
- [ ] Ser **Tech Provider** (ou parceiro) da Meta no App Dashboard.
- [ ] App Review com **Advanced Access** em `whatsapp_business_management` e `whatsapp_business_messaging` (a Meta pede vídeo do fluxo e política de privacidade publicada).
- [ ] Criar a configuração de **Facebook Login for Business** com o modo WhatsApp Embedded Signup e copiar o **Configuration ID**.
- [ ] `js/config.js`: preencher `META_APP_ID` e `WA_CONFIG_ID` (são públicos).
- [ ] Segredos: `META_APP_ID`, `META_APP_SECRET`, `WA_PIN` (6 dígitos para registrar números).
- [ ] Publicar: `npx supabase functions deploy whatsapp-connect --project-ref kqaqccjsoqdpbnnyyemw`.
- [ ] Adicionar o domínio do app em App › Configurações › Domínios permitidos do SDK JavaScript.
- [ ] Até a aprovação: testar com números de teste e usuários que tenham papel no App.

## 5. Meta Ads automático · você
- [ ] Segredos `META_TOKEN` (ads_read) e `META_ACCOUNT_ID`; publicar `meta-sync`; ligar em Configurações › Integrações. Passo a passo: `docs/META-SYNC.md`.

## 6. White-label com domínio próprio · você + DNS do cliente
- [ ] Ter o domínio da plataforma (ex.: `flowclass.com.br`) apontado para a Vercel, com `*.flowclass.com.br` (wildcard) no projeto para subdomínios de clientes.
- [ ] Para domínio do cliente: adicionar o domínio no projeto da Vercel (ela emite o HTTPS) e o cliente cria `CNAME` + `TXT _flowclass` mostrados na tela.
- [ ] **Falta construir**: a função que confere o TXT e marca `verificado` (hoje é manual: `update org_domains set verificado = true, verificado_em = now() where host = '...'`).

## 7. Claude no atendimento (próximo ciclo) · você
- [ ] Chave da API da Anthropic como segredo `ANTHROPIC_API_KEY` (console.anthropic.com). Definir limite de gasto mensal no console.
- [ ] Decidir o modo inicial: **copiloto** (sugere, humano envia). Recomendado começar assim.

## 8. Cobrança (quando for vender)
- [ ] Escolher gateway (Stripe, Asaas, Pagar.me, Mercado Pago). A estrutura `subscriptions` já tem `gateway` e `gateway_ref`.
- [ ] CNPJ com CNAE de software, contrato de uso e política de privacidade revisados por advogado (LGPD: você vira operador dos dados dos clientes).

## O que ainda é construção minha (sem depender de você)
1. Verificação automática de domínio (TXT) e aviso de HTTPS.
2. Caixa de entrada em 3 colunas usando `wa_conversations`/`wa_messages`, com atendente, filas e notas internas.
3. Assistente Claude por empresa (copiloto → assistido → automático) com limite de consumo em `usage_records`.
4. Automações (gatilho → condição → ação) começando por: lead sem resposta em X minutos, reserva parada, opt-out.
5. Reformulação dos Relatórios e do Funil (gráficos, velocidade, previsão).
6. Painel do dono da plataforma (todas as empresas, planos e consumo).
