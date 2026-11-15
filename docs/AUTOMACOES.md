# Automações (construtor de fluxos)

Gatilho → passos (com ramos), no espírito do n8n, já ligado ao WhatsApp, ao Funil e aos leads.
Tela: **Vender › Automações** (`js/views/automacoes.js`). Edita: dono, admin e coordenador; o resto do time vê e testa.

## Peças
- `supabase/functions/_shared/motor.js`: motor puro; o mesmo arquivo roda no servidor e no simulador.
- `_shared/automacao.ts`: carrega fluxos e regras, estado por lead (`autoexec`), envio, IA, HTTP seguro, rodízio.
- `_shared/enviar.ts`: envio (oficial ou QR) com opt-out, janela de 24h e registro em `wamsg`.
- `_shared/ia-bot.ts`: atendente com IA (saída estruturada, limites fixos, base da escola + cursos).
- `whatsapp-webhook` e `wa-qr-webhook`: ao receber mensagem, rodam as automações em segundo plano.
- `automacao-tick`: relógio a cada minuto (pg_cron, migração 008).
- `automacao-entrada`: webhook de entrada (site, formulário, n8n, Zapier).
- `automacao-ia`: IA para o simulador.

Gatilhos: primeira mensagem, palavra-chave, qualquer mensagem, parou de responder, parado na etapa, agendado, webhook.
Passos: mensagem, menu, perguntar e salvar, IA, esperar, condição, humano, encerrar, mover no funil, responsável
(rodízio), etiqueta, campo, tarefa, avisar o time, chamada HTTP.

## Para ligar em produção
1. `select vault.create_secret('<token>', 'automacao_token');` e depois rodar `008_automacoes.sql`.
2. Segredo `AUTOMACAO_TOKEN` (mesmo valor) no Supabase.
3. Deploy: `automacao-tick` e `automacao-entrada` com `--no-verify-jwt`; `automacao-ia`; e de novo `whatsapp-webhook`, `wa-qr-webhook`, `whatsapp-send`.
