// Funil comercial em Kanban: cada conversa do WhatsApp vira um cartão que você arrasta até a matrícula.
// É a peça central da operação: sem o lead registrado com a campanha, não existe CAC real.

import { store } from '../store.js';
import { esc, $, $$, brl, num, pct, fmtDate, today, daysBetween, parseCSV, parseDate, norm, phoneKey, toCSV, inRange, sum } from '../util.js';
import { STAGES, STAGE_IDX, ORIGENS, salesStats, courseName, campaignName, settings } from '../metrics.js';
import { toast, ICON, funnel, empty, readFileText, downloadFile, copyText, openDialog, badge } from '../ui.js';
import { moveLead, matriculaDialog, loseDialog, editLead, courseOpts, campOpts, stageLabel } from '../leads.js';

let tab = 'kanban';
let q = '';
let fCurso = '';

const COLS = [...STAGES, { id: 'perdido', label: 'Perdido' }];

export function render(ctx) {
  const { from, to, f, params } = ctx;
  if (params.etapa || params.vencidos) tab = 'lista';
  const s = salesStats(from, to, f);
  const tabs = [['kanban', 'Kanban'], ['lista', 'Lista'], ['analise', 'Análise'], ['respostas', 'Respostas prontas']];
  return `
  <form class="quick card" id="quick" autocomplete="off" aria-label="Registrar lead">
    <h2>Nova conversa no WhatsApp</h2>
    <div class="quick-grid">
      <div class="field"><label for="q-nome">Nome</label><input id="q-nome" name="nome" required placeholder="Como a pessoa se apresentou"></div>
      <div class="field"><label for="q-tel">WhatsApp</label><input id="q-tel" name="telefone" inputmode="tel" placeholder="(61) 9 0000-0000"></div>
      <div class="field"><label for="q-curso">Curso de interesse</label><select id="q-curso" name="cursoId">${courseOpts().map(([v, l]) => `<option value="${esc(v)}"${v === f.cursoId ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="q-origem">Como chegou</label><select id="q-origem" name="origem">${ORIGENS.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>
      <div class="field" id="q-camp-wrap"><label for="q-camp">Campanha</label><select id="q-camp" name="campanhaId">${campOpts().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="q-resp">1ª resposta (min)</label><input id="q-resp" name="primeiraResposta" type="number" min="0" inputmode="numeric" placeholder="ex.: 5"></div>
      <button class="btn primary" type="submit">${ICON.plus} Adicionar ao funil</button>
    </div>
  </form>

  <section class="kpis compact" aria-label="Funil no período">
    ${[['Entraram no período', num(s.leads)], ['Em aberto', num(s.abertos.length)], ['Matrículas', num(s.matriculas)], ['Conversão', pct(s.convLead)], ['Em negociação', brl(sum(s.abertos.filter((l) => l.etapa === 'negociacao'), (l) => l.valor))], ['Retornos atrasados', num(s.followVencidos.length)], ['Sem 1º contato', num(s.semContato.length)], ['1ª resposta média', s.tempoResposta === null ? '—' : num(s.tempoResposta) + ' min']].map(([l, v]) => `<article class="kpi"><h3>${l}</h3><p class="kpi-v">${v}</p></article>`).join('')}
  </section>

  <div class="toolbar">
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="tab" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn sm" data-act="import">${ICON.upload} Importar contatos</button>
    <button class="btn sm" data-act="export">${ICON.download} CSV</button>
  </div>
  <div id="tab-body">${body(ctx, s)}</div>`;
}

function body(ctx, s) {
  if (tab === 'kanban') return board(ctx);
  if (tab === 'lista') return list(ctx);
  if (tab === 'analise') return analysis(ctx, s);
  return respostas();
}

function filtered(ctx) {
  const qq = norm(q);
  return store.all('leads').filter((l) => (!ctx.f.cursoId || l.cursoId === ctx.f.cursoId) && (!fCurso || l.cursoId === fCurso) && (!qq || norm(l.nome + ' ' + l.telefone + ' ' + (l.notas || '')).includes(qq)));
}

function cardHTML(l) {
  const t = today();
  const dias = l.entrada ? daysBetween(l.entrada, t) : 0;
  const late = l.proximaData && l.proximaData < t && !['matriculado', 'perdido'].includes(l.etapa);
  const idx = STAGE_IDX[l.etapa];
  return `<article class="lead${late ? ' late' : ''}" draggable="true" data-drag="${esc(l.id)}" aria-label="${esc(l.nome)}, ${esc(stageLabel(l.etapa))}">
    <button type="button" class="lead-open" data-edit="${esc(l.id)}"><b>${esc(l.nome)}</b><small>${esc(courseName(l.cursoId))}</small></button>
    <p class="lead-meta">${esc(l.origem || '')}${l.campanhaId ? ' · ' + esc(campaignName(l.campanhaId)) : ''}</p>
    ${l.etapa === 'matriculado' ? `<p class="lead-meta"><b class="good">${brl(l.valor)}</b> · ${esc(l.statusPagamento || 'Pago')} · ${fmtDate(l.dataMatricula)}</p>` : `<p class="lead-meta">${dias === 0 ? 'Entrou hoje' : 'Há ' + dias + (dias > 1 ? ' dias' : ' dia')}${l.proximaData ? ` · <span class="${late ? 'bad' : ''}">retorno ${fmtDate(l.proximaData)}</span>` : ''}</p>`}
    ${l.proximaAcao && l.etapa !== 'matriculado' ? `<p class="lead-next">${esc(l.proximaAcao)}</p>` : ''}
    ${idx < 4 ? `<div class="lead-actions"><button type="button" class="btn sm" data-adv="${esc(l.id)}">${idx === 3 ? 'Matricular' : 'Avançar'} ${ICON.arrow}</button><button type="button" class="btn sm ghost" data-lose="${esc(l.id)}">Perdido</button></div>` : ''}
  </article>`;
}

function board(ctx) {
  const leads = filtered(ctx);
  // Abertos aparecem sempre; matriculados e perdidos só do período, para o quadro não crescer sem fim.
  const visible = leads.filter((l) => !['matriculado', 'perdido'].includes(l.etapa) || inRange(l.dataMatricula || l.dataPerda || l.entrada, ctx.from, ctx.to));
  if (!store.all('leads').length) return empty('O funil está vazio', 'Registre cada conversa nova no formulário acima. Depois arraste o cartão entre as colunas até a matrícula.');
  const counts = COLS.map((c) => visible.filter((l) => l.etapa === c.id).length);
  return `<div class="search-row"><label class="sr" for="v-q">Buscar no funil</label><input type="search" id="v-q" placeholder="Buscar por nome, telefone ou anotação" value="${esc(q)}"><span class="muted">Arraste os cartões entre as colunas. No celular, use os botões do cartão.</span></div>
  <div class="board" id="board">${COLS.map((c, i) => {
    const items = visible.filter((l) => l.etapa === c.id).sort((a, b) => (a.proximaData || '9').localeCompare(b.proximaData || '9') || (b.entrada || '').localeCompare(a.entrada || ''));
    const more = items.length - 15;
    const valor = sum(items, (l) => l.valor);
    const conv = i > 0 && i < 5 && counts[i - 1] ? Math.round((counts[i] / (counts[i - 1] + counts[i])) * 100) : null;
    return `<section class="col col-${c.id}" data-drop="${c.id}" aria-label="${esc(c.label)}">
      <header><h3>${esc(c.label)}</h3><span class="count">${items.length}</span></header>
      ${valor && (c.id === 'negociacao' || c.id === 'matriculado') ? `<p class="col-sum">${brl(valor)}</p>` : ''}
      <div class="col-body">${items.slice(0, 15).map(cardHTML).join('') || '<p class="col-empty">Solte um cartão aqui</p>'}${more > 0 ? `<a class="link" href="#funil?etapa=${c.id}">Ver todos (+${more})</a>` : ''}</div>
    </section>`;
  }).join('')}</div>
  <p class="hint">Matriculados e perdidos aparecem só dentro do período escolhido no topo. Soltar em Matriculado abre a matrícula; em Perdido, o motivo.</p>`;
}

function list(ctx) {
  const t = today();
  let leads = filtered(ctx);
  const p = ctx.params;
  if (p.etapa) leads = leads.filter((l) => l.etapa === p.etapa);
  if (p.vencidos) leads = leads.filter((l) => !['matriculado', 'perdido'].includes(l.etapa) && l.proximaData && l.proximaData < t);
  leads.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
  return `<div class="search-row"><label class="sr" for="v-q">Buscar no funil</label><input type="search" id="v-q" placeholder="Buscar por nome, telefone ou anotação" value="${esc(q)}">${p.etapa || p.vencidos ? `<a class="btn sm ghost" href="#funil">Tirar filtro: ${p.etapa ? esc(stageLabel(p.etapa)) : 'retornos atrasados'}</a>` : ''}</div>
  ${leads.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Curso</th><th>Origem</th><th>Entrada</th><th>Etapa</th><th>Próxima ação</th><th class="r">Valor</th></tr></thead><tbody>${leads.map((l) => `<tr><td><button class="link" data-edit="${esc(l.id)}">${esc(l.nome)}</button><small class="cell-sub">${esc(l.telefone || '')}</small></td><td>${esc(courseName(l.cursoId))}</td><td>${esc(l.origem || '')}${l.campanhaId ? `<small class="cell-sub">${esc(campaignName(l.campanhaId))}</small>` : ''}</td><td>${fmtDate(l.entrada)}</td><td>${badge(stageLabel(l.etapa), l.etapa === 'matriculado' ? 'good' : l.etapa === 'perdido' ? 'bad' : '')}${l.motivoPerda ? `<small class="cell-sub">${esc(l.motivoPerda)}</small>` : ''}</td><td>${l.proximaData ? `<span class="${l.proximaData < t && !['matriculado', 'perdido'].includes(l.etapa) ? 'bad' : ''}">${fmtDate(l.proximaData)}</span> ` : ''}${esc(l.proximaAcao || '')}</td><td class="r">${l.valor ? brl(l.valor) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Ninguém neste filtro.</p>'}`;
}

function analysis(ctx, s) {
  const stages = STAGES.map((st, i) => ({ label: st.label, count: s.funil[i] }));
  const motivos = Object.entries(s.motivos).sort((a, b) => b[1] - a[1]);
  const maxM = Math.max(1, ...motivos.map((m) => m[1]));
  return `<div class="grid-2">
    <section class="card"><header class="card-head"><div><h2>Conversão por etapa</h2><p class="muted">Quem entrou no período e até onde chegou</p></div></header>${s.leads ? funnel(stages) : '<p class="empty-sm">Sem conversas no período.</p>'}</section>
    <section class="card"><header class="card-head"><div><h2>Motivos de perda</h2><p class="muted">Mostra onde o atendimento trava</p></div></header>
      ${motivos.length ? `<ul class="hbars">${motivos.map(([m, c]) => `<li><span>${esc(m)}</span><span class="hb-track"><span style="width:${(c / maxM) * 100}%"></span></span><b>${c}</b></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhuma perda registrada no período.</p>'}
    </section>
    <section class="card"><header class="card-head"><h2>Por origem</h2></header>
      ${s.porOrigem.length ? `<table class="tbl"><thead><tr><th>Origem</th><th class="r">Conversas</th><th class="r">Matrículas</th><th class="r">Conversão</th></tr></thead><tbody>${s.porOrigem.map((o) => `<tr><td>${esc(o.origem)}</td><td class="r">${o.leads}</td><td class="r">${o.matriculas}</td><td class="r">${pct(o.leads ? o.matriculas / o.leads : null, 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-sm">Sem conversas no período.</p>'}
    </section>
  </div>`;
}

function respostas() {
  const r = settings().respostas || [];
  return `<p class="hint">Mensagens que a equipe usa no WhatsApp. Copie, ajuste o nome e envie.</p>
  <div class="row-actions"><button class="btn" data-act="resp">${ICON.plus} Nova resposta</button></div>
  ${r.length ? `<div class="cards">${r.map((x, i) => `<article class="card resp"><header class="card-head"><div><p class="eyebrow">${esc(x.etapa || 'Geral')}</p><h3>${esc(x.titulo)}</h3></div><div class="row-actions"><button class="btn sm" data-copy="${i}">${ICON.copy} Copiar</button><button class="btn sm ghost" data-resp="${i}">Editar</button></div></header><p class="pre" id="resp-${i}">${esc(x.texto)}</p></article>`).join('')}</div>` : '<p class="empty-sm">Nenhuma resposta salva.</p>'}`;
}

function respDialog(i, ctx) {
  const list = [...(settings().respostas || [])];
  const r = i === null ? {} : list[i];
  openDialog({
    title: i === null ? 'Nova resposta pronta' : 'Editar resposta',
    fields: [
      { name: 'titulo', label: 'Título', value: r.titulo, required: true },
      { name: 'etapa', label: 'Quando usar', type: 'select', options: ['Geral', ...STAGES.map((x) => x.label), 'Recuperar perdido'], value: r.etapa },
      { name: 'texto', label: 'Mensagem', type: 'textarea', rows: 6, value: r.texto, required: true, full: true },
    ],
    onSave: (d) => { if (i === null) list.push(d); else list[i] = d; store.put('settings', { ...store.settings(), id: 'main', respostas: list }); ctx.refresh(); },
    onDelete: i === null ? null : () => { list.splice(i, 1); store.put('settings', { ...store.settings(), id: 'main', respostas: list }); ctx.refresh(); },
  });
}

// Solta um cartão numa coluna. Matrícula e perda pedem os dados antes de mover.
function dropTo(id, etapa, ctx) {
  const l = store.get('leads', id);
  if (!l || l.etapa === etapa) return;
  if (etapa === 'matriculado') return matriculaDialog(l, ctx);
  if (etapa === 'perdido') return loseDialog(l, ctx);
  moveLead(l, etapa);
  toast(l.nome + ' → ' + stageLabel(etapa));
  ctx.refresh();
}

function importDialog(ctx) {
  let parsed = null;
  const { dlg } = openDialog({
    title: 'Importar lista de contatos', wide: true, saveLabel: 'Importar',
    fields: [
      { name: 'origem', label: 'Origem padrão', type: 'select', options: ORIGENS, value: 'Meta Ads' },
      { name: 'campanhaId', label: 'Campanha padrão', type: 'select', options: campOpts() },
      { name: 'cursoId', label: 'Curso padrão', type: 'select', options: courseOpts('Nenhum') },
    ],
    html: `<p class="hint">Aceita CSV (WhatsApp Business, planilha ou CRM) ou uma lista colada: <code>nome; telefone; data</code>. Telefones repetidos são ignorados.</p>
      <div class="drop"><label class="btn" for="li-file">${ICON.upload} Escolher arquivo</label><input type="file" id="li-file" accept=".csv,.txt" class="sr"><span class="muted" id="li-name"></span></div>
      <div class="field full"><label for="li-text">Conteúdo</label><textarea id="li-text" rows="6" placeholder="nome;telefone;data&#10;Maria Souza;61999990000;2026-10-20"></textarea></div><p class="note" id="li-prev"></p>`,
    onSave: (d) => {
      if (!parsed?.length) { const e = $('.form-error', dlg); e.textContent = 'Nada para importar.'; e.hidden = false; return false; }
      const known = new Set(store.all('leads').map((l) => phoneKey(l.telefone)).filter(Boolean));
      const courses = store.all('courses'); const camps = store.all('campaigns');
      let dup = 0;
      const recs = [];
      parsed.forEach((r) => {
        const k = phoneKey(r.telefone);
        if (k && known.has(k)) { dup++; return; }
        if (k) known.add(k);
        const curso = r.curso ? courses.find((c) => norm(c.nome).includes(norm(r.curso)))?.id : '';
        const camp = r.campanha ? camps.find((c) => norm(c.nome) === norm(r.campanha))?.id : '';
        recs.push({ nome: r.nome || r.telefone || 'Sem nome', telefone: r.telefone, entrada: r.data || today(), origem: ORIGENS.find((o) => norm(o) === norm(r.origem)) || d.origem, campanhaId: camp || d.campanhaId, cursoId: curso || d.cursoId, anuncio: r.anuncio || '', etapa: 'novo', etapaMax: 0, historico: [{ data: today(), etapa: 'novo' }] });
      });
      store.putMany('leads', recs);
      store.put('imports', { fonte: 'Contatos WhatsApp', lidas: parsed.length, novas: recs.length, substituidas: 0, ignoradas: dup });
      toast(recs.length + ' contatos no funil' + (dup ? ', ' + dup + ' repetidos ignorados.' : '.'));
      ctx.refresh();
    },
  });
  const prev = () => {
    const txt = $('#li-text', dlg).value.trim();
    if (!txt) { parsed = null; $('#li-prev', dlg).textContent = ''; return; }
    const p = parseCSV(txt);
    const H = p.headers.map(norm);
    const find = (...keys) => p.headers[H.findIndex((h) => keys.some((k) => h.includes(k)))];
    const hasHeader = H.some((h) => /nome|name|telefone|phone|celular|whats/.test(h));
    if (hasHeader) {
      const cn = find('nome', 'name'), ct = find('telefone', 'phone', 'celular', 'whats', 'numero'), cd = find('data', 'date', 'criad'), co = find('origem', 'source'), cc = find('curso', 'interesse'), ca = find('campanha', 'campaign'), cad = find('anuncio', 'ad name');
      parsed = p.rows.map((r) => ({ nome: r[cn], telefone: r[ct], data: parseDate(r[cd]), origem: r[co], curso: r[cc], campanha: r[ca], anuncio: r[cad] })).filter((r) => r.nome || r.telefone);
    } else {
      const all = [p.headers, ...p.rows.map((r) => Object.values(r))];
      parsed = all.map((cols) => ({ nome: cols[0], telefone: cols[1], data: parseDate(cols[2]) })).filter((r) => r.nome || r.telefone);
    }
    $('#li-prev', dlg).textContent = parsed.length + ' contatos encontrados. Primeiro: ' + (parsed[0] ? (parsed[0].nome || '') + ' ' + (parsed[0].telefone || '') : '');
  };
  $('#li-text', dlg).addEventListener('input', prev);
  $('#li-file', dlg).addEventListener('change', async (e) => { const fl = e.target.files[0]; if (!fl) return; $('#li-name', dlg).textContent = fl.name; $('#li-text', dlg).value = await readFileText(fl); prev(); });
}

function bindSearch(root, ctx) {
  $('#v-q', root)?.addEventListener('input', (e) => {
    q = e.target.value; const pos = e.target.selectionStart;
    $('#tab-body', root).innerHTML = body(ctx, salesStats(ctx.from, ctx.to, ctx.f));
    const inp = $('#v-q', root); inp.focus(); inp.setSelectionRange(pos, pos);
    bindSearch(root, ctx); bindDrag(root, ctx);
  });
}

function bindDrag(root, ctx) {
  let dragId = null;
  $$('[data-drag]', root).forEach((card) => {
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.drag; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (_) { /* ok */ } });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); $$('.col.over', root).forEach((c) => c.classList.remove('over')); });
  });
  $$('[data-drop]', root).forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('over'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('over');
      const id = dragId || e.dataTransfer.getData('text/plain');
      dragId = null;
      if (id) dropTo(id, col.dataset.drop, ctx);
    });
  });
}

export function mount(root, ctx) {
  const quick = $('#quick', root);
  const syncCamp = () => { $('#q-camp-wrap', root).hidden = !['Meta Ads', 'Google'].includes($('#q-origem', root).value); };
  $('#q-origem', root).addEventListener('change', syncCamp); syncCamp();
  quick.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(quick));
    if (!d.nome.trim()) { $('#q-nome', root).focus(); return; }
    const dup = d.telefone && store.all('leads').find((x) => phoneKey(x.telefone) === phoneKey(d.telefone));
    if (dup) { toast('Esse telefone já está no funil como ' + dup.nome + '. Abrindo o cartão.', 'warn'); editLead(dup, ctx); return; }
    store.put('leads', { nome: d.nome.trim(), telefone: d.telefone.trim(), cursoId: d.cursoId, origem: d.origem, campanhaId: ['Meta Ads', 'Google'].includes(d.origem) ? d.campanhaId : '', primeiraResposta: d.primeiraResposta ? Number(d.primeiraResposta) : null, entrada: today(), etapa: 'novo', etapaMax: 0, historico: [{ data: today(), etapa: 'novo' }] });
    toast('Adicionado ao funil.');
    ctx.refresh();
    setTimeout(() => $('#q-nome')?.focus(), 50);
  });
  bindSearch(root, ctx);
  bindDrag(root, ctx);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button,[data-tab]');
    if (!b) return;
    const ds = b.dataset;
    if (ds.tab) { tab = ds.tab; if (ctx.params.etapa || ctx.params.vencidos) location.hash = '#funil'; else ctx.refresh(); return; }
    if (ds.edit) return editLead(store.get('leads', ds.edit), ctx);
    if (ds.adv) {
      const l = store.get('leads', ds.adv);
      const idx = STAGE_IDX[l.etapa];
      return dropTo(l.id, STAGES[idx + 1].id, ctx);
    }
    if (ds.lose) return loseDialog(store.get('leads', ds.lose), ctx);
    if (ds.resp !== undefined) return respDialog(Number(ds.resp), ctx);
    if (ds.copy !== undefined) return copyText(settings().respostas[Number(ds.copy)].texto, $('#resp-' + ds.copy, root));
    if (ds.act === 'resp') return respDialog(null, ctx);
    if (ds.act === 'import') return importDialog(ctx);
    if (ds.act === 'export') {
      downloadFile('funil-liceu-' + today() + '.csv', toCSV(store.all('leads'), [{ key: 'nome', label: 'Nome' }, { key: 'telefone', label: 'Telefone' }, { label: 'Curso', get: (l) => courseName(l.cursoId) }, { key: 'origem', label: 'Origem' }, { label: 'Campanha', get: (l) => (l.campanhaId ? campaignName(l.campanhaId) : '') }, { key: 'anuncio', label: 'Anúncio' }, { key: 'entrada', label: 'Entrada' }, { label: 'Etapa', get: (l) => stageLabel(l.etapa) }, { key: 'valor', label: 'Valor' }, { key: 'motivoPerda', label: 'Motivo perda' }, { key: 'proximaData', label: 'Próximo retorno' }, { key: 'proximaAcao', label: 'Próxima ação' }]), 'text/csv');
    }
  });
  void fCurso;
}
