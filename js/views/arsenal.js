// Meu Arsenal: patente (evolução geral) separada das conquistas (feitos específicos, comprovados por dados).

import { esc, num, brl } from '../util.js';
import { estado, RANKS, conquistas, tituloAtivo, usarTitulo, XP } from '../game.js';
import { perfil, minhasQuests, marcarEstudo, montarQuiz, NIVEL_NOME } from '../perfil.js';
import { auth } from '../auth.js';
import { ICON } from '../ui.js';

function questsCard() {
  const p = perfil(); const qs = minhasQuests(); const ok = qs.filter((q) => q.ok).length;
  return `<section class="card quests" id="quests">
    <div class="card-head"><div><h2>Suas missões</h2><p class="muted">${p ? `Ponto de partida: <b>${esc(NIVEL_NOME[p.nivel] || '')}</b> · ${ok} de ${qs.length} concluídas` : 'Responda 6 perguntas e receba missões feitas para você'}</p></div>
    <button class="btn sm ${p ? '' : 'primary'}" data-quiz>${p ? 'Refazer perfil' : 'Montar meu perfil'}</button></div>
    <ul class="qst">${qs.map((q) => `<li class="${q.ok ? 'ok' : ''}"><span class="qst-ic">${q.ok ? ICON.check : q.tipo === 'estudo' ? ICON.ideia : ICON.raio}</span>
      <div><b>${esc(q.titulo)}</b>${q.tipo === 'estudo' ? '<small>Estudo · marque quando fizer</small>' : `<div class="cq-bar"><i style="width:${Math.max(3, (q.v / q.alvo) * 100)}%"></i></div><small>${q.v} / ${q.alvo}</small>`}</div>
      ${q.tipo === 'estudo' ? `<button class="btn sm ${q.ok ? 'primary' : ''}" data-estudo="${q.id}">${q.ok ? 'Feito' : 'Marcar'}</button>` : ''}</li>`).join('')}</ul>
  </section>`;
}

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

  ${questsCard()}

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
  const redesenhar = () => { const c = root.querySelector('#quests'); if (c) c.outerHTML = questsCard(); };
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-titulo]'); if (b) usarTitulo(b.dataset.titulo);
    const est = e.target.closest('[data-estudo]'); if (est) { est.disabled = true; await marcarEstudo(est.dataset.estudo); redesenhar(); }
    if (e.target.closest('[data-quiz]')) {
      const ov = document.createElement('div'); ov.className = 'pq-overlay'; document.body.append(ov);
      montarQuiz(ov, { nome: auth.member?.nome || auth.user?.user_metadata?.nome || '', escola: '', onFim: () => { ov.remove(); redesenhar(); } });
    }
  });
}
