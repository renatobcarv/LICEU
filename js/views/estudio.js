// Estúdio do criador: barra de progresso de conteúdo, brainstorm rápido e visualização da ideia como post.
// Usado pela Pauta Viral e pelo Calendário.

import { store } from '../store.js';
import { esc, today, fmtDate } from '../util.js';
import { courseName } from '../metrics.js';
import { openDialog, toast, ICON } from '../ui.js';
import { semana, sequenciaSemanas, metaSemana, xpConteudo, FORMATO_ICON, FORMATOS_BRAIN, CONQUISTAS_CONTEUDO, XP_C } from '../criador.js';
import { pedirIA, iaOnline, roteiroTexto } from '../ia.js';

export const iconFormato = (f) => ICON[FORMATO_ICON[f] || 'f_post'];

/** Barra do Estúdio: desafio da semana (anel), sequência, XP de conteúdo e próxima conquista. */
export function estudioBar() {
  const s = semana(); const seq = sequenciaSemanas(); const xp = xpConteudo();
  const pct = Math.min(1, s.n / s.meta); const R = 30, C = 2 * Math.PI * R;
  const prox = CONQUISTAS_CONTEUDO.map((c) => ({ ...c, ...c.check() })).filter((c) => !c.ok).sort((a, b) => b.v / b.alvo - a.v / a.alvo)[0];
  return `<section class="estudio" aria-label="Estúdio do criador">
    <div class="es-ring" title="${s.n} de ${s.meta} posts nesta semana">
      <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${R}" class="bg"/><circle cx="36" cy="36" r="${R}" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
      <b>${s.n}<small>/${s.meta}</small></b>
    </div>
    <div class="es-main"><p class="es-k">${s.ok ? 'Desafio da semana cumprido' : 'Desafio da semana'}</p>
      <p class="es-t">${s.ok ? 'Meta de posts batida. Cada post a mais vale +' + XP_C.publicado + ' XP.' : `Publique ${s.meta - s.n} ${s.meta - s.n === 1 ? 'post' : 'posts'} até domingo`}${s.planejados ? ` · ${s.planejados} já no calendário` : ''}</p></div>
    <div class="es-stat">${ICON.fogo}<b>${seq}</b><span>${seq === 1 ? 'semana' : 'semanas'} seguidas</span></div>
    <div class="es-stat">${ICON.raio}<b>${xp}</b><span>XP de conteúdo</span></div>
    ${prox ? `<div class="es-stat es-next">${ICON.medalha}<div><b>${esc(prox.nome)}</b><span>${prox.v}/${prox.alvo} · ${esc(prox.regra)}</span><i style="--w:${Math.max(4, (prox.v / prox.alvo) * 100)}%"></i></div></div>` : ''}
  </section>`;
}

let fFormato = 'Reels';
const ideias = () => store.all('pautas').filter((p) => p.brain && !['Descartada'].includes(p.status)).sort((a, b) => (b.fogo || 0) - (a.fogo || 0) || b.createdAt.localeCompare(a.createdAt));

