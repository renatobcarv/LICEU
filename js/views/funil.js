// Funil comercial em Kanban. Vários funis (cada um com nome e etapas próprias), botão de ganho,
// produtos que preenchem a matrícula, adição rápida direto na coluna e filtros de foco.
// Sem o lead registrado com a campanha, não existe CAC real.

import { store } from '../store.js';
import { esc, $, $$, brl, num, pct, fmtDate, today, daysBetween, weekStart, parseCSV, parseDate, norm, phoneKey, toCSV, inRange, sum } from '../util.js';
import { STAGES, STAGE_IDX, ORIGENS, salesStats, courseName, campaignName, settings, reached } from '../metrics.js';
import { toast, ICON, funnel, empty, readFileText, downloadFile, copyText, openDialog, badge, confirmButton } from '../ui.js';
import {
  matriculaDialog, loseDialog, editLead, courseOpts, campOpts, moveToCol, pipelines, pipeline, leadCol, leadStage, leadPipeId,
  pipeDialog, productDialog, responsaveis, tagList, TEMPERATURAS, myName, recebido,
} from '../leads.js';

const PIPE_KEY = 'liceu.funil.atual';
let tab = 'kanban';
let q = '';
let view = 'todos';   // todos | abertos | hoje | ganhos | perdidos
let fResp = '';
let fTemp = '';
let lote = '';        // id da importação de contatos em foco na Lista
let pipeId = (() => { try { return localStorage.getItem(PIPE_KEY) || 'principal'; } catch (e) { return 'principal'; } })();

