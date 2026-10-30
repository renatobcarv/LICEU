// Quadro: um quadro em branco para planejar (estilo Miro, simplificado).
// Notas, textos e seções livres, mais "cartões vivos" que mostram dados reais do sistema:
// um lead, uma etapa do funil, uma campanha, uma ideia ou uma meta. O número se atualiza sozinho.

import { store } from '../store.js';
import { esc, $, $$, brl, brl2, num, fmtDate, today, monthStart, monthEnd, uid } from '../util.js';
import { campaignRows, campaignName, courseName, goalProgress } from '../metrics.js';
import { toast, ICON, openDialog } from '../ui.js';
import { pipelines, leadPipeId, leadCol, leadStage } from '../leads.js';

export const autoRefresh = false; // o quadro se redesenha sozinho; mudanças de outras telas não interrompem o arraste

const BOARD_KEY = 'liceu.quadro.atual';
const CORES = ['neutro', 'ouro', 'laranja', 'verde', 'vermelho'];
const CORES_NOME = { neutro: 'Neutra', ouro: 'Lima', laranja: 'Azul', verde: 'Verde', vermelho: 'Vermelho' };
const ZMIN = 0.3, ZMAX = 2;

let boardId = (() => { try { return localStorage.getItem(BOARD_KEY) || ''; } catch (e) { return ''; } })();
let selected = null;
let saveTimer = null;

const setBoard = (id) => { boardId = id; try { localStorage.setItem(BOARD_KEY, id); } catch (e) { /* opcional */ } };
const boards = () => store.all('boards').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
const current = () => store.get('boards', boardId) || boards()[0] || null;

// ---------- modelos de quadro ----------
function note(x, y, texto, cor = 'ouro', w = 200, h = 130) { return { id: uid('n'), tipo: 'nota', x, y, w, h, cor, texto }; }
function secao(x, y, w, h, texto) { return { id: uid('s'), tipo: 'secao', x, y, w, h, cor: 'neutro', texto }; }
function texto(x, y, t, w = 360) { return { id: uid('t'), tipo: 'texto', x, y, w, h: 60, cor: 'neutro', texto: t }; }

const MODELOS = {
  branco: { nome: 'Quadro em branco', itens: () => [] },
  mes: {
    nome: 'Plano do mês',
    itens: () => {
      const out = [texto(40, 20, 'Plano do mês: o que fazemos para bater a meta de matrículas', 720)];
      const cols = [['Meta e números', 'Quantas matrículas? Qual CAC máximo?'], ['O que trava', 'Onde o funil para? (veja Funil › Análise)'], ['Ações da semana', 'Uma ação por nota, com dono e data'], ['Testes', 'Hipótese → indicador → prazo']];
      cols.forEach(([t, d], i) => { out.push(secao(40 + i * 300, 100, 280, 520, t)); out.push(note(60 + i * 300, 160, d, ['ouro', 'vermelho', 'laranja', 'verde'][i], 240, 110)); });
      return out;
    },
  },
  funil: {
    nome: 'Análise do funil',
    itens: () => {
      const p = pipelines()[0];
      const out = [texto(40, 20, p.nome + ': cada coluna mostra quantas pessoas estão na etapa agora', 760)];
      p.etapas.forEach((e, i) => {
        out.push(secao(40 + i * 250, 100, 230, 440, e.nome));
        out.push({ id: uid('v'), tipo: 'vivo', x: 55 + i * 250, y: 150, w: 200, h: 110, cor: 'neutro', ref: { kind: 'etapa', id: p.id + '|' + e.id } });
        out.push(note(55 + i * 250, 280, 'Por que as pessoas param aqui?', 'laranja', 200, 110));
      });
      return out;
    },
  },
  campanha: {
    nome: 'Planejar campanha',
    itens: () => [
      texto(40, 20, 'Campanha: do anúncio à matrícula', 520),
      secao(40, 100, 260, 420, 'Público'), secao(320, 100, 260, 420, 'Oferta e criativo'), secao(600, 100, 260, 420, 'Atendimento'), secao(880, 100, 260, 420, 'Como medir'),
      note(60, 160, 'Quem é? Idade, região, momento de vida', 'ouro', 220, 110), note(340, 160, 'Gancho dos 3 primeiros segundos', 'laranja', 220, 110),
      note(620, 160, 'Resposta pronta e tempo da 1ª resposta', 'verde', 220, 110), note(900, 160, 'CAC alvo e meta de conversas', 'vermelho', 220, 110),
    ],
  },
};

