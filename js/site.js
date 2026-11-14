// Páginas públicas (vendas e planos): revelação ao rolar, preços e alternância mensal/anual.
// PREÇOS: ajuste aqui. Os limites batem com a tabela "plans" do banco (supabase/migrations/002_saas.sql).

export const PLANOS = [
  // Ids batem com a tabela "plans" do banco (local, pro, agencia). Limites vêm de lá.
  { id: 'local', nome: 'Essencial', para: 'Para a escola começar a medir', mensal: 197, cls: '',
    itens: ['Até 10 usuários', '1 número de WhatsApp oficial', 'Funil, Modo ligação e matrículas', 'Meta Ads com custo por matrícula paga', 'Pauta Viral, calendário e Ciclo CEC', 'Missões, patentes e chat do time', '500 gerações de IA por mês'],
    nao: ['Suporte prioritário'] },
  { id: 'pro', nome: 'Escola', para: 'Para o comercial que quer bater meta', mensal: 497, cls: 'hot', tag: 'Mais escolhido',
    itens: ['Até 40 usuários', '5 números de WhatsApp oficial', 'Tudo do Essencial', '5.000 gerações de IA por mês', 'Relatórios por consultor e por curso', 'Perfis por área: vendas, atendimento, social', 'Suporte prioritário no WhatsApp'],
    nao: [] },
  { id: 'agencia', nome: 'Rede', para: 'Para grupos com várias unidades', mensal: 997, cls: 'ag',
    itens: ['Até 100 usuários', '30 números de WhatsApp oficial', 'Tudo do Escola', '30.000 gerações de IA por mês', 'Implantação junto com o seu time', 'Gerente de conta dedicado'],
    nao: [] },
];
export const ANUAL_MESES = 10; // anual = paga 10, usa 12

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const cadastro = (id) => `/?cadastro=1&plano=${id}`;

export function renderPlanos(el, anual = false) {
  el.innerHTML = PLANOS.map((p) => {
    const mes = anual ? Math.round((p.mensal * ANUAL_MESES) / 12) : p.mensal;
    return `<article class="plan ${p.cls}">
      ${p.tag ? `<span class="plan-tag">${p.tag}</span>` : ''}
      <h3>${p.nome}</h3><p class="for">${p.para}</p>
      <div class="price"><b>${brl(mes)}</b><span>/mês</span></div>
      <p class="price-note">${anual ? `${brl(p.mensal * ANUAL_MESES)} por ano · economia de ${brl(p.mensal * (12 - ANUAL_MESES))}` : '7 dias grátis · depois, cobrança mensal'}</p>
      <a class="btn ${p.cls === 'hot' ? 'primary' : 'ghost'} block" href="${cadastro(p.id)}">Testar 7 dias grátis</a>
      <ul>${p.itens.map((i) => `<li>${i}</li>`).join('')}${p.nao.map((i) => `<li class="no">${i}</li>`).join('')}</ul>
    </article>`;
  }).join('');
}

export function initBilling(btns, el) {
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderPlanos(el, b.dataset.bill === 'anual');
  }));
  renderPlanos(el, false);
}

export function reveal() {
  const els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}
