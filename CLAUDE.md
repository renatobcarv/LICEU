# FLOWCLASS Intelligence — memória do projeto

App próprio do Renato (não white-label por enquanto): marketing e matrículas para escolas,
do anúncio à matrícula. Primeiro cliente: **TEC Mais Valparaíso de Goiás**.
Produção: https://liceuinteligence.vercel.app (Vercel, deploy ao dar merge em `main`).
Fale com o usuário em **português**, tom de mentor: direto, honesto, sem bajulação.

## Stack
- JS puro em ES modules, **sem build** (`index.html` + `js/` + `css/app.css`). `npm run check` valida sintaxe.
- `js/store.js`: coleções em memória; modos `supabase` / `cloud` / `local` (sem login = localStorage).
  `store.put` carimba `criadoPor`; `store.bloqueado(coll)` impede gravação fora da área do perfil.
- Supabase projeto `kqaqccjsoqdpbnnyyemw` ("LICEU - Intelligence"). Tabela `records` (jsonb) com RLS
  por `can_coll(org, collection, 'r'|'w')` e `role_grants`. Migrações em `supabase/migrations/` (001–005).
- Edge Functions (Deno): `ia-criar` (Claude, structured output), `meta-sync`, `whatsapp-webhook`,
  `whatsapp-send`, `whatsapp-connect`; helpers em `_shared/wa.ts` (AES-GCM com `WA_ENC_KEY`).
- `js/config.js`: `WHITELABEL=false`.

## Paleta (decidida pelo usuário — não mudar sem pedir)
- Padrão **Acid Royal** (`data-paleta="acid"`): fundo `#060706` (black profundo), lima ácido `#C6FF00`,
  roxo royal `#8B00FF` (`--royal`), verde escuro `#142D16`. Texto escuro sobre lima: `--primary-foreground`.
- Alternativa **Toxic Luxury** (`toxic`): `#070908`, `#A3FF12`, `#7B2CBF`, `#102B20`.
- Definidas em `js/brand.js` (`PALETAS`) e variáveis CSS em `css/app.css`.
- **NUNCA ciano/azul** ("esse ciano nada haver"). `--grad-aurora` = lima → royal.
- Páginas públicas (vendas, planos) podem ter seções claras "branco tech" — o usuário gostou.
- Sem "cara de IA": visual premium, ícones SVG (`ICON` em `js/ui.js`), gráficos limpos, emojis com moderação.
- Use sempre os tokens (`--primary`, `--royal`, `--foreground`, `--muted-foreground`, `--card`, `--bg`).
  Atenção: `--muted` é cor de FUNDO, não de texto.

## Produto (módulos)
Painel, Meta Ads, Campanhas, Funil (WhatsApp + modo ligação), Matrículas, Meu Arsenal,
Pauta Viral (brainstorm, editor modo facilitado/avançado, IA), Calendário (prévia visual do post),
Metas, Relatórios, Time (quadro gamificado + insígnias), Chat, Configurações (abas).
- **Jogo** (`js/game.js`, `js/criador.js`): XP só de registro real; 11 patentes; missões do dia;
  sequência. **Individual por pessoa** com login (leads do responsável, pautas que criou,
  coleção `jogo` com id = usuário).
- **Convites** (`invites`, RPCs `create_invite`/`invite_info`/`accept_invite`): link `?convite=CODE`,
  boas-vindas, cadastro, aceite, depois **quiz de perfil** (`js/perfil.js`, 6 perguntas).
- O usuário chama de **"missões"**, nunca "quests".
- **Acesso**: todo o time VÊ tudo; cada perfil EDITA só a sua área (`js/access.js`: `ESCREVE`, `AREA`,
  `soVer`). Social → Pauta/Calendário; Vendas → Funil/Matrículas/Time; Atendimento → Funil/WhatsApp;
  **Coordenador** (`manager`) e Admin/Dono editam tudo. Cliente só vê relatórios/metas/calendário.
- Teste grátis de 7 dias; planos Escola/Rede/Agência (tabela `plans`).

## Regras de segurança (sempre)
- Nunca colar tokens/senhas no chat. Chaves só em **Supabase secrets**, nunca no repo/frontend.
- Nunca `service_role`/`sb_secret_` no frontend.
- Supabase PAT existe só como credencial injetada pelo proxy (ambiente "LICEU"); nunca imprimir.
- Mudanças em banco de produção: pedir confirmação ao usuário.
- Sem identificador de modelo em commits/PRs.

## Fluxo de trabalho
- Branch `claude/affectionate-newton-ifv15k` → PR → merge squash em `main` → ressincronizar branch.
- Antes de push: `npm run check`, testes Playwright (QA local com Supabase falso), screenshots 1440 e 390.
- Testes de banco: `tests/db/isolamento.sql`.
- Migração nova em produção: o usuário roda no SQL Editor do Supabase (ou autoriza), e só então merge.
- Docs: `docs/` (ARQUITETURA, DESIGN, SAAS, WHATSAPP, IA, PENDENCIAS, ROADMAP).

## Estado (14/11/2026)
- Migrações 001–004 aplicadas em produção; `ia-criar` ativa com `ANTHROPIC_API_KEY`.
- PR #29 (jogo individual + acesso por área) aguarda a migração **005_ver_tudo.sql** em produção.
