# Design system Klasso (v2 · nov/2026)

Fonte da verdade visual do Klasso. Vale para o app (`css/app.css`) e para as páginas públicas (`css/site.css`).
Decisões do usuário marcadas com 🔒 não mudam sem ele pedir.

## 1. Marca
- 🔒 Nome **Klasso**. Logo `assets/klasso-logo.png` (K lima+roxo com seta + "klasso" branco); símbolo `assets/klasso-mark.png`; favicon `assets/favicon.png`.
- 🔒 **Mascote: águia** = "visão de águia sobre o funil". Arquivos (tratados em roxo, fundo transparente, WebP):
  - `assets/aguia.webp` — em voo, completa (vendas, seção "Visão de águia", entra voando com a rolagem).
  - `assets/aguia-ataque.webp` — em ataque, garras à frente (topo da página de Planos).
  - `assets/aguia-rosto.webp` — rosto com olho lima (login/cadastro e fundo do card da patente, inteira, sem cortar).
  - Regras: corpo sempre roxo; **lima só no olho** (pequeno brilho pulsando); 🔒 **sem brilho verde em volta da águia**; brilho em volta só roxo.
  - Tratamento de imagem nova: recorte com alfa real → mapa de cor (preto-roxo → #8B00FF → lilás) a ~80% + contraste 1.15 → WebP q82–84.

## 2. Cor
| Token | Valor | Uso |
| --- | --- | --- |
| fundo | `#050506` | Preto profundo de tudo |
| `--card` | `#0c0c10` | Superfície neutra (sem tom verde) |
| `--primary` (lima) | `#C6FF00` | Ação e detalhe: CTA, ícone ativo, barras, número-herói, olho da águia |
| `--royal` (roxo) | `#8B00FF` (texto: `#b56bff`/`#d6b0ff`) | Estrutura e destaque: item ativo do menu, card da patente, brilhos, horizonte |
| branco | `#fff` / texto apoio `#a4a4b0`, `#9a9aa6` | Títulos e texto |
- 🔒 **Paleta única** (Toxic Luxury removida). 🔒 **Nunca azul/ciano** — nem em gráfico, gradiente ou badge.
- Regra de proporção: roxo estrutura, lima aponta. Se tudo é lima, nada se destaca.
- Contraste AA: texto secundário nunca abaixo de `#9a9aa6` sobre o preto (axe-core = 0 violações).
- WhatsApp pode usar o verde próprio só no botão "WhatsApp" (ação de marca de terceiro).

## 3. Tipografia
- Fustat (Google Fonts) em tudo; Geist Mono só para rótulos/kickers em caixa alta e números de cards (`001`).
- Títulos: peso 700–800, tracking negativo (-0.02 a -0.035em). Palavra-chave do título em lima (`<em>`).
- Kicker: mono, 11–13px, uppercase, letter-spacing .14em, lima.
- Copy: segunda pessoa, frases curtas, benefício primeiro ("Responda antes do concorrente"), números exatos.

## 4. Superfícies e efeitos (linguagem "glow")
- **Fundo líquido**: manchas roxas/lima desfocadas (blur 70–90px) animando devagar + granulado (feTurbulence) em overlay.
- **Vidro**: `linear-gradient(135deg, rgb(255 255 255/.12), rgb(255 255 255/.03))` + `backdrop-filter: blur(14–18px)` + borda branca 10–18% + highlight inset no topo.
- **Luz que nasce de baixo** nos cards (radial roxo/lima/lilás alternando), **horizonte roxo** enorme sob grades.
- **Ícones de vidro 3D** (`.glass`): quadrado arredondado preto brilhante, levemente girado, ícone em traço lima ou lilás com drop-shadow, flutuando.
- Texturas para dar personalidade a blocos: retícula de pontos lima (halftone), vidro canelado (listras verticais), anel de luz.
- No celular: troca vidro por fundo sólido (performance).

## 5. Movimento (`js/motion.js` páginas públicas · `js/app-motion.js` app)
- Títulos entram palavra por palavra (blur → nítido, sobe); blocos em cascata (90ms); números contam até o valor real.
- Ligados à rolagem: painel endireita (rotateX 18°→0), águia entra voando, mito×fato voam para o lugar, horizonte cresce, barra de progresso lima→roxo no topo.
- Interação: cards inclinam em 3D e recebem luz seguindo o mouse; botões primários magnéticos com reflexo.
- App: fundo líquido, cards de vidro com luz do mouse, entrada ao rolar, barra de leitura.
- **Sempre** respeitar `prefers-reduced-motion` (tudo visível e parado) e nunca deixar conteúdo oculto sem JS.

## 6. Componentes-chave
| Componente | Onde | Regra |
| --- | --- | --- |
| Botão primário | `.btn.primary` (+ `.shine` nas públicas) | Pílula lima, texto preto; **um por tela/bloco** |
| Card da patente | `.game-hero` | Bloco roxo royal com detalhes lima; águia ao fundo inteira |
| KPI | `.kpi` / `.hj-kpis` | Número grande; 3–4 por vez, o resto em "ver todos" |
| Card numerado | `.feat .fnum` | `001`… em pílula mono |
| Cartão mito×fato | `.mvf-card` | Vidro fosco inclinado, etiqueta "Mito" cinza / "Fato" lima |
| Item de fila | `.hj-item` | Avatar roxo, nome, motivo, seta lima |
| Menu | `.side` | Item ativo roxo com ícone lima e filete lima à esquerda; grupos em mono cinza |

## 7. UX (regras de arquitetura — o design é aprovado; o que cansa é excesso de informação)
1. **Tela inicial "Hoje" por papel** (`js/views/hoje.js`): responde "o que eu faço agora?". Vendas = fila (retornos atrasados, sem 1º contato, reservas sem pagamento); Social = conteúdo do dia; Coordenação = 3 números + quem precisa de ajuda.
2. **Menu pelo trabalho**: Vender · Divulgar · Gerir · Equipe · Sistema. Áreas fora do perfil recolhidas em "Mais áreas" (continua tudo acessível).
3. **Revelar aos poucos**: formulários atrás de botão ("+ Novo lead"), 4 indicadores + "ver todos", ações secundárias em "Mais ações".
4. **Uma ação principal por tela.**
5. **Cada informação mora num lugar só**; nos outros, resumo com link.
6. Página pública pode "gritar"; o app trabalha 8h por dia — intensidade com propósito, o dado é protagonista.

## 8. Checklist de tela nova
- [ ] Só tokens da paleta; nada azul/ciano; lima só em ação/dado/olho.
- [ ] Um `.btn.primary`; informação secundária recolhida.
- [ ] Contraste AA (axe-core sem violações), ARIA correto (tabs, grid, progressbar com nome).
- [ ] 1440 e 390px sem rolagem lateral; `prefers-reduced-motion` testado.
- [ ] Dados com `esc()` (XSS testado); números reais, nunca inventados.
- [ ] `npm run check` + Playwright.
