// Turmas: a ficha completa de cada turma, do jeito da escola.
// Identidade (nome, tema, cor), agenda, local, pessoas, oferta, o que inclui, campos próprios,
// checklist de preparação (vira tarefa no Calendário) e a mensagem pronta para o WhatsApp.
// A página da turma junta ocupação, alunos, interessados, lista de espera e o que falta fazer.

import { store } from './store.js';
import { esc, $, $$, brl, num, pct, fmtDate, today, addDays, daysBetween, sum, uid } from './util.js';
import { courseName } from './metrics.js';
import { toast, ICON, meter, badge, copyText, confirmButton, openDialog } from './ui.js';
import { courseOpts, productOpts, matriculaDialog, recebido, responsaveis } from './leads.js';
import { startFromTurma } from './views/campanhas.js';

export const STATUS_TURMA = ['Planejando', 'Inscrições abertas', 'Lotada', 'Em andamento', 'Concluída', 'Cancelada'];
const STATUS_CLS = { 'Planejando': '', 'Inscrições abertas': 'good', 'Lotada': 'warn', 'Em andamento': 'info', 'Concluída': 'info', 'Cancelada': 'bad' };
export const CORES_TURMA = [['lima', '#c4f15a'], ['azul', '#7fb7ff'], ['verde', '#6fe0a0'], ['ambar', '#ffb547'], ['rosa', '#ff8fb1'], ['aco', '#a7b0b5']];
const DIAS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom']];
const MODALIDADES = ['Presencial', 'Online ao vivo', 'Híbrida'];
const TURNOS = ['Manhã', 'Tarde', 'Noite', 'Integral', 'Fim de semana'];

// Checklist padrão de preparação: dias antes do início (negativo) ou depois (positivo).
const CHECKLIST_PADRAO = [
  [-20, 'Confirmar professor e datas'], [-18, 'Reservar sala e equipamentos'], [-15, 'Planejar campanha de divulgação'],
  [-10, 'Preparar material e apostila'], [-7, 'Criar grupo de WhatsApp da turma'], [-3, 'Confirmar pagamento ou sinal de cada aluno'],
  [-1, 'Lembrete para os alunos: local, horário e o que levar'], [0, 'Lista de presença e boas-vindas'], [7, 'Pedir depoimento e avaliação no Google'], [10, 'Emitir certificados'],
];

const corHex = (c) => (CORES_TURMA.find(([k]) => k === c) || CORES_TURMA[0])[1];
export const isMat = (l) => l.etapa === 'matriculado';

export function turmaStats(tm) {
  const leads = store.all('leads').filter((l) => l.turmaId === tm.id);
  const mats = leads.filter(isMat);
  const abertos = leads.filter((l) => !['matriculado', 'perdido'].includes(l.etapa));
  const espera = (tm.espera || []);
  const t = today();
  const dias = tm.inicio ? daysBetween(t, tm.inicio) : null;
  const vagas = Number(tm.vagas) || 0;
  const p = tm.meta ? mats.length / tm.meta : null;
  const st = p !== null && p >= 1 ? 'ok' : dias !== null && dias < 7 && p < 0.7 ? 'bad' : dias !== null && dias < 15 && p < 0.5 ? 'warn' : '';
  const receita = sum(mats, (l) => l.valor), rec = sum(mats, recebido);
  const checklist = tm.checklist || [];
  return { leads, mats, abertos, espera, dias, vagas, livres: vagas ? Math.max(0, vagas - mats.length) : null, p, st, receita, rec, feitos: checklist.filter((c) => c.feito).length, total: checklist.length, abaixoMinimo: tm.minimo && dias !== null && dias <= 7 && mats.length < tm.minimo };
}

