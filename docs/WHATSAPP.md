# WhatsApp oficial na Klasso

## Por que a API oficial (Cloud API da Meta)
- **Risco de banimento.** As reclamações de número banido no Reclame Aqui subiram 152% em 2026 (jan–ago). A maioria vem de ferramentas que simulam o WhatsApp Web (Baileys, extensões, disparadores). Banimento permanente quase nunca é revertido.
- **Rastreio do anúncio.** Só a API oficial entrega o `referral` do anúncio de clique para WhatsApp (`ctwa_clid`, nome do anúncio). É isso que liga lead → anúncio → matrícula e fecha o CAC real.
- **Custo (Brasil, 2026, confirmar na tabela da Meta).** Responder dentro de 24h desde a última mensagem do cliente é grátis. Modelo de marketing fica em torno de US$ 0,06–0,07 por mensagem; utilidade, cerca de US$ 0,007–0,008. Provedores (BSP) cobram a mensalidade deles por cima.

## O que o mercado oferece
| Plataforma | Tipo | O que o pessoal gosta | O que reclama |
|---|---|---|---|
| Convergefy | CRM de WhatsApp, API oficial (parceira Meta) | Lead do anúncio cai direto com origem; vários atendentes no mesmo número; chatbot sem código | Planos por número de atendentes e conexões; poucas avaliações independentes |
| Kommo | CRM de vendas em volta do WhatsApp | Funil visual, Salesbot | Preço por usuário (em dólar), suporte lento para conectar número oficial |
| Huggy, Octadesk, Digisac | Central de atendimento | Multiatendente, filas | Reclamações de suporte e instabilidade (Huggy) |
| Z-API, Evolution API (modo WhatsApp Web) | API não oficial | Barato, fácil | Risco alto de banimento, sem `ctwa_clid` |
| Chatwoot | Open source | Gratuito, omnichannel | Exige servidor e manutenção |

**Escolha da Klasso:** conectar direto na Cloud API (sem mensalidade de terceiro). Quem já usa Convergefy ou Kommo pode continuar lá; aí o caminho é importar os negócios pela planilha (Funil › Importar) ou integrar por webhook do provedor.

## O que já funciona no app
- Mensagem nova de número desconhecido **cria o lead** no Funil (origem "Meta Ads" quando veio de anúncio, com nome do anúncio).
- Botão **WhatsApp** no cartão abre a conversa dentro do app: histórico, respostas prontas em um toque, enviado/entregue/lido.
- Fora da janela de 24h o app avisa e só deixa enviar **modelo aprovado**.
- Cada mensagem enviada conta como contato do lead (tempo de primeira resposta, missões e XP).

## Conexão assistida (MVP, antes da aprovação de Tech Provider)
Enquanto a Meta não aprova o Klasso para o cadastro em um clique, o time Klasso conecta o número de cada escola:
1. **Secrets no Supabase** (Edge Functions › Secrets), uma vez só:
   - `WA_ENC_KEY`: gere com `openssl rand -base64 32` (cifra dos tokens).
   - `WA_VERIFY_TOKEN`: uma senha longa que você inventa (verificação do webhook).
   - `WA_APP_SECRET`: App da Meta › Configurações › Básico › Chave secreta (confere a assinatura de cada mensagem).
   - `PLATFORM_ADMINS`: e-mails do time Klasso separados por vírgula (só eles usam a conexão assistida).
   - Opcional `WA_PIN`: 6 dígitos para registrar números.
2. **Publicar as funções**: `whatsapp-connect`, `whatsapp-send` e `whatsapp-webhook` (esta com `--no-verify-jwt`).
3. **Webhook no app da Meta**: URL `https://kqaqccjsoqdpbnnyyemw.supabase.co/functions/v1/whatsapp-webhook`, token = `WA_VERIFY_TOKEN`, assinar **messages**.
4. **Para cada escola**: no Gerenciador de Negócios, adicione o número à conta WhatsApp (WABA) e dê acesso ao usuário do sistema. Depois, logado no Klasso **na empresa da escola**, vá em Configurações › Integrações › **Conexão assistida** e informe WABA, ID do número e o token permanente. A função valida na Meta, inscreve o webhook, registra o número e grava o token cifrado. O funil passa a usar o WhatsApp oficial sozinho.

