# IA na criação de conteúdo

## O que já funciona
- **Ideias com IA** (Pauta Viral › Brainstorm): o Claude sugere ideias por curso e tema; você marca quais entram no brainstorm.
- **Roteiro com IA** (prévia da ideia): gancho, cenas com fala e texto na tela, legenda, hashtags e CTA. "Salvar roteiro na pauta" guarda o texto e a pauta passa a "Briefing pronto".
- **Aprende com a casa:** cada pedido leva junto os posts publicados que mais geraram conversa e alcance (resultado preenchido no Calendário) e as ideias mais votadas pelo time. Quanto mais vocês registram resultado, mais a IA escreve no estilo que funciona na escola.
- **Regras fixas:** português do Brasil, nada de preço, desconto, depoimento, salário ou resultado inventado (vira `[inserir dado]`).
- **Modo demonstração** (sem conta): usa o banco de ganchos local e avisa que não é IA.

## Como ligar (uma vez) · você
1. console.anthropic.com: criar uma chave de API e definir um **limite de gasto mensal**.
2. Supabase › Edge Functions › Secrets: `ANTHROPIC_API_KEY`. Nunca no chat nem no código.
3. Publicar: `npx supabase functions deploy ia-criar --project-ref kqaqccjsoqdpbnnyyemw`.

## Segurança e custo
- A chave fica só no servidor; o navegador chama a função `ia-criar`.
- Só quem pode gravar pautas na escola usa a IA (regra do banco).
- Cada pedido consome 1 do limite mensal do plano (Escola 500, Rede 5.000, Grupo 30.000), contado em `usage_records`.
- Modelo: Claude Opus 5.5 com esforço médio e resposta em formato fixo (schema). Se o modelo recusar por política, a própria API refaz no modelo de reserva (`fallbacks: "default"`).

## Próximas ferramentas (catálogo em Configurações › Integrações)
O botão "Quero usar" grava o interesse da escola (`settings.iaInteresse`) para priorizar a fila. Nenhuma delas está conectada ainda:
| Ferramenta | Para quê | Antes de construir |
|---|---|---|
| Higgsfield | Vídeo curto a partir do roteiro | Confirmar API pública, preço por vídeo e direitos de uso comercial |
| Geração de imagem | Capa de Reels e slides | Escolher provedor; guardar no Storage, nunca no banco |
| Voz (ex.: ElevenLabs) | Narração do roteiro em português | Consentimento para voz clonada; custo por minuto |
| Canva | Carrossel no modelo da marca | App Canva Connect e OAuth da escola |
| Servidores MCP | Ligar Drive, Notion, CRM ao assistente | Ferramentas controladas por escola; tokens só no servidor |