// ---------- mensagem pronta (WhatsApp) ----------
export function fichaWhats(tm) {
  if (tm.mensagem && tm.mensagemEditada) return tm.mensagem;
  const dias = (tm.dias || []).map((d) => DIAS.find(([k]) => k === d)?.[1]).filter(Boolean).join(', ');
  const L = [];
  L.push(`*${tm.nome}*${tm.tema ? ' · ' + tm.tema : ''}`);
  L.push(courseName(tm.cursoId));
  L.push('');
  if (tm.inicio) L.push(`📅 Início: ${fmtDate(tm.inicio)}${tm.fim ? ' · término ' + fmtDate(tm.fim) : ''}`);
  if (dias || tm.horaIni) L.push(`🕒 ${[dias, tm.horaIni && tm.horaFim ? tm.horaIni + ' às ' + tm.horaFim : tm.horaIni].filter(Boolean).join(' · ')}`);
  if (tm.cargaHoraria) L.push(`⏱ ${tm.cargaHoraria} horas${tm.encontros ? ' em ' + tm.encontros + ' encontros' : ''}`);
  if (tm.modalidade) L.push(`📍 ${tm.modalidade}${tm.local ? ': ' + tm.local : ''}`);
  if (tm.professor) L.push(`👩‍🏫 Com ${tm.professor}`);
  if (tm.inclui) { L.push(''); L.push('*O que está incluso*'); tm.inclui.split('\n').filter(Boolean).forEach((x) => L.push('✔ ' + x.trim())); }
  if (tm.preRequisitos) { L.push(''); L.push('*Pré-requisitos:* ' + tm.preRequisitos); }
  if (tm.preco || tm.precoPromo) {
    L.push('');
    L.push(tm.precoPromo ? `💰 De ${brl(tm.preco)} por *${brl(tm.precoPromo)}*${tm.prazoPromo ? ' até ' + fmtDate(tm.prazoPromo) : ''}` : `💰 Investimento: *${brl(tm.preco)}*`);
    if (tm.condicoes) L.push(tm.condicoes);
    if (tm.sinal) L.push(`Garanta sua vaga com sinal de ${brl(tm.sinal)} no Pix.`);
  }
  const s = turmaStats(tm);
  if (s.livres !== null && s.livres <= 10) { L.push(''); L.push(`⚠ Restam ${s.livres} vagas.`); }
  (tm.extras || []).filter((x) => x.k).forEach((x) => L.push(`${x.k}: ${x.v}`));
  L.push(''); L.push('Quer que eu reserve a sua vaga?');
  return L.join('\n');
}

// ---------- editor (página inteira, por seções) ----------
let edit = null; // turma em edição

export function editorOpen(tm) {
  const t = today();
  edit = tm ? JSON.parse(JSON.stringify(tm)) : { status: 'Planejando', cor: 'lima', modalidade: 'Presencial', inicio: addDays(t, 30), dias: [], checklist: [], extras: [], espera: [], responsavel: '' };
}

