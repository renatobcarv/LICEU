# Design do LICEU Intelligence

O app segue a estrutura do modelo **Gateway System**, um design system de painel de pagamentos, com a identidade do LICEU: ouro como cor de marca, fonte Fustat e o logotipo da coluna. Tudo está em `css/app.css`. Este guia é a regra para qualquer tela ou componente novo.

Referência visual: https://claude.ai/artifact/8EZK22DY94scZVebE8dTmk

## Princípios

1. **Ouro é ação e dinheiro.** `--primary` aparece só no botão principal, no item ativo do menu, em valores de dinheiro em destaque e nos gráficos. Se tudo é dourado, nada se destaca.
2. **Hierarquia por luz, nunca por sombra.** As camadas são `--background` → `--card` → `--surface` → `--muted`, com borda de 1px (`--border`). Não existe `box-shadow` no sistema.
3. **Uma ação principal por tela** (`.btn.primary`), no topo à direita do conteúdo. As outras ações usam `.btn` (contorno) ou `.btn.ghost`.
4. **O raio segue o tamanho:**

   | Raio | Onde |
   | --- | --- |
   | 8 | Itens pequenos e de menu |
   | 12 | Inputs |
   | 16 | Cards internos |
   | 32 | Sidebar e card mestre |
   | Pílula | Botões, filtros e badges |

5. **O número é o protagonista.** KPI com rótulo 14/600 em `--muted-foreground` e valor grande em 700 `--heading-strong`.
6. **Previsibilidade.** Toda página tem o mesmo molde.

## Molde de página

```
Sidebar (card, raio 32, 264px)   │  Breadcrumb (kicker /) e título 24/600 · filtros de período e curso
  Logo                           │  ┌ Card mestre <main> (card, raio 32, padding 24) ─────────────┐
  Grupos do menu                 │  │ [abas sublinhadas ou filtros em pílula]      [ação primária] │
  Item ativo = bloco ouro sólido │  │ KPIs                                                        │
  Unidade · status               │  │ Cards internos (borda 1px, raio 16) · tabelas · estado vazio │
                                 │  └─────────────────────────────────────────────────────────────┘
```

Cada view devolve só o conteúdo do card mestre. A casca (`index.html` e `js/app.js`) monta o resto.

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | #0d0f12 | Fundo da aplicação; colunas do Kanban |
| `--card` | #1a1d24 | Sidebar, card mestre, diálogos, cartões de lead |
| `--surface` | #21252e | Inputs, painéis internos, estado vazio |
| `--muted` | #272c37 | Hover, badge neutro, trilho de barras. **É fundo, não texto** |
| `--border` | #333947 | Toda borda (1px) |
| `--foreground` | #f4f5f7 | Texto principal |
| `--heading` / `--heading-strong` | #f1ece2 / #fff | Títulos / valores e aba ativa |
| `--muted-foreground` | #a3acba | Rótulos, menu inativo, texto de apoio |
| `--subtle-foreground` | #8b95a6 | Metadados, placeholders |
| `--primary` | #e3b35f | Marca: CTA, item ativo, gráficos |
| `--primary-foreground` | #241a06 | Texto sobre o ouro |
| `--brand-deep` | #f0c677 | Links, filtro ativo, acento secundário |
| `--success` / `--delta-positive` | #5fd38a / #7bd44a | Ganho, meta atingida, variação boa |
| `--destructive` | #ff6b5e | Erro, perda, variação ruim |
| `--*-subtle` + `--*-foreground` | | Fundo e texto de badges e avisos (success, warning, destructive, info) |
| `--chart-1..4` | ouro, laranja, verde, cinza | Séries de gráfico, nessa ordem |

A escala de espaço é `--space-1/2/3/4/6/8` (4 a 32px). A de raio é `--radius-sm/md/lg/xl/2xl/pill`. As transições são `--t-fast` (150ms, abas e bordas) e `--t-base` (300ms, botões), e só mudam cor e borda: nada de deslizar, quicar ou girar.

O tema claro já existe só como troca de tokens (`<html data-theme="light">`). Componente nenhum usa cor literal; por isso os dois temas funcionam.

## Tipografia

Uma família só: **Fustat** (Google Fonts). Cinzel fica só no logotipo e Geist Mono só no briefing da Pauta.

| Estilo | Tamanho/linha | Peso |
| --- | --- | --- |
| Valor de KPI | 40/52 (24 no compacto) | 700 |
| Título de página (`h1`) | 24/32 | 600 |
| Título de card (`h2`) | 20/28 | 600 |
| Corpo, botão | 15–16/24 | 400 / 600 |
| Rótulo | 14/20 | 600 |
| Legenda | 12/18 | 400 |

Não use `font-variant-numeric: tabular-nums`: na Fustat esse recurso também alarga o espaço entre as palavras.

## Componentes (classes prontas)

| Componente | Classe | Regra |
| --- | --- | --- |
| Botão | `.btn`, `.btn.primary`, `.btn.sm`, `.btn.ghost`, `.btn.danger`, `.btn.win` | Pílula de 48px (36 no `.sm`). Só um `.primary` por tela |
| Botão de ícone | `.icon-btn`, `.icon-btn.sm` | Redondo, com borda |
| Abas | `.tabs` > `.tab[aria-selected]` | Sublinhadas; a ativa tem sublinhado ouro de 2px |
| Filtro | `.chip`, `.seg-b`, `.pipe-tab`, `.chip-radio` | Pílula de 38px; a ativa usa ouro a 12% e texto `--brand-deep` |
| Badge | `.badge` + `.good` `.bad` `.warn` `.info` | Mini pílula semântica |
| Card | `.card` + `.card-head` | Borda de 1px, raio 16, sem fundo próprio |
| KPI | `.kpis` > `.kpi` > `h3` + `.kpi-v` + `.kpi-d` | `.kpis.compact` para fileiras de 4 a 8 |
| Estado vazio | `empty(título, texto)` em `js/ui.js` | O texto fala do ganho, não da falta |
| Tabela | `.table-wrap` > `.tbl` | Sempre dentro de `.table-wrap` (rolagem no celular) |
| Formulário | `openDialog({ fields })` em `js/ui.js` | Use `{ type: 'section' }` para separar grupos |
| Kanban | `.board` > `.col` > `.lead` | Colunas em `--background`, cartões em `--card` |

## Voz

- Português coloquial, em segunda pessoa: "Você ainda não tem matrículas neste período".
- O estado vazio fala do benefício: "Registre cada conversa **pra saber qual anúncio traz aluno**".
- Rótulos curtos de ação: "Registrar matrícula", "Importar lista", "Ver detalhes".

## Ícones

São de linha, com 18px e traço de 1,6, na cor do texto (estilo Lucide), e ficam em `ICON` em `js/ui.js`. Não use emoji como ícone.

## Checklist de tela nova

- [ ] Só um `.btn.primary`, e o ouro aparece só em ação, valor ou gráfico.
- [ ] Nenhum `box-shadow` e nenhuma cor literal: só tokens.
- [ ] Texto com contraste de pelo menos 4,5:1 (`--subtle-foreground` é o mínimo para texto).
- [ ] Estado vazio que orienta, nunca "0/0" ou "—" sozinho.
- [ ] Em 390px, `document.documentElement.scrollWidth` ≤ 390. Tabelas dentro de `.table-wrap`.
- [ ] Rodou `node tools/check.mjs`.
