// Calendário: publicações, gravações, campanhas, turmas e tarefas no mesmo lugar.
// Absorve as abas da planilha (Calendário, Stories e Resultados) sem perder nada.

import { store } from '../store.js';
import { esc, $, $$, today, monthStart, monthEnd, addMonths, addDays, weekStart, fmtDate, fmtDow, toDate, iso, monthName, inRange, num, DOW_HEAD, sum } from '../util.js';
import { settings, courseName, STORY_BLOCKS, storiesCount } from '../metrics.js';
import { openDialog, toast, ICON, badge, confirmButton } from '../ui.js';
import { slug } from './painel.js';

export const TIPOS = ['Publicação', 'Gravação', 'Campanha', 'Turma / curso', 'Tarefa', 'Evento'];
export const STATUS = ['Ideia', 'Planejado', 'Em produção', 'Pronto', 'Publicado', 'Cancelado'];
export const FORMATOS = ['Reels', 'Vídeo motion', 'Carrossel', 'Arte', 'Post estático', 'Stories', 'Live', 'Outro'];
const OBJ = ['Atrair', 'Engajar', 'Gerar confiança', 'Gerar conversas', 'Gerar matrículas'];

let month = monthStart(today());
let tab = 'mes';
let fTipo = '';

export function render(ctx) {
  if (ctx.params.d) { month = monthStart(ctx.params.d); tab = 'mes'; }
  const tabs = [['mes', 'Mês'], ['lista', 'Lista'], ['stories', 'Stories do dia'], ['semanas', 'Resultados semanais']];
  return `
  <div class="toolbar">
    <div class="month-nav"><button class="icon-btn" data-mnav="-1" aria-label="Mês anterior">${ICON.left}</button><h2 class="month-title">${esc(monthName(month))} ${month.slice(0, 4)}</h2><button class="icon-btn" data-mnav="1" aria-label="Próximo mês">${ICON.right}</button><button class="btn sm ghost" data-mnav="0">Hoje</button></div>
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="tab" data-ctab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn primary" data-cadd="${today()}">${ICON.plus} Novo item</button>
  </div>
  ${tab === 'mes' || tab === 'lista' ? `<div class="chips legend" role="group" aria-label="Filtrar por tipo"><button type="button" class="chip" data-tipo="" aria-pressed="${!fTipo}">Todos</button>${TIPOS.map((t) => `<button type="button" class="chip" data-tipo="${esc(t)}" aria-pressed="${fTipo === t}"><span class="type-dot t-${slug(t)}" aria-hidden="true"></span>${esc(t)}</button>`).join('')}</div>` : ''}
  ${tab === 'mes' ? monthView() : tab === 'lista' ? listView() : tab === 'stories' ? storiesView() : weeksView(ctx)}`;
}

function items() {
  return store.all('calendar').filter((i) => inRange(i.data, month, monthEnd(month)) && (!fTipo || i.tipo === fTipo)).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
}

function monthView() {
  const list = items();
  const t = today();
  let d = weekStart(month);
  const end = monthEnd(month);
  const cells = [];
  while (d <= end || cells.length % 7) { cells.push(d); d = addDays(d, 1); }
  const pub = list.filter((i) => i.tipo === 'Publicação');
  return `
  <p class="note">${pub.filter((i) => i.status === 'Publicado').length} de ${pub.filter((i) => i.status !== 'Cancelado').length} publicações do mês já publicadas.</p>
  <div class="cal" role="grid" aria-label="Calendário de ${esc(monthName(month))}">
    <div class="cal-head" role="row">${DOW_HEAD.map((x) => `<span role="columnheader">${x}</span>`).join('')}</div>
    <div class="cal-body">${cells.map((c) => {
      const its = list.filter((i) => i.data === c);
      const out = c.slice(0, 7) !== month.slice(0, 7);
      return `<div class="cal-day${out ? ' out' : ''}${c === t ? ' today' : ''}" role="gridcell">
        <button type="button" class="cal-num" data-cadd="${c}" aria-label="Adicionar em ${fmtDate(c)}">${toDate(c).getDate()}</button>
        ${its.map((i) => `<button type="button" class="cal-item st-${slug(i.status)}" data-cedit="${esc(i.id)}"><span class="type-dot t-${slug(i.tipo)}" aria-hidden="true"></span><span class="ci-t">${esc(i.titulo || i.tipo)}</span></button>`).join('')}
      </div>`;
    }).join('')}</div>
  </div>
  <div class="cal-mobile">${list.length ? agenda(list) : '<p class="empty-sm">Nada neste mês.</p>'}</div>`;
}