// ---------- cartões vivos ----------
function liveData(ref) {
  const t = today();
  if (ref.kind === 'lead') {
    const l = store.get('leads', ref.id);
    if (!l) return { titulo: 'Lead excluído', linhas: [] };
    return { titulo: l.nome, sub: leadStage(l), href: '#funil', cor: l.etapa === 'matriculado' ? 'verde' : l.etapa === 'perdido' ? 'vermelho' : l.proximaData && l.proximaData < t ? 'laranja' : 'neutro',
      linhas: [courseName(l.cursoId), l.valor ? brl(l.valor) : '', l.proximaData ? 'Retorno ' + fmtDate(l.proximaData) : '', l.responsavel || ''].filter(Boolean) };
  }
  if (ref.kind === 'etapa') {
    const [pid, eid] = ref.id.split('|');
    const p = pipelines().find((x) => x.id === pid);
    const e = p?.etapas.find((x) => x.id === eid);
    if (!e) return { titulo: 'Etapa removida', linhas: [] };
    const its = store.all('leads').filter((l) => leadPipeId(l) === p.id && !['matriculado', 'perdido'].includes(l.etapa) && leadCol(l, p) === e.id);
    const late = its.filter((l) => l.proximaData && l.proximaData < t).length;
    return { titulo: e.nome, sub: p.nome, big: num(its.length), href: '#funil?pipe=' + encodeURIComponent(p.id), cor: e.limite && its.length > e.limite ? 'vermelho' : 'neutro',
      linhas: [late ? late + ' com retorno atrasado' : 'nenhum retorno atrasado', e.limite ? 'limite ' + e.limite : ''].filter(Boolean) };
  }
  if (ref.kind === 'campanha') {
    const r = campaignRows(monthStart(t), monthEnd(t)).find((x) => x.id === ref.id);
    if (!store.get('campaigns', ref.id)) return { titulo: 'Campanha removida', linhas: [] };
    return { titulo: campaignName(ref.id), sub: 'Este mês', big: r ? brl2(r.investimento) : '—', href: '#meta?c=' + encodeURIComponent(ref.id),
      linhas: r ? [num(r.resultados) + ' resultados', num(r.matriculas) + ' matrículas', 'CAC ' + brl2(r.cac)] : ['sem dados no mês'] };
  }
  if (ref.kind === 'ideia') {
    const i = store.get('ideas', ref.id);
    if (!i) return { titulo: 'Ideia excluída', linhas: [] };
    return { titulo: i.titulo, sub: i.status || 'Ideia', href: '#metas?tab=ideias', cor: i.status === 'Em teste' ? 'laranja' : i.status === 'Concluído' ? 'verde' : 'neutro', linhas: [i.hipotese || '', i.decisao ? 'Decisão: ' + i.decisao : ''].filter(Boolean) };
  }
  if (ref.kind === 'meta') {
    const g = store.get('goals', ref.id);
    if (!g) return { titulo: 'Meta excluída', linhas: [] };
    const pr = goalProgress(g);
    return { titulo: g.nome, sub: fmtDate(g.inicio) + ' a ' + fmtDate(g.fim), big: pr.progresso === null ? '—' : Math.round(pr.progresso * 100) + '%', href: '#metas', cor: pr.status === 'ok' ? 'verde' : pr.status === 'bad' ? 'vermelho' : pr.status === 'warn' ? 'laranja' : 'neutro', linhas: [pr.texto] };
  }
  return { titulo: '?', linhas: [] };
}

