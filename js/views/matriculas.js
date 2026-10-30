// Matrículas: quem comprou. É o número que mais importa, então tudo aqui é editável à mão:
// valor, data, forma e status de pagamento, turma, origem e campanha.

import { store } from '../store.js';
import { esc, $, brl, num, pct, fmtDate, today, daysBetween, norm, toCSV, inRange, sum, div } from '../util.js';
import { courseName, campaignName, goalProgress, extraMatriculas } from '../metrics.js';
import { openDialog, toast, ICON, meter, empty, downloadFile, badge } from '../ui.js';
import { matriculaDialog, recebido, courseOpts, PAG_STATUS } from '../leads.js';
import { importDialog as importNegocios } from '../importNegocios.js';
import { listHTML as turmasList, editorOpen, editorHTML, editorMount, editing, editingId, pageHTML, pageMount } from '../turmas.js';

let tab = 'lista';
let q = '';
let fStatus = '';

const isMat = (l) => l.etapa === 'matriculado';

export function render(ctx) {
  const { from, to, f } = ctx;
  // Ficha da turma: editor e página própria.
  if (ctx.params.turmaEdit) { const want = ctx.params.turmaEdit; if (!editing() || (want === 'nova' ? !!editingId() : editingId() !== want)) editorOpen(ctx.params.turmaEdit === 'nova' ? null : store.get('turmas', ctx.params.turmaEdit)); return editorHTML(); }
  if (ctx.params.turma) { const tm = store.get('turmas', ctx.params.turma); if (tm) return pageHTML(tm); }
  const all = store.all('leads').filter((l) => isMat(l) && (!f.cursoId || l.cursoId === f.cursoId));
  const per = all.filter((l) => inRange(l.dataMatricula, from, to));
  const ex = extraMatriculas(from, to, f);
  const receita = sum(per, (l) => l.valor) + ex.valor, rec = sum(per, recebido) + ex.valor;
  const goal = store.all('goals').find((g) => g.indicador === 'matriculas' && g.inicio <= to && g.fim >= from && (!f.cursoId || !g.cursoId || g.cursoId === f.cursoId));
  const gp = goal ? goalProgress(goal) : null;
  const tabs = [['lista', 'Matriculados'], ['cursos', 'Por curso'], ['turmas', 'Turmas']];
  return `
  <section class="mat-hero card">
    <div class="mh-main">
      <p class="eyebrow">Matrículas no período</p>
      <p class="mh-num">${num(per.length + ex.n)}${gp ? `<small>de ${num(gp.alvo)} na meta</small>` : ''}</p>
      ${ex.n ? `<p class="muted">${num(per.length)} com aluno cadastrado + ${num(ex.n)} lançada${ex.n > 1 ? 's' : ''} só como número nas campanhas (${Object.entries(ex.porCampanha).map(([id, n]) => esc(campaignName(id)) + ': ' + n).join(' · ')}). <a href="#meta">Ver no Meta Ads</a></p>` : ''}
      ${gp ? `${meter(gp.progresso, gp.status)}<p class="goal-status ${gp.status}">${esc(gp.texto)}</p>` : '<p class="muted">Sem meta de matrículas para este período. <a href="#metas">Criar meta</a></p>'}
    </div>
    <dl class="stats mh-stats">
      <div><dt>Valor matriculado</dt><dd>${brl(receita)}</dd></div>
      <div><dt>Recebido</dt><dd>${brl(rec)}</dd></div>
      <div><dt>A receber</dt><dd class="${receita - rec > 0 ? 'warn' : ''}">${brl(receita - rec)}</dd></div>
      <div><dt>Ticket médio</dt><dd>${brl(div(receita, per.length + ex.n))}</dd></div>
    </dl>
    <div class="mh-actions"><button class="btn primary" data-act="new">${ICON.plus} Registrar matrícula</button><a class="btn" href="#funil">Abrir funil</a></div>
  </section>

  <div class="toolbar">
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="tab" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn sm" data-act="importar">${ICON.upload} Importar planilha</button>
    <button class="btn sm" data-act="export">${ICON.download} CSV</button>
  </div>
  ${tab === 'lista' ? list(per) : tab === 'cursos' ? byCourse(per) : turmasList()}`;
}

