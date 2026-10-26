// WhatsApp e vendas: cada conversa vira um lead com origem, e o lead anda pelo funil até a matrícula.
// É o elo que falta no Meta: sem o lead registrado com a campanha, não existe CAC real.

import { store } from '../store.js';
import { esc, $, $$, brl, num, pct, fmtDate, today, daysBetween, parseCSV, parseDate, norm, phoneKey, toCSV, inRange } from '../util.js';
import { STAGES, STAGE_IDX, LOSS_REASONS, ORIGENS, salesStats, courseName, campaignName, settings, reached } from '../metrics.js';
import { openDialog, toast, badge, ICON, funnel, meter, empty, readFileText, downloadFile, copyText, confirmButton } from '../ui.js';

let tab = 'funil';
let q = '';

const courseOpts = (blank = 'Selecione') => [['', blank], ...store.all('courses').filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])];
const campOpts = () => [['', 'Nenhuma / não sei'], ...store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])];
const turmaOpts = (cursoId) => [['', 'Sem turma definida'], ...store.all('turmas').filter((t) => !cursoId || t.cursoId === cursoId).map((t) => [t.id, t.nome])];

export function render(ctx) {
  const { from, to, f, params } = ctx;
  if (params.etapa || params.vencidos) tab = 'lista';
  const s = salesStats(from, to, f);
  const tabs = [['funil', 'Funil'], ['lista', 'Lista'], ['analise', 'Análise'], ['turmas', 'Turmas'], ['respostas', 'Respostas prontas']];
  return `
  <form class="quick card" id="quick" autocomplete="off" aria-label="Registrar lead">
    <h2>Novo lead do WhatsApp</h2>
    <div class="quick-grid">
      <div class="field"><label for="q-nome">Nome</label><input id="q-nome" name="nome" required placeholder="Como a pessoa se apresentou"></div>
      <div class="field"><label for="q-tel">WhatsApp</label><input id="q-tel" name="telefone" inputmode="tel" placeholder="(61) 9 0000-0000"></div>
      <div class="field"><label for="q-curso">Curso de interesse</label><select id="q-curso" name="cursoId">${courseOpts().map(([v, l]) => `<option value="${esc(v)}"${v === f.cursoId ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="q-origem">Como chegou</label><select id="q-origem" name="origem">${ORIGENS.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>
      <div class="field" id="q-camp-wrap"><label for="q-camp">Campanha</label><select id="q-camp" name="campanhaId">${campOpts().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="q-resp">1ª resposta (min)</label><input id="q-resp" name="primeiraResposta" type="number" min="0" inputmode="numeric" placeholder="ex.: 5"></div>
      <button class="btn primary" type="submit">${ICON.plus} Registrar</button>
    </div>
  </form>

  <section class="kpis compact" aria-label="Comercial no período">
    ${[['Leads no período', num(s.leads)], ['Matrículas', num(s.matriculas)], ['Conversão', pct(s.convLead)], ['Receita', brl(s.receita)], ['Em aberto', num(s.abertos.length)], ['Retornos atrasados', num(s.followVencidos.length)], ['Sem 1º contato', num(s.semContato.length)], ['1ª resposta média', s.tempoResposta === null ? '—' : num(s.tempoResposta) + ' min']].map(([l, v]) => `<article class="kpi"><h3>${l}</h3><p class="kpi-v">${v}</p></article>`).join('')}
  </section>

  <div class="toolbar">
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="tab" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn sm" data-act="import">${ICON.upload} Importar lista</button>
    <button class="btn sm" data-act="export">${ICON.download} CSV</button>
  </div>
  <div id="tab-body">${body(ctx, s)}</div>`;
}

function body(ctx, s) {
  if (tab === 'funil') return board(ctx);
  if (tab === 'lista') return list(ctx);
  if (tab === 'analise') return analysis(ctx, s);
  if (tab === 'turmas') return turmas();
  return respostas();
}

function cardHTML(l) {
  const t = today();
  const dias = l.entrada ? daysBetween(l.entrada, t) : 0;
  const late = l.proximaData && l.proximaData < t;
  const idx = STAGE_IDX[l.etapa];
  return `<article class="lead${late ? ' late' : ''}" data-lead="${esc(l.id)}">
    <button type="button" class="lead-open" data-edit="${esc(l.id)}"><b>${esc(l.nome)}</b><small>${esc(courseName(l.cursoId))}</small></button>
    <p class="lead-meta">${esc(l.origem || '')}${l.campanhaId ? ' · ' + esc(campaignName(l.campanhaId)) : ''}</p>
    <p class="lead-meta">${dias === 0 ? 'Entrou hoje' : 'Há ' + dias + (dias > 1 ? ' dias' : ' dia')}${l.proximaData ? ` · <span class="${late ? 'bad' : ''}">retorno ${fmtDate(l.proximaData)}</span>` : ''}</p>
    ${l.proximaAcao ? `<p class="lead-next">${esc(l.proximaAcao)}</p>` : ''}
    <div class="lead-actions">
      ${idx < 4 ? `<button type="button" class="btn sm" data-adv="${esc(l.id)}">${idx === 3 ? 'Matricular' : 'Avançar'} ${ICON.arrow}</button>` : ''}
      ${l.etapa !== 'perdido' && idx < 4 ? `<button type="button" class="btn sm ghost" data-lose="${esc(l.id)}">Perdido</button>` : ''}
    </div>
  </article>`;
}

function filtered(ctx) {
  const qq = norm(q);
  return store.all('leads').filter((l) => (!ctx.f.cursoId || l.cursoId === ctx.f.cursoId) && (!qq || norm(l.nome + ' ' + l.telefone + ' ' + (l.notas || '')).includes(qq)));
}

function board(ctx) {
  const leads = filtered(ctx);
  // Mostra todos os abertos; matriculados e perdidos só do período, para o quadro não crescer sem fim.
  const visible = leads.filter((l) => !['matriculado', 'perdido'].includes(l.etapa) || inRange(l.dataMatricula || l.dataPerda || l.entrada, ctx.from, ctx.to));
  const cols = [...STAGES, { id: 'perdido', label: 'Perdido' }];
  if (!store.all('leads').length) return empty('Nenhum lead registrado ainda', 'Registre cada conversa nova no formulário acima. Leva 10 segundos e é o que permite saber qual anúncio matricula.');
  return `<div class="search-row"><label class="sr" for="v-q">Buscar lead</label><input type="search" id="v-q" placeholder="Buscar por nome, telefone ou anotação" value="${esc(q)}"></div>
  <div class="board">${cols.map((c) => {
    const items = visible.filter((l) => l.etapa === c.id).sort((a, b) => (a.proximaData || '9').localeCompare(b.proximaData || '9') || (b.entrada || '').localeCompare(a.entrada || ''));
    const more = items.length - 12;
    return `<section class="col col-${c.id}"><header><h3>${esc(c.label)}</h3><span class="count">${items.length}</span></header><div class="col-body">${items.slice(0, 12).map(cardHTML).join('') || '<p class="empty-sm">Vazio</p>'}${more > 0 ? `<a class="link" href="#vendas?etapa=${c.id}">Ver todos (+${more})</a>` : ''}</div></section>`;
  }).join('')}</div>
  <p class="hint">Matriculados e perdidos aparecem só dentro do período escolhido no topo.</p>`;
}

function list(ctx) {
  const t = today();
  let leads = filtered(ctx);
  const p = ctx.params;
  if (p.etapa) leads = leads.filter((l) => l.etapa === p.etapa);
  if (p.vencidos) leads = leads.filter((l) => !['matriculado', 'perdido'].includes(l.etapa) && l.proximaData && l.proximaData < t);
  leads.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
  const label = (id) => (id === 'perdido' ? 'Perdido' : STAGES[STAGE_IDX[id]]?.label || id);
  return `<div class="search-row"><label class="sr" for="v-q">Buscar lead</label><input type="search" id="v-q" placeholder="Buscar por nome, telefone ou anotação" value="${esc(q)}">${p.etapa || p.vencidos ? `<a class="btn sm ghost" href="#vendas">Tirar filtro: ${p.etapa ? esc(label(p.etapa)) : 'retornos atrasados'}</a>` : ''}</div>
  ${leads.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Lead</th><th>Curso</th><th>Origem</th><th>Entrada</th><th>Etapa</th><th>Próxima ação</th><th class="r">Valor</th></tr></thead><tbody>${leads.map((l) => `<tr><td><button class="link" data-edit="${esc(l.id)}">${esc(l.nome)}</button><small class="cell-sub">${esc(l.telefone || '')}</small></td><td>${esc(courseName(l.cursoId))}</td><td>${esc(l.origem || '')}${l.campanhaId ? `<small class="cell-sub">${esc(campaignName(l.campanhaId))}</small>` : ''}</td><td>${fmtDate(l.entrada)}</td><td>${badge(label(l.etapa), l.etapa === 'matriculado' ? 'good' : l.etapa === 'perdido' ? 'bad' : '')}${l.motivoPerda ? `<small class="cell-sub">${esc(l.motivoPerda)}</small>` : ''}</td><td>${l.proximaData ? `<span class="${l.proximaData < t && !['matriculado', 'perdido'].includes(l.etapa) ? 'bad' : ''}">${fmtDate(l.proximaData)}</span> ` : ''}${esc(l.proximaAcao || '')}</td><td class="r">${l.valor ? brl(l.valor) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Nenhum lead neste filtro.</p>'}`;
}

function analysis(ctx, s) {
  const stages = STAGES.map((st, i) => ({ label: st.label, count: s.funil[i] }));
  const motivos = Object.entries(s.motivos).sort((a, b) => b[1] - a[1]);
  const maxM = Math.max(1, ...motivos.map((m) => m[1]));
  const byCourse = {};
  store.all('leads').filter((l) => inRange(l.entrada, ctx.from, ctx.to)).forEach((l) => { const k = l.cursoId || ''; const x = byCourse[k] || (byCourse[k] = { leads: 0, mat: 0 }); x.leads++; if (l.etapa === 'matriculado') x.mat++; });
  return `<div class="grid-2">
    <section class="card"><header class="card-head"><div><h2>Funil do período</h2><p class="muted">Leads que entraram no período e até onde chegaram</p></div></header>${s.leads ? funnel(stages) : '<p class="empty-sm">Sem leads no período.</p>'}</section>
    <section class="card"><header class="card-head"><div><h2>Motivos de perda</h2><p class="muted">Registrar o motivo de cada perda mostra onde o atendimento trava</p></div></header>
      ${motivos.length ? `<ul class="hbars">${motivos.map(([m, c]) => `<li><span>${esc(m)}</span><span class="hb-track"><span style="width:${(c / maxM) * 100}%"></span></span><b>${c}</b></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhuma perda registrada no período.</p>'}
    </section>
    <section class="card"><header class="card-head"><h2>Por origem</h2></header>
      ${s.porOrigem.length ? `<table class="tbl"><thead><tr><th>Origem</th><th class="r">Leads</th><th class="r">Matrículas</th><th class="r">Conversão</th></tr></thead><tbody>${s.porOrigem.map((o) => `<tr><td>${esc(o.origem)}</td><td class="r">${o.leads}</td><td class="r">${o.matriculas}</td><td class="r">${pct(o.leads ? o.matriculas / o.leads : null, 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-sm">Sem leads no período.</p>'}
    </section>
    <section class="card"><header class="card-head"><h2>Por curso</h2></header>
      ${Object.keys(byCourse).length ? `<table class="tbl"><thead><tr><th>Curso</th><th class="r">Leads</th><th class="r">Matrículas</th><th class="r">Conversão</th></tr></thead><tbody>${Object.entries(byCourse).sort((a, b) => b[1].leads - a[1].leads).map(([k, v]) => `<tr><td>${esc(courseName(k))}</td><td class="r">${v.leads}</td><td class="r">${v.mat}</td><td class="r">${pct(v.mat / v.leads, 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-sm">Sem leads no período.</p>'}
    </section>
  </div>`;
}

function turmas() {
  const list = store.all('turmas').sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
  const t = today();
  return `<div class="row-actions"><button class="btn" data-act="turma">${ICON.plus} Nova turma</button></div>
  ${list.length ? `<div class="cards">${list.map((tm) => {
    const mats = store.all('leads').filter((l) => l.turmaId === tm.id && l.etapa === 'matriculado').length;
    const interessados = store.all('leads').filter((l) => l.turmaId === tm.id && !['matriculado', 'perdido'].includes(l.etapa)).length;
    const p = tm.meta ? mats / tm.meta : null;
    const dias = tm.inicio ? daysBetween(t, tm.inicio) : null;
    const st = p !== null && p >= 1 ? 'ok' : dias !== null && dias < 7 && p < 0.7 ? 'bad' : dias !== null && dias < 15 && p < 0.5 ? 'warn' : 'neutral';
    return `<article class="card turma"><header class="card-head"><div><p class="eyebrow">${esc(courseName(tm.cursoId))}</p><h3>${esc(tm.nome)}</h3></div><button class="btn sm" data-turma="${esc(tm.id)}">Editar</button></header>
      <p class="big">${mats} <small>de ${num(tm.meta)} na meta · ${num(tm.vagas)} vagas</small></p>${meter(p, st)}
      <dl class="stats"><div><dt>Início</dt><dd>${fmtDate(tm.inicio)}${dias !== null ? ` <small>${dias >= 0 ? 'em ' + dias + ' dias' : 'começou'}</small>` : ''}</dd></div><div><dt>Interessados em aberto</dt><dd>${interessados}</dd></div><div><dt>Ocupação</dt><dd>${pct(tm.vagas ? mats / tm.vagas : null, 0)}</dd></div></dl>
    </article>`;
  }).join('')}</div>` : empty('Nenhuma turma cadastrada', 'Cadastre as turmas abertas com vagas e meta. Ao matricular um lead, escolha a turma e a ocupação atualiza sozinha.')}`;
}

function respostas() {
  const r = settings().respostas || [];
  return `<p class="hint">Mensagens que a equipe usa no WhatsApp. Copie, ajuste o nome e envie. Edite para manter o tom da TEC Mais.</p>
  <div class="row-actions"><button class="btn" data-act="resp">${ICON.plus} Nova resposta</button></div>
  ${r.length ? `<div class="cards">${r.map((x, i) => `<article class="card resp"><header class="card-head"><div><p class="eyebrow">${esc(x.etapa || 'Geral')}</p><h3>${esc(x.titulo)}</h3></div><div class="row-actions"><button class="btn sm" data-copy="${i}">${ICON.copy} Copiar</button><button class="btn sm ghost" data-resp="${i}">Editar</button></div></header><p class="pre" id="resp-${i}">${esc(x.texto)}</p></article>`).join('')}</div>` : '<p class="empty-sm">Nenhuma resposta salva.</p>'}`;
}

// ---------- ações ----------
export function moveLead(l, etapa, extra = {}) {
  const t = today();
  const hist = [...(l.historico || []), { data: t, etapa }];
  const patch = { etapa, historico: hist, ...extra };
  if (etapa !== 'perdido') patch.etapaMax = Math.max(l.etapaMax ?? 0, STAGE_IDX[etapa] ?? 0);
  else patch.etapaMax = reached(l);
  if (etapa === 'matriculado') { patch.dataMatricula = extra.dataMatricula || t; if (!l.valor && !extra.valor) patch.valor = store.get('courses', l.cursoId)?.preco || 0; patch.proximaData = ''; patch.proximaAcao = ''; }
  if (etapa === 'perdido') { patch.dataPerda = t; patch.proximaData = ''; }
  return store.put('leads', { ...l, ...patch });
}

function matricularDialog(l, ctx) {
  const c = store.get('courses', l.cursoId);
  openDialog({
    title: 'Matricular ' + l.nome, saveLabel: 'Confirmar matrícula',
    fields: [
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOpts(), value: l.cursoId, required: true },
      { name: 'turmaId', label: 'Turma', type: 'select', options: turmaOpts(l.cursoId), value: l.turmaId },
      { name: 'valor', label: 'Valor da matrícula (R$)', type: 'number', value: l.valor || c?.preco || '' },
      { name: 'dataMatricula', label: 'Data do pagamento', type: 'date', value: today() },
    ],
    onSave: (d) => { moveLead(l, 'matriculado', { ...d, valor: d.valor || 0 }); toast('Matrícula registrada.'); ctx.refresh(); },
  });
}

function loseDialog(l, ctx) {
  openDialog({
    title: 'Por que ' + l.nome + ' não fechou?', saveLabel: 'Registrar perda',
    fields: [
      { name: 'motivoPerda', label: 'Motivo principal', type: 'select', options: LOSS_REASONS, value: LOSS_REASONS[0], required: true },
      { name: 'notas', label: 'O que a pessoa disse', type: 'textarea', value: l.notas, full: true },
    ],
    onSave: (d) => { moveLead(l, 'perdido', d); toast('Perda registrada com motivo.'); ctx.refresh(); },
  });
}

export function editLead(l, ctx, preset = {}) {
  const isNew = !l;
  l = l || { entrada: today(), etapa: 'novo', origem: 'Meta Ads', ...preset };
  const stageOpts = [...STAGES.map((s) => [s.id, s.label]), ['perdido', 'Perdido']];
  openDialog({
    title: isNew ? 'Novo lead' : l.nome, wide: true,
    fields: [
      { name: 'nome', label: 'Nome', value: l.nome, required: true },
      { name: 'telefone', label: 'WhatsApp', value: l.telefone },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOpts(), value: l.cursoId },
      { name: 'turmaId', label: 'Turma', type: 'select', options: turmaOpts(), value: l.turmaId },
      { name: 'origem', label: 'Como chegou', type: 'select', options: ORIGENS, value: l.origem },
      { name: 'campanhaId', label: 'Campanha', type: 'select', options: campOpts(), value: l.campanhaId },
      { name: 'anuncio', label: 'Anúncio ou post que trouxe', value: l.anuncio, hint: 'Use o mesmo nome do anúncio no Gerenciador para cruzar.' },
      { name: 'entrada', label: 'Primeiro contato', type: 'date', value: l.entrada, required: true },
      { name: 'primeiraResposta', label: 'Minutos até a 1ª resposta', type: 'number', value: l.primeiraResposta },
      { name: 'etapa', label: 'Etapa', type: 'select', options: stageOpts, value: l.etapa },
      { name: 'valor', label: 'Valor (R$)', type: 'number', value: l.valor },
      { name: 'dataMatricula', label: 'Data da matrícula', type: 'date', value: l.dataMatricula },
      { name: 'motivoPerda', label: 'Motivo da perda', type: 'select', options: ['', ...LOSS_REASONS], value: l.motivoPerda },
      { name: 'proximaData', label: 'Data do próximo retorno', type: 'date', value: l.proximaData },
      { name: 'proximaAcao', label: 'Próxima ação', value: l.proximaAcao, placeholder: 'ex.: mandar datas da turma', full: true },
      { name: 'notas', label: 'Anotações da conversa', type: 'textarea', value: l.notas, full: true },
    ],
    html: l.historico?.length ? `<p class="hint">Histórico: ${l.historico.map((h) => fmtDate(h.data) + ' ' + (h.etapa === 'perdido' ? 'Perdido' : STAGES[STAGE_IDX[h.etapa]]?.label || h.etapa)).join(' → ')}</p>` : '',
    onSave: (d) => {
      const dup = d.telefone && store.all('leads').find((x) => x.id !== l.id && phoneKey(x.telefone) === phoneKey(d.telefone));
      if (dup && isNew) toast('Atenção: já existe um lead com esse telefone (' + dup.nome + ').', 'warn');
      const changed = d.etapa !== l.etapa;
      const base = { ...l, ...d };
      if (changed || isNew) moveLead(base, d.etapa, { dataMatricula: d.dataMatricula, valor: d.valor });
      else store.put('leads', base);
      toast('Lead salvo.');
      ctx.refresh();
    },
    onDelete: isNew ? null : () => { store.remove('leads', l.id); toast('Lead excluído.'); ctx.refresh(); },
  });
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

function respDialog(i, ctx) {
  const s = settings();
  const list = [...(s.respostas || [])];
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

function importDialog(ctx) {
  let parsed = null;
  const { dlg } = openDialog({
    title: 'Importar lista de contatos', wide: true, saveLabel: 'Importar',
    fields: [
      { name: 'origem', label: 'Origem padrão', type: 'select', options: ORIGENS, value: 'Meta Ads' },
      { name: 'campanhaId', label: 'Campanha padrão', type: 'select', options: campOpts() },
      { name: 'cursoId', label: 'Curso padrão', type: 'select', options: courseOpts('Nenhum') },
    ],
    html: `<p class="hint">Aceita CSV (do WhatsApp Business, de uma planilha ou do CRM) ou uma lista colada com uma pessoa por linha: <code>nome; telefone; data</code>. Telefones repetidos são ignorados.</p>
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
      toast(recs.length + ' leads importados' + (dup ? ', ' + dup + ' repetidos ignorados.' : '.'));
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
  $('#li-file', dlg).addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; $('#li-name', dlg).textContent = f.name; $('#li-text', dlg).value = await readFileText(f); prev(); });
}

export function mount(root, ctx) {
  const quick = $('#quick', root);
  const syncCamp = () => { $('#q-camp-wrap', root).hidden = $('#q-origem', root).value !== 'Meta Ads' && $('#q-origem', root).value !== 'Google'; };
  $('#q-origem', root).addEventListener('change', syncCamp); syncCamp();
  quick.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(quick));
    if (!d.nome.trim()) { $('#q-nome', root).focus(); return; }
    const dup = d.telefone && store.all('leads').find((x) => phoneKey(x.telefone) === phoneKey(d.telefone));
    if (dup) { toast('Esse telefone já está cadastrado como ' + dup.nome + '. Abrindo o lead.', 'warn'); editLead(dup, ctx); return; }
    store.put('leads', { nome: d.nome.trim(), telefone: d.telefone.trim(), cursoId: d.cursoId, origem: d.origem, campanhaId: ['Meta Ads', 'Google'].includes(d.origem) ? d.campanhaId : '', primeiraResposta: d.primeiraResposta ? Number(d.primeiraResposta) : null, entrada: today(), etapa: 'novo', etapaMax: 0, historico: [{ data: today(), etapa: 'novo' }] });
    toast('Lead registrado.');
    ctx.refresh();
    setTimeout(() => $('#q-nome')?.focus(), 50);
  });
  $('#v-q', root)?.addEventListener('input', (e) => { q = e.target.value; const pos = e.target.selectionStart; $('#tab-body', root).innerHTML = body(ctx, salesStats(ctx.from, ctx.to, ctx.f)); const inp = $('#v-q', root); inp.focus(); inp.setSelectionRange(pos, pos); rebindSearch(root, ctx); });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button,[data-tab]');
    if (!b) return;
    const ds = b.dataset;
    if (ds.tab) { tab = ds.tab; if (ctx.params.etapa || ctx.params.vencidos) { location.hash = '#vendas'; } else ctx.refresh(); return; }
    if (ds.edit) return editLead(store.get('leads', ds.edit), ctx);
    if (ds.adv) {
      const l = store.get('leads', ds.adv);
      const idx = STAGE_IDX[l.etapa];
      if (idx === 3) return matricularDialog(l, ctx);
      moveLead(l, STAGES[idx + 1].id);
      toast(l.nome + ' → ' + STAGES[idx + 1].label);
      return ctx.refresh();
    }
    if (ds.lose) return loseDialog(store.get('leads', ds.lose), ctx);
    if (ds.turma) return turmaDialog(store.get('turmas', ds.turma), ctx);
    if (ds.resp !== undefined) return respDialog(Number(ds.resp), ctx);
    if (ds.copy !== undefined) return copyText(settings().respostas[Number(ds.copy)].texto, $('#resp-' + ds.copy, root));
    if (ds.act === 'turma') return turmaDialog(null, ctx);
    if (ds.act === 'resp') return respDialog(null, ctx);
    if (ds.act === 'import') return importDialog(ctx);
    if (ds.act === 'export') {
      const rows = store.all('leads');
      downloadFile('leads-tecmais-' + today() + '.csv', toCSV(rows, [{ key: 'nome', label: 'Nome' }, { key: 'telefone', label: 'Telefone' }, { label: 'Curso', get: (l) => courseName(l.cursoId) }, { key: 'origem', label: 'Origem' }, { label: 'Campanha', get: (l) => (l.campanhaId ? campaignName(l.campanhaId) : '') }, { key: 'anuncio', label: 'Anúncio' }, { key: 'entrada', label: 'Entrada' }, { key: 'etapa', label: 'Etapa' }, { key: 'valor', label: 'Valor' }, { key: 'dataMatricula', label: 'Data matrícula' }, { key: 'motivoPerda', label: 'Motivo perda' }, { key: 'proximaData', label: 'Próximo retorno' }, { key: 'proximaAcao', label: 'Próxima ação' }]), 'text/csv');
    }
  });
  void confirmButton;
}

function rebindSearch(root, ctx) {
  $('#v-q', root)?.addEventListener('input', (e) => { q = e.target.value; const pos = e.target.selectionStart; $('#tab-body', root).innerHTML = body(ctx, salesStats(ctx.from, ctx.to, ctx.f)); const inp = $('#v-q', root); inp.focus(); inp.setSelectionRange(pos, pos); rebindSearch(root, ctx); });
}