/** Brainstorm: escreva e aperte Enter. Cada ideia vira cartão; as mais votadas sobem. */
export function brainstorm() {
  const list = ideias();
  const cursos = store.all('courses').filter((c) => c.ativo !== false);
  return `<section class="brain">
    <form class="brain-in" id="brain-form" autocomplete="off">
      <span class="bi-ic">${ICON.ideia}</span>
      <label class="sr" for="brain-txt">Nova ideia</label>
      <input id="brain-txt" placeholder="Solta a ideia e aperte Enter… ex.: 3 erros que reprovam no estágio" maxlength="160">
      <div class="brain-fmt" role="group" aria-label="Formato">${FORMATOS_BRAIN.map((f) => `<button type="button" class="bf" data-bfmt="${esc(f)}" aria-pressed="${f === fFormato}" title="${esc(f)}">${iconFormato(f)}<span>${esc(f)}</span></button>`).join('')}</div>
      ${cursos.length ? `<label class="sr" for="brain-curso">Curso</label><select id="brain-curso"><option value="">Qualquer curso</option>${cursos.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select>` : ''}
      <button class="btn primary" type="submit">${ICON.plus} Anotar <small>+${XP_C.ideia} XP</small></button>
    </form>
    <div class="ia-row"><button type="button" class="btn ia-btn" data-ia-ideias>${ICON.ia} Ideias com IA</button><small>${iaOnline() ? 'O Claude sugere ideias com base nos seus cursos. Você escolhe quais entram.' : 'Modo demonstração: sugestões do banco de ganchos, sem IA. Com conta, o Claude gera ideias para os seus cursos.'}</small></div>
    ${list.length ? `<div class="brain-grid">${list.map(cartao).join('')}</div>` : `<div class="empty"><h3>Nenhuma ideia ainda</h3><p>Escreva sem filtro: tema, dúvida que o aluno faz, bastidor, erro comum. Depois vote nas melhores e transforme em pauta.</p></div>`}
  </section>`;
}

function cartao(p) {
  const f = p.form?.formato || 'Reels';
  return `<article class="idea" draggable="true" data-ideia="${esc(p.id)}">
    <header><span class="idea-f" title="${esc(f)}">${iconFormato(f)}<span>${esc(f)}</span></span><button type="button" class="idea-fogo${p.fogo ? ' on' : ''}" data-fogo="${esc(p.id)}" aria-label="Votar nesta ideia">${ICON.fogo}<b>${p.fogo || 0}</b></button></header>
    <h3>${esc(p.titulo)}</h3>
    <p class="idea-meta">${p.form?.cursoId ? esc(courseName(p.form.cursoId)) + ' · ' : ''}${p.status === 'Ideia' ? 'Ideia' : esc(p.status)}${p.calendarId ? ' · no calendário' : ''}</p>
    <footer>
      <button type="button" class="ib" data-ver="${esc(p.id)}" title="Visualizar">${ICON.olho}<span>Ver</span></button>
      <button type="button" class="ib" data-virar="${esc(p.id)}" title="Transformar em pauta">${ICON.raio}<span>Pauta</span></button>
      <button type="button" class="ib" data-agendar="${esc(p.id)}" title="Agendar">${ICON.agenda}<span>Agendar</span></button>
      <button type="button" class="ib ghost" data-descartar="${esc(p.id)}" title="Descartar" aria-label="Descartar">${ICON.lixo}</button>
    </footer>
  </article>`;
}

export function anotar(texto, formato = fFormato, cursoId = '') {
  const t = String(texto || '').trim(); if (!t) return null;
  return store.put('pautas', { titulo: t.slice(0, 160), brain: true, status: 'Ideia', fogo: 0, form: { ideia: t, formato, cursoId, curso: cursoId ? courseName(cursoId) : '' } });
}

// ---------- visualizar a ideia como post ----------
function frases(p) {
  const kit = p.kit || ''; const base = (p.form?.ideia || p.titulo || '').trim();
  const linhas = kit.split('\n').map((l) => l.replace(/^[#*\-\d.\s]+/, '').trim()).filter((l) => l.length > 12 && l.length < 120);
  return linhas.length >= 3 ? linhas.slice(0, 5) : [base, 'O que quase ninguém te conta', 'Na prática, na sala de aula', 'Chama no WhatsApp e garanta a vaga'];
}
export function visualizar(p, ctx) {
  const f = p.form?.formato || p.formato || 'Reels';
  const titulo = p.titulo || p.form?.ideia || '';
  const escola = store.settings().unidade || 'sua escola';
  const insta = (store.settings().instagram || '@suaescola').replace(/^@?/, '@');
  const fr = frases(p);
  const tela = f === 'Carrossel'
    ? `<div class="pv-car">${fr.slice(0, 4).map((t, i) => `<div class="pv-slide${i === 0 ? ' first' : ''}"><small>${i + 1}/${Math.min(4, fr.length)}</small><b>${esc(i === 0 ? titulo : t)}</b>${i === 0 ? '<span>arrasta pro lado →</span>' : ''}</div>`).join('')}</div>`
    : f === 'Post estático'
      ? `<div class="pv-post"><b>${esc(titulo)}</b><span>${esc(escola)}</span></div>`
      : `<div class="pv-vert ${f === 'Stories' ? 'story' : ''}">${f === 'Stories' ? '<div class="pv-bars"><i class="on"></i><i></i><i></i></div>' : ''}<p class="pv-hook">${esc(titulo)}</p><p class="pv-sub">${esc(fr[1] || '')}</p>
          ${f === 'Stories' ? '<span class="pv-sticker">Responder no WhatsApp</span>' : `<div class="pv-side"><span>${ICON.fogo}</span><span>${ICON.olho}</span><span>${ICON.agenda}</span></div><p class="pv-cap"><b>${esc(insta)}</b> ${esc(fr[2] || '')}</p>`}</div>`;
  openDialog({ title: 'Prévia · ' + f, wide: true,
    html: `<div class="pv">
      <div class="pv-phone ${f === 'Carrossel' || f === 'Post estático' ? 'feed' : ''}"><div class="pv-top"><span class="pv-av"></span><b>${esc(insta)}</b><small>${f === 'Reels' || f === 'Vídeo motion' ? 'Reels' : 'agora'}</small></div>${tela}</div>
      <div class="pv-side-info"><span class="idea-f">${iconFormato(f)}<span>${esc(f)}</span></span><h3>${esc(titulo)}</h3>
        <p class="muted">Prévia do jeito que o seguidor vê. O texto vem da ideia${p.kit ? ' e do roteiro da pauta' : ''}; ajuste na pauta antes de gravar.</p>
        <div class="pv-ia"><ol class="pv-steps">${fr.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
        <button type="button" class="btn sm ia-btn" data-ia-roteiro>${ICON.ia} ${p.kit ? 'Refazer roteiro com IA' : 'Roteiro com IA'}</button>
        ${p.calendarId ? '' : `<div class="pv-ag"><label for="pv-data">Agendar para</label><input type="date" id="pv-data" value="${today()}"><button type="button" class="btn sm" data-pv-ag>${ICON.agenda} Agendar</button></div>`}
        <div class="row-actions">${p.brain || p.id ? `<a class="btn sm primary" href="#pauta?ideia=${esc(p.id)}">${ICON.raio} Transformar em pauta</a>` : ''}</div>
      </div></div>`,
    onOpen: (form, dlg) => {
      dlg.querySelector('[data-ia-roteiro]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget; btn.disabled = true; btn.classList.add('loading');
        try {
          const { resultado: r, demo } = await pedirIA('roteiro', { ideia: titulo, formato: f, curso: p.form?.curso || '' });
          dlg.querySelector('.pv-ia').innerHTML = `${demo ? '<p class="hint">Modo demonstração: roteiro de exemplo, sem IA.</p>' : ''}<p><b>Gancho:</b> ${esc(r.gancho)}</p><ol class="pv-steps">${r.cenas.map((c) => `<li>${esc(c.fala)}<small> · tela: ${esc(c.tela)}</small></li>`).join('')}</ol><p class="muted"><b>Legenda:</b> ${esc(r.legenda)}<br>${esc((r.hashtags || []).join(' '))}</p><button type="button" class="btn sm primary" data-ia-salvar>${ICON.check} Salvar roteiro na pauta</button>`;
          dlg.querySelector('.pv-hook') && (dlg.querySelector('.pv-hook').textContent = r.gancho);
          dlg.querySelector('[data-ia-salvar]').addEventListener('click', () => {
            const cur = store.get('pautas', p.id); if (!cur) return;
            store.put('pautas', { ...cur, kit: roteiroTexto(r), status: cur.status === 'Ideia' ? 'Briefing pronto' : cur.status, iaGerado: !demo });
            toast('Roteiro salvo na pauta.'); dlg.close(); ctx?.refresh?.();
          });
        } catch (er) { toast(er.message, 'bad'); }
        btn.disabled = false; btn.classList.remove('loading');
      });
      dlg.querySelector('[data-pv-ag]')?.addEventListener('click', () => { const d = dlg.querySelector('#pv-data').value; if (!d) return; agendarIdeia(store.get('pautas', p.id), d, ctx); dlg.close(); });
      dlg.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => dlg.close()));
    } });
}

function iaIdeiasDialog(ctx) {
  const cursos = store.all('courses').filter((c) => c.ativo !== false);
  const { dlg } = openDialog({ title: 'Ideias com IA', wide: true,
    fields: [
      { name: 'cursoId', label: 'Curso', type: 'select', options: [['', 'Todos os cursos'], ...cursos.map((c) => [c.id, c.nome])] },
      { name: 'tema', label: 'Tema ou momento (opcional)', placeholder: 'ex.: volta às aulas, mito comum, rotina do estágio' },
      { name: 'quantidade', label: 'Quantas ideias', type: 'number', value: 6 },
    ],
    html: '<div id="ia-res"></div>', saveLabel: 'Gerar ideias',
    onSave: (d) => {
      const box = dlg.querySelector('#ia-res'); const btn = dlg.querySelector('button[type=submit]');
      const curso = d.cursoId ? courseName(d.cursoId) : '';
      btn.disabled = true; btn.classList.add('loading');
      pedirIA('ideias', { curso, tema: d.tema || '', quantidade: d.quantidade || 6 }).then(({ resultado, demo }) => {
        box.innerHTML = `${demo ? '<p class="hint">Modo demonstração: sugestões do banco de ganchos, sem IA.</p>' : ''}<ul class="ia-list">${resultado.ideias.map((x, i) => `<li><label><input type="checkbox" data-ia-i="${i}" checked><span class="idea-f">${iconFormato(x.formato)}<span>${esc(x.formato)}</span></span><b>${esc(x.titulo)}</b><small>${esc(x.gancho)}</small></label></li>`).join('')}</ul><button type="button" class="btn primary" data-ia-add>${ICON.plus} Adicionar ao brainstorm</button>`;
        box.querySelector('[data-ia-add]').addEventListener('click', () => {
          const sel = [...box.querySelectorAll('[data-ia-i]:checked')].map((c) => resultado.ideias[c.dataset.iaI]);
          sel.forEach((x) => { const pt = anotar(x.titulo, x.formato, d.cursoId || ''); if (pt) store.put('pautas', { ...pt, gancho: x.gancho, iaGerado: !demo }); });
          toast(sel.length + (sel.length === 1 ? ' ideia adicionada.' : ' ideias adicionadas.')); dlg.close(); ctx.refresh();
        });
      }).catch((er) => { box.innerHTML = `<p class="form-error">${esc(er.message)}</p>`; })
        .finally(() => { btn.disabled = false; btn.classList.remove('loading'); });
      return false; // mantém o diálogo aberto para escolher as ideias
    } });
}

/** Liga os eventos do brainstorm dentro de `root`. Retorna true se tratou o clique. */
export function bindBrain(root, ctx, agendarFn) {
  root.querySelector('#brain-form')?.addEventListener('submit', (e) => {
    e.preventDefault(); const i = root.querySelector('#brain-txt');
    if (!anotar(i.value, fFormato, root.querySelector('#brain-curso')?.value || '')) return i.focus();
    i.value = ''; ctx.refresh(); setTimeout(() => document.querySelector('#brain-txt')?.focus(), 30);
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    const d = b.dataset;
    if (b.matches('[data-ia-ideias]')) return iaIdeiasDialog(ctx);
    if (d.bfmt) { fFormato = d.bfmt; root.querySelectorAll('[data-bfmt]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (d.fogo) { const p = store.get('pautas', d.fogo); store.put('pautas', { ...p, fogo: (p.fogo || 0) + 1 }); return ctx.refresh(); }
    if (d.ver) return visualizar(store.get('pautas', d.ver), ctx);
    if (d.virar) { location.hash = '#pauta?ideia=' + d.virar; return; }
    if (d.agendar) return agendarFn(store.get('pautas', d.agendar));
    if (d.descartar) { const p = store.get('pautas', d.descartar); store.put('pautas', { ...p, status: 'Descartada' }); toast('Ideia descartada. Ela continua no banco de pautas.'); return ctx.refresh(); }
  });
  root.querySelectorAll('[data-ideia]').forEach((c) => c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/ideia', c.dataset.ideia); e.dataTransfer.effectAllowed = 'copy'; }));
}

/** Agendar uma ideia num dia: cria o item no calendário e liga à pauta. */
export function agendarIdeia(p, data, ctx) {
  if (!p) return;
  const it = store.put('calendar', { data, tipo: 'Publicação', status: 'Planejado', titulo: p.titulo, formato: p.form?.formato || 'Reels', cursoId: p.form?.cursoId || '', pautaId: p.id });
  store.put('pautas', { ...p, calendarId: it.id });
  toast(`Agendado para ${fmtDate(data)}.`);
  ctx?.refresh?.();
  return it;
}
export { metaSemana, today };
