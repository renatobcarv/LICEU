// Linguagem visual da página de vendas aplicada ao painel: fundo líquido, cards de vidro com luz,
// entrada ao rolar e luz que segue o mouse. Leve e sem atrapalhar o trabalho: tudo desliga com "menos movimento".

const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALVOS = '.card, .kpi, .game-hero, .conq, .tm-card, .kb-col, .feat, .missoes';

export function appMotion() {
  if (document.querySelector('.app-bg')) return;
  // Fundo: manchas líquidas roxa e lima + granulado (fixo, atrás de tudo)
  const bg = document.createElement('div'); bg.className = 'app-bg'; bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="grain"></span>';
  document.body.prepend(bg);
  document.documentElement.classList.add('ap');
  if (calmo) { document.documentElement.classList.add('ap-calmo'); return; }

  // Barra de leitura no topo
  const bar = document.createElement('div'); bar.className = 'mo-progress'; document.body.append(bar);
  let pend = false;
  addEventListener('scroll', () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 40 ? Math.min(1, scrollY / h) : 0})`; }); }, { passive: true });

  // Entrada ao rolar: cards abaixo da dobra sobem quando aparecem
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('ap-on'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: .08 });
  const main = document.getElementById('main');
  const marcar = () => main.querySelectorAll(ALVOS).forEach((el) => {
    if (el.dataset.ap) return; el.dataset.ap = '1';
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * .92) { el.classList.add('ap-on'); return; } // já visível: deixa a animação de entrada da tela agir
    el.classList.add('ap-in'); io.observe(el);
  });
  new MutationObserver(() => requestAnimationFrame(marcar)).observe(main, { childList: true, subtree: true });
  marcar();

  // Luz que segue o mouse nos cards
  if (matchMedia('(hover: hover)').matches) {
    main.addEventListener('pointermove', (e) => {
      const c = e.target.closest?.(ALVOS); if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      c.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    }, { passive: true });
  }
}
