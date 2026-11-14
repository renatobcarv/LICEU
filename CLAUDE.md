# Klasso — memória do projeto

**Klasso** (antes FLOWCLASS Intelligence; o nome mudou em 14/11/2026). App próprio do Renato (não white-label por enquanto): marketing e matrículas para escolas,
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

## Marca e paleta (decididas pelo usuário — não mudar sem pedir)
- Nome **Klasso**. Logo: `assets/klasso-logo.png` (K lima+roxo com seta + "klasso" branco), símbolo `assets/klasso-mark.png`.
- **Paleta única** (Toxic Luxury foi removida a pedido): preto `#050506`, lima `#C6FF00` (`--primary`),
  roxo royal `#8B00FF` (`--royal`), branco. Superfícies neutras (`--card #0c0c10`), sem tom verde-floresta.
- Roxo = estrutura/destaque (item ativo do menu, bloco da patente). Lima = ação e detalhe (CTAs, ícone ativo, barras).
- **NUNCA ciano/azul.** Páginas públicas podem ter seções claras "branco tech".
- Sem "cara de IA": visual premium, ícones SVG (`ICON` em `js/ui.js`). `--muted` é cor de FUNDO, não de texto.
- **Mascote: águia** (visão de cima do funil). `assets/aguia.webp` (em voo, roxa, seção "Visão de águia" das vendas)
  e `assets/aguia-rosto.webp` (rosto, olho lima, painel do login/cadastro). Sem brilho verde em volta da águia (pedido do usuário);
  lima só no olho. Imagens trazidas pelo usuário; tratadas em roxo da marca.
- Chaves de localStorage continuam `flowclass.*` (não renomear: perderia dados dos usuários).

## Design system (resumo — completo em `docs/DESIGN.md`)
- Preto #050506 · lima #C6FF00 (ação/detalhe) · roxo #8B00FF (estrutura/destaque) · branco. Nunca azul/ciano.
- Linguagem "glow": fundo líquido roxo/lima + granulado, vidro com backdrop-blur, luz nascendo de baixo, ícones de vidro 3D, retícula lima, vidro canelado, anel de luz.
- Movimento: títulos palavra a palavra, cascata, contadores, cenas ligadas à rolagem, cards 3D com luz do mouse, botões magnéticos; sempre com `prefers-reduced-motion`.
- Águia: voo (`aguia.webp`), ataque (`aguia-ataque.webp`), rosto (`aguia-rosto.webp`); corpo roxo, lima só no olho, sem glow verde em volta.
- UX: tela "Hoje" por papel, menu pelo trabalho (Vender/Divulgar/Gerir/Equipe), revelar aos poucos, 1 ação principal por tela. O usuário aprovou o visual; excesso de informação é o que cansa.

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

## Números reais da TEC Mais (usar na copy, nunca arredondar/inventar)
- Campanha Injetáveis, 26/09 a 25/10/2026: **R$ 797,92** investidos, **240** conversas, **25 matrículas pagas**,
  **R$ 31,92 por matrícula paga**, **10,4%** das conversas viraram matrícula, ~30,4 mil alcançados.
- Receita registrada (R$ 2.475) parece só sinal: não prometer ROI com ela.

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

- Painel usa a mesma linguagem visual das vendas (`js/app-motion.js`: fundo líquido, cards de vidro, entrada ao rolar).
- **Pendente:** rodar `supabase/migrations/006_plano_start.sql` em produção (sem ela, quem escolhe Start cai no Essencial).
