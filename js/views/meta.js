// Meta Ads: importa o relatório do Gerenciador com todas as colunas, compara campanhas, permite
// corrigir qualquer linha à mão e cruza com o WhatsApp para chegar ao CAC real.
//
// Regra de ouro: guardamos contagens (valor gasto, impressões, alcance, cliques, resultados, compras).
// Taxas e custos (CTR, CPC, CPM, frequência, custo por resultado...) são recalculados a partir delas,
// então batem com o Gerenciador e continuam certos depois de uma correção manual.

import { store } from '../store.js';
import { esc, $, $$, brl, brl2, num, pct, num1, parseCSV, parseNum, parseDate, norm, toCSV, fmtDate, fmtRange, uid, today, inRange, div } from '../util.js';
import { overview, campaignRows, mediaTotals, courseName, diagnostics, NIVEL, METRIC_KEYS, share } from '../metrics.js';
import { openDialog, toast, badge, ICON, readFileText, downloadFile, empty, confirmButton } from '../ui.js';

let canal = '';
let sortKey = 'investimento';
let colSet = 'todas';
let tab = 'campanhas';
const picked = new Set();

const x2 = (v) => (v === null || v === undefined ? '—' : num1(v));
// Colunas na ordem do Gerenciador. group: meta (veio do Meta) ou real (cruzado com o WhatsApp).
const COLS = [
  { key: 'investimento', label: 'Valor gasto', fmt: brl2, best: 'none', group: 'meta' },
  { key: 'resultados', label: 'Resultados', fmt: num, best: 'up', group: 'meta', sub: (r) => r.tipoResultado },
  { key: 'custoResultado', label: 'Custo por resultado', fmt: brl2, best: 'down', group: 'meta' },
  { key: 'alcance', label: 'Alcance', fmt: num, best: 'up', group: 'meta' },
  { key: 'impressoes', label: 'Impressões', fmt: num, best: 'up', group: 'meta' },
  { key: 'freq', label: 'Frequência', fmt: (v) => (v === null || v === undefined ? '—' : String(v.toFixed(2)).replace('.', ',')), best: 'none', group: 'meta' },
  { key: 'cliquesTodos', label: 'Cliques (todos)', fmt: num, best: 'up', group: 'meta' },
  { key: 'cpm', label: 'CPM', fmt: brl2, best: 'down', group: 'meta' },
  { key: 'ctr', label: 'CTR (link)', fmt: (v) => pct(v, 2), best: 'up', group: 'meta' },
  { key: 'cpc', label: 'CPC (link)', fmt: brl2, best: 'down', group: 'meta' },
  { key: 'cpcUnico', label: 'Custo por clique único', fmt: brl2, best: 'down', group: 'meta' },
  { key: 'custoMilAlcance', label: 'Custo por 1.000 alcançadas', fmt: brl2, best: 'down', group: 'meta' },
  { key: 'cliquesLinkUnicos', label: 'Cliques no link únicos', fmt: num, best: 'up', group: 'meta' },
  { key: 'conversas', label: 'Conversas', fmt: num, best: 'up', group: 'meta' },
  { key: 'compras', label: 'Compras', fmt: num, best: 'up', group: 'meta' },
  { key: 'leads', label: 'Leads WhatsApp', fmt: num, best: 'up', group: 'real' },
  { key: 'matriculas', label: 'Matrículas', fmt: num, best: 'up', group: 'real' },
  { key: 'cac', label: 'CAC', fmt: brl2, best: 'down', group: 'real' },
  { key: 'roas', label: 'Retorno', fmt: (v) => (v === null ? '—' : num1(v) + 'x'), best: 'up', group: 'real' },
];
const SORTS = [['investimento', 'Maior valor gasto'], ['custoResultado', 'Menor custo por resultado'], ['cac', 'Menor CAC'], ['resultados', 'Mais resultados'], ['matriculas', 'Mais matrículas'], ['ctr', 'Maior CTR']];
const ASC = ['cac', 'custoResultado'];
const visibleCols = () => COLS.filter((c) => colSet === 'todas' || c.group === colSet);

