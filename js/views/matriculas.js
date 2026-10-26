// Matrículas: quem comprou. É o número que mais importa, então tudo aqui é editável à mão:
// valor, data, forma e status de pagamento, turma, origem e campanha.

import { store } from '../store.js';
import { esc, $, brl, num, pct, fmtDate, today, daysBetween, norm, toCSV, inRange, sum, div } from '../util.js';
import { courseName, campaignName, goalProgress } from '../metrics.js';
import { openDialog, toast, ICON, meter, empty, downloadFile, badge } from '../ui.js';
import { matriculaDialog, recebido, courseOpts, PAG_STATUS } from '../leads.js';

let tab = 'lista';
let q = '';
let fStatus = '';

const isMat = (l) => l.etapa === 'matriculado';

export function render(ctx) {
  const { from, to, f } = ctx;
  const all = store.all('leads').filter((l) => isMat(l) && (!f.cursoId || l.cursoId === f.cursoId));
  const per = all.filter((l) => inRange(l.dataMatricula, from, to));
  const receita = sum(per, (l) => l.valor), rec = sum(per, recebido);
  const goal = store.all('goals').find((g) => g.indicador === 'matriculas' && g.inicio <= to && g.fim >= from && (!f.cursoId || !g.cursoId || g.cursoId === f.cursoId));
  const gp = goal ? goalProgress(goal) : null;
  const tabs = [['lista', 'Matriculados'], ['cursos', 'Por curso'], ['turmas', 'Turmas']];
  return `
  <section class="mat-hero card">
    <div class="mh-main">
      <p class="eyebrow">Matrículas no período</p>
      <p class="mh-num">${num(per.length)}${gp ? `<small>de ${num(gp.alvo)} na meta</small>` : ''}</p>
      ${gp ? `${meter(gp.progresso, gp.status)}<p class="goal-status ${gp.status}">${esc(gp.texto)}</p>` : '<p class="muted">Sem meta de matrículas para este período. <a href="#metas">Criar meta</a></p>'}
    </div>
    <dl class="stats mh-stats">
      <div><dt>Valor matriculado</dt><dd>${brl(receita)}</dd></div>
      <div><dt>Recebido</dt><dd>${brl(rec)}</dd></div>
      <div><dt>A receber</dt><dd class="${receita - rec > 0 ? 'warn' : ''}">${brl(receita - rec)}</dd></div>
      <div><dt>Ticket médio</dt><dd>${brl(div(receita, per.length))}</dd></div>
    </dl>
    <div class="mh-actions"><button class="btn primary" data-act="new">${ICON.plus} Registrar matrícula</button><a class="btn" href="#funil">Abrir funil</a></div>
  </section>

  <div class="toolbar">
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="tab" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn sm" data-act="export">${ICON.download} CSV</button>
  </div>
  ${tab === 'lista' ? list(per) : tab === 'cursos' ? byCourse(per) : turmas()}`;
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

function turmas() {
  const list = store.all('turmas').sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
  const t = today();
  return `<div class="row-actions"><button class="btn" data-act="turma">${ICON.plus} Nova turma</button></div>
  ${list.length ? `<div class="cards">${list.map((tm) => {
    const mats = store.all('leads').filter((l) => l.turmaId === tm.id && isMat(l)).length;
    const interessados = store.all('leads').filter((l) => l.turmaId === tm.id && !['matriculado', 'perdido'].includes(l.etapa)).length;
    const p = tm.meta ? mats / tm.meta : null;
    const dias = tm.inicio ? daysBetween(t, tm.inicio) : null;
    const st = p !== null && p >= 1 ? 'ok' : dias !== null && dias < 7 && p < 0.7 ? 'bad' : dias !== null && dias < 15 && p < 0.5 ? 'warn' : 'neutral';
    return `<article class="card turma"><header class="card-head"><div><p class="eyebrow">${esc(courseName(tm.cursoId))}</p><h3>${esc(tm.nome)}</h3></div><button class="btn sm" data-turma="${esc(tm.id)}">Editar</button></header>
      <p class="big">${mats} <small>de ${num(tm.meta)} na meta · ${num(tm.vagas)} vagas</small></p>${meter(p, st)}
      <dl class="stats"><div><dt>Início</dt><dd>${fmtDate(tm.inicio)}${dias !== null ? ` <small>${dias >= 0 ? 'em ' + dias + ' dias' : 'começou'}</small>` : ''}</dd></div><div><dt>Interessados no funil</dt><dd>${interessados}</dd></div><div><dt>Ocupação</dt><dd>${pct(tm.vagas ? mats / tm.vagas : null, 0)}</dd></div></dl>
    </article>`;
  }).join('')}</div>` : empty('Nenhuma turma cadastrada', 'Cadastre as turmas abertas com vagas e meta. Ao registrar a matrícula, escolha a turma e a ocupação atualiza sozinha.')}`;
}

function turmaDialog(tm, ctx) {
  openDialog({
    title: tm ? 'Editar turma' : 'Nova turma',
    fields: [
      { name: 'nome', label: 'Nome da turma', value: tm?.nome, required: true, placeholder: 'ex.: Técnico em Enfermagem · T12' },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOpts(), value: tm?.cursoId, required: true },
      { name: 'inicio', label: 'Início', type: 'date', value: tm?.inicio },
      { name: 'vagas', label: 'Vagas', type: 'number', value: tm?.vagas },
      { name: 'meta', label: 'Meta de matrículas', type: 'number', value: tm?.meta },
    ],
    onSave: (d) => { store.put('turmas', { ...(tm || {}), ...d }); toast('Turma salva.'); ctx.refresh(); },
    onDelete: tm ? () => { store.remove('turmas', tm.id); ctx.refresh(); } : null,
  });
}

export function mount(root, ctx) {
  $('#m-q', root)?.addEventListener('change', (e) => { q = e.target.value; ctx.refresh(); });
  $('#m-q', root)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { q = e.target.value; ctx.refresh(); } });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.tab) { tab = ds.tab; return ctx.refresh(); }
    if (ds.st !== undefined) { fStatus = ds.st; return ctx.refresh(); }
    if (ds.edit) return matriculaDialog(store.get('leads', ds.edit), ctx);
    if (ds.turma) return turmaDialog(store.get('turmas', ds.turma), ctx);
    if (ds.act === 'new') return matriculaDialog(null, ctx);
    if (ds.act === 'turma') return turmaDialog(null, ctx);
    if (ds.act === 'export') {
      const rows = store.all('leads').filter(isMat).filter((l) => inRange(l.dataMatricula, ctx.from, ctx.to));
      downloadFile('matriculas-' + ctx.from + '-a-' + ctx.to + '.csv', toCSV(rows, [{ key: 'nome', label: 'Aluno' }, { key: 'telefone', label: 'Telefone' }, { label: 'Curso', get: (l) => courseName(l.cursoId) }, { label: 'Turma', get: (l) => store.get('turmas', l.turmaId)?.nome || '' }, { key: 'dataMatricula', label: 'Data' }, { label: 'Valor', get: (l) => String(l.valor ?? '').replace('.', ',') }, { key: 'formaPagamento', label: 'Forma de pagamento' }, { key: 'parcelas', label: 'Parcelas' }, { label: 'Pagamento', get: (l) => l.statusPagamento || 'Pago' }, { label: 'Recebido', get: (l) => String(recebido(l)).replace('.', ',') }, { key: 'origem', label: 'Origem' }, { label: 'Campanha', get: (l) => (l.campanhaId ? campaignName(l.campanhaId) : '') }]), 'text/csv');
    }
  });
}