## Como ligar (uma vez)
1. Em business.facebook.com crie um **App** (tipo Business) e adicione o produto **WhatsApp**. Registre o número da escola (ele sai do app comum do WhatsApp).
2. Gere um **token permanente** de usuário do sistema com `whatsapp_business_messaging` e `whatsapp_business_management`.
3. No Supabase, em Edge Functions › Secrets, cadastre: `WA_TOKEN`, `WA_PHONE_ID` (ID do número), `WA_APP_SECRET` (App › Configurações › Básico), `WA_VERIFY_TOKEN` (uma senha que você inventa) e `ORG_ID`. **Nunca cole tokens no chat nem no código.**
4. Publique as funções:
   ```
   npx supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref kqaqccjsoqdpbnnyyemw
   npx supabase functions deploy whatsapp-send --project-ref kqaqccjsoqdpbnnyyemw
   ```
5. No app da Meta › WhatsApp › Configuração › Webhook: URL `https://kqaqccjsoqdpbnnyyemw.supabase.co/functions/v1/whatsapp-webhook`, token de verificação = `WA_VERIFY_TOKEN`. Assine o campo **messages**.
6. Na Klasso, Configurações › Integrações › marque **WhatsApp oficial**.

## Próximos passos
- Modelos aprovados com variáveis (nome, curso) e disparo de retomada para reservas paradas.
- Caixa de entrada única (todas as conversas sem resposta) com distribuição por consultor.
- Chatbot de triagem (curso de interesse, horário, cidade) antes de chegar no closer.

## Conexão por QR Code (não oficial, opcional)

Ao lado da API oficial, em Configurações › Integrações. Só dono/admin; exige aceite explícito do risco
(gravado em `wa_connections.aceite_risco_em`).

**Riscos (ditos ao cliente):** a Meta pode bloquear o número; o lead chega sem o anúncio de origem (`ctwa_clid`),
então o custo por matrícula fica menos preciso; não há modelos aprovados (só texto). Recomendar número secundário.

**Peças**
- Migração `007_whatsapp_qr.sql` (colunas `tipo`, `instancia`, `aceite_risco_em`).
- `wa-qr`: ações `conectar` (cria instância + QR), `qr`, `status`, `desconectar`.
- `wa-qr-webhook` (sem JWT): autentica por `?k=EVO_WEBHOOK_TOKEN`; cria lead e grava `wamsg` (entrada e o que foi enviado pelo celular).
- `whatsapp-send`: quando a conexão é `tipo='qr'`, envia pela Evolution (sem a regra das 24h, que é da API oficial).

**Leads que chegaram com o servidor fora do ar (recuperação automática)**
- Quando o servidor volta, o celular reenvia as mensagens pendentes e o webhook as recebe normalmente.
- Além disso, ao reconectar (`CONNECTION_UPDATE` = open), o `wa-qr-webhook` busca no servidor tudo desde `ultima_sync`
  (folga de 10 min) e grava o que faltou. Duplicadas são ignoradas (`wa_events`).
- O painel confere sozinho ao abrir Integrações e tem o botão **Buscar conversas perdidas**.
- Para isso a Evolution precisa guardar mensagens: rodar **com Postgres**.

**Servidor Evolution API** (no seu PC com Docker Desktop, ou VPS de ~R$ 30–60/mês). `docker-compose.yml`:
```yaml
services:
  evolution:
    image: atendai/evolution-api:v2.2.3
    restart: always
    ports: ["8080:8080"]
    environment:
      AUTHENTICATION_API_KEY: ${EVO_KEY}   # senha forte num arquivo .env ao lado (nunca no Git)
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://evo:${PG_PASS}@db:5432/evolution
      DATABASE_SAVE_DATA_NEW_MESSAGE: "true"
      CACHE_LOCAL_ENABLED: "true"
    volumes: [evolution_instances:/evolution/instances]
    depends_on: [db]
  db:
    image: postgres:16-alpine
    restart: always
    environment: { POSTGRES_USER: evo, POSTGRES_PASSWORD: "${PG_PASS}", POSTGRES_DB: evolution }
    volumes: [pg:/var/lib/postgresql/data]
volumes: { evolution_instances: {}, pg: {} }
```
`docker compose up -d`. HTTPS público: Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8080`; para endereço
fixo, túnel nomeado com domínio). No PC: Docker Desktop iniciando com o sistema e suspensão desligada.

**Segredos no Supabase** (nunca no repositório nem no chat):
- `EVO_URL` = `https://wa.seudominio.com.br`
- `EVO_KEY` = a `AUTHENTICATION_API_KEY` do servidor
- `EVO_WEBHOOK_TOKEN` = `openssl rand -hex 24`

**Deploy**
```bash
npx supabase functions deploy wa-qr --project-ref kqaqccjsoqdpbnnyyemw
npx supabase functions deploy wa-qr-webhook --no-verify-jwt --project-ref kqaqccjsoqdpbnnyyemw
npx supabase functions deploy whatsapp-send --project-ref kqaqccjsoqdpbnnyyemw
```