// ---------- desenho ----------
function itemHTML(it) {
  const sel = selected === it.id ? ' sel' : '';
  const style = `left:${it.x}px;top:${it.y}px;width:${it.w}px;${it.tipo === 'texto' ? '' : `height:${it.h}px;`}`;
  if (it.tipo === 'vivo') {
    const d = liveData(it.ref);
    return `<div class="qi qi-vivo c-${d.cor || 'neutro'}${sel}" data-id="${esc(it.id)}" style="${style}">
      <p class="qv-k">${esc(KIND_LABEL[it.ref.kind] || '')}${d.sub ? ' · ' + esc(d.sub) : ''}</p>
      <p class="qv-t">${esc(d.titulo)}</p>${d.big ? `<p class="qv-big">${esc(d.big)}</p>` : ''}
      ${d.linhas.map((x) => `<p class="qv-l">${esc(x)}</p>`).join('')}
      ${d.href ? `<a class="qv-open" href="${esc(d.href)}" data-nodrag>Abrir ${ICON.arrow}</a>` : ''}
      <span class="qi-rs" data-rs aria-hidden="true"></span></div>`;
  }
  return `<div class="qi qi-${it.tipo} c-${it.cor || 'neutro'}${sel}" data-id="${esc(it.id)}" style="${style}">
    <div class="qi-txt" data-txt>${esc(it.texto || '')}</div>${it.tipo === 'texto' ? '' : '<span class="qi-rs" data-rs aria-hidden="true"></span>'}</div>`;
}
const KIND_LABEL = { lead: 'Lead', etapa: 'Etapa do funil', campanha: 'Campanha', ideia: 'Ideia', meta: 'Meta' };

export function render() {
  const bs = boards();
  const b = current();
  if (b) setBoard(b.id);
  return `<section class="pipe-bar" aria-label="Quadros">
    <div class="pipe-tabs scroll-x" role="tablist">${bs.map((x) => `<button type="button" class="pipe-tab" role="tab" data-board="${esc(x.id)}" aria-selected="${b && x.id === b.id}"><span>${esc(x.nome)}</span></button>`).join('')}
      <button type="button" class="pipe-tab add" data-q="new">${ICON.plus} Novo quadro</button></div>
    ${b ? '<button type="button" class="btn sm ghost" data-q="rename">Renomear ou excluir</button>' : ''}
  </section>
  ${b ? `<div class="qb-tools" role="toolbar" aria-label="Ferramentas do quadro">
      <button type="button" class="btn sm" data-q="nota">+ Nota</button>
      <button type="button" class="btn sm" data-q="texto">+ Texto</button>
      <button type="button" class="btn sm" data-q="secao">+ Seção</button>
      <button type="button" class="btn sm primary" data-q="vivo">+ Cartão vivo</button>
      <span class="qb-sep"></span>
      <span class="qb-colors" id="qb-colors" aria-label="Cor do item selecionado">${CORES.map((c) => `<button type="button" class="sw c-${c}" data-cor="${c}" title="${CORES_NOME[c]}" aria-label="Cor ${CORES_NOME[c]}"></button>`).join('')}</span>
      <button type="button" class="btn sm ghost" data-q="dup" title="Duplicar (Ctrl+D)">Duplicar</button>
      <button type="button" class="btn sm ghost danger" data-q="del" title="Excluir (Delete)">Excluir</button>
      <span class="grow"></span>
      <button type="button" class="icon-btn sm" data-q="zout" aria-label="Diminuir zoom">−</button><span class="qb-z" id="qb-z"></span><button type="button" class="icon-btn sm" data-q="zin" aria-label="Aumentar zoom">+</button>
      <button type="button" class="btn sm ghost" data-q="fit">Ver tudo</button>
    </div>
    <div class="qb-view" id="qb-view" tabindex="0" aria-label="Quadro ${esc(b.nome)}. Clique duas vezes no fundo para criar uma nota."><div class="qb-world" id="qb-world"></div></div>
    <p class="hint">Duplo clique no fundo cria uma nota; duplo clique numa nota edita o texto. Arraste o fundo para mover o quadro; Ctrl + roda do mouse para zoom. Delete apaga o item selecionado.</p>`
    : `<section class="card qb-empty"><h2>Planeje como num quadro em branco</h2><p class="muted">Notas, seções e cartões que mostram números reais: quantas pessoas estão em cada etapa do funil, quanto cada campanha gastou, o andamento de uma meta.</p>
      <div class="row-actions">${Object.entries(MODELOS).map(([k, m]) => `<button type="button" class="btn${k === 'mes' ? ' primary' : ''}" data-model="${k}">${esc(m.nome)}</button>`).join('')}</div></section>`}`;
}

