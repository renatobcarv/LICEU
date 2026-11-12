// Time: cada pessoa tem um card com anel de insígnia na cor da função, patente e XP vindos dos leads dela.
// Clique no card abre o board individual. Reconhecimentos (kudos) deixam o time mais vivo.

import { store } from '../store.js';
import { esc, num, brl, today } from '../util.js';
import { openDialog, toast, ICON } from '../ui.js';
import { estadoPessoa, RANKS } from '../game.js';
import { myName } from '../leads.js';

export const FUNCOES = {
  lider: { nome: 'Líder', icone: '♛', a: '#c4f15a', b: '#12c48b', faz: 'Define a direção, cobra o ritmo e destrava o time.' },
  closer: { nome: 'Closer', icone: '◆', a: '#ffc940', b: '#ff7a1a', faz: 'Transforma conversa em matrícula paga.' },
  sdr: { nome: 'Atendimento / SDR', icone: '✆', a: '#12c48b', b: '#2ee6d6', faz: 'Responde rápido e qualifica cada lead.' },
  trafego: { nome: 'Gestor de Tráfego', icone: '➹', a: '#4f8bff', b: '#2ee6d6', faz: 'Cuida da verba, dos públicos e do custo por resultado.' },
  copy: { nome: 'Copywriter', icone: '✎', a: '#a46bff', b: '#ff4d9a', faz: 'Escreve o que faz o lead responder.' },
  social: { nome: 'Social Media', icone: '✦', a: '#ff4d9a', b: '#ff7a1a', faz: 'Mantém a constância e o engajamento nas redes.' },
  design: { nome: 'Criativos / Design', icone: '◐', a: '#2ee6d6', b: '#a46bff', faz: 'Cria as peças e vídeos que param a rolagem.' },
  financeiro: { nome: 'Financeiro', icone: '$', a: '#ffc940', b: '#c4f15a', faz: 'Cobra, confere pagamentos e protege o caixa.' },
};
const KUDOS = ['🔥', '🚀', '👏', '🏆', '💡'];
const iniciais = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function card(m) {
  const f = FUNCOES[m.funcao] || FUNCOES.sdr;
  const g = estadoPessoa(m.nome);
  const kud = Object.values(m.kudos || {}).reduce((a, v) => a + v.length, 0);
  return `<article class="tm-card" style="--a:${f.a};--b:${f.b}" data-membro="${m.id}" tabindex="0" role="button" aria-label="Abrir board de ${esc(m.nome)}">
    <div class="tm-ring"><div class="tm-av">${m.foto ? `<img src="${esc(m.foto)}" alt="">` : esc(iniciais(m.nome))}</div><span class="tm-ic" title="${esc(f.nome)}">${f.icone}</span></div>
    <h3>${esc(m.nome)}</h3>
    <p class="tm-role">${esc(f.nome)}</p>
    <p class="tm-rank">${esc(g.rank.nome)} · nv ${g.level}</p>
    <div class="tm-bar"><i style="width:${Math.max(3, g.progress * 100)}%"></i></div>
    <div class="tm-nums"><span><b>${num(g.matMes)}</b>mat. mês</span><span><b>${num(g.xp)}</b>XP</span><span><b>${kud}</b>kudos</span></div>
  </article>`;
}

export function render() {
  const time = store.all('team').filter((m) => m.ativo !== false);
  const rank = time.map((m) => ({ m, g: estadoPessoa(m.nome) })).sort((a, b) => b.g.xp - a.g.xp);
  const pod = rank.slice(0, 3);
  return `
  <section class="card tm-head">
    <div class="card-head"><div><h2>Seu time</h2><p class="muted">Cada pessoa sobe de patente pelo que registra no Funil. A cor do anel mostra a função.</p></div>
    <button class="btn primary" data-act="novo">${ICON.plus} Adicionar pessoa</button></div>
    ${pod.length >= 2 ? `<div class="podium">${[pod[1], pod[0], pod[2]].filter(Boolean).map(({ m, g }) => { const pos = pod.indexOf(pod.find((x) => x.m === m)) + 1; const f = FUNCOES[m.funcao] || FUNCOES.sdr; return `<div class="pd p${pos}" style="--a:${f.a};--b:${f.b}"><div class="pd-av">${esc(iniciais(m.nome))}</div><b>${esc(m.nome.split(' ')[0])}</b><small>${num(g.xp)} XP</small><div class="pd-step">${pos}º</div></div>`; }).join('')}</div>` : ''}
  </section>
  ${time.length ? `<div class="tm-grid">${time.map(card).join('')}</div>` : `<div class="empty"><h3>Monte seu time</h3><p>Adicione cada pessoa com a função dela. O nome precisa ser igual ao "responsável" usado no Funil para o XP contar.</p><button class="btn primary" data-act="novo">${ICON.plus} Adicionar pessoa</button></div>`}
  <section class="card"><div class="card-head"><div><h2>Funções e insígnias</h2></div></div>
    <div class="fn-legend">${Object.values(FUNCOES).map((f) => `<span style="--a:${f.a};--b:${f.b}"><i>${f.icone}</i><b>${esc(f.nome)}</b><small>${esc(f.faz)}</small></span>`).join('')}</div>
  </section>`;
}