function list(per) {
  const qq = norm(q);
  const rows = per.filter((l) => (!fStatus || (l.statusPagamento || 'Pago') === fStatus) && (!qq || norm(l.nome + ' ' + (l.telefone || '')).includes(qq))).sort((a, b) => (b.dataMatricula || '').localeCompare(a.dataMatricula || ''));
  return `<div class="search-row"><label class="sr" for="m-q">Buscar aluno</label><input type="search" id="m-q" placeholder="Buscar aluno por nome ou telefone" value="${esc(q)}">
    <div class="chips" role="group" aria-label="Pagamento">${[['', 'Todos'], ...PAG_STATUS.map((x) => [x, x])].map(([v, l]) => `<button type="button" class="chip" data-st="${v}" aria-pressed="${fStatus === v}">${l}</button>`).join('')}</div></div>
  ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Aluno</th><th>Curso e turma</th><th>Data</th><th class="r">Valor</th><th>Pagamento</th><th>Origem</th><th></th></tr></thead><tbody>${rows.map((l) => `<tr>
    <td><b>${esc(l.nome)}</b><small class="cell-sub">${esc(l.telefone || '')}</small></td>
    <td>${esc(courseName(l.cursoId))}${l.turmaId ? `<small class="cell-sub">${esc(store.get('turmas', l.turmaId)?.nome || '')}</small>` : ''}</td>
    <td class="nowrap">${fmtDate(l.dataMatricula)}</td>
    <td class="r"><b>${brl(l.valor)}</b>${l.parcelas ? `<small class="cell-sub">${num(l.parcelas)}x · ${esc(l.formaPagamento || '')}</small>` : l.formaPagamento ? `<small class="cell-sub">${esc(l.formaPagamento)}</small>` : ''}</td>
    <td>${badge(l.statusPagamento || 'Pago', (l.statusPagamento || 'Pago') === 'Pago' ? 'good' : 'warn')}${l.statusPagamento && l.statusPagamento !== 'Pago' ? `<small class="cell-sub">recebido ${brl(recebido(l))}</small>` : ''}</td>
    <td>${esc(l.origem || '')}${l.campanhaId ? `<small class="cell-sub">${esc(campaignName(l.campanhaId))}</small>` : ''}</td>
    <td class="r"><button class="btn sm" data-edit="${esc(l.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhuma matrícula neste período', 'Registre aqui quem comprou, ou arraste o cartão para Matriculado no funil. Use o período no topo para ver outros meses.', `<button class="btn primary" data-act="new">${ICON.plus} Registrar matrícula</button>`)}`;
}

function byCourse(per) {
  const g = {};
  per.forEach((l) => { const k = l.cursoId || ''; const x = g[k] || (g[k] = { n: 0, valor: 0, rec: 0, campanha: 0 }); x.n++; x.valor += Number(l.valor) || 0; x.rec += recebido(l); if (l.campanhaId) x.campanha++; });
  const rows = Object.entries(g).sort((a, b) => b[1].n - a[1].n);
  if (!rows.length) return '<p class="empty-sm">Nenhuma matrícula no período.</p>';
  const max = Math.max(...rows.map(([, v]) => v.n));
  return `<section class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Curso</th><th>Matrículas</th><th class="r">Valor</th><th class="r">Recebido</th><th class="r">Ticket médio</th><th class="r">Vieram de campanha</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(courseName(k))}</td><td><div class="inline-bar"><span style="width:${(v.n / max) * 100}%"></span><b>${v.n}</b></div></td><td class="r">${brl(v.valor)}</td><td class="r">${brl(v.rec)}</td><td class="r">${brl(v.valor / v.n)}</td><td class="r">${pct(v.campanha / v.n, 0)}</td></tr>`).join('')}</tbody></table></div></section>`;
}


export function mount(root, ctx) {
  if (ctx.params.turmaEdit) return editorMount(root, ctx);
  if (ctx.params.turma && store.get('turmas', ctx.params.turma)) return pageMount(root, ctx, store.get('turmas', ctx.params.turma));
  $('#m-q', root)?.addEventListener('change', (e) => { q = e.target.value; ctx.refresh(); });
  $('#m-q', root)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { q = e.target.value; ctx.refresh(); } });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.tab) { tab = ds.tab; return ctx.refresh(); }
    if (ds.st !== undefined) { fStatus = ds.st; return ctx.refresh(); }
    if (ds.edit) return matriculaDialog(store.get('leads', ds.edit), ctx);
    if (ds.act === 'new') return matriculaDialog(null, ctx);
    if (ds.act === 'importar') return importNegocios(ctx);
    if (ds.act === 'turma') { editorOpen(null); location.hash = '#matriculas?turmaEdit=nova'; return; }
    if (ds.act === 'export') {
      const rows = store.all('leads').filter(isMat).filter((l) => inRange(l.dataMatricula, ctx.from, ctx.to));
      downloadFile('matriculas-' + ctx.from + '-a-' + ctx.to + '.csv', toCSV(rows, [{ key: 'nome', label: 'Aluno' }, { key: 'telefone', label: 'Telefone' }, { key: 'email', label: 'E-mail' }, { key: 'cpf', label: 'CPF/CNPJ' }, { label: 'Curso', get: (l) => courseName(l.cursoId) }, { label: 'Turma', get: (l) => store.get('turmas', l.turmaId)?.nome || '' }, { key: 'dataMatricula', label: 'Data' }, { label: 'Valor', get: (l) => String(l.valor ?? '').replace('.', ',') }, { key: 'formaPagamento', label: 'Forma de pagamento' }, { key: 'parcelas', label: 'Parcelas' }, { label: 'Pagamento', get: (l) => l.statusPagamento || 'Pago' }, { label: 'Recebido', get: (l) => String(recebido(l)).replace('.', ',') }, { key: 'origem', label: 'Origem' }, { label: 'Campanha', get: (l) => (l.campanhaId ? campaignName(l.campanhaId) : '') }, { key: 'anuncio', label: 'Anúncio' }, { label: 'UTM source', get: (l) => l.rastreio?.utm_source || '' }, { label: 'UTM campaign', get: (l) => l.rastreio?.utm_campaign || '' }, { label: 'ID do clique', get: (l) => l.rastreio?.clickId || '' }, { key: 'responsavel', label: 'Responsável' }]), 'text/csv');
    }
  });
}
