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
