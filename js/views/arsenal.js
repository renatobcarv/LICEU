// Meu Arsenal: patente (evolução geral) separada das conquistas (feitos específicos, comprovados por dados).

import { esc, num, brl } from '../util.js';
import { estado, RANKS, conquistas, tituloAtivo, usarTitulo, XP } from '../game.js';

export function render() {
  const g = estado();
  const cs = conquistas(g.level);
  const ganhas = cs.filter((c) => c.ok);
  const tit = cs.find((c) => c.id === tituloAtivo() && c.ok);
  const cats = [...new Set(cs.map((c) => c.cat))];
  return `
  <div class="game-grid">
    <section class="game-hero" aria-label="Patente atual">
      <div class="gh-top"><span class="gh-chip">Nível ${g.level} · ${g.rankIdx + 1}/${RANKS.length}</span><span class="gh-chip dark">${num(g.xp)} XP</span></div>
      <p class="gh-kicker">Patente</p>
      <h2 class="gh-rank">${esc(g.rank.nome)}</h2>
      ${tit ? `<p class="gh-title">Título: <b>${esc(tit.nome)}</b></p>` : ''}
      <p class="gh-lema">${esc(g.rank.sentido)}</p>
      <div class="gh-bar"><i style="width:${Math.max(3, g.progress * 100)}%"></i></div>
      <p class="gh-next">${g.need - g.into} XP para o nível ${g.level + 1}${g.prox ? ` · próxima: <b>${esc(g.prox.nome)}</b>` : ''}</p>
    </section>
    <section class="card ars-stats">
      <div class="ars-n"><b>${ganhas.length}</b><span>de ${cs.length} conquistas</span></div>
      <div class="ars-n"><b>${g.seq}</b><span>dias seguidos · ${esc(g.faixa.nome)}</span></div>
      <div class="ars-n"><b>${g.best}</b><span>recorde de dias</span></div>
      <p class="muted ars-how">XP vem de atividade registrada: ligação +${XP.ligacao}, avanço de lead +${XP.avanco}, reserva +${XP.reserva}, matrícula paga +${XP.paga}, missão +${XP.missao}, dia completo +${XP.dia}, meta batida +${XP.meta}. Conquistas não dão XP: elas provam resultado.</p>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><div><h2>Hierarquia de patentes</h2><p class="muted">Do iniciante à elite do mercado digital</p></div></div>
    <ol class="ranks">${RANKS.map((r, i) => `<li class="${i < g.rankIdx ? 'past' : i === g.rankIdx ? 'now' : ''}"><span class="rk-n">${String(i + 1).padStart(2, '0')}</span><div><b>${esc(r.nome)}</b><small>${esc(r.sentido)}</small></div><em>nível ${r.min}</em></li>`).join('')}</ol>
  </section>

  ${cats.map((cat) => `<section class="card">
    <div class="card-head"><div><h2>${esc(cat)}</h2></div></div>
    <div class="conq-grid">${cs.filter((c) => c.cat === cat).map((c) => `
      <article class="conq ${c.ok ? 'ok' : ''} ${c.lendaria ? 'lend' : ''} ${c.breve ? 'breve' : ''}">
        <div class="cq-ic">${c.ok ? '★' : '🔒'}</div>
        <h3>${esc(c.nome)}${c.ultra ? ' <small>ultra raro</small>' : ''}</h3>
        <p>${esc(c.regra)}</p>
        ${c.breve ? '' : `<div class="cq-bar"><i style="width:${Math.max(2, (c.v / c.alvo) * 100)}%"></i></div><small class="cq-v">${c.moeda ? brl(c.v) + ' / ' + brl(c.alvo) : num(c.v) + ' / ' + num(c.alvo)}</small>`}
        ${c.ok ? `<button class="btn sm ${tituloAtivo() === c.id ? 'primary' : ''}" data-titulo="${c.id}">${tituloAtivo() === c.id ? 'Título em uso' : 'Usar como título'}</button>` : ''}
      </article>`).join('')}</div>
  </section>`).join('')}`;
}

export function mount(root) {
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-titulo]'); if (b) usarTitulo(b.dataset.titulo); });
}