const fld = (name, label, attrs = {}) => {
  const v = edit[name] ?? '';
  const id = 't-' + name;
  if (attrs.type === 'textarea') return `<div class="field${attrs.full ? ' full' : ''}"><label for="${id}">${label}</label><textarea id="${id}" data-t="${name}" rows="${attrs.rows || 3}" placeholder="${esc(attrs.ph || '')}">${esc(v)}</textarea>${attrs.hint ? `<p class="hint">${attrs.hint}</p>` : ''}</div>`;
  if (attrs.options) return `<div class="field${attrs.full ? ' full' : ''}"><label for="${id}">${label}</label><select id="${id}" data-t="${name}">${attrs.options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
  return `<div class="field${attrs.full ? ' full' : ''}"><label for="${id}">${label}${attrs.req ? ' <span class="req">*</span>' : ''}</label><input id="${id}" data-t="${name}" type="${attrs.type || 'text'}" value="${esc(v)}" placeholder="${esc(attrs.ph || '')}"${attrs.list ? ` list="${attrs.list}"` : ''}${attrs.type === 'number' ? ' min="0" inputmode="decimal"' : ''}>${attrs.hint ? `<p class="hint">${attrs.hint}</p>` : ''}</div>`;
};

export function editorHTML() {
  const e = edit;
  const isNew = !e.id;
  const cor = corHex(e.cor);
  return `<div class="toolbar"><a class="btn ghost" href="#matriculas${e.id ? '?turma=' + encodeURIComponent(e.id) : ''}" data-tcancel>← Voltar</a><span class="grow"></span>
      ${isNew ? '' : '<button type="button" class="btn danger" data-tdel>Excluir turma</button>'}<button type="button" class="btn primary" data-tsave>${ICON.plus} ${isNew ? 'Criar turma' : 'Salvar turma'}</button></div>
    <section class="card turma-id" style="--tc:${cor}">
      <div class="turma-banner"><span class="turma-dot"></span><div><p class="eyebrow">${esc(courseName(e.cursoId) || 'Escolha o curso')}</p><h2>${esc(e.nome || 'Nova turma')}</h2>${e.tema ? `<p class="muted">${esc(e.tema)}</p>` : ''}</div></div>
      <div class="form-grid">
        ${fld('nome', 'Nome da turma', { req: true, ph: 'ex.: Injetáveis · T12 · Novembro' })}
        <div class="field"><label for="t-cursoId">Curso <span class="req">*</span></label><select id="t-cursoId" data-t="cursoId">${courseOpts().map(([v, l]) => `<option value="${esc(v)}"${v === e.cursoId ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        ${fld('tema', 'Nome especial ou tema (opcional)', { ph: 'ex.: Turma Florence, Turma das Mães, Turma Empresa X' })}
        ${fld('codigo', 'Código interno', { ph: 'ex.: INJ-2611' })}
        ${fld('status', 'Situação', { options: STATUS_TURMA })}
        <div class="field"><span class="lbl">Cor da turma</span><div class="tcolors">${CORES_TURMA.map(([k, h]) => `<button type="button" class="tcolor${e.cor === k ? ' on' : ''}" data-tcor="${k}" style="--tc:${h}" aria-label="Cor ${k}" aria-pressed="${e.cor === k}"></button>`).join('')}</div></div>
      </div>
    </section>
    <div class="grid-2">
      <section class="card"><header class="card-head"><h2>Agenda</h2></header><div class="form-grid">
        ${fld('inicio', 'Início', { type: 'date', req: true })}${fld('fim', 'Término', { type: 'date' })}
        <div class="field full"><span class="lbl">Dias de aula</span><div class="chips">${DIAS.map(([k, l]) => `<button type="button" class="chip" data-tdia="${k}" aria-pressed="${(e.dias || []).includes(k)}">${l}</button>`).join('')}</div></div>
        ${fld('horaIni', 'Das', { type: 'time' })}${fld('horaFim', 'Até', { type: 'time' })}
        ${fld('turno', 'Turno', { options: ['', ...TURNOS] })}${fld('cargaHoraria', 'Carga horária (h)', { type: 'number' })}
        ${fld('encontros', 'Número de encontros', { type: 'number' })}${fld('modalidade', 'Modalidade', { options: MODALIDADES })}
        ${fld('local', 'Local, sala ou link', { full: true, ph: 'ex.: Sala 3 · Rua X, 120 · ou link da aula' })}
      </div></section>
      <section class="card"><header class="card-head"><h2>Pessoas e vagas</h2></header><div class="form-grid">
        ${fld('professor', 'Professor(a) / instrutor(a)', { ph: 'ex.: Enf. Carla Souza' })}${fld('responsavel', 'Responsável pela turma', { list: 'dl-turma-resp' })}
        ${fld('vagas', 'Vagas', { type: 'number' })}${fld('meta', 'Meta de matrículas', { type: 'number' })}
        ${fld('minimo', 'Mínimo para abrir', { type: 'number', hint: 'Abaixo disso, a página avisa 7 dias antes.' })}${fld('cidade', 'Cidade', { ph: 'para a campanha' })}
        ${fld('publico', 'Para quem é', { full: true, type: 'textarea', rows: 2, ph: 'ex.: quem já atua em farmácia e quer aplicar com segurança' })}
      </div><datalist id="dl-turma-resp">${responsaveis().map((r) => `<option value="${esc(r)}">`).join('')}</datalist></section>
    </div>
    <div class="grid-2">
      <section class="card"><header class="card-head"><h2>Oferta</h2></header><div class="form-grid">
        <div class="field full"><label for="t-produtoId">Produto vinculado</label><select id="t-produtoId" data-t="produtoId">${productOpts('Nenhum').map(([v, l]) => `<option value="${esc(v)}"${v === e.produtoId ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select><p class="hint">Preenche o preço da matrícula nesta turma.</p></div>
        ${fld('preco', 'Valor cheio (R$)', { type: 'number' })}${fld('precoPromo', 'Valor promocional (R$)', { type: 'number' })}
        ${fld('prazoPromo', 'Promoção até', { type: 'date' })}${fld('sinal', 'Sinal via Pix (R$)', { type: 'number', hint: 'Garante a vaga e reduz desistência.' })}
        ${fld('condicoes', 'Condições de pagamento', { full: true, ph: 'ex.: 6x sem juros no cartão ou 5% off no Pix' })}
      </div></section>
      <section class="card"><header class="card-head"><h2>O que a turma entrega</h2></header><div class="form-grid">
        ${fld('inclui', 'O que está incluso (um item por linha)', { type: 'textarea', full: true, rows: 5, ph: 'Aula prática no laboratório\nApostila\nCertificado\nCoffee break' })}
        ${fld('preRequisitos', 'Pré-requisitos', { type: 'textarea', full: true, rows: 2 })}
        ${fld('levar', 'O aluno precisa levar', { full: true, ph: 'ex.: jaleco, documento com foto' })}
      </div></section>
    </div>
    <section class="card"><header class="card-head"><div><h2>Do seu jeito</h2><p class="muted">Campos seus: parceiro, brinde, regra da turma, observação para a equipe…</p></div><button type="button" class="btn sm" data-tex>${ICON.plus} Adicionar campo</button></header>
      ${(e.extras || []).length ? `<ul class="ex-list">${e.extras.map((x, i) => `<li class="kv-row"><input data-tek="${i}" value="${esc(x.k)}" placeholder="Campo" aria-label="Campo"><input data-tev="${i}" value="${esc(x.v)}" placeholder="Valor" aria-label="Valor"><button type="button" class="icon-btn sm" data-texrm="${i}" aria-label="Remover">×</button></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhum campo extra ainda.</p>'}
      ${fld('notas', 'Anotações da turma', { type: 'textarea', full: true, rows: 3 })}
    </section>
    <section class="card"><header class="card-head"><div><h2>Checklist de preparação</h2><p class="muted">Cada tarefa com data vira lembrete no Calendário.</p></div><div class="row-actions">${(e.checklist || []).length ? '' : '<button type="button" class="btn sm" data-tpadrao>Usar checklist padrão</button>'}<button type="button" class="btn sm" data-tck>${ICON.plus} Tarefa</button></div></header>
      ${(e.checklist || []).length ? `<ul class="ex-list">${e.checklist.map((c, i) => `<li class="ac-row"><input data-tct="${i}" value="${esc(c.t)}" aria-label="Tarefa"><input type="date" data-tcd="${i}" value="${esc(c.d || '')}" aria-label="Data"><input data-tcr="${i}" value="${esc(c.r || '')}" placeholder="Responsável" aria-label="Responsável"><button type="button" class="icon-btn sm" data-tckrm="${i}" aria-label="Remover">×</button></li>`).join('')}</ul>` : '<p class="empty-sm">Use o checklist padrão (sala, professor, material, grupo de WhatsApp, lembrete D-1, certificados) ou crie o seu.</p>'}
    </section>
    <div class="row-actions wiz-foot"><span class="grow"></span><button type="button" class="btn primary" data-tsave>${isNew ? 'Criar turma' : 'Salvar turma'}</button></div>`;
}

function readEditor(root) {
  $$('[data-t]', root).forEach((el) => { const k = el.dataset.t; edit[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; });
  $$('[data-tek]', root).forEach((el) => { edit.extras[+el.dataset.tek].k = el.value; });
  $$('[data-tev]', root).forEach((el) => { edit.extras[+el.dataset.tev].v = el.value; });
  $$('[data-tct]', root).forEach((el) => { edit.checklist[+el.dataset.tct].t = el.value; });
  $$('[data-tcd]', root).forEach((el) => { edit.checklist[+el.dataset.tcd].d = el.value; });
  $$('[data-tcr]', root).forEach((el) => { edit.checklist[+el.dataset.tcr].r = el.value; });
}

function saveTurma(ctx) {
  if (!edit.nome?.trim()) return toast('Dê um nome para a turma.', 'warn');
  if (!edit.cursoId) return toast('Escolha o curso.', 'warn');
  if (!edit.inicio) return toast('Informe a data de início.', 'warn');
  if (edit.fim && edit.fim < edit.inicio) return toast('O término está antes do início.', 'warn');
  if (edit.precoPromo && edit.preco && edit.precoPromo > edit.preco) return toast('O valor promocional está maior que o cheio.', 'warn');
  if (edit.produtoId && !edit.preco) edit.preco = store.get('products', edit.produtoId)?.valor || '';
  edit.extras = (edit.extras || []).filter((x) => x.k || x.v);
  edit.checklist = (edit.checklist || []).filter((c) => c.t).map((c) => ({ ...c, id: c.id || uid('ck') }));
  const saved = store.put('turmas', edit);
  // Lembretes do checklist no Calendário: recria os desta turma que ainda não foram feitos.
  store.all('calendar').filter((i) => i.turmaId === saved.id && i.origemChecklist).forEach((i) => store.remove('calendar', i.id));
  const tarefas = saved.checklist.filter((c) => c.d && !c.feito).map((c) => ({ data: c.d, tipo: 'Tarefa', titulo: c.t + ' · ' + saved.nome, responsavel: c.r || saved.responsavel || '', cursoId: saved.cursoId, status: 'Planejado', turmaId: saved.id, origemChecklist: true }));
  const inicio = { data: saved.inicio, tipo: 'Turma / curso', titulo: 'Início · ' + saved.nome, cursoId: saved.cursoId, status: 'Planejado', turmaId: saved.id, origemChecklist: true };
  store.putMany('calendar', [inicio, ...tarefas]);
  toast(edit.id ? 'Turma salva.' : 'Turma criada. O início e o checklist estão no Calendário.');
  edit = null;
  location.hash = '#matriculas?turma=' + encodeURIComponent(saved.id);
  void ctx;
}

export function editorMount(root, ctx) {
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button,[data-tcancel]');
    if (!b || !edit) return;
    const ds = b.dataset;
    readEditor(root);
    if (ds.tcancel !== undefined) { edit = null; return; }
    if (ds.tcor) { edit.cor = ds.tcor; return ctx.refresh(); }
    if (ds.tdia) { const s = new Set(edit.dias || []); s.has(ds.tdia) ? s.delete(ds.tdia) : s.add(ds.tdia); edit.dias = DIAS.map(([k]) => k).filter((k) => s.has(k)); return ctx.refresh(); }
    if (ds.tex !== undefined) { edit.extras = [...(edit.extras || []), { k: '', v: '' }]; return ctx.refresh(); }
    if (ds.texrm !== undefined) { edit.extras.splice(+ds.texrm, 1); return ctx.refresh(); }
    if (ds.tck !== undefined) { edit.checklist = [...(edit.checklist || []), { t: '', d: '', r: edit.responsavel || '' }]; return ctx.refresh(); }
    if (ds.tckrm !== undefined) { edit.checklist.splice(+ds.tckrm, 1); return ctx.refresh(); }
    if (ds.tpadrao !== undefined) { const base = edit.inicio || addDays(today(), 30); edit.checklist = CHECKLIST_PADRAO.map(([d, t]) => ({ t, d: addDays(base, d), r: edit.responsavel || '' })); return ctx.refresh(); }
    if (ds.tsave !== undefined) return saveTurma(ctx);
    if (ds.tdel !== undefined) {
      if (!confirmButton(b, 'Confirmar exclusão da turma')) return;
      store.all('calendar').filter((i) => i.turmaId === edit.id && i.origemChecklist).forEach((i) => store.remove('calendar', i.id));
      store.remove('turmas', edit.id); edit = null; toast('Turma excluída. Os alunos continuam matriculados.'); location.hash = '#matriculas'; return;
    }
  });
  root.addEventListener('change', (ev) => { if (edit && ev.target.matches('[data-t="cursoId"],[data-t="nome"],[data-t="tema"],[data-t="produtoId"]')) { readEditor(root); if (ev.target.dataset.t === 'produtoId' && edit.produtoId) { const p = store.get('products', edit.produtoId); if (p?.valor) edit.preco = p.valor; } ctx.refresh(); } });
}
export const editing = () => !!edit;
export const editingId = () => edit?.id || null;

// ---------- página da turma ----------
export function pageHTML(tm) {
  const s = turmaStats(tm);
  const cor = corHex(tm.cor);
  const t = today();
  const diasTxt = s.dias === null ? '' : s.dias > 0 ? `começa em ${s.dias} dia${s.dias > 1 ? 's' : ''}` : s.dias === 0 ? 'começa hoje' : tm.fim && tm.fim >= t ? 'em andamento' : 'já começou';
  const agenda = [(tm.dias || []).map((d) => DIAS.find(([k]) => k === d)?.[1]).join(', '), tm.horaIni && (tm.horaIni + (tm.horaFim ? '–' + tm.horaFim : '')), tm.turno, tm.cargaHoraria && tm.cargaHoraria + ' h', tm.encontros && tm.encontros + ' encontros'].filter(Boolean).join(' · ');
  const msg = fichaWhats(tm);
  return `<div class="toolbar"><a class="btn ghost" href="#matriculas">← Turmas</a><span class="grow"></span>
      <button type="button" class="btn" data-tp="dup">Duplicar para a próxima</button><button type="button" class="btn" data-tp="camp">Planejar campanha</button><button type="button" class="btn" data-tp="edit">Editar turma</button><button type="button" class="btn primary" data-tp="mat">${ICON.plus} Matricular aluno</button></div>
    <section class="card turma-id" style="--tc:${cor}">
      <div class="turma-banner"><span class="turma-dot"></span><div class="grow"><p class="eyebrow">${esc(courseName(tm.cursoId))}${tm.codigo ? ' · ' + esc(tm.codigo) : ''}</p><h2>${esc(tm.nome)}</h2>${tm.tema ? `<p class="turma-tema">${esc(tm.tema)}</p>` : ''}<p class="muted">${fmtDate(tm.inicio)}${tm.fim ? ' a ' + fmtDate(tm.fim) : ''}${diasTxt ? ' · ' + diasTxt : ''}${agenda ? ' · ' + esc(agenda) : ''}</p></div>${badge(tm.status || 'Planejando', STATUS_CLS[tm.status] || '')}</div>
      ${s.abaixoMinimo ? `<p class="banner warn">Faltam ${s.dias} dias e só ${s.mats.length} de ${tm.minimo} alunos mínimos para abrir. Decida: reforçar a divulgação, juntar com outra turma ou adiar.</p>` : ''}
      <dl class="stats wide"><div><dt>Matriculados</dt><dd>${num(s.mats.length)}${tm.vagas ? ` <small>de ${num(tm.vagas)} vagas · ${num(s.livres)} livres</small>` : ''}</dd></div><div><dt>Meta</dt><dd>${tm.meta ? num(tm.meta) : '—'}<small>${tm.meta ? pct(s.p, 0) + ' atingido' : 'defina em Editar'}</small></dd></div><div><dt>Interessados no funil</dt><dd>${num(s.abertos.length)}</dd></div><div><dt>Lista de espera</dt><dd>${num(s.espera.length)}</dd></div><div><dt>Valor matriculado</dt><dd>${brl(s.receita)}<small>recebido ${brl(s.rec)}</small></dd></div><div><dt>Preparação</dt><dd>${s.total ? s.feitos + ' / ' + s.total : '—'}<small>tarefas feitas</small></dd></div></dl>
      ${tm.vagas ? meter(s.mats.length / tm.vagas, s.mats.length >= tm.vagas ? 'ok' : s.st || 'ok') : ''}
    </section>
    <div class="grid-2">
      <section class="card"><header class="card-head"><div><h2>Alunos</h2><p class="muted">Matriculados nesta turma</p></div></header>
        ${s.mats.length ? `<ul class="todo">${s.mats.sort((a, b) => a.nome.localeCompare(b.nome)).map((l) => `<li><span><b>${esc(l.nome)}</b><small>${esc(l.telefone || '')}${l.dataMatricula ? ' · matrícula ' + fmtDate(l.dataMatricula) : ''}</small></span><span class="row-actions">${badge(l.statusPagamento || 'Pago', l.statusPagamento === 'Pendente' ? 'bad' : l.statusPagamento === 'Parcial' ? 'warn' : 'good')}<button type="button" class="btn sm ghost" data-tal="${esc(l.id)}">Abrir</button></span></li>`).join('')}</ul>` : '<p class="empty-sm">Ninguém matriculado ainda. Use "Matricular aluno" ou escolha esta turma no ganho do Funil.</p>'}
        ${s.abertos.length ? `<h3 class="sub-h">Interessados no funil</h3><ul class="todo">${s.abertos.slice(0, 12).map((l) => `<li><span><b>${esc(l.nome)}</b><small>${esc(l.telefone || '')}${l.proximaData ? ' · retorno ' + fmtDate(l.proximaData) : ''}</small></span><a class="btn sm ghost" href="#funil">Funil</a></li>`).join('')}</ul>` : ''}
      </section>
      <section class="card"><header class="card-head"><div><h2>Lista de espera</h2><p class="muted">Para quando lotar ou para a próxima turma</p></div><button type="button" class="btn sm" data-tp="espera">${ICON.plus} Adicionar</button></header>
        ${s.espera.length ? `<ul class="todo">${s.espera.map((x, i) => `<li><span><b>${esc(x.nome)}</b><small>${esc(x.telefone || '')}${x.data ? ' · desde ' + fmtDate(x.data) : ''}</small></span><button type="button" class="icon-btn sm" data-esprm="${i}" aria-label="Remover">×</button></li>`).join('')}</ul>` : '<p class="empty-sm">Vazia.</p>'}
      </section>
    </div>
    <div class="grid-2">
      <section class="card"><header class="card-head"><div><h2>Checklist</h2><p class="muted">O que falta para a turma acontecer bem</p></div><button type="button" class="btn sm" data-tp="edit">Editar</button></header>
        ${(tm.checklist || []).length ? `<ul class="todo">${tm.checklist.map((c, i) => `<li class="${c.feito ? 'done' : ''}"><label class="check-field"><input type="checkbox" data-tchk="${i}"${c.feito ? ' checked' : ''}> <span><b>${esc(c.t)}</b><small>${c.d ? fmtDate(c.d) + (c.d < t && !c.feito ? ' · <span class="bad">atrasada</span>' : '') : 'sem data'}${c.r ? ' · ' + esc(c.r) : ''}</small></span></label></li>`).join('')}</ul>` : '<p class="empty-sm">Sem checklist. Em "Editar turma" use o padrão ou crie o seu.</p>'}
      </section>
      <section class="card"><header class="card-head"><div><h2>Mensagem da turma</h2><p class="muted">Pronta para o WhatsApp, com os dados da ficha</p></div><div class="row-actions"><button type="button" class="btn sm" data-tp="copy">${ICON.copy} Copiar</button></div></header>
        <textarea class="msg-box" id="t-msg" rows="14" aria-label="Mensagem">${esc(msg)}</textarea>
        <div class="row-actions"><button type="button" class="btn sm ghost" data-tp="msgsave">Salvar meu texto</button>${tm.mensagemEditada ? '<button type="button" class="btn sm ghost" data-tp="msgreset">Voltar ao automático</button>' : ''}</div>
      </section>
    </div>
    <section class="card"><header class="card-head"><h2>Ficha</h2></header>
      <dl class="w5h-view">${[['Modalidade', tm.modalidade], ['Local', tm.local], ['Professor(a)', tm.professor], ['Responsável', tm.responsavel], ['Para quem é', tm.publico], ['Pré-requisitos', tm.preRequisitos], ['O aluno leva', tm.levar], ['Oferta', tm.precoPromo ? `${brl(tm.precoPromo)} (de ${brl(tm.preco)})${tm.prazoPromo ? ' até ' + fmtDate(tm.prazoPromo) : ''}` : tm.preco ? brl(tm.preco) : ''], ['Condições', tm.condicoes], ['Sinal', tm.sinal ? brl(tm.sinal) : ''], ['O que inclui', (tm.inclui || '').split('\n').filter(Boolean).join(' · ')], ...(tm.extras || []).map((x) => [x.k, x.v]), ['Anotações', tm.notas]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') || '<p class="empty-sm">Complete a ficha em "Editar turma".</p>'}</dl>
    </section>`;
}

export function pageMount(root, ctx, tm) {
  root.addEventListener('change', (ev) => {
    const cb = ev.target.closest('[data-tchk]');
    if (!cb) return;
    const cur = store.get('turmas', tm.id);
    const ck = [...(cur.checklist || [])]; ck[+cb.dataset.tchk] = { ...ck[+cb.dataset.tchk], feito: cb.checked };
    store.put('turmas', { ...cur, checklist: ck });
    const cal = store.all('calendar').find((i) => i.turmaId === tm.id && i.origemChecklist && i.titulo.startsWith(ck[+cb.dataset.tchk].t));
    if (cal) store.put('calendar', { ...cal, status: cb.checked ? 'Publicado' : 'Planejado' });
  });
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    const cur = store.get('turmas', tm.id);
    if (ds.tp === 'edit') { editorOpen(cur); location.hash = '#matriculas?turmaEdit=' + encodeURIComponent(cur.id); return; }
    if (ds.tp === 'mat') return matriculaDialog({ origem: 'Passante / balcão', cursoId: cur.cursoId, turmaId: cur.id, produtoId: cur.produtoId || '', valor: cur.precoPromo || cur.preco || '' }, ctx);
    if (ds.tal) return matriculaDialog(store.get('leads', ds.tal), ctx);
    if (ds.tp === 'camp') return startFromTurma(cur);
    if (ds.tp === 'dup') {
      const shift = cur.inicio && cur.fim ? daysBetween(cur.inicio, cur.fim) : 0;
      const ini = addDays(cur.inicio || today(), 30);
      editorOpen({ ...cur, id: undefined, createdAt: undefined, nome: cur.nome + ' (próxima)', inicio: ini, fim: cur.fim ? addDays(ini, shift) : '', status: 'Planejando', espera: [], mensagemEditada: false, checklist: (cur.checklist || []).map((c) => ({ ...c, id: undefined, feito: false, d: c.d && cur.inicio ? addDays(ini, daysBetween(cur.inicio, c.d)) : c.d })) });
      toast('Copiamos a ficha com as datas 30 dias à frente. Ajuste e salve.');
      location.hash = '#matriculas?turmaEdit=nova';
      return;
    }
    if (ds.tp === 'copy') return copyText($('#t-msg', root).value, $('#t-msg', root));
    if (ds.tp === 'msgsave') { store.put('turmas', { ...cur, mensagem: $('#t-msg', root).value, mensagemEditada: true }); toast('Seu texto foi salvo.'); return ctx.refresh(); }
    if (ds.tp === 'msgreset') { store.put('turmas', { ...cur, mensagem: '', mensagemEditada: false }); return ctx.refresh(); }
    if (ds.tp === 'espera') {
      return openDialog({ title: 'Lista de espera', saveLabel: 'Adicionar', fields: [{ name: 'nome', label: 'Nome', required: true }, { name: 'telefone', label: 'WhatsApp' }], onSave: (d) => { store.put('turmas', { ...cur, espera: [...(cur.espera || []), { ...d, data: today() }] }); ctx.refresh(); } });
    }
    if (ds.esprm !== undefined) { const esp = [...(cur.espera || [])]; esp.splice(+ds.esprm, 1); store.put('turmas', { ...cur, espera: esp }); return ctx.refresh(); }
  });
}

// ---------- lista (cards) ----------
export function listHTML() {
  const list = store.all('turmas').sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
  return `<div class="row-actions"><button class="btn primary" data-act="turma">${ICON.plus} Nova turma</button></div>
  ${list.length ? `<div class="cards">${list.map((tm) => {
    const s = turmaStats(tm);
    return `<a class="card turma turma-card" href="#matriculas?turma=${encodeURIComponent(tm.id)}" style="--tc:${corHex(tm.cor)}"><header class="card-head"><div><p class="eyebrow">${esc(courseName(tm.cursoId))}</p><h3>${esc(tm.nome)}</h3>${tm.tema ? `<p class="turma-tema">${esc(tm.tema)}</p>` : ''}</div>${badge(tm.status || 'Planejando', STATUS_CLS[tm.status] || '')}</header>
      <p class="big">${s.mats.length} <small>${tm.vagas ? 'de ' + num(tm.vagas) + ' vagas' : 'matriculados'}${tm.meta ? ' · meta ' + num(tm.meta) : ''}</small></p>${meter(tm.vagas ? s.mats.length / tm.vagas : s.p, s.st || 'ok')}
      <dl class="stats"><div><dt>Início</dt><dd>${fmtDate(tm.inicio)}${s.dias !== null ? ` <small>${s.dias >= 0 ? 'em ' + s.dias + ' dias' : 'começou'}</small>` : ''}</dd></div><div><dt>Interessados</dt><dd>${s.abertos.length}</dd></div><div><dt>Preparação</dt><dd>${s.total ? s.feitos + '/' + s.total : '—'}</dd></div><div><dt>Espera</dt><dd>${s.espera.length}</dd></div></dl>
      ${s.abaixoMinimo ? `<p class="bad small">Abaixo do mínimo para abrir (${tm.minimo}).</p>` : ''}
    </a>`;
  }).join('')}</div>` : `<div class="empty"><h3>Crie a primeira turma</h3><p>Monte a ficha do seu jeito: agenda, professor, o que inclui, oferta, checklist e a mensagem pronta para o WhatsApp. A ocupação e os alunos atualizam sozinhos.</p></div>`}`;
}