function agenda(list) {
  const days = [...new Set(list.map((i) => i.data))];
  return days.map((d) => `<div class="ag-day"><h4>${fmtDate(d)} <small>${fmtDow(d)}</small></h4>${list.filter((i) => i.data === d).map((i) => `<button type="button" class="ag-item" data-cedit="${esc(i.id)}"><span class="type-dot t-${slug(i.tipo)}" aria-hidden="true"></span><span>${esc(i.titulo || i.tipo)}<small>${esc(i.tipo)}${i.formato ? ' · ' + esc(i.formato) : ''} · ${esc(i.status)}</small></span></button>`).join('')}</div>`).join('');
}

function listView() {
  const list = items();
  if (!list.length) return '<p class="empty-sm">Nada neste mês com esse filtro.</p>';
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Curso / campanha</th><th>Tema ou ideia</th><th>Formato</th><th>Pilar</th><th>Objetivo</th><th>CTA</th><th>Status</th><th>Link</th></tr></thead><tbody>${list.map((i) => `<tr>
    <td class="nowrap">${fmtDate(i.data)} <small>${fmtDow(i.data)}</small></td><td><span class="type-dot t-${slug(i.tipo)}" aria-hidden="true"></span> ${esc(i.tipo)}</td><td>${esc(i.cursoId ? courseName(i.cursoId) : i.campanhaTexto || '')}</td>
    <td><button class="link" data-cedit="${esc(i.id)}">${esc(i.titulo || '(sem título)')}</button></td><td>${esc(i.formato || '')}</td><td>${esc(i.pilar || '')}</td><td>${esc(i.objetivo || '')}</td><td>${esc(i.cta || '')}</td>
    <td>${badge(i.status, i.status === 'Publicado' ? 'good' : i.status === 'Cancelado' ? 'neutral' : i.data < today() ? 'warn' : '')}</td><td>${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">abrir</a>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function storiesView() {
  const s = settings();
  const meta = s.metaStoriesDia || 5;
  const days = [];
  for (let d = month; d <= monthEnd(month); d = addDays(d, 1)) days.push(d);
  const done = days.filter((d) => storiesCount(store.get('stories', d)) >= meta).length;
  return `<p class="note">Toque em cada bloco para marcar: vazio → Feito → Pendente → Não se aplica. Meta: ${meta} por dia. <b>${done}</b> dias completos no mês.</p>
  <div class="table-wrap"><table class="tbl stories"><thead><tr><th>Dia</th>${STORY_BLOCKS.map((b) => `<th>${esc(b.label)}</th>`).join('')}<th class="r">Total</th><th>Observações</th></tr></thead><tbody>${days.map((d) => {
    const r = store.get('stories', d);
    const n = storiesCount(r);
    return `<tr class="${d === today() ? 'is-today' : ''}"><td class="nowrap">${fmtDate(d)} <small>${fmtDow(d)}</small></td>${STORY_BLOCKS.map((b) => { const v = r?.blocos?.[b.id] || ''; return `<td><button type="button" class="st-cell st-${slug(v) || 'vazio'}" data-story="${d}" data-block="${b.id}" aria-label="${esc(b.label)} em ${fmtDate(d)}: ${v || 'vazio'}">${esc(v === 'Não se aplica' ? 'N/A' : v || '·')}</button></td>`; }).join('')}<td class="r"><b class="${n >= meta ? 'good' : ''}">${n}</b></td><td><label class="sr" for="so-${d}">Observação</label><input class="cell-input" id="so-${d}" data-sobs="${d}" value="${esc(r?.obs || '')}"></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// Resultados semanais: o que a planilha pedia toda sexta. O que o sistema já sabe vem preenchido.
function weekAuto(ws) {
  const we = addDays(ws, 6);
  const cal = store.all('calendar').filter((i) => inRange(i.data, ws, we) && i.tipo === 'Publicação' && i.status === 'Publicado');
  const leads = store.all('leads');
  const best = cal.slice().sort((a, b) => (Number(b.metricas?.conversas) || 0) + (Number(b.metricas?.interacoes) || 0) / 10 - ((Number(a.metricas?.conversas) || 0) + (Number(a.metricas?.interacoes) || 0) / 10))[0];
  return {
    reels: cal.filter((i) => ['Reels', 'Vídeo motion'].includes(i.formato)).length,
    fotos: cal.filter((i) => ['Carrossel', 'Arte', 'Post estático'].includes(i.formato)).length,
    contatos: leads.filter((l) => inRange(l.entrada, ws, we)).length,
    matriculas: leads.filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, ws, we)).length,
    melhor: best?.titulo || '',
  };
}
const pick = (manual, auto) => (manual === null || manual === undefined || manual === '' ? auto : manual);

function weeksView() {
  const weeks = [];
  for (let w = weekStart(month); w <= monthEnd(month); w = addDays(w, 7)) weeks.push(w);
  const rows = weeks.map((ws) => { const r = store.get('weekly', ws) || { id: ws }; const a = weekAuto(ws); return { ws, r, a }; });
  const tot = (get) => sum(rows, get);
  return `<p class="note">Preencha na sexta. Reels, carrosséis, contatos e matrículas vêm do calendário e do WhatsApp; digite só se quiser corrigir. Valores em itálico são automáticos.</p>
  <div class="table-wrap"><table class="tbl"><thead><tr><th>Semana</th><th class="r">Seguidores início</th><th class="r">Seguidores fim</th><th class="r">Crescimento</th><th class="r">Reels</th><th class="r">Fotos / carrosséis</th><th class="r">Depoimentos</th><th class="r">Avaliações Google</th><th class="r">Contatos</th><th class="r">Matrículas</th><th>Melhor conteúdo</th><th>Aprendizado / próximo passo</th><th></th></tr></thead>
  <tbody>${rows.map(({ ws, r, a }) => {
    const cres = r.seguidoresFim != null && r.seguidoresInicio != null ? r.seguidoresFim - r.seguidoresInicio : null;
    const cell = (m, au) => (m === null || m === undefined || m === '' ? `<i class="auto">${num(au)}</i>` : num(m));
    return `<tr><td class="nowrap">${fmtDate(ws)} a ${fmtDate(addDays(ws, 6))}</td><td class="r">${num(r.seguidoresInicio)}</td><td class="r">${num(r.seguidoresFim)}</td><td class="r"><b>${cres === null ? '—' : (cres > 0 ? '+' : '') + num(cres)}</b></td><td class="r">${cell(r.reels, a.reels)}</td><td class="r">${cell(r.fotos, a.fotos)}</td><td class="r">${num(r.depoimentos)}</td><td class="r">${num(r.avaliacoesGoogle)}</td><td class="r">${cell(r.contatos, a.contatos)}</td><td class="r">${cell(r.matriculas, a.matriculas)}</td><td>${esc(r.melhorConteudo || '')}${!r.melhorConteudo && a.melhor ? `<i class="auto">${esc(a.melhor)}</i>` : ''}</td><td>${esc(r.aprendizado || '')}</td><td><button class="btn sm" data-week="${ws}">Preencher</button></td></tr>`;
  }).join('')}</tbody>
  <tfoot><tr><th>Mês</th><td></td><td></td><td class="r"><b>${num(tot(({ r }) => (r.seguidoresFim != null && r.seguidoresInicio != null ? r.seguidoresFim - r.seguidoresInicio : 0)))}</b></td><td class="r">${num(tot(({ r, a }) => pick(r.reels, a.reels)))}</td><td class="r">${num(tot(({ r, a }) => pick(r.fotos, a.fotos)))}</td><td class="r">${num(tot(({ r }) => r.depoimentos))}</td><td class="r">${num(tot(({ r }) => r.avaliacoesGoogle))}</td><td class="r">${num(tot(({ r, a }) => pick(r.contatos, a.contatos)))}</td><td class="r">${num(tot(({ r, a }) => pick(r.matriculas, a.matriculas)))}</td><td colspan="3"></td></tr></tfoot></table></div>`;
}

function weekDialog(ws, ctx) {
  const r = store.get('weekly', ws) || { id: ws };
  const a = weekAuto(ws);
  const prev = store.get('weekly', addDays(ws, -7));
  openDialog({
    title: 'Semana de ' + fmtDate(ws) + ' a ' + fmtDate(addDays(ws, 6)), wide: true,
    fields: [
      { name: 'seguidoresInicio', label: 'Seguidores no início', type: 'number', value: r.seguidoresInicio ?? prev?.seguidoresFim ?? '' },
      { name: 'seguidoresFim', label: 'Seguidores no fim', type: 'number', value: r.seguidoresFim },
      { name: 'reels', label: `Reels publicados (automático: ${a.reels})`, type: 'number', value: r.reels, placeholder: 'deixe vazio para usar o automático' },
      { name: 'fotos', label: `Fotos / carrosséis (automático: ${a.fotos})`, type: 'number', value: r.fotos, placeholder: 'vazio = automático' },
      { name: 'depoimentos', label: 'Depoimentos gravados', type: 'number', value: r.depoimentos },
      { name: 'avaliacoesGoogle', label: 'Avaliações novas no Google', type: 'number', value: r.avaliacoesGoogle },
      { name: 'contatos', label: `Contatos (automático: ${a.contatos})`, type: 'number', value: r.contatos, placeholder: 'vazio = automático' },
      { name: 'matriculas', label: `Matrículas (automático: ${a.matriculas})`, type: 'number', value: r.matriculas, placeholder: 'vazio = automático' },
      { name: 'melhorConteudo', label: 'Melhor conteúdo', value: r.melhorConteudo || '', placeholder: a.melhor, full: true },
      { name: 'aprendizado', label: 'Aprendizado / próximo passo', type: 'textarea', value: r.aprendizado, full: true },
    ],
    onSave: (d) => { store.put('weekly', { ...r, ...d, id: ws }); toast('Semana salva.'); ctx.refresh(); },
  });
}

export function editItem(it, ctx, preset = {}) {
  const s = settings();
  const isNew = !it;
  it = it || { data: today(), tipo: 'Publicação', status: 'Planejado', ...preset };
  const m = it.metricas || {};
  const courses = [['', '—'], ...store.all('courses').map((c) => [c.id, c.nome])];
  const { dlg } = openDialog({
    title: isNew ? 'Novo item no calendário' : it.titulo || it.tipo, wide: true,
    fields: [
      { name: 'data', label: 'Data', type: 'date', value: it.data, required: true },
      { name: 'hora', label: 'Hora', type: 'time', value: it.hora },
      { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS, value: it.tipo },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, value: it.status },
      { name: 'titulo', label: 'Tema ou ideia', value: it.titulo, required: true, full: true },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courses, value: it.cursoId },
      { name: 'campanhaTexto', label: 'Campanha ou ação', value: it.campanhaTexto, placeholder: 'ex.: Evento/Ação local' },
      { name: 'formato', label: 'Formato', type: 'select', options: ['', ...FORMATOS], value: it.formato },
      { name: 'pilar', label: 'Pilar', type: 'select', options: ['', ...s.pilares], value: it.pilar },
      { name: 'objetivo', label: 'Objetivo', type: 'select', options: ['', ...OBJ], value: it.objetivo },
      { name: 'cta', label: 'Chamada para ação', value: it.cta },
      { name: 'responsavel', label: 'Responsável', value: it.responsavel, list: 'resp-list' },
      { name: 'link', label: 'Link do post', type: 'url', value: it.link },
      { name: 'notas', label: 'Observações', type: 'textarea', value: it.notas, full: true },
    ],
    html: `<datalist id="resp-list">${(s.responsaveis || []).map((r) => `<option value="${esc(r)}">`).join('')}</datalist>
      <details class="more" ${it.status === 'Publicado' ? 'open' : ''}><summary>Resultado do post (preencha 2 a 3 dias depois)</summary>
      <div class="form-grid">${[['alcance', 'Alcance'], ['interacoes', 'Curtidas + reações'], ['comentarios', 'Comentários'], ['salvamentos', 'Salvamentos'], ['compartilhamentos', 'Compartilhamentos'], ['conversas', 'Conversas no WhatsApp geradas']].map(([k, l]) => `<div class="field"><label for="m_${k}">${l}</label><input type="number" id="m_${k}" name="m_${k}" value="${esc(m[k] ?? '')}" min="0"></div>`).join('')}</div></details>
      <div class="row-actions">${it.pautaId && store.get('pautas', it.pautaId) ? `<a class="btn sm" href="#pauta?id=${esc(it.pautaId)}">Abrir pauta</a>` : ''}${!isNew ? `<a class="btn sm" href="#pauta?de=${esc(it.id)}">Criar briefing na Pauta Viral</a>` : ''}</div>`,
    onSave: (d) => {
      const metricas = {};
      Object.keys(d).filter((k) => k.startsWith('m_')).forEach((k) => { if (d[k] !== null) metricas[k.slice(2)] = d[k]; delete d[k]; });
      store.put('calendar', { ...it, ...d, metricas });
      toast('Salvo no calendário.');
      ctx.refresh();
    },
    onDelete: isNew ? null : () => { store.remove('calendar', it.id); toast('Item excluído.'); ctx.refresh(); },
  });
  $$('a', dlg).forEach((a) => a.addEventListener('click', () => dlg.close()));
}

const CYCLE = ['', 'Feito', 'Pendente', 'Não se aplica'];

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.mnav !== undefined) { const n = Number(ds.mnav); month = n === 0 ? monthStart(today()) : addMonths(month, n); if (ctx.params.d) history.replaceState(null, '', '#calendario'); ctx.params.d = ''; ctx.refresh(); return; }
    if (ds.ctab) { tab = ds.ctab; ctx.params.d = ''; ctx.refresh(); return; }
    if (ds.tipo !== undefined) { fTipo = ds.tipo; ctx.refresh(); return; }
    if (ds.cadd) return editItem(null, ctx, { data: ds.cadd });
    if (ds.cedit) return editItem(store.get('calendar', ds.cedit), ctx);
    if (ds.week) return weekDialog(ds.week, ctx);
    if (ds.story) {
      const r = store.get('stories', ds.story) || { id: ds.story, blocos: {} };
      const cur = r.blocos?.[ds.block] || '';
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      store.put('stories', { ...r, id: ds.story, blocos: { ...(r.blocos || {}), [ds.block]: next } });
      ctx.refresh();
    }
  });
  $$('[data-sobs]', root).forEach((inp) => inp.addEventListener('change', () => { const d = inp.dataset.sobs; const r = store.get('stories', d) || { id: d, blocos: {} }; store.put('stories', { ...r, id: d, obs: inp.value.trim() }); }));
  void confirmButton; void iso;
}
