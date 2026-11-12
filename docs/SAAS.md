# FLOWCLASS · Arquitetura SaaS em níveis

A ideia: começar como ferramenta de uma escola, mas com a fundação de um SaaS que outras empresas e agências possam comprar, sem reescrever nada no caminho. Cada nível reaproveita o anterior.

| Nível | Para quem | O que liga | Status |
|---|---|---|---|
| **1. Escola local** | Uma escola, um time | Perfis granulares, marca própria, WhatsApp oficial (1 número), Meta Ads, gamificação | ✅ Código pronto, falta publicar (ver PENDENCIAS.md) |
| **2. Várias escolas** | Redes e franquias | Cada empresa com seus números (Embedded Signup), limites por plano, consumo | ✅ Banco e telas prontos · ⏳ depende do App Meta aprovado |
| **3. Agências** | Agência que revende | Agência › clientes, marca herdada, domínio próprio, troca de cliente com 1 clique | ✅ Banco, telas e testes · ⏳ verificação de domínio e HTTPS |
| **4. Escala** | Muitas empresas e mensagens | Tabelas próprias de conversa/mensagem, caixa de entrada, filas, cobrança | 🧱 Tabelas criadas · ⏳ telas e gateway de pagamento |

## Como as peças se encaixam

```
Navegador (JS puro, sem build)                          Supabase
┌───────────────────────────────┐   RLS por empresa   ┌──────────────────────────────────┐
│ app.js  menu por perfil        │ ─────────────────▶ │ orgs (parent_id, plano, branding) │
│ auth.js my_orgs / marca        │                    │ members (10 perfis)               │
│ store.js dados + fila offline  │                    │ role_grants (perfil × coleção)    │
│ views/* telas                  │                    │ records (dados do app, jsonb)     │
│ views/saas.js plano/marca/WA   │                    │ plans · subscriptions · usage     │
└───────────────────────────────┘                    │ org_domains · wa_connections      │
          │ functions.invoke                          │ wa_credentials (só servidor)      │
          ▼                                           │ wa_events · wa_conversations/msgs │
Edge Functions (Deno)                                 └──────────────────────────────────┘
  whatsapp-connect  Embedded Signup → token cifrado → registra número
  whatsapp-webhook  assinatura Meta → descobre a empresa pelo phone_number_id → lead + mensagem
  whatsapp-send     permissão no banco → janela de 24h → envia com o número da empresa
  meta-sync         Meta Ads → campanhas e números diários
```

## Regras que não se negociam
1. **A empresa nunca vem do navegador.** Toda leitura e escrita passa pelo RLS (`can_coll`, `my_role`). Trocar o `org_id` na requisição não adianta: testado em `tests/db/isolamento.sql`.
2. **Permissão é no banco, a tela só esconde.** Atendimento não recebe investimento em anúncio nem se mexer no navegador.
3. **Token de terceiros nunca vai ao navegador nem ao modelo de IA.** Fica cifrado (AES-GCM, `WA_ENC_KEY`) em `wa_credentials`, tabela sem nenhuma política de leitura.
4. **Webhook só aceita o que a Meta assinou** (`X-Hub-Signature-256`) e processa cada evento uma vez (`wa_events`).
5. **Migrações só acrescentam.** `002_saas.sql` roda duas vezes sem efeito colateral (testado).

## Perfis
`owner` dono · `admin` · `manager` gestor · `editor` (legado) · `social` · `sales` · `support` · `analyst` · `leitura` · `client`.
O padrão de cada um está em `role_grants` (org_id nulo). Uma empresa pode ajustar o próprio (linhas com org_id dela). Gestor da agência herda acesso aos clientes; o cliente não enxerga a agência.

## Testes
- `bash tests/db/run.sh`: sobe um Postgres temporário, aplica schema + migrações (duas vezes) e roda 27 tentativas de violar isolamento e permissões.
- Suíte do app (Playwright): 80 verificações de telas e fluxos, mais o modo nuvem com Supabase simulado (perfis, marca, cartões de administração).

## Por que não trocar de stack agora
O Supabase já entrega Postgres, login, RLS, armazenamento, funções e tempo real. Migrar para NestJS/Prisma/Redis/Docker custaria meses sem nenhuma função nova para o cliente. A troca só se justifica no Nível 4, se o volume de mensagens pedir filas dedicadas; as tabelas `wa_conversations`/`wa_messages` já estão desenhadas para isso.