const setPipe = (id) => { pipeId = id || 'principal'; try { localStorage.setItem(PIPE_KEY, pipeId); } catch (e) { /* opcional */ } };
const OPEN = (l) => !['matriculado', 'perdido'].includes(l.etapa);
const initials = (s) => String(s || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export function render(ctx) {
  const { from, to, f, params } = ctx;
  if (params.etapa || params.vencidos) tab = 'lista';
  if (params.pipe) { setPipe(params.pipe); tab = 'kanban'; history.replaceState(null, '', '#funil'); }
  const p = pipeline(pipeId);
  pipeId = p.id;
  const s = salesStats(from, to, { ...f, funilId: p.id });
  const pipes = pipelines();
  const abertosPorFunil = (id) => store.all('leads').filter((l) => OPEN(l) && leadPipeId(l) === id).length;
  const tabs = [['kanban', 'Kanban'], ['lista', 'Lista'], ['analise', 'Análise'], ['produtos', 'Produtos'], ['respostas', 'Respostas prontas']];
  return `
  <section class="pipe-bar" aria-label="Funis">
    <div class="pipe-tabs scroll-x" role="tablist">${pipes.map((x) => `<button type="button" class="pipe-tab" role="tab" data-pipe="${esc(x.id)}" aria-selected="${x.id === p.id}"><span>${esc(x.nome)}</span><small>${abertosPorFunil(x.id)}</small></button>`).join('')}
      <button type="button" class="pipe-tab add" data-act="new-pipe">${ICON.plus} Novo funil</button></div>
    <button type="button" class="btn sm ghost" data-act="edit-pipe">Editar funil</button>
  </section>
  ${p.descricao ? `<p class="pipe-desc">${esc(p.descricao)}</p>` : ''}

  <form class="quick card" id="quick" autocomplete="off" aria-label="Registrar lead">
    <h2>Nova conversa em <em>${esc(p.nome)}</em></h2>
    <div class="quick-grid">
      <div class="field"><label for="q-nome">Nome</label><input id="q-nome" name="nome" required placeholder="Como a pessoa se apresentou"></div>
      <div class="field"><label for="q-tel">WhatsApp</label><input id="q-tel" name="telefone" inputmode="tel" placeholder="(61) 9 0000-0000"></div>
      <div class="field"><label for="q-curso">Curso de interesse</label><select id="q-curso" name="cursoId">${courseOpts().map(([v, l]) => `<option value="${esc(v)}"${v === (f.cursoId || p.cursoId) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="q-origem">Como chegou</label><select id="q-origem" name="origem">${ORIGENS.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>
      <div class="field" id="q-camp-wrap"><label for="q-camp">Campanha</label><select id="q-camp" name="campanhaId">${campOpts().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="q-temp">Temperatura</label><select id="q-temp" name="temperatura"><option value="">—</option>${TEMPERATURAS.map((t) => `<option>${t}</option>`).join('')}</select></div>
      <button class="btn primary" type="submit">${ICON.plus} Adicionar</button>
    </div>
  </form>

  <section class="kpis compact" aria-label="Funil no período">
    ${[['Entraram no período', num(s.leads)], ['Em aberto', num(s.abertos.length)], ['Ganhos', num(s.matriculas)], ['Conversão', pct(s.convLead)], ['Em aberto (R$)', brl(sum(s.abertos, (l) => l.valor))], ['Ganho (R$)', brl(s.receita)], ['Retornos atrasados', num(s.followVencidos.length)], ['Sem 1º contato', num(s.semContato.length)]].map(([l, v]) => `<article class="kpi"><h3>${l}</h3><p class="kpi-v">${v}</p></article>`).join('')}
  </section>

  <div class="toolbar">
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="tab" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn sm" data-act="import">${ICON.upload} Importar lista</button>
    <button class="btn sm" data-act="export">${ICON.download} CSV</button>
    <button class="btn sm danger" data-act="zerar">Zerar</button>
  </div>
  <div id="tab-body">${body(ctx, s, p)}</div>`;
}

function body(ctx, s, p) {
  if (tab === 'kanban') return board(ctx, p);
  if (tab === 'lista') return list(ctx, p);
  if (tab === 'analise') return analysis(ctx, s, p);
  if (tab === 'produtos') return produtos(ctx);
  return respostas();
}

// Filtros comuns: curso do topo, busca, responsável e temperatura.
function filtered(ctx) {
  const qq = norm(q);
  return store.all('leads').filter((l) => !l.foraDoFunil && (!ctx.f.cursoId || l.cursoId === ctx.f.cursoId)
    && (!fResp || (fResp === '—' ? !l.responsavel : l.responsavel === fResp))
    && (!fTemp || l.temperatura === fTemp)
    && (!qq || norm([l.nome, l.telefone, l.email, l.cidade, l.notas, l.proximaAcao, ...tagList(l.etiquetas)].join(' ')).includes(qq)));
}

const daysInStage = (l) => { const h = (l.historico || []).at(-1); const d = h?.data || l.entrada; return d ? daysBetween(d, today()) : 0; };

function cardHTML(l, p) {
  const t = today();
  const late = l.proximaData && l.proximaData < t && OPEN(l);
  const due = l.proximaData && l.proximaData === t && OPEN(l);
  const col = leadCol(l, p);
  const i = p.etapas.findIndex((e) => e.id === col);
  const next = i >= 0 && i < p.etapas.length - 1 ? p.etapas[i + 1] : null;
  const parado = OPEN(l) ? daysInStage(l) : 0;
  const prod = store.get('products', l.produtoId);
  const tags = tagList(l.etiquetas);
  const temp = l.temperatura ? `<span class="temp t-${norm(l.temperatura)}" title="${esc(l.temperatura)}" aria-label="${esc(l.temperatura)}"></span>` : '';
  return `<article class="lead${late ? ' late' : ''}${parado >= 7 ? ' stale' : ''}" draggable="true" data-drag="${esc(l.id)}" aria-label="${esc(l.nome)}, ${esc(leadStage(l))}">
    <div class="lead-top">
      <button type="button" class="lead-open" data-edit="${esc(l.id)}"><b>${temp}${esc(l.nome)}</b><small>${esc(prod?.nome || courseName(l.cursoId))}</small></button>
      ${l.responsavel ? `<span class="avatar" title="${esc(l.responsavel)}">${esc(initials(l.responsavel))}</span>` : ''}
    </div>
    ${tags.length ? `<p class="tags">${tags.slice(0, 3).map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</p>` : ''}
    ${l.origem || l.campanhaId ? `<p class="lead-meta">${esc(l.origem || '')}${l.campanhaId ? ' · ' + esc(campaignName(l.campanhaId)) : ''}</p>` : ''}
    ${l.etapa === 'matriculado'
      ? `<p class="lead-meta"><b class="good">${brl(l.valor)}</b> · ${esc(l.statusPagamento || 'Pago')}${l.statusPagamento && l.statusPagamento !== 'Pago' ? ' (' + brl(recebido(l)) + ')' : ''} · ${fmtDate(l.dataMatricula)}</p>`
      : l.etapa === 'perdido'
        ? `<p class="lead-meta">${esc(l.motivoPerda || 'Sem motivo')} · ${fmtDate(l.dataPerda)}</p>`
        : `<p class="lead-meta">${l.valor ? `<b>${brl(l.valor)}</b> · ` : ''}<span class="${parado >= 7 ? 'warn-t' : ''}">${parado === 0 ? 'Mudou hoje' : parado + (parado > 1 ? ' dias' : ' dia') + ' na etapa'}</span>${l.proximaData ? ` · <span class="${late ? 'bad' : due ? 'warn-t' : ''}">${due ? 'retorno hoje' : 'retorno ' + fmtDate(l.proximaData)}</span>` : ''}</p>`}
    ${l.proximaAcao && OPEN(l) ? `<p class="lead-next">${esc(l.proximaAcao)}</p>` : ''}
    ${OPEN(l) ? `<div class="lead-actions">
      ${next ? `<button type="button" class="btn sm" data-move="${esc(l.id)}" data-to="${esc(next.id)}" title="Mover para ${esc(next.nome)}">${ICON.arrow}</button>` : ''}
      <button type="button" class="btn sm win" data-win="${esc(l.id)}">✓ Ganho</button>
      <button type="button" class="btn sm ghost" data-lose="${esc(l.id)}">Perdido</button>
    </div>` : ''}
  </article>`;
}

function filterBar() {
  const views = [['todos', 'Tudo'], ['abertos', 'Em aberto'], ['hoje', 'Para fazer hoje'], ['ganhos', 'Só ganhos'], ['perdidos', 'Só perdidos']];
  const resp = responsaveis();
  return `<div class="filter-bar">
    <label class="sr" for="v-q">Buscar no funil</label><input type="search" id="v-q" placeholder="Buscar nome, telefone, etiqueta…" value="${esc(q)}">
    <div class="seg" role="group" aria-label="Mostrar">${views.map(([id, l]) => `<button type="button" class="seg-b" data-view="${id}" aria-pressed="${view === id}">${l}</button>`).join('')}</div>
    <select id="v-resp" aria-label="Responsável"><option value="">Todos os responsáveis</option>${resp.map((r) => `<option${r === fResp ? ' selected' : ''}>${esc(r)}</option>`).join('')}<option value="—"${fResp === '—' ? ' selected' : ''}>Sem responsável</option></select>
    <select id="v-temp" aria-label="Temperatura"><option value="">Qualquer temperatura</option>${TEMPERATURAS.map((t) => `<option${t === fTemp ? ' selected' : ''}>${t}</option>`).join('')}</select>
  </div>`;
}

function board(ctx, p) {
  const all = filtered(ctx).filter((l) => leadPipeId(l) === p.id);
  const t = today();
  // Abertos aparecem sempre; ganhos e perdidos só do período, para o quadro não crescer sem fim.
  const inPeriod = (l) => OPEN(l) || inRange(l.dataMatricula || l.dataPerda || l.entrada, ctx.from, ctx.to);
  let leads = all.filter(inPeriod);
  if (view === 'hoje') leads = leads.filter((l) => OPEN(l) && ((l.proximaData && l.proximaData <= t) || (l.etapa === 'novo' && !l.proximaData)));
  const sorter = (a, b) => (a.proximaData || '9').localeCompare(b.proximaData || '9') || (b.entrada || '').localeCompare(a.entrada || '');
  const noLeads = !store.all('leads').some((l) => leadPipeId(l) === p.id);

  if (view === 'ganhos' || view === 'perdidos') {
    const etapa = view === 'ganhos' ? 'matriculado' : 'perdido';
    const items = leads.filter((l) => l.etapa === etapa).sort((a, b) => (b.dataMatricula || b.dataPerda || '').localeCompare(a.dataMatricula || a.dataPerda || ''));
    return `${filterBar()}
      <p class="list-sum">${items.length} ${view === 'ganhos' ? 'ganho' : 'perdido'}${items.length === 1 ? '' : 's'} de ${fmtDate(ctx.from)} a ${fmtDate(ctx.to)}${view === 'ganhos' && items.length ? ` · <b class="good">${brl(sum(items, (l) => l.valor))}</b> · recebido ${brl(sum(items, recebido))}` : ''}</p>
      ${items.length ? `<div class="lead-grid col-${view === 'ganhos' ? 'matriculado' : 'perdido'}">${items.map((l) => cardHTML(l, p)).join('')}</div>` : '<p class="empty-sm">Nada aqui no período escolhido no topo.</p>'}`;
  }

  const cols = [...p.etapas.map((e) => ({ ...e, open: true })), ...(view === 'todos' ? [{ id: 'ganho', nome: 'Ganho', nivel: 'matriculado' }, { id: 'perdido', nome: 'Perdido', nivel: 'perdido' }] : [])];
  return `${filterBar()}
  ${noLeads ? '<p class="hint">Funil vazio. Use o formulário acima, o <b>+</b> no topo de cada coluna (aceita vários nomes, um por linha) ou "Importar lista".</p>' : ''}
  <div class="board" id="board">${cols.map((c) => {
    const items = leads.filter((l) => leadCol(l, p) === c.id).sort(sorter);
    const more = items.length - 20;
    const valor = sum(items, (l) => l.valor);
    const over = c.limite && items.length > c.limite;
    return `<section class="col col-${esc(c.nivel)}${over ? ' wip-over' : ''}" data-drop="${esc(c.id)}" aria-label="${esc(c.nome)}">
      <header><h3>${esc(c.nome)}</h3><span class="col-h-r"><span class="count" title="${c.limite ? 'Limite: ' + c.limite : ''}">${items.length}${c.limite ? '/' + c.limite : ''}</span>${c.open ? `<button type="button" class="icon-btn sm" data-addcol="${esc(c.id)}" aria-label="Adicionar em ${esc(c.nome)}">${ICON.plus}</button>` : ''}</span></header>
      ${c.open ? `<form class="col-add" data-colform="${esc(c.id)}" hidden><label class="sr" for="ca-${esc(c.id)}">Nomes</label><textarea id="ca-${esc(c.id)}" rows="2" placeholder="Nome, telefone&#10;Um por linha"></textarea><div class="row-actions"><button class="btn sm primary" type="submit">Adicionar</button><button class="btn sm ghost" type="button" data-addcol="${esc(c.id)}">Fechar</button></div></form>` : ''}
      ${valor ? `<p class="col-sum">${brl(valor)}</p>` : ''}
      ${over ? `<p class="col-warn">Acima do limite: destrave antes de puxar mais.</p>` : ''}
      <div class="col-body">${items.slice(0, 20).map((l) => cardHTML(l, p)).join('') || `<p class="col-empty">${c.id === 'ganho' ? 'Solte aqui quem fechou' : 'Solte um cartão aqui'}</p>`}${more > 0 ? `<button type="button" class="link" data-tab="lista">Ver todos (+${more})</button>` : ''}</div>
    </section>`;
  }).join('')}</div>
  <p class="hint">Arraste os cartões entre as colunas ou use os botões. Ganhos e perdidos aparecem só dentro do período escolhido no topo. Cartão com borda âmbar está parado há 7 dias ou mais.</p>`;
}

function list(ctx, p) {
  const t = today();
  const prm = ctx.params;
  let leads = filtered(ctx);
  const lotes = store.all('imports').filter((i) => i.tipo === 'leads').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const loteRec = lote && store.get('imports', lote);
  if (loteRec) leads = store.all('leads').filter((l) => l.importId === lote);
  // Atalhos do Painel (#funil?etapa=… ou ?vencidos=1) olham todos os funis.
  if (loteRec) { /* lote: todos os funis */ } else if (prm.etapa) leads = leads.filter((l) => l.etapa === prm.etapa);
  else if (prm.vencidos) leads = leads.filter((l) => OPEN(l) && l.proximaData && l.proximaData < t);
  else leads = leads.filter((l) => leadPipeId(l) === p.id);
  if (!prm.etapa && !prm.vencidos && !loteRec) {
    if (view === 'abertos') leads = leads.filter(OPEN);
    if (view === 'hoje') leads = leads.filter((l) => OPEN(l) && l.proximaData && l.proximaData <= t);
    if (view === 'ganhos') leads = leads.filter((l) => l.etapa === 'matriculado');
    if (view === 'perdidos') leads = leads.filter((l) => l.etapa === 'perdido');
  }
  leads.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
  const multi = prm.etapa || prm.vencidos || loteRec;
  return `${filterBar()}
  ${lotes.length ? `<div class="lote-bar"><label for="v-lote">Lista importada</label><select id="v-lote"><option value="">Todas (sem filtro de lista)</option>${lotes.map((i) => `<option value="${esc(i.id)}"${i.id === lote ? ' selected' : ''}>${esc(fmtDate((i.createdAt || '').slice(0, 10)) + ' · ' + (i.arquivo || i.fonte) + ' · ' + (i.novas ?? 0) + ' novos')}</option>`).join('')}</select>
    ${loteRec ? `<span class="muted">${leads.length} lead${leads.length === 1 ? '' : 's'} desta lista · ${leads.filter((l) => l.etapa === 'matriculado').length} matriculado(s) · ${leads.filter((l) => !OPEN(l) || (l.historico || []).length > 1).length} já trabalhado(s)</span><button type="button" class="btn sm danger ghost" data-act="undo-lote">Desfazer importação</button>` : ''}</div>` : ''}
  ${multi ? `<p class="row-actions"><a class="btn sm ghost" href="#funil">Tirar filtro: ${prm.etapa ? esc(prm.etapa === 'matriculado' ? 'matriculados' : STAGES.find((x) => x.id === prm.etapa)?.label || prm.etapa) : 'retornos atrasados'} (todos os funis)</a></p>` : ''}
  ${leads.length ? `<div class="row-actions bulk"><span class="muted" id="sel-n">${leads.length} na lista</span><button type="button" class="btn sm danger ghost" data-act="del-sel" disabled>Excluir selecionados</button></div><div class="table-wrap"><table class="tbl"><thead><tr><th class="sel"><input type="checkbox" id="sel-all" aria-label="Selecionar todos"></th><th>Pessoa</th>${multi ? '<th>Funil</th>' : ''}<th>Etapa</th><th>Interesse</th><th>Origem</th><th>Responsável</th><th>Próxima ação</th><th class="r">Valor</th></tr></thead><tbody>${leads.map((l) => `<tr>
    <td class="sel"><input type="checkbox" data-sel="${esc(l.id)}" aria-label="Selecionar ${esc(l.nome)}"></td><td><button class="link" data-edit="${esc(l.id)}">${esc(l.nome)}</button><small class="cell-sub">${esc(l.telefone || '')}${l.temperatura ? ' · ' + esc(l.temperatura) : ''}</small></td>
    ${multi ? `<td>${esc(pipeline(leadPipeId(l)).nome)}</td>` : ''}
    <td>${badge(leadStage(l), l.etapa === 'matriculado' ? 'good' : l.etapa === 'perdido' ? 'bad' : '')}${l.motivoPerda && l.etapa === 'perdido' ? `<small class="cell-sub">${esc(l.motivoPerda)}</small>` : ''}</td>
    <td>${esc(store.get('products', l.produtoId)?.nome || courseName(l.cursoId))}${tagList(l.etiquetas).length ? `<small class="cell-sub">${esc(tagList(l.etiquetas).join(', '))}</small>` : ''}</td>
    <td>${esc(l.origem || '')}${l.campanhaId ? `<small class="cell-sub">${esc(campaignName(l.campanhaId))}</small>` : ''}</td>
    <td>${esc(l.responsavel || '—')}</td>
    <td>${l.proximaData ? `<span class="${l.proximaData < t && OPEN(l) ? 'bad' : ''}">${fmtDate(l.proximaData)}</span> ` : ''}${esc(l.proximaAcao || '')}</td>
    <td class="r">${l.valor ? brl(l.valor) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Ninguém neste filtro.</p>'}`;
}

function analysis(ctx, s, p) {
  const stages = STAGES.map((st, i) => ({ label: st.label, count: s.funil[i] }));
  const motivos = Object.entries(s.motivos).sort((a, b) => b[1] - a[1]);
  const maxM = Math.max(1, ...motivos.map((m) => m[1]));
  const leads = store.all('leads').filter((l) => leadPipeId(l) === p.id && (!ctx.f.cursoId || l.cursoId === ctx.f.cursoId));
  const abertos = leads.filter(OPEN);
  const porEtapa = p.etapas.map((e) => { const its = abertos.filter((l) => leadCol(l, p) === e.id); return { e, n: its.length, valor: sum(its, (l) => l.valor), parado: its.length ? Math.round(sum(its, daysInStage) / its.length) : 0 }; });
  const maxE = Math.max(1, ...porEtapa.map((x) => x.n));
  const resp = {};
  leads.forEach((l) => {
    const r = l.responsavel || 'Sem responsável';
    const x = resp[r] || (resp[r] = { r, abertos: 0, ganhos: 0, perdidos: 0, valor: 0 });
    if (OPEN(l)) x.abertos++;
    if (l.etapa === 'matriculado' && inRange(l.dataMatricula, ctx.from, ctx.to)) { x.ganhos++; x.valor += Number(l.valor) || 0; }
    if (l.etapa === 'perdido' && inRange(l.dataPerda, ctx.from, ctx.to)) x.perdidos++;
  });
  const rs = Object.values(resp).sort((a, b) => b.ganhos - a.ganhos || b.abertos - a.abertos);
  // Gargalo: maior queda entre duas etapas seguidas, entre quem entrou no período.
  const ent = leads.filter((l) => inRange(l.entrada, ctx.from, ctx.to));
  const reach = STAGES.map((_, i) => ent.filter((l) => reached(l) >= i).length);
  let garg = null;
  for (let i = 1; i < reach.length; i++) { if (!reach[i - 1]) continue; const r = reach[i] / reach[i - 1]; if (!garg || r < garg.r) garg = { i, r, perde: reach[i - 1] - reach[i] }; }
  // Tempo médio em cada etapa, medido pelo histórico de mudanças (só etapas já concluídas).
  const tempo = {};
  leads.forEach((l) => { const h = l.historico || []; for (let i = 0; i < h.length - 1; i++) { const k = h[i].etapa; const d = daysBetween(h[i].data, h[i + 1].data); if (d >= 0 && STAGE_IDX[k] !== undefined && k !== 'matriculado') (tempo[k] = tempo[k] || []).push(d); } });
  // Coorte: cada semana de entrada, quanto avançou até hoje.
  const semanas = {};
  ent.forEach((l) => { const w = weekStart(l.entrada); (semanas[w] = semanas[w] || []).push(l); });
  const coorte = Object.entries(semanas).sort((a, b) => b[0].localeCompare(a[0]));
  const pc = (n, d) => (d ? Math.round((n / d) * 100) + '%' : '—');
  return `<div class="grid-2">
    <section class="card span-2 garg"><header class="card-head"><div><p class="eyebrow">Onde o funil trava</p><h2>${garg ? `${esc(STAGES[garg.i - 1].label)} → ${esc(STAGES[garg.i].label)}` : 'Sem dados suficientes no período'}</h2>
      <p class="muted">${garg ? `Só ${pc(reach[garg.i], reach[garg.i - 1])} passam desta etapa: ${garg.perde} pessoa${garg.perde === 1 ? '' : 's'} ficaram pelo caminho entre quem entrou de ${fmtDate(ctx.from)} a ${fmtDate(ctx.to)}. Comece a melhorar por aqui.` : 'Registre os leads que entram no período para o sistema apontar o gargalo.'}</p></div></header>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Etapa</th><th class="r">Chegaram</th><th class="r">Passaram da anterior</th><th class="r">Tempo médio na etapa</th></tr></thead><tbody>${STAGES.map((st, i) => `<tr${garg && garg.i === i ? ' class="hl"' : ''}><td>${esc(st.label)}</td><td class="r">${reach[i]}</td><td class="r">${i ? pc(reach[i], reach[i - 1]) : '—'}</td><td class="r">${tempo[st.id]?.length ? (sum(tempo[st.id]) / tempo[st.id].length).toFixed(1).replace('.', ',') + ' dias' : st.id === 'matriculado' ? 'fim' : 'sem histórico'}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="card span-2"><header class="card-head"><div><h2>Coorte por semana de entrada</h2><p class="muted">Quem entrou em cada semana e até onde chegou hoje. Mostra se o atendimento melhorou ou piorou com o tempo.</p></div></header>
      ${coorte.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Semana</th><th class="r">Entraram</th>${STAGES.slice(1).map((x) => `<th class="r">${esc(x.label)}</th>`).join('')}<th class="r">Perdidos</th></tr></thead><tbody>${coorte.map(([w, ls]) => `<tr><td>${fmtDate(w)}</td><td class="r">${ls.length}</td>${STAGES.slice(1).map((_, j) => `<td class="r">${pc(ls.filter((l) => reached(l) >= j + 1).length, ls.length)}</td>`).join('')}<td class="r">${pc(ls.filter((l) => l.etapa === 'perdido').length, ls.length)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Ninguém entrou neste funil no período escolhido no topo.</p>'}
    </section>
    <section class="card"><header class="card-head"><div><h2>Etapas de ${esc(p.nome)}</h2><p class="muted">Cartões em aberto agora e há quanto tempo, em média, estão parados</p></div></header>
      ${abertos.length ? `<ul class="hbars">${porEtapa.map((x) => `<li><span>${esc(x.e.nome)}${x.e.limite && x.n > x.e.limite ? ' <b class="bad">acima do limite</b>' : ''}</span><span class="hb-track"><span style="width:${(x.n / maxE) * 100}%"></span></span><b>${x.n}</b><small class="muted">${x.parado} d${x.valor ? ' · ' + brl(x.valor) : ''}</small></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhum cartão em aberto.</p>'}</section>
    <section class="card"><header class="card-head"><div><h2>Conversão por etapa</h2><p class="muted">Quem entrou no período e até onde chegou</p></div></header>${s.leads ? funnel(stages) : '<p class="empty-sm">Sem conversas no período.</p>'}</section>
    <section class="card"><header class="card-head"><div><h2>Por responsável</h2><p class="muted">Ganhos e perdas no período; abertos agora</p></div></header>
      ${rs.length ? `<table class="tbl"><thead><tr><th>Pessoa</th><th class="r">Abertos</th><th class="r">Ganhos</th><th class="r">Perdidos</th><th class="r">Ganho (R$)</th></tr></thead><tbody>${rs.map((x) => `<tr><td>${esc(x.r)}</td><td class="r">${x.abertos}</td><td class="r">${x.ganhos}</td><td class="r">${x.perdidos}</td><td class="r">${x.valor ? brl(x.valor) : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-sm">Sem leads neste funil.</p>'}
    </section>
    <section class="card"><header class="card-head"><div><h2>Motivos de perda</h2><p class="muted">Mostra onde o atendimento trava</p></div></header>
      ${motivos.length ? `<ul class="hbars">${motivos.map(([m, c]) => `<li><span>${esc(m)}</span><span class="hb-track"><span style="width:${(c / maxM) * 100}%"></span></span><b>${c}</b></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhuma perda registrada no período.</p>'}
    </section>
    <section class="card"><header class="card-head"><h2>Por origem</h2></header>
      ${s.porOrigem.length ? `<table class="tbl"><thead><tr><th>Origem</th><th class="r">Conversas</th><th class="r">Ganhos</th><th class="r">Conversão</th></tr></thead><tbody>${s.porOrigem.map((o) => `<tr><td>${esc(o.origem)}</td><td class="r">${o.leads}</td><td class="r">${o.matriculas}</td><td class="r">${pct(o.leads ? o.matriculas / o.leads : null, 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-sm">Sem conversas no período.</p>'}
    </section>
  </div>`;
}

function produtos(ctx) {
  const prods = store.all('products').sort((a, b) => (a.ativo === false) - (b.ativo === false) || a.nome.localeCompare(b.nome));
  const vendas = (id) => store.all('leads').filter((l) => l.etapa === 'matriculado' && l.produtoId === id && inRange(l.dataMatricula, ctx.from, ctx.to));
  const semProduto = store.all('courses').filter((c) => c.ativo !== false && !prods.some((p) => p.cursoId === c.id));
  return `<p class="hint">Produto é o que você vende: curso, valor e condição. No ganho, escolher o produto preenche a matrícula em um toque.</p>
  <div class="row-actions"><button class="btn primary" data-act="new-prod">${ICON.plus} Novo produto</button>${semProduto.length ? `<button class="btn" data-act="prod-from-courses">Criar um por curso (${semProduto.length})</button>` : ''}</div>
  ${prods.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th><th>Curso</th><th class="r">Valor</th><th>Condição</th><th class="r">Vendas no período</th><th class="r">Receita</th></tr></thead><tbody>${prods.map((p) => { const v = vendas(p.id); return `<tr${p.ativo === false ? ' class="muted"' : ''}><td><button class="link" data-prod="${esc(p.id)}">${esc(p.nome)}</button>${p.ativo === false ? '<small class="cell-sub">fora de venda</small>' : ''}</td><td>${esc(p.cursoId ? courseName(p.cursoId) : '—')}</td><td class="r">${p.valor ? brl(p.valor) : '—'}</td><td>${esc([p.formaPagamento, p.parcelas ? p.parcelas + 'x' : ''].filter(Boolean).join(' · ') || '—')}</td><td class="r">${v.length}</td><td class="r">${v.length ? brl(sum(v, (l) => l.valor)) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`
    : empty('Nenhum produto cadastrado', 'Cadastre os cursos com valor e condição (ex.: "Injetáveis · à vista" e "Injetáveis · 6x no cartão"). Depois o ganho fica em um toque.')}`;
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

// Cria um lead novo numa etapa do funil atual.
function newLead(p, st, d) {
  return { nome: d.nome, telefone: d.telefone || '', cursoId: d.cursoId || p.cursoId || '', origem: d.origem || '', campanhaId: d.campanhaId || '', temperatura: d.temperatura || '', etiquetas: d.etiquetas || [], responsavel: d.responsavel ?? myName(), primeiraResposta: d.primeiraResposta ?? null, entrada: d.entrada || today(), email: d.email || '', anuncio: d.anuncio || '', ...(d.importId ? { importId: d.importId } : {}), funilId: p.id, etapaFunil: st.id, etapa: st.nivel, etapaMax: STAGES.findIndex((x) => x.id === st.nivel), historico: [{ data: today(), etapa: st.nivel, col: st.id }] };
}

// Linhas "Nome, telefone" (ou ; ou tab) viram leads. Telefones já cadastrados são ignorados.
function parseLines(txt) {
  return txt.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean).map((ln) => {
    const parts = ln.split(/\s*[;\t,]\s*/);
    let nome = parts[0], telefone = parts[1] || '';
    if (!telefone && /\d{8,}/.test(ln.replace(/\D/g, ''))) { const m = ln.match(/[+()\d][\d\s()+-]{7,}/); if (m) { telefone = m[0].trim(); nome = ln.replace(m[0], '').trim() || telefone; } }
    return { nome, telefone };
  });
}

function addMany(rows, p, st, extra = {}) {
  const known = new Set(store.all('leads').map((l) => phoneKey(l.telefone)).filter(Boolean));
  let dup = 0;
  const recs = [];
  rows.forEach((r) => {
    const k = phoneKey(r.telefone);
    if (k && known.has(k)) { dup++; return; }
    if (k) known.add(k);
    recs.push(newLead(p, st, { ...extra, ...r }));
  });
  if (recs.length) store.putMany('leads', recs);
  return { added: recs.length, dup };
}

function importDialog(ctx, p) {
  let parsed = null;
  const { dlg } = openDialog({
    title: 'Importar lista de contatos', wide: true, saveLabel: 'Importar',
    fields: [
      { name: 'funilId', label: 'Funil', type: 'select', options: pipelines().map((x) => [x.id, x.nome]), value: p.id },
      { name: 'etapa', label: 'Etapa', type: 'select', options: p.etapas.map((e) => [e.id, e.nome]) },
      { name: 'origem', label: 'Origem padrão', type: 'select', options: ORIGENS, value: 'Meta Ads' },
      { name: 'campanhaId', label: 'Campanha padrão', type: 'select', options: campOpts() },
      { name: 'cursoId', label: 'Curso padrão', type: 'select', options: courseOpts('Nenhum'), value: p.cursoId },
      { name: 'etiqueta', label: 'Etiqueta para a lista', placeholder: 'ex.: feira 10/10' },
    ],
    html: `<p class="hint">Aceita CSV (WhatsApp Business, planilha ou CRM) ou uma lista colada, uma pessoa por linha: <code>nome, telefone</code>. Telefones repetidos são ignorados.</p>
      <div class="drop"><label class="btn" for="li-file">${ICON.upload} Escolher arquivo</label><input type="file" id="li-file" accept=".csv,.txt" class="sr"><span class="muted" id="li-name"></span></div>
      <div class="field full"><label for="li-text">Conteúdo</label><textarea id="li-text" rows="6" placeholder="Maria Souza, 61999990000&#10;João Lima, 61988880000"></textarea></div><p class="note" id="li-prev"></p>`,
    onOpen: (form) => {
      const fs = $('[name="funilId"]', form);
      fs.addEventListener('change', () => { const x = pipeline(fs.value); $('[name="etapa"]', form).innerHTML = x.etapas.map((e) => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join(''); });
      $('#li-text', form).focus();
    },
    onSave: (d) => {
      if (!parsed?.length) { const e = $('.form-error', dlg); e.textContent = 'Nada para importar.'; e.hidden = false; return false; }
      const px = pipeline(d.funilId);
      const st = px.etapas.find((e) => e.id === d.etapa) || px.etapas[0];
      const courses = store.all('courses'); const camps = store.all('campaigns');
      const rows = parsed.map((r) => ({
        nome: r.nome || r.telefone || 'Sem nome', telefone: r.telefone || '', entrada: r.data || today(),
        origem: ORIGENS.find((o) => norm(o) === norm(r.origem)) || d.origem,
        campanhaId: (r.campanha && camps.find((c) => norm(c.nome) === norm(r.campanha))?.id) || d.campanhaId,
        cursoId: (r.curso && courses.find((c) => norm(c.nome).includes(norm(r.curso)))?.id) || d.cursoId,
        anuncio: r.anuncio || '', email: r.email || '',
      }));
      const imp = store.put('imports', { tipo: 'leads', fonte: 'Contatos · ' + px.nome, arquivo: $('#li-name', dlg).textContent || 'Lista colada', lidas: parsed.length });
      const res = addMany(rows, px, st, { etiquetas: d.etiqueta ? [d.etiqueta] : [], importId: imp.id });
      store.put('imports', { ...imp, novas: res.added, substituidas: 0, ignoradas: res.dup });
      lote = imp.id; tab = 'lista';
      toast(res.added + ' contatos em ' + px.nome + (res.dup ? ', ' + res.dup + ' repetidos ignorados.' : '.'));
      setPipe(px.id);
      ctx.refresh();
    },
  });
  const prev = () => {
    const txt = $('#li-text', dlg).value.trim();
    if (!txt) { parsed = null; $('#li-prev', dlg).textContent = ''; return; }
    const first = txt.split(/\r?\n/)[0];
    const H = first.split(/[;,\t]/).map(norm);
    const hasHeader = H.some((h) => /^(nome|name|telefone|phone|celular|whats|e-?mail)/.test(h));
    if (hasHeader) {
      const p = parseCSV(txt);
      const HH = p.headers.map(norm);
      const find = (...keys) => p.headers[HH.findIndex((h) => keys.some((k) => h.includes(k)))];
      const cn = find('nome', 'name'), ct = find('telefone', 'phone', 'celular', 'whats', 'numero'), cd = find('data', 'date', 'criad'), co = find('origem', 'source'), cc = find('curso', 'interesse'), ca = find('campanha', 'campaign'), cad = find('anuncio', 'ad name'), ce = find('email', 'e-mail');
      parsed = p.rows.map((r) => ({ nome: r[cn], telefone: r[ct], data: parseDate(r[cd]), origem: r[co], curso: r[cc], campanha: r[ca], anuncio: r[cad], email: r[ce] })).filter((r) => r.nome || r.telefone);
    } else {
      parsed = parseLines(txt);
    }
    $('#li-prev', dlg).textContent = parsed.length + ' contatos encontrados. Primeiro: ' + (parsed[0] ? (parsed[0].nome || '') + ' ' + (parsed[0].telefone || '') : '');
  };
  $('#li-text', dlg).addEventListener('input', prev);
  $('#li-file', dlg).addEventListener('change', async (e) => { const fl = e.target.files[0]; if (!fl) return; $('#li-name', dlg).textContent = fl.name; $('#li-text', dlg).value = await readFileText(fl); prev(); });
}

// Começar do zero: apaga os contatos deste funil ou de todos, e se quiser os funis criados.
function zerarDialog(ctx, p) {
  const all = store.all('leads');
  const doFunil = all.filter((l) => leadPipeId(l) === p.id);
  const { dlg } = openDialog({
    title: 'Zerar e começar do zero', saveLabel: 'Apagar de vez',
    fields: [
      { name: 'escopo', label: 'O que apagar', type: 'select', full: true, options: [['funil', `Contatos do funil "${p.nome}" (${doFunil.length})`], ['todos', `Todos os contatos de todos os funis (${all.length})`]] },
      { name: 'manterMatriculados', label: 'Manter os matriculados (eles somem do funil, mas a matrícula e o faturamento ficam)', type: 'checkbox', value: true, full: true },
      { name: 'funis', label: 'Apagar também os funis que criei (o funil principal volta ao padrão)', type: 'checkbox', value: false, full: true },
      { name: 'confirma', label: 'Para confirmar, digite APAGAR', required: true, full: true },
    ],
    html: '<p class="banner warn">Não tem volta. Antes, exporte o CSV do funil ou um backup em Configurações.</p>',
    onSave: (d) => {
      if (d.confirma.trim().toUpperCase() !== 'APAGAR') { const e = $('.form-error', dlg); e.textContent = 'Digite APAGAR para confirmar.'; e.hidden = false; return false; }
      const alvo = (d.escopo === 'todos' ? all : doFunil).filter((l) => !(d.manterMatriculados && l.etapa === 'matriculado'));
      alvo.forEach((l) => store.remove('leads', l.id));
      if (d.manterMatriculados) store.putMany('leads', all.filter((l) => l.etapa === 'matriculado' && (d.escopo === 'todos' || leadPipeId(l) === p.id)).map((l) => ({ ...l, foraDoFunil: true })));
      if (d.funis) { store.all('pipelines').forEach((x) => store.remove('pipelines', x.id)); setPipe('principal'); }
      if (d.escopo === 'todos') store.removeWhere('imports', (i) => i.tipo === 'leads');
      toast(alvo.length + ' contatos apagados' + (d.funis ? ' e funis reiniciados' : '') + '. Pode começar do zero.');
      ctx.refresh();
    },
  });
}

function rerenderBody(root, ctx) {
  const p = pipeline(pipeId);
  const inp = $('#v-q', root);
  const focused = document.activeElement === inp;
  const pos = inp?.selectionStart;
  $('#tab-body', root).innerHTML = body(ctx, salesStats(ctx.from, ctx.to, { ...ctx.f, funilId: p.id }), p);
  bindBody(root, ctx);
  if (focused) { const i2 = $('#v-q', root); i2.focus(); i2.setSelectionRange(pos, pos); }
}

function bindBody(root, ctx) {
  $('#v-q', root)?.addEventListener('input', (e) => { q = e.target.value; rerenderBody(root, ctx); });
  $('#v-resp', root)?.addEventListener('change', (e) => { fResp = e.target.value; rerenderBody(root, ctx); });
  $('#v-temp', root)?.addEventListener('change', (e) => { fTemp = e.target.value; rerenderBody(root, ctx); });
  $('#v-lote', root)?.addEventListener('change', (e) => { lote = e.target.value; rerenderBody(root, ctx); });
  $$('[data-colform]', root).forEach((form) => {
    const ta = $('textarea', form);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !ta.value.includes('\n')) { e.preventDefault(); form.requestSubmit(); } if (e.key === 'Escape') form.hidden = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const rows = parseLines(ta.value);
      if (!rows.length) return ta.focus();
      const p = pipeline(pipeId);
      const st = p.etapas.find((x) => x.id === form.dataset.colform);
      const res = addMany(rows, p, st, { origem: '' });
      toast(res.added + (res.added === 1 ? ' lead adicionado' : ' leads adicionados') + ' em ' + st.nome + (res.dup ? '. ' + res.dup + ' telefone(s) já existiam.' : '.'));
      ctx.refresh();
      setTimeout(() => { const f2 = $(`[data-colform="${CSS.escape(st.id)}"]`); if (f2) { f2.hidden = false; $('textarea', f2).focus(); } }, 60);
    });
  });
  const sync = () => { const n = $$('[data-sel]:checked', root).length; const b = $('[data-act="del-sel"]', root); if (b) { b.disabled = !n; b.textContent = n ? 'Excluir ' + n + ' selecionado' + (n > 1 ? 's' : '') : 'Excluir selecionados'; } };
  $('#sel-all', root)?.addEventListener('change', (e) => { $$('[data-sel]', root).forEach((c) => { c.checked = e.target.checked; }); sync(); });
  $$('[data-sel]', root).forEach((c) => c.addEventListener('change', sync));
  bindDrag(root, ctx);
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
      if (id) moveToCol(store.get('leads', id), col.dataset.drop, ctx, pipeline(pipeId));
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
    const p = pipeline(pipeId);
    store.put('leads', newLead(p, p.etapas[0], { ...d, nome: d.nome.trim(), telefone: d.telefone.trim(), campanhaId: ['Meta Ads', 'Google'].includes(d.origem) ? d.campanhaId : '' }));
    toast('Adicionado em ' + p.nome + '.');
    ctx.refresh();
    setTimeout(() => $('#q-nome')?.focus(), 50);
  });
  bindBody(root, ctx);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button,[data-tab]');
    if (!b) return;
    const ds = b.dataset;
    const p = pipeline(pipeId);
    if (ds.pipe) { setPipe(ds.pipe); return ctx.refresh(); }
    if (ds.tab) { tab = ds.tab; if (ctx.params.etapa || ctx.params.vencidos) location.hash = '#funil'; else ctx.refresh(); return; }
    if (ds.view) { view = ds.view; return rerenderBody(root, ctx); }
    if (ds.addcol) {
      const f = $(`[data-colform="${CSS.escape(ds.addcol)}"]`, root);
      f.hidden = !f.hidden;
      if (!f.hidden) $('textarea', f).focus();
      return;
    }
    if (ds.edit) return editLead(store.get('leads', ds.edit), ctx);
    if (ds.move) return moveToCol(store.get('leads', ds.move), ds.to, ctx, p);
    if (ds.win) return matriculaDialog(store.get('leads', ds.win), ctx);
    if (ds.lose) return loseDialog(store.get('leads', ds.lose), ctx);
    if (ds.prod) return productDialog(store.get('products', ds.prod), ctx);
    if (ds.resp !== undefined) return respDialog(Number(ds.resp), ctx);
    if (ds.copy !== undefined) return copyText(settings().respostas[Number(ds.copy)].texto, $('#resp-' + ds.copy, root));
    if (ds.act === 'new-pipe') return pipeDialog(null, ctx, { onSaved: (x) => x && setPipe(x.id) });
    if (ds.act === 'edit-pipe') return pipeDialog(p, ctx, { onSaved: (x) => setPipe(x ? x.id : 'principal') });
    if (ds.act === 'new-prod') return productDialog(null, ctx);
    if (ds.act === 'prod-from-courses') {
      const prods = store.all('products');
      const recs = store.all('courses').filter((c) => c.ativo !== false && !prods.some((x) => x.cursoId === c.id)).map((c) => ({ nome: c.nome, cursoId: c.id, valor: c.preco || null, ativo: true }));
      store.putMany('products', recs);
      toast(recs.length + ' produtos criados. Abra cada um para pôr o valor e a condição de pagamento.');
      return ctx.refresh();
    }
    if (ds.act === 'undo-lote') {
      const its = store.all('leads').filter((l) => l.importId === lote);
      // Só sai quem ainda não foi trabalhado: matriculados e leads que mudaram de etapa ficam.
      const keep = its.filter((l) => !OPEN(l) || (l.historico || []).length > 1);
      const del = its.filter((l) => !keep.includes(l));
      if (!confirmButton(b, 'Confirmar: apagar ' + del.length + (keep.length ? ' (mantém ' + keep.length + ' já trabalhados)' : ''))) return;
      del.forEach((l) => store.remove('leads', l.id));
      const imp = store.get('imports', lote);
      if (!keep.length && imp) store.remove('imports', lote); else if (imp) store.put('imports', { ...imp, desfeita: true, novas: keep.length });
      toast(del.length + ' leads da lista removidos' + (keep.length ? '; ' + keep.length + ' já trabalhados foram mantidos.' : '.'));
      lote = '';
      return ctx.refresh();
    }
    if (ds.act === 'del-sel') {
      const ids = $$('[data-sel]:checked', root).map((c) => c.dataset.sel);
      if (!ids.length || !confirmButton(b, 'Confirmar: apagar ' + ids.length + ' de vez')) return;
      ids.forEach((id) => store.remove('leads', id));
      toast(ids.length === 1 ? '1 lead excluído.' : ids.length + ' leads excluídos.');
      return ctx.refresh();
    }
    if (ds.act === 'resp') return respDialog(null, ctx);
    if (ds.act === 'import') return importDialog(ctx, p);
    if (ds.act === 'zerar') return zerarDialog(ctx, p);
    if (ds.act === 'export') {
      downloadFile('funil-liceu-' + today() + '.csv', toCSV(store.all('leads'), [
        { key: 'nome', label: 'Nome' }, { key: 'telefone', label: 'Telefone' }, { key: 'email', label: 'E-mail' }, { key: 'cidade', label: 'Cidade' },
        { label: 'Funil', get: (l) => pipeline(leadPipeId(l)).nome }, { label: 'Etapa', get: leadStage },
        { label: 'Produto', get: (l) => store.get('products', l.produtoId)?.nome || '' }, { label: 'Curso', get: (l) => courseName(l.cursoId) },
        { key: 'temperatura', label: 'Temperatura' }, { key: 'responsavel', label: 'Responsável' }, { label: 'Etiquetas', get: (l) => tagList(l.etiquetas).join(', ') },
        { key: 'origem', label: 'Origem' }, { label: 'Campanha', get: (l) => (l.campanhaId ? campaignName(l.campanhaId) : '') }, { key: 'anuncio', label: 'Anúncio' },
        { key: 'entrada', label: 'Entrada' }, { key: 'valor', label: 'Valor' }, { key: 'objecao', label: 'Objeção' }, { key: 'motivoPerda', label: 'Motivo perda' },
        { key: 'proximaData', label: 'Próximo retorno' }, { key: 'proximaAcao', label: 'Próxima ação' },
      ]), 'text/csv');
    }
  });
}
