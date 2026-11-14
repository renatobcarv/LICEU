// Animações da página de vendas, guiadas pela rolagem. Sem biblioteca.
// Tudo desliga com "prefers-reduced-motion" e o conteúdo continua visível sem JS.

const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function motion() {
  document.documentElement.classList.add('mo');
  if (calmo) { document.documentElement.classList.add('mo-calmo'); return; }

  // 1. Barra de progresso da leitura (lima -> roxo)
  const bar = document.createElement('div'); bar.className = 'mo-progress'; document.body.append(bar);

  // 2. Títulos entram palavra por palavra
  $$('.h1, .h2').forEach((h) => {
    const anda = (n) => { [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) { const frag = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach((w) => { if (!w.trim()) { frag.append(w); return; } const s = document.createElement('span'); s.className = 'mo-w'; s.innerHTML = '<span></span>'; s.firstChild.textContent = w; frag.append(s); }); c.replaceWith(frag); }
      else if (c.nodeType === 1 && !c.classList.contains('mo-w')) anda(c);
    }); };
    anda(h); $$('.mo-w', h).forEach((w, i) => w.style.setProperty('--d', `${i * 45}ms`)); h.classList.add('mo-split');
  });

  // 3. Entrada em cascata dos blocos
  const blocos = '.sec-head > *:not(.h2), .gt-card, .feat, .step, .trust > div, .st-card, .st-values > div, .gm-list li, .gm-rule, .faq details, .case-copy > *:not(.h2), .eg-copy > *:not(.h2), .lead, .hero-cta, .hero-meta, .hk-badge';
  $$(blocos).forEach((el) => { el.classList.add('mo-in'); const irmaos = [...el.parentElement.children].filter((x) => x.classList.contains('mo-in')); el.style.setProperty('--d', `${Math.min(irmaos.indexOf(el), 8) * 90}ms`); });

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('mo-on'); io.unobserve(e.target);
    if (e.target.matches('[data-count]')) contar(e.target);
    if (e.target.matches('.gm-card')) subirPatente(e.target);
  }), { rootMargin: '0px 0px -12% 0px', threshold: .12 });
  $$('.mo-in, .mo-split, .gm-card, .mvf-card, .glowcard, [data-count]').forEach((el) => io.observe(el));

  // 4. Números contam até o valor real
  $$('.gc-num b, .gc-foot b, .eg-chip b').forEach((b) => { b.dataset.count = b.textContent.trim(); });
  function contar(el) {
    const alvo = el.dataset.count; const m = alvo.match(/[\d.,]+/); if (!m) return;
    const bruto = m[0]; const dec = bruto.includes(',') ? bruto.split(',')[1].length : 0;
    const n = parseFloat(bruto.replace(/\./g, '').replace(',', '.')); const t0 = performance.now(); const dur = 1400;
    const passo = (t) => { const k = clamp((t - t0) / dur); const e = 1 - Math.pow(1 - k, 4);
      const v = (n * e).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      el.textContent = alvo.replace(bruto, v); if (k < 1) requestAnimationFrame(passo); else el.textContent = alvo; };
    requestAnimationFrame(passo);
  }

  // 5. Gamificação: barra enche, patentes acendem em sequência, sobe de Novato para Ninja
  function subirPatente(card) {
    const rank = card.querySelector('.gm-rank'); const chip = card.querySelector('.gm-chip.lime');
    if (rank) { rank.textContent = 'Novato do Digital'; setTimeout(() => { rank.classList.add('mo-lvl'); rank.textContent = 'Ninja do Copy'; chip?.classList.add('mo-pop'); }, 1300); }
  }

  // 6. Cards com inclinação 3D e luz seguindo o mouse
  if (matchMedia('(hover: hover)').matches) {
    $$('.feat, .gt-card, .st-card, .mvf-card, .gm-card').forEach((c) => {
      c.classList.add('mo-tilt');
      c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`); c.style.setProperty('--rx', `${(0.5 - y) * 8}deg`); c.style.setProperty('--ry', `${(x - 0.5) * 10}deg`); });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
    // 7. Botões magnéticos
    $$('.btn.primary').forEach((b) => {
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .28}px`; });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
    // 8. Fundo do topo segue o mouse
    const bg = document.querySelector('.hk-bg');
    if (bg) addEventListener('pointermove', (e) => { bg.style.setProperty('--px', `${(e.clientX / innerWidth - .5) * 40}px`); bg.style.setProperty('--py', `${(e.clientY / innerHeight - .5) * 30}px`); }, { passive: true });
  }

  // 9. Ligado à rolagem: progresso, painel endireitando, mito x fato voando para o lugar, halftone
  const shot = document.querySelector('.hk-shot'); const stage = document.querySelector('.hk-stage');
  const mvf = document.querySelector('.mvf-stage'); const glow = document.querySelector('#produto');
  let pend = false;
  const rolar = () => {
    pend = false; const H = innerHeight;
    bar.style.transform = `scaleX(${clamp(scrollY / (document.documentElement.scrollHeight - H))})`;
    if (shot && stage) { const r = stage.getBoundingClientRect(); const k = clamp(1 - (r.top - H * .25) / (H * .6)); shot.style.transform = `rotateX(${18 - k * 18}deg) scale(${.92 + k * .08}) translateY(${(1 - k) * 40}px)`; }
    if (mvf) { const r = mvf.getBoundingClientRect(); const k = clamp(1 - (r.top - H * .15) / (H * .75)); mvf.style.setProperty('--k', k.toFixed(3)); }
    if (glow) { const r = glow.getBoundingClientRect(); const k = clamp(1 - (r.bottom - H) / H); glow.style.setProperty('--sol', k.toFixed(3)); }
  };
  addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(rolar); } }, { passive: true });
  addEventListener('resize', rolar); rolar();
}