function editar(m, ctx) {
  const consult = (store.settings().consultores || []).map((c) => c.nome);
  openDialog({
    title: m ? 'Editar pessoa' : 'Nova pessoa no time', saveLabel: m ? 'Salvar' : 'Adicionar',
    fields: [
      { name: 'nome', label: 'Nome (igual ao responsável no Funil)', required: true, value: m?.nome || '', list: 'dl-cons', full: true },
      { name: 'funcao', label: 'Função no time', type: 'select', options: Object.entries(FUNCOES).map(([v, f]) => [v, f.nome]), value: m?.funcao || 'sdr' },
      { name: 'foto', label: 'Foto (link, opcional)', value: m?.foto || '' },
      { name: 'bio', label: 'O que faz / frase', type: 'textarea', rows: 2, value: m?.bio || '', full: true },
    ],
    html: `<datalist id="dl-cons">${consult.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`,
    onSave: (d) => { store.put('team', { ...(m || { kudos: {}, desde: today() }), ...d }); ctx.refresh?.(); },
    onDelete: m ? () => store.remove('team', m.id) : undefined, deleteLabel: 'Tirar do time',
  });
}

function board(m, ctx) {
  const f = FUNCOES[m.funcao] || FUNCOES.sdr;
  const g = estadoPessoa(m.nome);
  const prox = RANKS[g.rankIdx + 1];
  const ls = store.all('leads').filter((l) => String(l.responsavel || '').trim().toLowerCase() === m.nome.trim().toLowerCase())
    .flatMap((l) => (l.historico || []).slice(1).map((h) => ({ d: h.data, t: `${l.nome} → ${h.etapa}` }))).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6);
  const meus = m.kudos || {};
  openDialog({
    title: m.nome, wide: true,
    html: `<div class="tb" style="--a:${f.a};--b:${f.b}">
      <div class="tb-top"><div class="tm-ring big"><div class="tm-av">${m.foto ? `<img src="${esc(m.foto)}" alt="">` : esc(iniciais(m.nome))}</div><span class="tm-ic">${f.icone}</span></div>
        <div><p class="tm-role">${esc(f.nome)}</p><h2>${esc(g.rank.nome)}</h2><p class="muted">${esc(m.bio || f.faz)}</p>
        <div class="tm-bar"><i style="width:${Math.max(3, g.progress * 100)}%"></i></div><small class="muted">Nível ${g.level} · ${g.need - g.into} XP para o próximo${prox ? ` · rumo a ${esc(prox.nome)}` : ''}</small></div></div>
      <div class="tb-nums">${[['Leads', g.leads], ['Em aberto', g.abertos], ['Reservas', g.reservas], ['Pagas', g.pagas], ['Faturado', brl(g.receita)], ['XP', num(g.xp)]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <h3>Reconhecer</h3><div class="kudos">${KUDOS.map((k) => `<button type="button" class="kd ${(meus[k] || []).includes(myName() || 'Eu') ? 'on' : ''}" data-kudo="${k}">${k}<b>${(meus[k] || []).length}</b></button>`).join('')}</div>
      <h3>Atividade recente</h3>${ls.length ? `<ul class="tb-feed">${ls.map((x) => `<li><small>${esc(x.d.split('-').reverse().slice(0, 2).join('/'))}</small>${esc(x.t)}</li>`).join('')}</ul>` : '<p class="muted">Nada registrado no Funil ainda.</p>'}
      <p><button type="button" class="btn sm" data-editar>Editar pessoa</button></p>
    </div>`,
    onOpen: (form, dlg) => {
      dlg.addEventListener('click', (e) => {
        const k = e.target.closest('[data-kudo]');
        if (k) { const eu = myName() || 'Eu'; const cur = store.get('team', m.id) || m; const kd = { ...(cur.kudos || {}) }; const arr = kd[k.dataset.kudo] || []; kd[k.dataset.kudo] = arr.includes(eu) ? arr.filter((x) => x !== eu) : [...arr, eu]; store.put('team', { ...cur, kudos: kd }); k.classList.toggle('on'); k.querySelector('b').textContent = kd[k.dataset.kudo].length; if (!arr.includes(eu)) toast(`${k.dataset.kudo} para ${m.nome}!`); }
        if (e.target.closest('[data-editar]')) { dlg.close(); setTimeout(() => editar(store.get('team', m.id) || m, ctx), 50); }
      });
    },
  });
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="novo"]')) return editar(null, ctx);
    const c = e.target.closest('[data-membro]'); if (c) board(store.get('team', c.dataset.membro), ctx);
  });
  root.addEventListener('keydown', (e) => { const c = e.target.closest?.('[data-membro]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); board(store.get('team', c.dataset.membro), ctx); } });
}
