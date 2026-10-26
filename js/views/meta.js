// Meta Ads: importa o relatório do Gerenciador, compara campanhas e mostra onde melhorar.
// O que torna este módulo útil é o cruzamento com o WhatsApp: custo por conversa vem do Meta,
// mas CAC e matrícula vêm dos leads registrados com a campanha.

import { store } from '../store.js';
import { esc, $, $$, brl, brl2, num, pct, num1, parseCSV, parseNum, parseDate, norm, toCSV, fmtDate, fmtRange, uid, today } from '../util.js';
import { campaignRows, mediaTotals, courseName, diagnostics, NIVEL } from '../metrics.js';
import { openDialog, toast, badge, ICON, readFileText, downloadFile, empty, confirmButton } from '../ui.js';

let canal = '';
let sortKey = 'cac';
const picked = new Set();

const COLS = [
  { key: 'investimento', label: 'Investimento', fmt: brl, best: 'none' },
  { key: 'impressoes', label: 'Impressões', fmt: num, best: 'up' },
  { key: 'alcance', label: 'Alcance', fmt: num, best: 'up' },
  { key: 'freq', label: 'Frequência', fmt: (v) => (v === null ? '—' : num1(v)), best: 'down' },
  { key: 'ctr', label: 'CTR', fmt: (v) => pct(v, 2), best: 'up' },
  { key: 'cpc', label: 'CPC', fmt: brl2, best: 'down' },
  { key: 'cpm', label: 'CPM', fmt: brl2, best: 'down' },
  { key: 'conversas', label: 'Conversas', fmt: num, best: 'up' },
  { key: 'custoConversa', label: 'Custo/conversa', fmt: brl2, best: 'down' },
  { key: 'leads', label: 'Leads WhatsApp', fmt: num, best: 'up' },
  { key: 'matriculas', label: 'Matrículas', fmt: num, best: 'up' },
  { key: 'cac', label: 'CAC', fmt: brl2, best: 'down' },
  { key: 'roas', label: 'Retorno', fmt: (v) => (v === null ? '—' : num1(v) + 'x'), best: 'up' },
];
const SORTS = [['cac', 'Menor CAC'], ['custoConversa', 'Menor custo por conversa'], ['investimento', 'Maior investimento'], ['matriculas', 'Mais matrículas'], ['ctr', 'Maior CTR']];