export function mount(root, ctx) {
  const b = current();
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-board],[data-q],[data-model],[data-cor]');
    if (!t) return;
    const ds = t.dataset;
    if (ds.board) { setBoard(ds.board); selected = null; return ctx.refresh(); }
    if (ds.model) return createBoard(ds.model, ctx);
    if (ds.q === 'new') return newBoardDialog(ctx);
    if (ds.q === 'rename') return renameDialog(b, ctx);
  });
  if (!b) return;

  const view = $('#qb-view', root);
  const world = $('#qb-world', root);
  b.vista = b.vista || { x: 0, y: 0, z: 1 };
  b.itens = b.itens || [];
  const v = b.vista;

  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.put('boards', b), 400); };
  const applyView = () => { world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`; view.style.backgroundPosition = `${v.x}px ${v.y}px`; view.style.backgroundSize = `${24 * v.z}px ${24 * v.z}px`; $('#qb-z', root).textContent = Math.round(v.z * 100) + '%'; };
  const draw = () => {
    const order = [...b.itens].sort((a, c) => (a.tipo === 'secao' ? 0 : 1) - (c.tipo === 'secao' ? 0 : 1));
    world.innerHTML = order.map(itemHTML).join('');
    $$('.sw', root).forEach((s) => s.setAttribute('aria-pressed', !!selected && b.itens.find((i) => i.id === selected)?.cor === s.dataset.cor));
  };
  const toWorld = (cx, cy) => { const r = view.getBoundingClientRect(); return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; };
  const center = () => { const r = view.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };
  const add = (it) => { b.itens.push(it); selected = it.id; draw(); save(); return it; };
  const find = (id) => b.itens.find((i) => i.id === id);
  const zoomAt = (z, cx, cy) => {
    const r = view.getBoundingClientRect();
    const nz = Math.min(ZMAX, Math.max(ZMIN, z));
    const px = cx - r.left, py = cy - r.top;
    v.x = px - ((px - v.x) / v.z) * nz; v.y = py - ((py - v.y) / v.z) * nz; v.z = nz;
    applyView(); save();
  };
  const fit = () => {
    if (!b.itens.length) { v.x = 0; v.y = 0; v.z = 1; applyView(); return; }
    const r = view.getBoundingClientRect();
    const minX = Math.min(...b.itens.map((i) => i.x)), minY = Math.min(...b.itens.map((i) => i.y));
    const maxX = Math.max(...b.itens.map((i) => i.x + i.w)), maxY = Math.max(...b.itens.map((i) => i.y + (i.h || 60)));
    const z = Math.min(1.2, Math.max(ZMIN, Math.min((r.width - 60) / (maxX - minX || 1), (r.height - 60) / (maxY - minY || 1))));
    v.z = z; v.x = (r.width - (maxX - minX) * z) / 2 - minX * z; v.y = (r.height - (maxY - minY) * z) / 2 - minY * z;
    applyView(); save();
  };
  const editText = (el, it) => {
    const tx = $('[data-txt]', el);
    if (!tx) return;
    tx.contentEditable = 'true'; tx.focus();
    const rg = document.createRange(); rg.selectNodeContents(tx); const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    const done = () => { tx.contentEditable = 'false'; it.texto = tx.innerText.trim(); save(); tx.removeEventListener('blur', done); };
    tx.addEventListener('blur', done);
    tx.addEventListener('keydown', (e) => { if (e.key === 'Escape') { tx.blur(); } e.stopPropagation(); });
  };
  const removeSel = () => { if (!selected) return toast('Selecione um item primeiro.', 'warn'); b.itens = b.itens.filter((i) => i.id !== selected); selected = null; draw(); save(); };
  const dupSel = () => { const it = find(selected); if (!it) return toast('Selecione um item primeiro.', 'warn'); add({ ...JSON.parse(JSON.stringify(it)), id: uid('n'), x: it.x + 24, y: it.y + 24 }); };

  applyView(); draw();
  if (!b.itens.length || !b.vista.visto) { b.vista.visto = true; requestAnimationFrame(fit); }

  // Ferramentas
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-q],[data-cor]');
    if (!t) return;
    const q = t.dataset.q;
    const c = center();
    if (q === 'nota') { const it = add(note(c.x - 100, c.y - 65, '')); requestAnimationFrame(() => editText($(`[data-id="${it.id}"]`, world), it)); }
    if (q === 'texto') { const it = add(texto(c.x - 150, c.y - 20, 'Título', 300)); requestAnimationFrame(() => editText($(`[data-id="${it.id}"]`, world), it)); }
    if (q === 'secao') add(secao(c.x - 160, c.y - 200, 320, 400, 'Nova seção'));
    if (q === 'vivo') liveDialog((ref) => add({ id: uid('v'), tipo: 'vivo', x: c.x - 110, y: c.y - 70, w: 220, h: 130, cor: 'neutro', ref }), (refs) => { const x0 = b.itens.length ? Math.max(...b.itens.map((i) => i.x + i.w)) + 80 : c.x - 340; const y0 = b.itens.length ? Math.min(...b.itens.map((i) => i.y)) : c.y - 140; refs.forEach((ref, i) => b.itens.push({ id: uid('v'), tipo: 'vivo', x: x0 + (i % 3) * 235, y: y0 + Math.floor(i / 3) * 145, w: 220, h: 130, cor: 'neutro', ref })); draw(); save(); fit(); toast(refs.length + ' cartões colocados à direita do quadro.'); });
    if (q === 'del') removeSel();
    if (q === 'dup') dupSel();
    if (q === 'zin') { const r = view.getBoundingClientRect(); zoomAt(v.z * 1.2, r.left + r.width / 2, r.top + r.height / 2); }
    if (q === 'zout') { const r = view.getBoundingClientRect(); zoomAt(v.z / 1.2, r.left + r.width / 2, r.top + r.height / 2); }
    if (q === 'fit') fit();
    if (t.dataset.cor) { const it = find(selected); if (!it) return toast('Selecione uma nota ou seção para mudar a cor.', 'warn'); it.cor = t.dataset.cor; draw(); save(); }
  });

  // Arrastar, mover o quadro e redimensionar (mouse, caneta e toque)
  let drag = null;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('[data-nodrag]')) return;
    const el = e.target.closest('.qi');
    if (el && el.querySelector('[contenteditable="true"]')) return;
    view.focus({ preventScroll: true });
    if (el) {
      const it = find(el.dataset.id);
      if (selected !== it.id) { selected = it.id; $$('.qi.sel', world).forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); $$('.sw', root).forEach((s) => s.setAttribute('aria-pressed', it.cor === s.dataset.cor)); }
      const resize = !!e.target.closest('[data-rs]');
      // Mover uma seção leva junto o que está dentro dela.
      const inside = !resize && it.tipo === 'secao' ? b.itens.filter((o) => o !== it && o.x >= it.x && o.y >= it.y && o.x + o.w <= it.x + it.w + 1 && o.y <= it.y + it.h).map((o) => ({ o, x: o.x, y: o.y })) : [];
      drag = { kind: resize ? 'resize' : 'move', it, el, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, oh: it.h, inside, moved: false };
    } else {
      if (selected) { selected = null; $$('.qi.sel', world).forEach((x) => x.classList.remove('sel')); }
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y };
      view.classList.add('panning');
    }
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (drag.kind === 'pan') { v.x = drag.ox + dx; v.y = drag.oy + dy; applyView(); return; }
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const it = drag.it;
    if (drag.kind === 'move') {
      it.x = Math.round(drag.ox + dx / v.z); it.y = Math.round(drag.oy + dy / v.z);
      drag.el.style.left = it.x + 'px'; drag.el.style.top = it.y + 'px';
      drag.inside.forEach(({ o, x, y }) => { o.x = Math.round(x + dx / v.z); o.y = Math.round(y + dy / v.z); const oe = $(`[data-id="${CSS.escape(o.id)}"]`, world); if (oe) { oe.style.left = o.x + 'px'; oe.style.top = o.y + 'px'; } });
    } else {
      it.w = Math.max(120, Math.round(drag.ow + dx / v.z)); it.h = Math.max(70, Math.round(drag.oh + dy / v.z));
      drag.el.style.width = it.w + 'px'; drag.el.style.height = it.h + 'px';
    }
  });
  const end = () => { if (!drag) return; if (drag.kind === 'pan' || drag.moved) save(); drag = null; view.classList.remove('panning'); };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.qi');
    if (el) { const it = find(el.dataset.id); if (it.tipo !== 'vivo') editText(el, it); return; }
    const p = toWorld(e.clientX, e.clientY);
    const it = add(note(Math.round(p.x - 100), Math.round(p.y - 65), ''));
    requestAnimationFrame(() => editText($(`[data-id="${it.id}"]`, world), it));
  });
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(v.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
    else { v.x -= e.deltaX; v.y -= e.deltaY; applyView(); save(); }
  }, { passive: false });
  view.addEventListener('keydown', (e) => {
    if (e.target.isContentEditable) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeSel(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); dupSel(); }
    if (e.key === 'Enter' && selected) { const el = $(`[data-id="${CSS.escape(selected)}"]`, world); const it = find(selected); if (el && it.tipo !== 'vivo') { e.preventDefault(); editText(el, it); } }
  });
}

function createBoard(model, ctx, nome) {
  const m = MODELOS[model] || MODELOS.branco;
  const b = store.put('boards', { nome: nome || m.nome, itens: m.itens(), vista: { x: 0, y: 0, z: 1 } });
  setBoard(b.id); selected = null;
  toast('Quadro criado.');
  ctx.refresh();
}

function newBoardDialog(ctx) {
  openDialog({
    title: 'Novo quadro', saveLabel: 'Criar quadro',
    fields: [
      { name: 'nome', label: 'Nome', required: true, placeholder: 'ex.: Plano de novembro', full: true },
      { name: 'modelo', label: 'Começar com', type: 'select', options: Object.entries(MODELOS).map(([k, m]) => [k, m.nome]), value: 'branco', full: true },
    ],
    onSave: (d) => createBoard(d.modelo, ctx, d.nome),
  });
}

function renameDialog(b, ctx) {
  openDialog({
    title: 'Quadro', saveLabel: 'Salvar',
    fields: [{ name: 'nome', label: 'Nome', value: b.nome, required: true, full: true }],
    onSave: (d) => { store.put('boards', { ...b, nome: d.nome }); ctx.refresh(); },
    onDelete: () => { store.remove('boards', b.id); setBoard(''); toast('Quadro excluído.'); ctx.refresh(); },
    deleteLabel: 'Excluir quadro',
  });
}

// Escolher o que o cartão vivo mostra. "Leads de uma etapa" coloca vários cartões de uma vez.
function liveDialog(onOne, onMany) {
  const opts = {
    etapa: pipelines().flatMap((p) => p.etapas.map((e) => [p.id + '|' + e.id, p.nome + ' › ' + e.nome])),
    campanha: store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome]),
    meta: store.all('goals').map((g) => [g.id, g.nome]),
    ideia: store.all('ideas').map((i) => [i.id, (i.titulo || 'Ideia') + ' · ' + (i.status || 'Ideia')]),
    lead: store.all('leads').sort((a, b) => (b.entrada || '').localeCompare(a.entrada || '')).slice(0, 400).map((l) => [l.id, l.nome + ' · ' + leadStage(l)]),
    leadsEtapa: pipelines().flatMap((p) => p.etapas.map((e) => [p.id + '|' + e.id, p.nome + ' › ' + e.nome])),
  };
  const kinds = [['etapa', 'Etapa do funil (contagem ao vivo)'], ['campanha', 'Campanha (gasto, matrículas, CAC do mês)'], ['meta', 'Meta (progresso)'], ['ideia', 'Ideia ou teste'], ['lead', 'Um lead'], ['leadsEtapa', 'Todos os leads de uma etapa (até 24)']];
  const optHTML = (k) => (opts[k].length ? opts[k] : [['', 'Nada cadastrado ainda']]).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  openDialog({
    title: 'Cartão vivo', saveLabel: 'Colocar no quadro',
    fields: [
      { name: 'kind', label: 'O que mostrar', type: 'select', options: kinds, value: 'etapa', full: true },
      { name: 'ref', label: 'Qual', type: 'select', options: opts.etapa.length ? opts.etapa : [['', 'Nada cadastrado ainda']], full: true },
    ],
    html: '<p class="hint">O cartão lê os dados do sistema toda vez que o quadro abre. Não precisa atualizar à mão.</p>',
    onOpen: (form) => {
      const k = $('[name="kind"]', form), r = $('[name="ref"]', form);
      k.addEventListener('change', () => { r.innerHTML = optHTML(k.value); });
      k.focus();
    },
    onSave: (d) => {
      if (!d.ref) { toast('Não há nada desse tipo cadastrado ainda.', 'warn'); return false; }
      if (d.kind === 'leadsEtapa') {
        const [pid, eid] = d.ref.split('|');
        const p = pipelines().find((x) => x.id === pid);
        const its = store.all('leads').filter((l) => leadPipeId(l) === pid && !['matriculado', 'perdido'].includes(l.etapa) && leadCol(l, p) === eid).slice(0, 24);
        if (!its.length) { toast('Essa etapa está vazia.', 'warn'); return false; }
        onMany(its.map((l) => ({ kind: 'lead', id: l.id })));
        return;
      }
      onOne({ kind: d.kind, id: d.ref });
    },
  });
}