export function render(ctx) {
  const { from, to, f, params } = ctx;
  // O canal vem do endereço: sair e voltar à tela limpa o filtro, e o Painel nunca fica diferente sem aviso.
  canal = ['Meta', 'Google', 'Outro'].includes(params.canal) ? params.canal : '';
  if (params.c) tab = 'campanhas';
  const rows = campaignRows(from, to, { ...f, canal });
  const t = mediaTotals(rows);
  const asc = ASC.includes(sortKey);
  rows.sort((a, b) => { const x = a[sortKey], y = b[sortKey]; if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; return asc ? x - y : y - x; });
  const sel = params.c ? rows.find((r) => r.id === params.c) || campaignRows(from, to, f).find((r) => r.id === params.c) || null : null;
  const canais = [['', 'Todos'], ['Meta', 'Meta'], ['Google', 'Google'], ['Outro', 'Outros']];
  const tabs = [['campanhas', 'Campanhas'], ['linhas', 'Dados importados'], ['historico', 'Importações']];

  return `
  <div class="toolbar">
    <div class="chips" role="group" aria-label="Canal">${canais.map(([v, l]) => `<button type="button" class="chip" data-canal="${v}" aria-pressed="${canal === v}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn primary" data-act="import">${ICON.upload} Importar relatório</button>
    <button class="btn" data-act="manual">${ICON.plus} Digitar métricas</button>
    <button class="btn" data-act="camps">Campanhas</button>
  </div>

  <section class="kpis compact" aria-label="Totais de mídia">
    ${[['Valor gasto', brl2(t.investimento)], ['Resultados', num(t.resultados)], ['Custo por resultado', brl2(t.custoResultado)], ['Alcance', num(t.alcance)], ['Impressões', num(t.impressoes)], ['CPM', brl2(t.cpm)], ['CTR (link)', pct(t.ctr, 2)], [canal ? 'CAC de mídia · só ' + canal : 'CAC de mídia', brl2(canal ? t.cac : overview(from, to, f).cac)]].map(([l, v]) => `<article class="kpi"><h3>${l}</h3><p class="kpi-v">${v}</p></article>`).join('')}
  </section>

  ${partialNotice(from, to, f)}
  ${sel ? detail(sel, t, from, to) : ''}

  <div class="toolbar"><div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" class="tab" role="tab" data-mtab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div></div>
  ${tab === 'linhas' ? linesView(from, to) : tab === 'historico' ? historyView() : compareView(rows, from, to)}
  `;
}

// Explica quais relatórios longos entraram (ou não) no período, já que cada linha conta inteira.
function partialNotice(from, to, f) {
  const camps = new Set(store.all('campaigns').filter((c) => (!f.cursoId || c.cursoId === f.cursoId) && (!canal || c.canal === canal)).map((c) => c.id));
  const parts = store.all('adStats').filter((s) => camps.has(s.campanhaId) && s.inicio && s.fim && s.inicio <= to && s.fim >= from && (s.inicio < from || s.fim > to));
  if (!parts.length) return '';
  const groups = {};
  parts.forEach((s) => { const k = s.inicio + '|' + s.fim; (groups[k] || (groups[k] = { inicio: s.inicio, fim: s.fim, dentro: share(s, from, to) === 1 })); });
  const txt = Object.values(groups).map((g) => `o relatório de ${fmtDate(g.inicio)} a ${fmtDate(g.fim)} ${g.dentro ? '<b>conta inteiro</b> aqui, porque a maior parte dos dias dele cai neste período' : '<b>fica de fora</b>, porque a maior parte dos dias dele cai em outro período'}`).join('; ');
  return `<div class="banner info">Como os números foram contados: ${txt}. Para números exatos por semana, exporte do Gerenciador com Detalhamento por dia.</div>`;
}

function compareView(rows, from, to) {
  return `<section class="card">
    <header class="card-head">
      <div><h2>Comparar campanhas</h2><p class="muted">${fmtRange(from, to)} · marque 2 a 4 para comparar lado a lado. Verde é o melhor da coluna.</p></div>
      <div class="row-actions">
        <label class="inline-field" for="m-cols">Colunas <select id="m-cols"><option value="todas"${colSet === 'todas' ? ' selected' : ''}>Todas</option><option value="meta"${colSet === 'meta' ? ' selected' : ''}>Só do Meta</option><option value="real"${colSet === 'real' ? ' selected' : ''}>Só resultado real</option></select></label>
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
      <li>No Gerenciador, escolha o período e a aba <b>Campanhas</b> (ou Anúncios, para ver por criativo).</li>
      <li>Use sua visualização de colunas (ex.: "Análise de Métricas"). Todas as colunas dela são lidas: valor gasto, resultados, alcance, impressões, frequência, cliques, CPM, CTR, CPC, custos e compras.</li>
      <li>Para números exatos por semana, use <b>Detalhamento › Por tempo › Dia</b>.</li>
      <li><b>Exportar › CSV</b> e clique em Importar relatório. Reimportar o mesmo período substitui as linhas, sem duplicar.</li>
    </ol>
  </section>`;
}

function table(rows) {
  const cols = visibleCols();
  const bestOf = {};
  cols.forEach((c) => {
    if (c.best === 'none') return;
    const vals = rows.map((r) => r[c.key]).filter((v) => v !== null && v !== undefined && v !== 0);
    if (vals.length > 1) bestOf[c.key] = c.best === 'up' ? Math.max(...vals) : Math.min(...vals);
  });
  return `<div class="table-wrap"><table class="tbl dense">
    <thead><tr><th><span class="sr">Comparar</span></th><th>Campanha</th><th>Veiculação</th>${cols.map((c) => `<th class="r">${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><input type="checkbox" aria-label="Comparar ${esc(r.nome)}" data-pick="${esc(r.id)}"${picked.has(r.id) ? ' checked' : ''}></td>
      <td class="nowrap"><a href="#meta?c=${esc(r.id)}">${esc(r.nome)}</a><small class="cell-sub">${esc(r.canal || '')} · ${esc(courseName(r.cursoId))}</small></td>
      <td class="nowrap">${veicBadge(r.veiculacao)}</td>
      ${cols.map((c) => { const v = r[c.key]; const best = bestOf[c.key] !== undefined && v === bestOf[c.key]; return `<td class="r${best ? ' best' : ''}">${c.fmt(v)}${c.sub && c.sub(r) ? `<small class="cell-sub">${esc(c.sub(r))}</small>` : ''}</td>`; }).join('')}
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function veicBadge(v) {
  if (!v) return '<span class="muted">—</span>';
  const cls = v === 'Ativa' ? 'good' : v === 'Com problemas' || v === 'Erro no pagamento' ? 'bad' : v === 'Sem veiculação' ? 'warn' : '';
  return badge(v, cls);
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

function statsInPeriod(from, to, campanhaId) {
  return store.all('adStats').filter((s) => (!campanhaId || s.campanhaId === campanhaId) && (s.inicio || '') <= to && (s.fim || s.inicio || '') >= from)
    .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || '') || (b.investimento || 0) - (a.investimento || 0));
}

function linesView(from, to) {
  const list = statsInPeriod(from, to);
  const camp = (id) => store.get('campaigns', id)?.nome || 'Campanha removida';
  if (!list.length) return empty('Nenhuma linha neste período', 'As linhas aparecem aqui depois de importar o relatório ou digitar métricas. Cada uma pode ser corrigida à mão.');
  return `<section class="card">
    <header class="card-head"><div><h2>Dados importados</h2><p class="muted">Cada linha é exatamente o que veio do arquivo (ou foi digitado). Clique em Corrigir se algum valor estiver errado.</p></div><button class="btn sm" data-act="csv-lines">${ICON.download} CSV das linhas</button></header>
    <div class="table-wrap"><table class="tbl dense"><thead><tr><th>Campanha / anúncio</th><th>Período</th><th>Veiculação</th><th class="r">Valor gasto</th><th class="r">Resultados</th><th class="r">Alcance</th><th class="r">Impressões</th><th class="r">Cliques (todos)</th><th class="r">Cliques no link</th><th class="r">Compras</th><th>Origem</th><th></th></tr></thead>
    <tbody>${list.map((s) => `<tr><td>${esc(camp(s.campanhaId))}${s.anuncio ? `<small class="cell-sub">${esc(s.anuncio)}</small>` : ''}</td><td class="nowrap">${fmtDate(s.inicio)}–${fmtDate(s.fim)}</td><td>${veicBadge(s.veiculacao)}</td><td class="r">${brl2(s.investimento)}</td><td class="r">${num(s.resultados)}${s.tipoResultado ? `<small class="cell-sub">${esc(s.tipoResultado)}</small>` : ''}</td><td class="r">${num(s.alcance)}</td><td class="r">${num(s.impressoes)}</td><td class="r">${num(s.cliquesTodos)}</td><td class="r">${num(s.cliques)}</td><td class="r">${num(s.compras)}</td><td>${badge(s.origem === 'editado' ? 'Corrigido' : s.origem === 'manual' ? 'Digitado' : s.origem === 'demo' ? 'Exemplo' : 'Importado', s.origem === 'editado' ? 'warn' : '')}</td><td class="r nowrap"><button class="btn sm" data-edit-stat="${esc(s.id)}">Corrigir</button></td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

function historyView() {
  const imports = store.all('imports').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  if (!imports.length) return empty('Nenhuma importação ainda', 'O histórico mostra cada arquivo importado, quantas linhas entraram e permite desfazer.');
  return `<section class="card"><header class="card-head"><h2>Histórico de importações</h2></header><div class="table-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Arquivo</th><th class="r">Linhas lidas</th><th class="r">Novas</th><th class="r">Substituídas</th><th class="r">Ignoradas</th><th></th></tr></thead><tbody>${imports.map((i) => `<tr><td>${esc(new Date(i.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</td><td>${esc(i.arquivo || i.fonte)}</td><td class="r">${num(i.lidas)}</td><td class="r">${num(i.novas)}</td><td class="r">${num(i.substituidas)}</td><td class="r">${num(i.ignoradas)}</td><td class="r">${i.fonte?.includes('Ads') ? `<button class="btn sm ghost" data-undo="${esc(i.id)}">Desfazer</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}

// Plano da campanha (cadastro manual) contra o realizado no período.
function planBlock(r) {
  const c = store.get('campaigns', r.id) || {};
  const itens = [];
  if (c.formato) itens.push(['Leva para', esc(c.formato) + (c.linkDestino ? ` · <a href="${esc(c.linkDestino)}" target="_blank" rel="noopener">abrir</a>` : '')]);
  if (c.inicio) itens.push(['Período', fmtDate(c.inicio) + (c.fim ? ' a ' + fmtDate(c.fim) : ' · sem data de fim')]);
  if (c.orcamentoDia) itens.push(['Orçamento/dia', brl2(c.orcamentoDia)]);
  if (c.metaMatriculas) itens.push(['Matrículas x meta', `<b class="${r.matriculas >= c.metaMatriculas ? 'good' : ''}">${num(r.matriculas)}</b> de ${num(c.metaMatriculas)}${r.matriculasExtra ? ` <small class="muted">(${num(r.matriculasExtra)} sem cadastro)</small>` : ''}`]);
  else if (r.matriculasExtra) itens.push(['Matrículas', `${num(r.matriculas)} <small class="muted">(${num(r.matriculasExtra)} sem cadastro)</small>`]);
  if (c.metaVendas) itens.push(['Vendas x meta', `<b class="${r.receita >= c.metaVendas ? 'good' : ''}">${brl(r.receita)}</b> de ${brl(c.metaVendas)}`]);
  if (c.cacMax) itens.push(['CAC x limite', r.cac === null ? 'sem matrícula ainda · limite ' + brl2(c.cacMax) : `<b class="${r.cac > c.cacMax ? 'bad' : 'good'}">${brl2(r.cac)}</b> · limite ${brl2(c.cacMax)}`]);
  if (c.metaConversas) itens.push(['Conversas x meta', `${num(r.resultados)} de ${num(c.metaConversas)}`]);
  if (c.respostasQuiz) itens.push(['Respostas do quiz', num(c.respostasQuiz) + (r.investimento ? ' · ' + brl2(r.investimento / c.respostasQuiz) + ' cada' : '')]);
  if (c.oferta) itens.push(['Oferta', esc(c.oferta)]);
  if (c.publico) itens.push(['Público', esc(c.publico)]);
  if (!itens.length) return `<p class="hint">Sem plano cadastrado. Em "Editar campanha" você define formato (quiz, WhatsApp…), data de início, metas e lança matrículas que não passaram pelo funil.</p>`;
  return `<h3 class="sub-h">Plano da campanha</h3><dl class="stats wide plan">${itens.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function detail(r, t, from, to) {
  const diag = diagnostics(from, to, {}).filter((d) => d.titulo.startsWith(r.nome));
  const vs = (k, dir) => { const c = COLS.find((x) => x.key === k); if (r[k] === null || r[k] === undefined || t[k] === null || !t[k]) return ''; const d = r[k] / t[k] - 1; const good = dir === 'up' ? d > 0 : d < 0; return `<small class="${Math.abs(d) < 0.05 ? 'neutral' : good ? 'good' : 'bad'}">média ${c.fmt(t[k])}</small>`; };
  const lines = statsInPeriod(from, to, r.id);
  const compras = ['comprasSite', 'comprasApp', 'comprasOffline', 'comprasMeta'].filter((k) => r[k]);
  return `<section class="card detail">
    <header class="card-head">
      <div><p class="eyebrow">${esc(r.canal || '')} · ${esc(r.objetivo || 'Objetivo não informado')} · ${esc(courseName(r.cursoId))}</p><h2>${esc(r.nome)}</h2><div class="row-actions" style="margin-top:8px">${veicBadge(r.veiculacao)}${r.tipoResultado ? badge('Resultado: ' + r.tipoResultado, 'info') : ''}</div></div>
      <div class="row-actions">
        <a class="btn sm" href="#pauta?curso=${esc(r.cursoId || '')}&anuncio=1">Criar novo criativo</a>
        <a class="btn sm" href="#metas?ideia=campanha&c=${esc(r.id)}">Registrar teste</a>
        <button class="btn sm" data-edit-camp="${esc(r.id)}">Editar campanha</button>
        <a class="icon-btn" href="#meta" aria-label="Fechar detalhe">${ICON.x}</a>
      </div>
    </header>
    ${planBlock(r)}
    <h3 class="sub-h">Mídia (Meta)</h3>
    <dl class="stats wide">
      <div><dt>Valor gasto</dt><dd>${brl2(r.investimento)}</dd></div>
      <div><dt>Resultados</dt><dd>${num(r.resultados)} <small>${esc(r.tipoResultado || '')}</small></dd></div>
      <div><dt>Custo por resultado</dt><dd>${brl2(r.custoResultado)} ${vs('custoResultado', 'down')}</dd></div>
      <div><dt>Alcance</dt><dd>${num(r.alcance)}</dd></div>
      <div><dt>Impressões</dt><dd>${num(r.impressoes)}</dd></div>
      <div><dt>Frequência</dt><dd>${COLS[5].fmt(r.freq)}</dd></div>
      <div><dt>Cliques (todos)</dt><dd>${num(r.cliquesTodos)}</dd></div>
      <div><dt>CPM</dt><dd>${brl2(r.cpm)} ${vs('cpm', 'down')}</dd></div>
      <div><dt>CTR (link)</dt><dd>${pct(r.ctr, 2)} ${vs('ctr', 'up')}</dd></div>
      <div><dt>CPC (link)</dt><dd>${brl2(r.cpc)} ${vs('cpc', 'down')}</dd></div>
      <div><dt>Custo por clique único</dt><dd>${brl2(r.cpcUnico)}</dd></div>
      <div><dt>Custo por 1.000 alcançadas</dt><dd>${brl2(r.custoMilAlcance)}</dd></div>
      <div><dt>Cliques no link únicos</dt><dd>${num(r.cliquesLinkUnicos)}</dd></div>
      <div><dt>Compras</dt><dd>${num(r.compras)}${compras.length ? `<small>${compras.map((k) => ({ comprasSite: 'site', comprasApp: 'app', comprasOffline: 'offline', comprasMeta: 'na Meta' }[k]) + ': ' + num(r[k])).join(' · ')}</small>` : ''}</dd></div>
    </dl>
    <h3 class="sub-h">Resultado real (WhatsApp e matrículas)</h3>
    <dl class="stats wide">
      <div><dt>Leads registrados</dt><dd>${num(r.leads)} <small>de ${num(r.conversas || r.leadsMeta || r.resultados)} resultados no Meta</small></dd></div>
      <div><dt>Matrículas</dt><dd>${num(r.matriculas)} <small>${pct(r.convLead)} dos leads</small></dd></div>
      <div><dt>CAC</dt><dd>${brl2(r.cac)} ${vs('cac', 'down')}</dd></div>
      <div><dt>Receita</dt><dd>${brl(r.receita)}</dd></div>
    </dl>
    ${diag.length ? `<ul class="diag">${diag.map((d) => `<li class="diag-${NIVEL[d.nivel].cls}">${badge(NIVEL[d.nivel].label, NIVEL[d.nivel].cls)}<h4>${esc(d.titulo.replace(r.nome + ': ', ''))}</h4><p>${esc(d.texto)}</p></li>`).join('')}</ul>` : '<p class="note">Nenhum sinal de alerta nesta campanha no período.</p>'}
    ${r.adList.length > 1 || (r.adList[0] && r.adList[0].nome !== '(sem nome de anúncio)') ? `<h3 class="sub-h">Anúncios</h3><div class="table-wrap"><table class="tbl dense"><thead><tr><th>Anúncio</th><th class="r">Valor gasto</th><th class="r">Resultados</th><th class="r">Custo/resultado</th><th class="r">CTR</th><th class="r">Leads</th><th class="r">Matrículas</th><th class="r">CAC</th></tr></thead><tbody>${r.adList.map((a) => `<tr><td>${esc(a.nome)}${a.conjunto ? `<small class="cell-sub">${esc(a.conjunto)}</small>` : ''}</td><td class="r">${brl2(a.investimento)}</td><td class="r">${num(a.resultados)}</td><td class="r">${brl2(a.custoResultado)}</td><td class="r">${pct(a.ctr, 2)}</td><td class="r">${num(a.leads)}</td><td class="r">${num(a.matriculas)}</td><td class="r">${brl2(a.cac)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3 class="sub-h">Linhas que formam estes números</h3>
    <div class="table-wrap"><table class="tbl dense"><thead><tr><th>Período</th><th>Anúncio</th><th class="r">Valor gasto</th><th class="r">Resultados</th><th class="r">Impressões</th><th>Origem</th><th></th></tr></thead><tbody>${lines.map((s) => `<tr><td class="nowrap">${fmtDate(s.inicio)}–${fmtDate(s.fim)}</td><td>${esc(s.anuncio || '—')}</td><td class="r">${brl2(s.investimento)}</td><td class="r">${num(s.resultados)}</td><td class="r">${num(s.impressoes)}</td><td>${esc(s.origem === 'editado' ? 'Corrigido' : s.origem === 'manual' ? 'Digitado' : 'Importado')}</td><td class="r"><button class="btn sm" data-edit-stat="${esc(s.id)}">Corrigir</button></td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

export function mount(root, ctx) {
  $$('[data-canal]', root).forEach((b) => b.addEventListener('click', () => { location.hash = '#meta' + (b.dataset.canal ? '?canal=' + b.dataset.canal : ''); }));
  $('#m-sort', root)?.addEventListener('change', (e) => { sortKey = e.target.value; ctx.refresh(); });
  $('#m-cols', root)?.addEventListener('change', (e) => { colSet = e.target.value; ctx.refresh(); });
  $$('[data-pick]', root).forEach((cb) => cb.addEventListener('change', () => {
    if (cb.checked) { if (picked.size >= 4) { cb.checked = false; toast('Compare até 4 campanhas por vez.', 'warn'); return; } picked.add(cb.dataset.pick); } else picked.delete(cb.dataset.pick);
    ctx.refresh();
  }));
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-edit-camp],[data-undo],[data-mtab],[data-edit-stat]');
    if (!b) return;
    if (b.dataset.mtab) { tab = b.dataset.mtab; return ctx.refresh(); }
    if (b.dataset.editCamp) return editCampaign(store.get('campaigns', b.dataset.editCamp), ctx);
    if (b.dataset.editStat) return statDialog(store.get('adStats', b.dataset.editStat), ctx);
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
    if (act === 'manual') statDialog(null, ctx);
    if (act === 'camps') campaignsDialog(ctx);
    if (act === 'clear-pick') { picked.clear(); ctx.refresh(); }
    if (act === 'csv') {
      const rows = campaignRows(ctx.from, ctx.to, { ...ctx.f, canal });
      const n = (v) => (v === null || v === undefined ? '' : String(+(+v).toFixed(6)).replace('.', ','));
      downloadFile('meta-ads-campanhas-' + ctx.from + '-a-' + ctx.to + '.csv', toCSV(rows, [{ key: 'nome', label: 'Campanha' }, { key: 'veiculacao', label: 'Veiculação' }, { key: 'canal', label: 'Canal' }, { get: (r) => courseName(r.cursoId), label: 'Curso' }, { key: 'tipoResultado', label: 'Tipo de resultado' }, ...COLS.map((c) => ({ label: c.label + (c.key === 'ctr' ? ' (%)' : ''), get: (r) => n(c.key === 'ctr' && r.ctr !== null ? r.ctr * 100 : r[c.key]) })), { label: 'Compras no site', get: (r) => n(r.comprasSite) }, { label: 'Compras no app', get: (r) => n(r.comprasApp) }, { label: 'Compras offline', get: (r) => n(r.comprasOffline) }, { label: 'Compras na Meta', get: (r) => n(r.comprasMeta) }]), 'text/csv');
    }
    if (act === 'csv-lines') {
      const list = statsInPeriod(ctx.from, ctx.to);
      const n = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
      downloadFile('meta-ads-linhas-' + ctx.from + '-a-' + ctx.to + '.csv', toCSV(list, [{ label: 'Campanha', get: (s) => store.get('campaigns', s.campanhaId)?.nome || '' }, { key: 'conjunto', label: 'Conjunto' }, { key: 'anuncio', label: 'Anúncio' }, { key: 'inicio', label: 'Início' }, { key: 'fim', label: 'Fim' }, { key: 'veiculacao', label: 'Veiculação' }, { key: 'tipoResultado', label: 'Tipo de resultado' }, ...FIELDS.map((f) => ({ label: f.label, get: (s) => n(s[f.key]) })), { key: 'origem', label: 'Origem' }]), 'text/csv');
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

export const FORMATOS = ['WhatsApp (mensagens)', 'Quiz', 'Formulário instantâneo', 'Página de captura / site', 'Direct do Instagram', 'Ligação', 'Outro'];

// Cadastro manual da campanha: o que o Gerenciador não sabe (formato, metas, matrículas que não passaram pelo funil).
function editCampaign(c, ctx) {
  const extras = (c?.matriculasExtras || []).map((e) => ({ ...e }));
  const row = (e) => `<li class="ex-row" data-id="${esc(e.id || '')}">
    <input type="date" data-k="data" value="${esc(e.data || today())}" aria-label="Data">
    <input type="number" min="0" inputmode="numeric" data-k="qtd" value="${esc(e.qtd ?? 1)}" aria-label="Quantidade" placeholder="Qtd.">
    <input type="number" min="0" step="any" inputmode="decimal" data-k="valor" value="${esc(e.valor ?? '')}" aria-label="Valor total (R$)" placeholder="Valor total R$">
    <input data-k="nota" value="${esc(e.nota || '')}" aria-label="Observação" placeholder="ex.: balcão, vieram pelo quiz">
    <button type="button" class="icon-btn sm" data-rmx aria-label="Remover lançamento">×</button></li>`;
  const sec = (label) => ({ type: 'section', label, name: '_' });
  const { dlg } = openDialog({
    title: c ? 'Campanha: ' + c.nome : 'Nova campanha', wide: true,
    fields: [
      sec('Identificação'),
      { name: 'nome', label: 'Nome (igual ao do Gerenciador)', value: c?.nome, required: true, full: true },
      { name: 'canal', label: 'Canal', type: 'select', options: ['Meta', 'Google', 'Outro'], value: c?.canal || 'Meta' },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOptions(), value: c?.cursoId },
      { name: 'objetivo', label: 'Objetivo no Gerenciador', type: 'select', options: ['Mensagens no WhatsApp', 'Cadastro (formulário)', 'Vendas (compras)', 'Tráfego', 'Engajamento', 'Visitas ao perfil', 'Alcance', 'Remarketing', 'Pesquisa (Google)', 'Outro'], value: c?.objetivo || 'Mensagens no WhatsApp' },
      { name: 'formato', label: 'Para onde o anúncio leva', type: 'select', options: ['', ...FORMATOS], value: c?.formato || '' },
      { name: 'linkDestino', label: 'Link do quiz, formulário ou página', type: 'url', value: c?.linkDestino, placeholder: 'https://' },
      { name: 'inicio', label: 'Começou em', type: 'date', value: c?.inicio },
      { name: 'fim', label: 'Termina em (se tiver)', type: 'date', value: c?.fim },
      { name: 'orcamentoDia', label: 'Orçamento por dia (R$)', type: 'number', value: c?.orcamentoDia },
      { name: 'veiculacao', label: 'Veiculação', type: 'select', options: ['', ...VEIC_LABELS], value: c?.veiculacao || '' },
      { name: 'status', label: 'Situação no painel', type: 'select', options: ['Ativa', 'Pausada', 'Encerrada'], value: c?.status || 'Ativa' },
      { name: 'publico', label: 'Público', value: c?.publico, placeholder: 'ex.: mulheres 25-45, 15 km da escola' },
      { name: 'oferta', label: 'Oferta', value: c?.oferta, placeholder: 'ex.: matrícula grátis até sexta', full: true },
      sec('Metas da campanha'),
      { name: 'metaMatriculas', label: 'Meta de matrículas', type: 'number', value: c?.metaMatriculas },
      { name: 'metaVendas', label: 'Meta de vendas (R$)', type: 'number', value: c?.metaVendas },
      { name: 'cacMax', label: 'CAC máximo aceitável (R$)', type: 'number', value: c?.cacMax, hint: 'Acima disso o painel avisa.' },
      { name: 'metaConversas', label: 'Meta de conversas ou cadastros', type: 'number', value: c?.metaConversas },
      sec('Resultados contados à mão'),
      { name: 'respostasQuiz', label: 'Pessoas que responderam o quiz/formulário', type: 'number', value: c?.respostasQuiz, hint: 'Se o Gerenciador não mostra esse número.' },
      { name: 'notas', label: 'Observações e aprendizados', type: 'textarea', value: c?.notas, full: true },
    ],
    html: `<h3 class="form-sec">Matrículas sem cadastro de aluno</h3>
      <p class="hint">Matrículas que essa campanha gerou mas que não estão no funil (ex.: a pessoa viu o anúncio e foi direto ao balcão). Lance só o número: elas entram no total de matrículas, na receita e no CAC, igual em todas as telas. Não lance de novo quem você já registrou como aluno.</p>
      <ol class="ex-list" id="ex-list">${extras.map(row).join('')}</ol>
      <button type="button" class="btn sm" id="ex-add">${ICON.plus} Lançar matrículas</button>`,
    onOpen: (form) => {
      const list = $('#ex-list', form);
      $('#ex-add', form).addEventListener('click', () => { list.insertAdjacentHTML('beforeend', row({})); $('.ex-row:last-child [data-k="qtd"]', list).focus(); });
      list.addEventListener('click', (e) => { if (e.target.closest('[data-rmx]')) e.target.closest('.ex-row').remove(); });
      $('[name="nome"]', form).focus();
    },
    onSave: (d, form) => {
      const ex = $$('.ex-row', form).map((li) => ({ id: li.dataset.id || uid('mx'), data: $('[data-k="data"]', li).value, qtd: Number($('[data-k="qtd"]', li).value) || 0, valor: $('[data-k="valor"]', li).value === '' ? 0 : Number($('[data-k="valor"]', li).value), nota: $('[data-k="nota"]', li).value.trim() })).filter((e) => e.qtd > 0 && e.data);
      const { _, ...rest } = d;
      store.put('campaigns', { ...(c || {}), ...rest, matriculasExtras: ex });
      toast('Campanha salva.' + (ex.length ? ' ' + ex.reduce((a, e) => a + e.qtd, 0) + ' matrículas sem cadastro contadas.' : ''));
      ctx.refresh();
    },
    onDelete: c ? () => { store.remove('campaigns', c.id); store.removeWhere('adStats', (s) => s.campanhaId === c.id); toast('Campanha e métricas excluídas.'); ctx.go('#meta'); } : null,
    deleteLabel: 'Excluir campanha e métricas',
  });
  return dlg;
}

function campaignsDialog(ctx) {
  const list = store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome));
  const { dlg } = openDialog({
    title: 'Campanhas', wide: true,
    html: `<p class="hint">Defina o curso de cada campanha. É o que liga o investimento às matrículas do curso.</p>
    ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Campanha</th><th>Canal</th><th>Curso</th><th>Veiculação</th><th></th></tr></thead><tbody>${list.map((c) => `<tr><td>${esc(c.nome)}</td><td>${esc(c.canal)}</td><td>${esc(courseName(c.cursoId))}</td><td>${esc(c.veiculacao || '—')}</td><td class="r"><button type="button" class="btn sm" data-ec="${esc(c.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Nenhuma campanha ainda.</p>'}
    <button type="button" class="btn" data-ec="">${ICON.plus} Nova campanha</button>`,
  });
  $$('[data-ec]', dlg).forEach((b) => b.addEventListener('click', () => { dlg.close(); editCampaign(b.dataset.ec ? store.get('campaigns', b.dataset.ec) : null, ctx); }));
}

function findOrCreateCampaign(nome, canalNovo, cursoId) {
  const n = norm(nome);
  const found = store.all('campaigns').find((c) => norm(c.nome) === n);
  if (found) return found;
  return store.put('campaigns', { nome: nome.trim(), canal: canalNovo, cursoId: cursoId || guessCourse(nome), status: 'Ativa', objetivo: /mensag|whats|conversa/i.test(nome) ? 'Mensagens no WhatsApp' : '' });
}

// ---------- linha de métrica: digitar ou corrigir ----------
// Campos guardados (contagens). As taxas aparecem ao lado, recalculadas enquanto você digita.
const FIELDS = [
  { key: 'investimento', label: 'Valor gasto (R$)' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'impressoes', label: 'Impressões' },
  { key: 'cliquesTodos', label: 'Cliques (todos)' },
  { key: 'cliques', label: 'Cliques no link' },
  { key: 'cliquesLinkUnicos', label: 'Cliques no link únicos' },
  { key: 'cliquesUnicosTodos', label: 'Cliques únicos (todos)' },
  { key: 'conversas', label: 'Conversas por mensagem iniciadas' },
  { key: 'leadsMeta', label: 'Leads (formulário)' },
  { key: 'compras', label: 'Compras' },
  { key: 'comprasSite', label: 'Compras no site' },
  { key: 'comprasApp', label: 'Compras no app' },
  { key: 'comprasOffline', label: 'Compras offline' },
  { key: 'comprasMeta', label: 'Compras na Meta' },
];
const TIPOS = ['', 'Conversas', 'Compras', 'Leads', 'Visitas ao perfil', 'Cliques no link', 'Visualizações da página', 'Engajamento', 'Alcance', 'Visualizações do vídeo', 'Seguidores', 'Outro'];
const VEIC_LABELS = ['Ativa', 'Desativada', 'Pausada', 'Sem veiculação', 'Erro no pagamento', 'Com problemas', 'Em análise', 'Arquivada', 'Concluída'];

function previewRates(d) {
  const r = { ...d };
  ['investimento', 'resultados', 'alcance', 'impressoes', 'cliques', 'cliquesUnicosTodos'].forEach((k) => (r[k] = Number(r[k]) || 0));
  return [
    ['Custo por resultado', brl2(div(r.investimento, r.resultados))],
    ['Frequência', r.alcance ? (r.impressoes / r.alcance).toFixed(2).replace('.', ',') : '—'],
    ['CPM', r.impressoes ? brl2(r.investimento / r.impressoes * 1000) : '—'],
    ['CTR (link)', pct(div(r.cliques, r.impressoes), 2)],
    ['CPC (link)', brl2(div(r.investimento, r.cliques))],
    ['Custo por clique único', brl2(div(r.investimento, r.cliquesUnicosTodos))],
    ['Custo por 1.000 alcançadas', r.alcance ? brl2(r.investimento / r.alcance * 1000) : '—'],
  ];
}

function statDialog(s, ctx) {
  const isNew = !s;
  const camps = store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome));
  const reported = s?.metaReportado || {};
  const repList = [['CTR (link)', reported.ctr, (v) => String(v).replace('.', ',') + '%'], ['CPC (link)', reported.cpc, brl2], ['CPM', reported.cpm, brl2], ['Frequência', reported.frequencia, (v) => String(v).replace('.', ',')], ['Custo por resultado', reported.custoResultado, brl2], ['Custo por clique único', reported.cpcUnico, brl2], ['Custo por 1.000 alcançadas', reported.custoMilAlcance, brl2]].filter((x) => x[1] !== null && x[1] !== undefined && x[1] !== '');
  const { dlg, form } = openDialog({
    title: isNew ? 'Digitar métricas de um período' : 'Corrigir linha de métrica', wide: true,
    fields: [
      { name: 'campanhaNome', label: 'Campanha', value: isNew ? '' : store.get('campaigns', s.campanhaId)?.nome || '', required: true, full: true, list: 'camp-list', placeholder: 'Escolha ou digite um nome novo' },
      { name: 'conjunto', label: 'Conjunto de anúncios (opcional)', value: s?.conjunto || '' },
      { name: 'anuncio', label: 'Anúncio (opcional)', value: s?.anuncio || '' },
      { name: 'inicio', label: 'De', type: 'date', value: s?.inicio || ctx.from, required: true },
      { name: 'fim', label: 'Até', type: 'date', value: s?.fim || (ctx.to < today() ? ctx.to : today()), required: true },
      { name: 'veiculacao', label: 'Veiculação', type: 'select', options: ['', ...VEIC_LABELS], value: s?.veiculacao || '' },
      { name: 'tipoResultado', label: 'Tipo de resultado', type: 'select', options: TIPOS, value: s?.tipoResultado || '' },
      ...FIELDS.map((f) => ({ name: f.key, label: f.label, type: 'number', value: s ? s[f.key] ?? '' : '', required: f.key === 'investimento' })),
    ],
    html: `<datalist id="camp-list">${camps.map((c) => `<option value="${esc(c.nome)}">`).join('')}</datalist>
      <div class="card" style="padding:16px;gap:10px"><h3 class="sub-h">Calculado a partir dos campos acima</h3><dl class="stats wide" id="st-prev"></dl>
      ${repList.length ? `<p class="hint">Valores que o Meta informou no arquivo: ${repList.map(([l, v, f]) => `${l} ${esc(f(v))}`).join(' · ')}</p>` : ''}</div>`,
    onSave: (d, f) => {
      if (d.inicio > d.fim) { const e = $('.form-error', dlg); e.textContent = 'A data inicial é depois da final.'; e.hidden = false; return false; }
      const camp = findOrCreateCampaign(d.campanhaNome, 'Meta', '');
      const rec = { ...(s || {}), campanhaId: camp.id, conjunto: d.conjunto, anuncio: d.anuncio, inicio: d.inicio, fim: d.fim, veiculacao: d.veiculacao, tipoResultado: d.tipoResultado, origem: isNew ? 'manual' : 'editado' };
      FIELDS.forEach((fl) => (rec[fl.key] = d[fl.key] === null ? 0 : d[fl.key]));
      if (!isNew) rec.corrigidoEm = new Date().toISOString();
      store.put('adStats', rec);
      if (d.veiculacao) store.put('campaigns', { ...store.get('campaigns', camp.id), veiculacao: d.veiculacao });
      toast(isNew ? 'Métricas salvas.' : 'Linha corrigida. Os números recalcularam.');
      ctx.refresh();
      void f;
    },
    onDelete: isNew ? null : () => { store.remove('adStats', s.id); toast('Linha excluída.'); ctx.refresh(); },
    deleteLabel: 'Excluir linha',
  });
  const upd = () => { const d = {}; FIELDS.forEach((fl) => (d[fl.key] = $('#f_' + fl.key, form).value)); $('#st-prev', dlg).innerHTML = previewRates(d).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join(''); };
  form.addEventListener('input', upd); upd();
}

// ---------- importação ----------
// Nomes de coluna aceitos (já sem acento, minúsculos e sem "(BRL)"). Só comparação exata, para que
// "Custo por resultados" nunca seja confundido com "Valor gasto".
const ALIASES = {
  campanha: ['nome da campanha', 'campanha', 'campaign name', 'campaign'],
  conjunto: ['nome do conjunto de anuncios', 'conjunto de anuncios', 'ad set name', 'grupo de anuncios', 'ad group'],
  anuncio: ['nome do anuncio', 'anuncio', 'ad name', 'ad'],
  inicio: ['inicio dos relatorios', 'reporting starts', 'dia', 'day', 'data', 'date'],
  fim: ['encerramento dos relatorios', 'termino dos relatorios', 'reporting ends'],
  veiculacao: ['veiculacao da campanha', 'veiculacao do anuncio', 'veiculacao do conjunto de anuncios', 'veiculacao', 'campaign delivery', 'ad delivery', 'delivery'],
  investimento: ['valor gasto', 'valor usado', 'amount spent', 'investimento', 'gasto', 'custo', 'cost'],
  resultados: ['resultados', 'results'],
  custoResultado: ['custo por resultados', 'custo por resultado', 'cost per result', 'cost per results'],
  tipoResultado: ['indicador de resultados', 'indicador de resultado', 'result indicator', 'tipo de resultado', 'result type'],
  alcance: ['alcance', 'reach'],
  impressoes: ['impressoes', 'impressions', 'impr.'],
  frequencia: ['frequencia', 'frequency'],
  cliquesTodos: ['cliques (todos)', 'clicks (all)', 'cliques', 'clicks'],
  cpm: ['cpm (custo por 1.000 impressoes)', 'cpm (cost per 1,000 impressions)', 'cpm'],
  ctr: ['ctr (taxa de cliques no link)', 'ctr (link click-through rate)'],
  cpc: ['cpc (custo por clique no link)', 'cpc (cost per link click)'],
  cliquesLink: ['cliques no link', 'link clicks'],
  cliquesLinkUnicos: ['cliques no link unicos', 'unique link clicks'],
  cpcUnico: ['custo por clique unico (todos)', 'cost per unique click (all)'],
  custoMilAlcance: ['custo por 1.000 contas meta alcancadas', 'custo por 1.000 contas da central de contas alcancadas', 'custo por 1.000 pessoas alcancadas', 'cost per 1,000 accounts center accounts reached', 'cost per 1,000 people reached'],
  conversas: ['conversas por mensagem iniciadas', 'messaging conversations started', 'conversas iniciadas'],
  leadsMeta: ['leads', 'cadastros', 'leads no formulario'],
  compras: ['compras', 'purchases'],
  comprasApp: ['compras no app', 'app purchases', 'mobile app purchases'],
  comprasSite: ['compras no site', 'website purchases'],
  comprasOffline: ['compras offline', 'offline purchases'],
  comprasMeta: ['compras na meta', 'meta purchases', 'on-facebook purchases'],
};
export const LABELS = {
  campanha: 'Campanha', conjunto: 'Conjunto', anuncio: 'Anúncio', inicio: 'Início', fim: 'Fim', veiculacao: 'Veiculação', investimento: 'Valor gasto', resultados: 'Resultados', custoResultado: 'Custo por resultado', tipoResultado: 'Tipo de resultado',
  alcance: 'Alcance', impressoes: 'Impressões', frequencia: 'Frequência', cliquesTodos: 'Cliques (todos)', cpm: 'CPM', ctr: 'CTR (link)', cpc: 'CPC (link)', cliquesLink: 'Cliques no link', cliquesLinkUnicos: 'Cliques no link únicos',
  cpcUnico: 'Custo por clique único', custoMilAlcance: 'Custo por 1.000 alcançadas', conversas: 'Conversas', leadsMeta: 'Leads', compras: 'Compras', comprasApp: 'Compras no app', comprasSite: 'Compras no site', comprasOffline: 'Compras offline', comprasMeta: 'Compras na Meta',
};

const headerKey = (h) => norm(h).replace(/\s*\((brl|usd|eur|r\$)\)\s*$/, '').replace(/\s+/g, ' ').trim();

export function mapHeaders(headers) {
  const map = {};
  const nh = headers.map((h) => ({ h, n: headerKey(h) }));
  Object.entries(ALIASES).forEach(([key, al]) => {
    for (const a of al) { const hit = nh.find((x) => x.n === a); if (hit) { map[key] = hit.h; break; } }
  });
  if (!map.conversas) { const hit = nh.find((x) => x.n.includes('conversa') && x.n.includes('inicia')); if (hit) map.conversas = hit.h; }
  return map;
}

// "61.405" em coluna de contagem é milhar; "797.92" em coluna de valor é decimal.
function parseCount(v) {
  const s = String(v ?? '').trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  const n = parseNum(s);
  return n === null ? null : Math.round(n);
}

export function resultType(raw) {
  const t = norm(raw);
  if (!t) return '';
  if (/messag|conversa/.test(t)) return 'Conversas';
  if (/purchase|compra/.test(t)) return 'Compras';
  if (/lead|cadastro/.test(t)) return 'Leads';
  if (/profile_visit|visita/.test(t)) return 'Visitas ao perfil';
  if (/landing_page/.test(t)) return 'Visualizações da página';
  if (/link_click|clique/.test(t)) return 'Cliques no link';
  if (/video/.test(t)) return 'Visualizações do vídeo';
  if (/follow|seguidor|like/.test(t)) return 'Seguidores';
  if (/engagement|engajamento/.test(t)) return 'Engajamento';
  if (/reach|alcance/.test(t)) return 'Alcance';
  return 'Outro';
}

export function veiculacaoLabel(raw) {
  const t = norm(raw);
  if (!t || t === '0') return '';
  return ({ active: 'Ativa', inactive: 'Desativada', not_delivering: 'Sem veiculação', paused: 'Pausada', campaign_paused: 'Pausada', adset_paused: 'Pausada', archived: 'Arquivada', deleted: 'Excluída', completed: 'Concluída', in_process: 'Em análise', pending_review: 'Em análise', with_issues: 'Com problemas', disapproved: 'Reprovada', pending_billing_info: 'Erro no pagamento', ativa: 'Ativa', desativada: 'Desativada', desativado: 'Desativada' })[t] || String(raw).trim();
}

export function buildRows(parsed, map, opt) {
  const out = []; let ignoradas = 0;
  parsed.rows.forEach((r) => {
    const nome = (r[map.campanha] || '').trim();
    if (!nome || /^total/i.test(nome)) { ignoradas++; return; }
    const get = (k) => (map[k] ? r[map[k]] : '');
    const money = (k) => (map[k] ? parseNum(get(k)) : null);
    const count = (k) => (map[k] ? parseCount(get(k)) : null);
    const inicio = parseDate(get('inicio')) || opt.inicio;
    const fim = parseDate(get('fim')) || (map.inicio && parseDate(get('inicio'))) || opt.fim;
    const investimento = money('investimento') || 0;
    const custoResultado = money('custoResultado');
    const indicador = (get('tipoResultado') || '').trim();
    const tipoResultado = resultType(indicador);
    let resultados = count('resultados');
    if (resultados === null) resultados = custoResultado ? Math.round(investimento / custoResultado) : 0;
    const impressoes = count('impressoes') || 0;
    const ctr = money('ctr'), cpc = money('cpc'), cpcUnico = money('cpcUnico');
    let cliques = count('cliquesLink');
    if (cliques === null) cliques = ctr !== null ? Math.round(ctr / 100 * impressoes) : cpc ? Math.round(investimento / cpc) : (count('cliquesLinkUnicos') || 0);
    const pick = (k, tipo) => { const v = count(k); return v !== null ? v : tipoResultado === tipo ? resultados : 0; };
    out.push({
      campanha: nome, conjunto: (get('conjunto') || '').trim(), anuncio: (get('anuncio') || '').trim(), inicio, fim,
      veiculacao: veiculacaoLabel(get('veiculacao')), tipoResultado, indicador,
      investimento, resultados, alcance: count('alcance') || 0, impressoes, cliques,
      cliquesTodos: count('cliquesTodos') || 0, cliquesLinkUnicos: count('cliquesLinkUnicos') || 0,
      cliquesUnicosTodos: cpcUnico ? Math.round(investimento / cpcUnico) : 0,
      conversas: pick('conversas', 'Conversas'), leadsMeta: pick('leadsMeta', 'Leads'), compras: pick('compras', 'Compras'),
      comprasApp: count('comprasApp') || 0, comprasSite: count('comprasSite') || 0, comprasOffline: count('comprasOffline') || 0, comprasMeta: count('comprasMeta') || 0,
      metaReportado: { ctr, cpc, cpm: money('cpm'), frequencia: money('frequencia'), custoResultado, cpcUnico, custoMilAlcance: money('custoMilAlcance') },
    });
  });
  return { rows: out, ignoradas };
}

function importDialog(ctx) {
  let parsed = null, map = null, fileName = '';
  const { dlg } = openDialog({
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
      <div class="field full"><label for="imp-text">Conteúdo do CSV</label><textarea id="imp-text" rows="4" placeholder="Nome da campanha,Valor gasto (BRL),Impressões,..."></textarea></div>
      <div id="imp-preview"></div>`,
    onSave: (d) => {
      if (!parsed || !map?.campanha) { const e = $('.form-error', dlg); e.textContent = 'Não encontrei a coluna com o nome da campanha. Confira o arquivo.'; e.hidden = false; return false; }
      if (!map.investimento) { const e = $('.form-error', dlg); e.textContent = 'Não encontrei a coluna de valor gasto. Inclua "Valor gasto" ou "Valor usado" na exportação.'; e.hidden = false; return false; }
      const { rows, ignoradas } = buildRows(parsed, map, d);
      if (!rows.length) { const e = $('.form-error', dlg); e.textContent = 'Nenhuma linha com campanha para importar.'; e.hidden = false; return false; }
      const imp = store.put('imports', { fonte: d.canal + ' Ads', arquivo: fileName || 'Conteúdo colado', lidas: parsed.rows.length });
      const existing = store.all('adStats');
      let novas = 0, subst = 0;
      const removed = new Set();
      const recs = rows.map((r) => {
        const camp = findOrCreateCampaign(r.campanha, d.canal, '');
        if (r.veiculacao) store.put('campaigns', { ...store.get('campaigns', camp.id), veiculacao: r.veiculacao, ...(r.tipoResultado === 'Compras' && !camp.objetivo ? { objetivo: 'Vendas (compras)' } : {}) });
        const key = [camp.id, norm(r.conjunto), norm(r.anuncio), r.inicio, r.fim].join('|');
        const old = existing.find((s) => [s.campanhaId, norm(s.conjunto), norm(s.anuncio), s.inicio, s.fim].join('|') === key);
        // Mesmo anúncio com período que se sobrepõe (ex.: mês inteiro e depois o mesmo mês por dia): a linha antiga sai, senão o gasto conta em dobro.
        existing.filter((s) => s !== old && !s.manual && s.campanhaId === camp.id && norm(s.conjunto) === norm(r.conjunto) && norm(s.anuncio) === norm(r.anuncio) && s.inicio && s.fim && r.inicio && r.fim && s.inicio <= r.fim && r.inicio <= s.fim && !(s.importId === imp.id))
          .forEach((s) => { if (!removed.has(s.id)) { removed.add(s.id); store.remove('adStats', s.id); } });
        if (old) subst++; else novas++;
        const { campanha, ...rest } = r;
        // Recomeça do zero em cada reimportação (corrige linhas importadas antes com a leitura antiga).
        const base = {};
        METRIC_KEYS.forEach((k) => (base[k] = 0));
        return { ...base, ...rest, id: old?.id || uid('ad_'), createdAt: old?.createdAt, campanhaId: camp.id, origem: 'csv', importId: imp.id };
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
    const { rows, ignoradas } = buildRows(parsed, map, { inicio: $('#f_inicio', dlg).value, fim: $('#f_fim', dlg).value });
    const known = new Set(Object.values(map));
    const unknown = parsed.headers.filter((h) => !known.has(h));
    box.innerHTML = `<p class="note">${parsed.rows.length} linhas lidas${ignoradas ? ` (${ignoradas} sem nome de campanha, como a linha de total, serão ignoradas)` : ''}. Colunas reconhecidas:</p>
      <ul class="map-list">${Object.keys(ALIASES).filter((k) => map[k]).map((k) => `<li class="ok">✓ ${LABELS[k]} <small>← ${esc(map[k])}</small></li>`).join('')}${!map.resultados && map.custoResultado ? '<li class="ok">✓ Resultados <small>← calculado: valor gasto ÷ custo por resultado</small></li>' : ''}</ul>
      ${unknown.length ? `<p class="hint">Colunas não usadas: ${unknown.map(esc).join(', ')}</p>` : ''}
      ${rows.length ? `<div class="table-wrap"><table class="tbl dense"><thead><tr><th>Campanha</th><th>Período</th><th>Veiculação</th><th class="r">Valor gasto</th><th class="r">Resultados</th><th class="r">Custo/res.</th><th class="r">Alcance</th><th class="r">Impressões</th><th class="r">CTR</th><th class="r">Compras</th></tr></thead><tbody>${rows.slice(0, 8).map((r) => `<tr><td>${esc(r.campanha)}${r.anuncio ? `<small class="cell-sub">${esc(r.anuncio)}</small>` : ''}</td><td class="nowrap">${fmtDate(r.inicio)}–${fmtDate(r.fim)}</td><td>${esc(r.veiculacao || '—')}</td><td class="r">${brl2(r.investimento)}</td><td class="r">${num(r.resultados)}<small class="cell-sub">${esc(r.tipoResultado)}</small></td><td class="r">${brl2(div(r.investimento, r.resultados))}</td><td class="r">${num(r.alcance)}</td><td class="r">${num(r.impressoes)}</td><td class="r">${pct(div(r.cliques, r.impressoes), 2)}</td><td class="r">${num(r.compras)}</td></tr>`).join('')}</tbody></table></div>${rows.length > 8 ? `<p class="hint">e mais ${rows.length - 8} linhas.</p>` : ''}<p class="hint">Confira os valores com o Gerenciador antes de importar. Depois você pode corrigir qualquer linha em Dados importados.</p>` : '<p class="form-error">Nenhuma linha válida. O arquivo precisa ter a coluna com o nome da campanha.</p>'}`;
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
  void inRange;
}