export function render(ctx) {
  const { from, to, f, params } = ctx;
  const rows = campaignRows(from, to, { ...f, canal });
  const t = mediaTotals(rows);
  const asc = ['cac', 'custoConversa'].includes(sortKey);
  rows.sort((a, b) => { const x = a[sortKey], y = b[sortKey]; if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; return asc ? x - y : y - x; });
  const sel = params.c ? rows.find((r) => r.id === params.c) || null : null;
  const imports = store.all('imports').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const canais = [['', 'Todos'], ['Meta', 'Meta'], ['Google', 'Google'], ['Outro', 'Outros']];

  return `
  <div class="toolbar">
    <div class="chips" role="group" aria-label="Canal">${canais.map(([v, l]) => `<button type="button" class="chip" data-canal="${v}" aria-pressed="${canal === v}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn primary" data-act="import">${ICON.upload} Importar relatório</button>
    <button class="btn" data-act="manual">${ICON.plus} Digitar métricas</button>
    <button class="btn" data-act="camps">Campanhas</button>
  </div>

  <section class="kpis compact" aria-label="Totais de mídia">
    ${[['Investimento', brl(t.investimento)], ['Impressões', num(t.impressoes)], ['Alcance', num(t.alcance)], ['CTR', pct(t.ctr, 2)], ['CPM', brl2(t.cpm)], ['Conversas', num(t.conversas || t.leadsMeta)], ['Custo por conversa', brl2(t.custoConversa)], ['CAC de mídia', brl2(t.cac)]].map(([l, v]) => `<article class="kpi"><h3>${l}</h3><p class="kpi-v">${v}</p></article>`).join('')}
  </section>

  ${sel ? detail(sel, t, from, to) : ''}

  <section class="card">
    <header class="card-head">
      <div><h2>Comparar campanhas</h2><p class="muted">${fmtRange(from, to)} · marque 2 a 4 para comparar lado a lado. Verde é o melhor da coluna.</p></div>
      <div class="row-actions">
        <label class="inline-field" for="m-sort">Ordenar <select id="m-sort">${SORTS.map(([v, l]) => `<option value="${v}"${v === sortKey ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <button class="btn sm" data-act="csv">${ICON.download} CSV</button>
      </div>
    </header>
    ${rows.length ? table(rows) : empty('Nenhuma campanha com dados neste período', 'Exporte o relatório do Gerenciador de Anúncios (CSV) e importe aqui. As campanhas são criadas sozinhas a partir do nome.', `<button class="btn primary" data-act="import">${ICON.upload} Importar relatório</button>`)}
    ${picked.size >= 2 ? compare(rows.filter((r) => picked.has(r.id))) : ''}
  </section>

  <section class="card">
    <header class="card-head"><div><h2>Como exportar do Gerenciador de Anúncios</h2></div></header>
    <ol class="steps">
      <li>No Gerenciador, escolha o período e a aba <b>Anúncios</b> (ou Campanhas).</li>
      <li>Em <b>Detalhamento › Por tempo › Dia</b>, se quiser números exatos por semana.</li>
      <li>Colunas mínimas: nome da campanha, nome do anúncio, valor usado, impressões, alcance, cliques no link e conversas por mensagem iniciadas.</li>
      <li><b>Exportar › CSV</b>. Depois clique em Importar relatório. Reimportar o mesmo período substitui as linhas, sem duplicar.</li>
    </ol>
  </section>

  ${imports.length ? `<section class="card"><header class="card-head"><h2>Histórico de importações</h2></header><div class="table-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Arquivo</th><th class="r">Linhas lidas</th><th class="r">Novas</th><th class="r">Substituídas</th><th class="r">Ignoradas</th><th></th></tr></thead><tbody>${imports.map((i) => `<tr><td>${esc(new Date(i.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</td><td>${esc(i.arquivo || i.fonte)}</td><td class="r">${num(i.lidas)}</td><td class="r">${num(i.novas)}</td><td class="r">${num(i.substituidas)}</td><td class="r">${num(i.ignoradas)}</td><td class="r"><button class="btn sm ghost" data-undo="${esc(i.id)}">Desfazer</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}
  `;
}

function table(rows) {
  const bestOf = {};
  COLS.forEach((c) => {
    if (c.best === 'none') return;
    const vals = rows.map((r) => r[c.key]).filter((v) => v !== null && v !== undefined && v !== 0);
    if (vals.length > 1) bestOf[c.key] = c.best === 'up' ? Math.max(...vals) : Math.min(...vals);
  });
  return `<div class="table-wrap"><table class="tbl dense">
    <thead><tr><th><span class="sr">Comparar</span></th><th>Campanha</th>${COLS.map((c) => `<th class="r">${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><input type="checkbox" aria-label="Comparar ${esc(r.nome)}" data-pick="${esc(r.id)}"${picked.has(r.id) ? ' checked' : ''}></td>
      <td class="nowrap"><a href="#meta?c=${esc(r.id)}">${esc(r.nome)}</a><small class="cell-sub">${esc(r.canal || '')} · ${esc(courseName(r.cursoId))}${r.status && r.status !== 'Ativa' ? ' · ' + esc(r.status) : ''}</small></td>
      ${COLS.map((c) => { const v = r[c.key]; const best = bestOf[c.key] !== undefined && v === bestOf[c.key]; return `<td class="r${best ? ' best' : ''}">${c.fmt(v)}</td>`; }).join('')}
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function compare(list) {
  return `<div class="compare"><h3>Lado a lado</h3><div class="table-wrap"><table class="tbl">
    <thead><tr><th>Indicador</th>${list.map((r) => `<th class="r">${esc(r.nome)}</th>`).join('')}</tr></thead>
    <tbody>${COLS.map((c) => {
      const vals = list.map((r) => r[c.key]);
      const valid = vals.filter((v) => v !== null && v !== undefined && v !== 0);
      const best = c.best === 'none' || valid.length < 2 ? null : c.best === 'up' ? Math.max(...valid) : Math.min(...valid);
      return `<tr><th scope="row">${c.label}</th>${vals.map((v) => `<td class="r${best !== null && v === best ? ' best' : ''}">${c.fmt(v)}${best !== null && v === best ? ' <span class="sr">(melhor)</span>' : ''}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>
    <button class="btn sm ghost" data-act="clear-pick">Limpar seleção</button></div>`;
}

function detail(r, t, from, to) {
  const diag = diagnostics(from, to, {}).filter((d) => d.titulo.startsWith(r.nome));
  const vs = (k, dir) => { if (r[k] === null || t[k] === null || !t[k]) return ''; const d = r[k] / t[k] - 1; const good = dir === 'up' ? d > 0 : d < 0; return `<small class="${Math.abs(d) < 0.05 ? 'neutral' : good ? 'good' : 'bad'}">média ${COLS.find((c) => c.key === k).fmt(t[k])}</small>`; };
  return `<section class="card detail">
    <header class="card-head">
      <div><p class="eyebrow">${esc(r.canal || '')} · ${esc(r.objetivo || 'Objetivo não informado')} · ${esc(courseName(r.cursoId))}</p><h2>${esc(r.nome)}</h2></div>
      <div class="row-actions">
        <a class="btn sm" href="#pauta?curso=${esc(r.cursoId || '')}&anuncio=1">Criar novo criativo</a>
        <a class="btn sm" href="#metas?ideia=campanha&c=${esc(r.id)}">Registrar teste</a>
        <button class="btn sm" data-edit-camp="${esc(r.id)}">Editar</button>
        <a class="icon-btn" href="#meta" aria-label="Fechar detalhe">${ICON.x}</a>
      </div>
    </header>
    <dl class="stats wide">
      <div><dt>Investimento</dt><dd>${brl(r.investimento)}</dd></div>
      <div><dt>CTR</dt><dd>${pct(r.ctr, 2)} ${vs('ctr', 'up')}</dd></div>
      <div><dt>Frequência</dt><dd>${r.freq === null ? '—' : num1(r.freq)}</dd></div>
      <div><dt>Custo por conversa</dt><dd>${brl2(r.custoConversa)} ${vs('custoConversa', 'down')}</dd></div>
      <div><dt>Leads registrados</dt><dd>${num(r.leads)} <small>de ${num(r.conversas || r.leadsMeta)} conversas</small></dd></div>
      <div><dt>Matrículas</dt><dd>${num(r.matriculas)} <small>${pct(r.convLead)} dos leads</small></dd></div>
      <div><dt>CAC</dt><dd>${brl2(r.cac)} ${vs('cac', 'down')}</dd></div>
      <div><dt>Receita</dt><dd>${brl(r.receita)}</dd></div>
    </dl>
    ${diag.length ? `<ul class="diag">${diag.map((d) => `<li class="diag-${NIVEL[d.nivel].cls}">${badge(NIVEL[d.nivel].label, NIVEL[d.nivel].cls)}<h4>${esc(d.titulo.replace(r.nome + ': ', ''))}</h4><p>${esc(d.texto)}</p></li>`).join('')}</ul>` : '<p class="note">Nenhum sinal de alerta nesta campanha no período.</p>'}
    ${r.adList.length ? `<h3 class="sub-h">Anúncios</h3><div class="table-wrap"><table class="tbl dense"><thead><tr><th>Anúncio</th><th class="r">Investimento</th><th class="r">CTR</th><th class="r">Conversas</th><th class="r">Custo/conversa</th><th class="r">Leads</th><th class="r">Matrículas</th><th class="r">CAC</th></tr></thead><tbody>${r.adList.map((a) => `<tr><td>${esc(a.nome)}${a.conjunto ? `<small class="cell-sub">${esc(a.conjunto)}</small>` : ''}</td><td class="r">${brl(a.investimento)}</td><td class="r">${pct(a.ctr, 2)}</td><td class="r">${num(a.conversas || a.leadsMeta)}</td><td class="r">${brl2(a.custoConversa)}</td><td class="r">${num(a.leads)}</td><td class="r">${num(a.matriculas)}</td><td class="r">${brl2(a.cac)}</td></tr>`).join('')}</tbody></table></div><p class="hint">Leads e matrículas por anúncio só aparecem quando o lead é registrado com o nome do anúncio.</p>` : ''}
  </section>`;
}

export function mount(root, ctx) {
  $$('[data-canal]', root).forEach((b) => b.addEventListener('click', () => { canal = b.dataset.canal; ctx.refresh(); }));
  $('#m-sort', root)?.addEventListener('change', (e) => { sortKey = e.target.value; ctx.refresh(); });
  $$('[data-pick]', root).forEach((cb) => cb.addEventListener('change', () => {
    if (cb.checked) { if (picked.size >= 4) { cb.checked = false; toast('Compare até 4 campanhas por vez.', 'warn'); return; } picked.add(cb.dataset.pick); } else picked.delete(cb.dataset.pick);
    ctx.refresh();
  }));
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-edit-camp],[data-undo]');
    if (!b) return;
    if (b.dataset.editCamp) return editCampaign(store.get('campaigns', b.dataset.editCamp), ctx);
    if (b.dataset.undo) {
      if (!confirmButton(b, 'Confirmar')) return;
      const imp = store.get('imports', b.dataset.undo);
      store.removeWhere('adStats', (s) => s.importId === imp.id);
      store.remove('imports', imp.id);
      toast('Importação desfeita. Linhas substituídas por ela não voltam.');
      return;
    }
    const act = b.dataset.act;
    if (act === 'import') importDialog(ctx);
    if (act === 'manual') manualDialog(ctx);
    if (act === 'camps') campaignsDialog(ctx);
    if (act === 'clear-pick') { picked.clear(); ctx.refresh(); }
    if (act === 'csv') {
      const rows = campaignRows(ctx.from, ctx.to, { ...ctx.f, canal });
      downloadFile('meta-ads-' + ctx.from + '-a-' + ctx.to + '.csv', toCSV(rows, [{ key: 'nome', label: 'Campanha' }, { key: 'canal', label: 'Canal' }, { get: (r) => courseName(r.cursoId), label: 'Curso' }, ...COLS.map((c) => ({ label: c.label, get: (r) => (r[c.key] === null ? '' : String(+(+r[c.key]).toFixed(4)).replace('.', ',')) }))]), 'text/csv');
    }
  });
}

// ---------- campanhas ----------
function courseOptions() { return [['', 'Sem curso definido'], ...store.all('courses').map((c) => [c.id, c.nome])]; }

export function guessCourse(name) {
  const n = norm(name);
  const hit = store.all('courses').find((c) => { const words = norm(c.nome).split(/\s+/).filter((w) => w.length > 4); return words.some((w) => n.includes(w)); });
  return hit?.id || '';
}

function editCampaign(c, ctx) {
  openDialog({
    title: c ? 'Editar campanha' : 'Nova campanha',
    fields: [
      { name: 'nome', label: 'Nome (igual ao do Gerenciador)', value: c?.nome, required: true, full: true },
      { name: 'canal', label: 'Canal', type: 'select', options: ['Meta', 'Google', 'Outro'], value: c?.canal || 'Meta' },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOptions(), value: c?.cursoId },
      { name: 'objetivo', label: 'Objetivo', type: 'select', options: ['Mensagens no WhatsApp', 'Cadastro (formulário)', 'Tráfego', 'Engajamento', 'Alcance', 'Remarketing', 'Pesquisa (Google)', 'Outro'], value: c?.objetivo || 'Mensagens no WhatsApp' },
      { name: 'status', label: 'Status', type: 'select', options: ['Ativa', 'Pausada', 'Encerrada'], value: c?.status || 'Ativa' },
      { name: 'notas', label: 'Observações', type: 'textarea', value: c?.notas, full: true },
    ],
    onSave: (d) => { store.put('campaigns', { ...(c || {}), ...d }); toast('Campanha salva.'); ctx.refresh(); },
    onDelete: c ? () => { store.remove('campaigns', c.id); store.removeWhere('adStats', (s) => s.campanhaId === c.id); toast('Campanha e métricas excluídas.'); ctx.go('#meta'); } : null,
    deleteLabel: 'Excluir campanha e métricas',
  });
}

function campaignsDialog(ctx) {
  const list = store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome));
  const { dlg } = openDialog({
    title: 'Campanhas', wide: true,
    html: `<p class="hint">Defina o curso de cada campanha. É o que liga o investimento às matrículas do curso.</p>
    ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Campanha</th><th>Canal</th><th>Curso</th><th>Status</th><th></th></tr></thead><tbody>${list.map((c) => `<tr><td>${esc(c.nome)}</td><td>${esc(c.canal)}</td><td>${esc(courseName(c.cursoId))}</td><td>${esc(c.status || 'Ativa')}</td><td class="r"><button type="button" class="btn sm" data-ec="${esc(c.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Nenhuma campanha ainda.</p>'}
    <button type="button" class="btn" data-ec="">${ICON.plus} Nova campanha</button>`,
  });
  $$('[data-ec]', dlg).forEach((b) => b.addEventListener('click', () => { dlg.close(); editCampaign(b.dataset.ec ? store.get('campaigns', b.dataset.ec) : null, ctx); }));
}

function manualDialog(ctx) {
  const camps = store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome));
  openDialog({
    title: 'Digitar métricas de um período',
    fields: [
      { name: 'campanhaNome', label: 'Campanha', value: '', required: true, full: true, list: 'camp-list', placeholder: 'Escolha ou digite um nome novo' },
      { name: 'anuncio', label: 'Anúncio (opcional)', value: '' },
      { name: 'cursoId', label: 'Curso (se a campanha for nova)', type: 'select', options: courseOptions() },
      { name: 'inicio', label: 'De', type: 'date', value: ctx.from, required: true },
      { name: 'fim', label: 'Até', type: 'date', value: ctx.to < today() ? ctx.to : today(), required: true },
      { name: 'investimento', label: 'Valor usado (R$)', type: 'number', required: true },
      { name: 'impressoes', label: 'Impressões', type: 'number' },
      { name: 'alcance', label: 'Alcance', type: 'number' },
      { name: 'cliques', label: 'Cliques no link', type: 'number' },
      { name: 'conversas', label: 'Conversas iniciadas', type: 'number' },
      { name: 'leadsMeta', label: 'Cadastros (formulário)', type: 'number' },
    ],
    html: `<datalist id="camp-list">${camps.map((c) => `<option value="${esc(c.nome)}">`).join('')}</datalist>`,
    onSave: (d, form) => {
      if (d.inicio > d.fim) { $('.form-error', form.parentElement).textContent = 'A data inicial é depois da final.'; $('.form-error', form.parentElement).hidden = false; return false; }
      const camp = findOrCreateCampaign(d.campanhaNome, 'Meta', d.cursoId);
      store.put('adStats', { campanhaId: camp.id, anuncio: d.anuncio, inicio: d.inicio, fim: d.fim, investimento: d.investimento || 0, impressoes: d.impressoes || 0, alcance: d.alcance || 0, cliques: d.cliques || 0, conversas: d.conversas || 0, leadsMeta: d.leadsMeta || 0, origem: 'manual' });
      toast('Métricas salvas.');
      ctx.refresh();
    },
  });
}

function findOrCreateCampaign(nome, canalNovo, cursoId) {
  const n = norm(nome);
  const found = store.all('campaigns').find((c) => norm(c.nome) === n);
  if (found) return found;
  return store.put('campaigns', { nome: nome.trim(), canal: canalNovo, cursoId: cursoId || guessCourse(nome), status: 'Ativa', objetivo: /mensag|whats|conversa/i.test(nome) ? 'Mensagens no WhatsApp' : '' });
}

// ---------- importação ----------
const ALIASES = {
  campanha: ['nome da campanha', 'campaign name', 'campanha', 'campaign'],
  conjunto: ['nome do conjunto de anuncios', 'ad set name', 'conjunto de anuncios', 'grupo de anuncios', 'ad group'],
  anuncio: ['nome do anuncio', 'ad name', 'anuncio', 'ad'],
  inicio: ['inicio dos relatorios', 'reporting starts', 'dia', 'day', 'data', 'date'],
  fim: ['termino dos relatorios', 'encerramento dos relatorios', 'reporting ends'],
  investimento: ['valor usado (brl)', 'amount spent (brl)', 'valor usado', 'amount spent', 'investimento', 'gasto', 'custo', 'cost'],
  impressoes: ['impressoes', 'impressions', 'impr.'],
  alcance: ['alcance', 'reach'],
  cliques: ['cliques no link', 'link clicks', 'cliques (todos)', 'clicks (all)', 'cliques', 'clicks'],
  conversas: ['conversas por mensagem iniciadas', 'messaging conversations started', 'conversas iniciadas'],
  leadsMeta: ['leads', 'cadastros', 'leads no formulario', 'conversoes', 'conversions'],
  resultados: ['resultados', 'results'],
  tipoResultado: ['indicador de resultado', 'result indicator', 'tipo de resultado', 'result type'],
};

export function mapHeaders(headers) {
  const map = {};
  const nh = headers.map((h) => ({ h, n: norm(h) }));
  Object.entries(ALIASES).forEach(([key, al]) => {
    let hit = null;
    for (const a of al) { hit = nh.find((x) => x.n === a); if (hit) break; }
    if (!hit) for (const a of al) { if (a.length < 5) continue; hit = nh.find((x) => x.n.startsWith(a)); if (hit) break; }
    if (!hit && key === 'conversas') hit = nh.find((x) => x.n.includes('conversa') && x.n.includes('inicia'));
    if (hit) map[key] = hit.h;
  });
  return map;
}

export function buildRows(parsed, map, opt) {
  const out = []; let ignoradas = 0;
  parsed.rows.forEach((r) => {
    const nome = (r[map.campanha] || '').trim();
    if (!nome || /^total/i.test(nome)) { ignoradas++; return; }
    const inicio = parseDate(r[map.inicio]) || opt.inicio;
    const fim = parseDate(r[map.fim]) || (map.inicio && parseDate(r[map.inicio])) || opt.fim;
    const g = (k) => (map[k] ? parseNum(r[map[k]]) || 0 : 0);
    let conversas = g('conversas');
    const tipo = norm(r[map.tipoResultado] || '');
    if (!map.conversas && /conversa|messag/.test(tipo)) conversas = g('resultados');
    let leadsMeta = g('leadsMeta');
    if (!map.leadsMeta && /lead|cadastro/.test(tipo)) leadsMeta = g('resultados');
    out.push({ campanha: nome, conjunto: (r[map.conjunto] || '').trim(), anuncio: (r[map.anuncio] || '').trim(), inicio, fim, investimento: g('investimento'), impressoes: g('impressoes'), alcance: g('alcance'), cliques: g('cliques'), conversas, leadsMeta });
  });
  return { rows: out, ignoradas };
}

function importDialog(ctx) {
  let parsed = null, map = null, fileName = '';
  const { dlg, form } = openDialog({
    title: 'Importar relatório de anúncios', wide: true, saveLabel: 'Importar',
    fields: [
      { name: 'canal', label: 'Canal', type: 'select', options: ['Meta', 'Google', 'Outro'], value: 'Meta' },
      { name: 'inicio', label: 'Período (se o arquivo não tiver datas): de', type: 'date', value: ctx.from },
      { name: 'fim', label: 'até', type: 'date', value: ctx.to < today() ? ctx.to : today() },
    ],
    html: `<div class="drop">
        <label class="btn" for="imp-file">${ICON.upload} Escolher arquivo CSV</label>
        <input type="file" id="imp-file" accept=".csv,text/csv,.txt" class="sr">
        <span class="muted" id="imp-name">ou cole o conteúdo abaixo</span>
      </div>
      <div class="field full"><label for="imp-text">Conteúdo do CSV</label><textarea id="imp-text" rows="5" placeholder="Nome da campanha;Nome do anúncio;Valor usado (BRL);Impressões;..."></textarea></div>
      <div id="imp-preview"></div>`,
    onSave: (d) => {
      if (!parsed || !map?.campanha) { const e = $('.form-error', dlg); e.textContent = 'Não encontrei a coluna com o nome da campanha. Confira o arquivo.'; e.hidden = false; return false; }
      const { rows, ignoradas } = buildRows(parsed, map, d);
      if (!rows.length) { const e = $('.form-error', dlg); e.textContent = 'Nenhuma linha com campanha para importar.'; e.hidden = false; return false; }
      const imp = store.put('imports', { fonte: d.canal + ' Ads', arquivo: fileName || 'Conteúdo colado', lidas: parsed.rows.length });
      const existing = store.all('adStats');
      let novas = 0, subst = 0;
      const recs = rows.map((r) => {
        const camp = findOrCreateCampaign(r.campanha, d.canal, '');
        const key = [camp.id, norm(r.conjunto), norm(r.anuncio), r.inicio, r.fim].join('|');
        const old = existing.find((s) => [s.campanhaId, norm(s.conjunto), norm(s.anuncio), s.inicio, s.fim].join('|') === key);
        if (old) subst++; else novas++;
        const { campanha, ...rest } = r;
        return { ...(old || {}), ...rest, id: old?.id || uid('ad_'), campanhaId: camp.id, origem: 'csv', importId: imp.id };
      });
      store.putMany('adStats', recs);
      store.put('imports', { ...imp, novas, substituidas: subst, ignoradas });
      toast(`${novas} linhas novas, ${subst} substituídas.`);
      ctx.refresh();
    },
  });
  const preview = () => {
    const txt = $('#imp-text', dlg).value;
    const box = $('#imp-preview', dlg);
    if (!txt.trim()) { box.innerHTML = ''; parsed = null; return; }
    parsed = parseCSV(txt);
    map = mapHeaders(parsed.headers);
    const labels = { campanha: 'Campanha', anuncio: 'Anúncio', conjunto: 'Conjunto', inicio: 'Início', fim: 'Fim', investimento: 'Valor usado', impressoes: 'Impressões', alcance: 'Alcance', cliques: 'Cliques', conversas: 'Conversas', leadsMeta: 'Cadastros', resultados: 'Resultados' };
    const { rows } = buildRows(parsed, map, { inicio: $('#f_inicio', dlg).value, fim: $('#f_fim', dlg).value });
    box.innerHTML = `<p class="note">${parsed.rows.length} linhas lidas. Colunas reconhecidas:</p>
      <ul class="map-list">${Object.entries(labels).map(([k, l]) => `<li class="${map[k] ? 'ok' : 'miss'}">${map[k] ? '✓' : '·'} ${l}${map[k] ? ` <small>← ${esc(map[k])}</small>` : ' <small>não encontrada</small>'}</li>`).join('')}</ul>
      ${rows.length ? `<div class="table-wrap"><table class="tbl dense"><thead><tr><th>Campanha</th><th>Anúncio</th><th>Período</th><th class="r">Valor</th><th class="r">Impr.</th><th class="r">Conversas</th></tr></thead><tbody>${rows.slice(0, 5).map((r) => `<tr><td>${esc(r.campanha)}</td><td>${esc(r.anuncio)}</td><td>${fmtDate(r.inicio)}–${fmtDate(r.fim)}</td><td class="r">${brl2(r.investimento)}</td><td class="r">${num(r.impressoes)}</td><td class="r">${num(r.conversas)}</td></tr>`).join('')}</tbody></table></div>${rows.length > 5 ? `<p class="hint">e mais ${rows.length - 5} linhas.</p>` : ''}` : '<p class="form-error">Nenhuma linha válida. O arquivo precisa ter a coluna com o nome da campanha.</p>'}`;
  };
  $('#imp-text', dlg).addEventListener('input', preview);
  ['#f_inicio', '#f_fim'].forEach((s) => $(s, dlg).addEventListener('change', preview));
  $('#imp-file', dlg).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileName = file.name;
    $('#imp-name', dlg).textContent = file.name;
    $('#imp-text', dlg).value = await readFileText(file);
    preview();
  });
  void form;
}
