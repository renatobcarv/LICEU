// Pauta Viral integrada: o mesmo formulário e banco de ganchos do artefato original,
// agora com banco de pautas, envio direto para o calendário e dados reais do curso no briefing.

import { store } from '../store.js';
import { esc, $, $$, norm, today, addDays, fmtDate, pct, num } from '../util.js';
import { HOOKS, BANK, FORMATOS, OBJETIVOS, CONSCIENCIA, OBJECOES, buildBrief } from '../pauta-data.js';
import { buildKit, kitText, AMBIENTES, QUEM, TONS } from '../pauta-gen.js';
import { salesStats, contentStats, settings } from '../metrics.js';
import { openDialog, toast, copyText, ICON, badge, confirmButton, dayPicker } from '../ui.js';

export const autoRefresh = false; // não redesenha no meio da digitação

const DRAFT_KEY = 'liceu.intelligence.pauta.draft';
const BLANK = { qstep: 0, v: 0, kitEdits: {}, ambiente: 'lab', ambienteLivre: '', quem: 'professor', tom: 'Direto', duracao: 30, palavra: '', formato: 'Reels', objetivo: OBJETIVOS[0][0], consciencia: CONSCIENCIA[2][0], objecao: '', cenario: 'Claude escolhe', validado: 'Ainda não', curso: '', ideia: '', erro: '', protagonista: '', publico: '', entrega: '', prova: '', refs: '', cta: '', restricoes: '', voz: '', anuncio: false, picked: [], usarDados: true };
let draft = loadDraft();
let tab = 'nova';
let cat = 'Todos';
let hq = '';

function loadDraft() { try { return { ...structuredClone(BLANK), ...(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}) }; } catch (e) { return { ...structuredClone(BLANK) }; } }
function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* opcional */ } }

const courseByName = (name) => { const n = norm(name); return store.all('courses').find((c) => norm(c.nome) === n) || store.all('courses').find((c) => n && norm(c.nome).includes(n)); };

// Resumo de dados reais do curso nos últimos 60 dias, para orientar ângulo e objeção.
function contexto(d) {
  if (!d.usarDados) return '';
  const c = courseByName(d.curso);
  const to = today(), from = addDays(to, -59);
  const f = { cursoId: c?.id || '' };
  const s = salesStats(from, to, f);
  const ct = contentStats(from, to, f);
  const lines = [];
  if (s.leads) lines.push(`- Últimos 60 dias${c ? ' em ' + c.nome : ''}: ${s.leads} leads no WhatsApp, ${s.matriculas} matrículas (${pct(s.convLead, 0)}).`);
  const mot = Object.entries(s.motivos).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (mot.length) lines.push('- Motivos de perda mais comuns: ' + mot.map(([m, n]) => `${m} (${n})`).join(', ') + '.');
  if (ct.ranked.length) lines.push('- Conteúdos que mais geraram resposta: ' + ct.ranked.slice(0, 3).map((i) => `"${i.titulo}" (${i.formato})`).join('; ') + '.');
  return lines.join('\n');
}
const brief = () => buildBrief({ ...draft, contexto: contexto(draft) });

function radios(name, opts) {
  return `<div class="chips">${opts.map(([v, l]) => `<label class="chip-radio"><input type="radio" name="${name}" value="${esc(v)}"${draft[name] === v ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
}

export function render(ctx) {
  const p = ctx.params;
  // Atalhos vindos de outros módulos (diagnóstico, campanha, calendário).
  if (p.curso !== undefined || p.anuncio || p.objecao || p.de || p.id) {
    draft = { ...structuredClone(BLANK) };
    if (p.curso) draft.curso = store.get('courses', p.curso)?.nome || '';
    if (p.anuncio) { draft.anuncio = true; draft.objetivo = 'Conversas no WhatsApp'; }
    if (p.objecao) { const hit = OBJECOES.find(([v]) => norm(v).includes(norm(p.objecao)) || norm(p.objecao).includes(norm(v || '#'))); draft.objecao = hit ? hit[0] : ''; draft.ideia = 'Conteúdo que responde a objeção "' + p.objecao + '" antes da conversa no WhatsApp.'; }
    if (p.de) { const it = store.get('calendar', p.de); if (it) { draft.curso = store.get('courses', it.cursoId)?.nome || ''; draft.formato = FORMATOS.includes(it.formato) ? it.formato : 'Reels'; draft.ideia = 'Variação de um conteúdo que funcionou: "' + (it.titulo || '') + '". Mesmo assunto, gancho diferente.'; } }
    if (p.id) { const pt = store.get('pautas', p.id); if (pt) draft = { ...structuredClone(BLANK), ...pt.form, _id: pt.id, qstep: 'kit' }; }
    saveDraft(); tab = 'nova';
    history.replaceState(null, '', '#pauta');
  }
  const pautas = store.all('pautas').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `
  <div class="toolbar"><div class="tabs" role="tablist">
    <button type="button" class="tab" role="tab" data-ptab="nova" aria-selected="${tab === 'nova'}">${draft._id ? 'Editando pauta' : 'Nova pauta'}</button>
    <button type="button" class="tab" role="tab" data-ptab="banco" aria-selected="${tab === 'banco'}">Banco de pautas <span class="count">${pautas.length}</span></button>
  </div></div>
  ${tab === 'banco' ? bank(pautas) : form()}`;
}

// ---------- quiz ----------
const QSTEPS = ['Formato', 'Objetivo', 'Curso e ideia', 'Público', 'Ambiente', 'Quem e tom', 'Ganchos', 'Finalizar'];
const chipsSet = (name, opts) => `<div class="chips">${opts.map(([v, l]) => `<button type="button" class="chip" data-pset="${name}" data-val="${esc(v)}" aria-pressed="${String(draft[name]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
const inp = (name, label, ph = '', type = 'text') => `<div class="field"><label for="pq-${name}">${label}</label><input id="pq-${name}" data-pd="${name}" type="${type}" value="${esc(draft[name] ?? '')}" placeholder="${esc(ph)}"></div>`;
const area = (name, label, ph = '', rows = 3) => `<div class="field"><label for="pq-${name}">${label}</label><textarea id="pq-${name}" data-pd="${name}" rows="${rows}" placeholder="${esc(ph)}">${esc(draft[name] ?? '')}</textarea></div>`;

function quizStep() {
  const i = draft.qstep || 0;
  const courses = store.all('courses').filter((c) => c.ativo !== false);
  const Q = [
    ['Qual formato?', 'Cada formato tem um molde de roteiro diferente.', chipsSet('formato', FORMATOS.map((f) => [f, f]))],
    ['O que esse post precisa gerar?', 'Define a ação final e a legenda.', chipsSet('objetivo', OBJETIVOS)],
    ['Sobre qual curso e qual é a ideia?', 'A ideia pode ser crua. Ex.: "mostrar o erro que todo mundo comete quando alguém desmaia".',
      `<div class="field"><label for="pq-curso">Curso ou tema</label><input id="pq-curso" data-pd="curso" list="p-cursos" value="${esc(draft.curso)}" placeholder="Ex.: Primeiros Socorros"><datalist id="p-cursos">${courses.map((c) => `<option value="${esc(c.nome)}">`).join('')}</datalist></div>
       <div class="chips">${courses.slice(0, 8).map((c) => `<button type="button" class="chip" data-pset="curso" data-val="${esc(c.nome)}" aria-pressed="${draft.curso === c.nome}">${esc(c.nome)}</button>`).join('')}</div>
       ${area('ideia', 'A ideia, do seu jeito', 'Uma frase já basta. Pode separar em pontos com ponto final.')}
       ${inp('erro', 'O erro ou mito que o post derruba (opcional)', 'Ex.: achar que a pessoa caída tá respirando')}`],
    ['Em que ponto a pessoa está?', 'Muda o tom inteiro. Quem nem sabe que precisa não pode receber "últimas vagas".', `${chipsSet('consciencia', CONSCIENCIA.filter(([v]) => v !== 'Claude avalia'))}<h3 class="sub-h">O que mais trava a decisão</h3>${chipsSet('objecao', OBJECOES)}`],
    ['Onde vai ser gravado?', 'O ambiente vira a direção de luz, objetos, som e o prompt de imagem.', `<div class="cards amb">${AMBIENTES.map((a) => `<button type="button" class="card pick${draft.ambiente === a.id ? ' on' : ''}" data-pset="ambiente" data-val="${a.id}" aria-pressed="${draft.ambiente === a.id}"><b>${esc(a.nome)}</b><span class="muted">${esc(a.pt)}</span></button>`).join('')}</div>${inp('ambienteLivre', 'Ou descreva o seu lugar', 'Ex.: recepção da escola com o painel da marca ao fundo')}`],
    ['Quem aparece e qual o tom?', 'Define quem fala, o enquadramento e a trilha.', `${chipsSet('quem', QUEM)}<h3 class="sub-h">Tom</h3>${chipsSet('tom', TONS.map((t) => [t, t]))}${['Reels', 'Vídeo motion'].includes(draft.formato) ? `<h3 class="sub-h">Duração</h3>${chipsSet('duracao', [[15, '15 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']])}` : ''}${draft.formato === 'Vídeo motion' ? inp('protagonista', 'Protagonista (opcional)', 'Ex.: motorista de app, boné e relógio verde') : ''}`],
    ['Quer partir de algum gancho do banco?', 'Opcional. Marque até 3: eles entram nas opções de gancho do kit.', `<div class="picked" id="picked"></div><div class="bank"><div class="bank-top"><input type="search" id="p-q" placeholder="Buscar gancho por palavra" aria-label="Buscar gancho" value="${esc(hq)}"><div class="chips scroll-x" id="p-tabs">${['Todos', ...BANK.map((g) => g.cat)].map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join('')}</div></div><ul class="hooks" id="hooks"></ul></div>`],
    ['Últimos detalhes', 'Tudo opcional. Quanto mais real, melhor o kit.', `<div class="form-grid">${inp('palavra', 'Palavra-chave para comentar', 'Ex.: GUIA')}${inp('prova', 'O que temos de real para mostrar', 'Ex.: vídeo da aula prática, depoimento da Ana')}${inp('publico', 'Para quem', 'Ex.: quem já atua em farmácia')}${inp('restricoes', 'Não pode', 'Ex.: mostrar rosto da professora, preço')}</div>
      <label class="toggle"><input type="checkbox" data-pck="anuncio"${draft.anuncio ? ' checked' : ''}> Esse post também vai virar anúncio pago</label>`],
  ];
  const [q, help, body] = Q[i];
  return `<div class="quiz">
    <nav class="steps-nav" aria-label="Etapas">${QSTEPS.map((t, k) => `<button type="button" class="step-pill${k === i ? ' on' : ''}${k < i ? ' done' : ''}" data-qgo="${k}"><span>${k + 1}</span>${esc(t)}</button>`).join('')}</nav>
    <h2>${esc(q)}</h2><p class="muted">${esc(help)}</p>
    <div class="quiz-a">${body}</div>
    <div class="row-actions"><button type="button" class="btn" data-qnav="prev"${i ? '' : ' disabled'}>Voltar</button><span class="grow"></span>${i < QSTEPS.length - 1 ? `<button type="button" class="btn ghost" data-qnav="kit">Pular e gerar</button><button type="button" class="btn primary" data-qnav="next">Próxima ${ICON.arrow}</button>` : `<button type="button" class="btn primary" data-qnav="kit">Gerar kit</button>`}</div>
  </div>`;
}

// ---------- kit ----------
function kitBlocks() { return buildKit(draft).map((b) => ({ ...b, texto: draft.kitEdits?.[b.id] ?? b.texto })); }
function kitView() {
  const blocos = kitBlocks();
  return `<div class="kit">
    <div class="kit-main">
      <header class="kit-head"><div><p class="eyebrow">${esc(draft.formato)} · ${esc(draft.objetivo.split(' (')[0])}${draft.curso ? ' · ' + esc(draft.curso) : ''}</p><h2>${esc(titleOf(draft))}</h2><p class="muted">Edite à vontade: o texto fica salvo. "Outra versão" troca ganchos, roteiro e legenda.</p></div></header>
      ${blocos.map((b) => `<section class="card kit-b"><header class="card-head"><h3>${esc(b.titulo)}</h3><div class="row-actions">${draft.kitEdits?.[b.id] !== undefined ? `<button type="button" class="btn sm ghost" data-kreset="${b.id}">Desfazer edição</button>` : ''}<button type="button" class="btn sm" data-kcopy="${b.id}">${ICON.copy} Copiar</button></div></header><textarea class="kit-t" data-kedit="${b.id}" rows="${Math.min(22, Math.max(4, b.texto.split('\n').length + 1))}">${esc(b.texto)}</textarea></section>`).join('')}
      <details class="more"><summary>Briefing para o Claude (para ir além no chat)</summary><div class="inner"><pre class="brief" id="p-brief">${esc(brief())}</pre><button type="button" class="btn sm" data-pact="copy">${ICON.copy} Copiar briefing</button></div></details>
    </div>
    <aside class="kit-side card">
      <button type="button" class="btn primary block" data-pact="agendar">${ICON.calendario} Salvar e escolher o dia</button>
      <button type="button" class="btn block" data-pact="copyall">${ICON.copy} Copiar tudo</button>
      <button type="button" class="btn block" data-pact="again">Outra versão</button>
      <button type="button" class="btn block" data-pact="save">Salvar no banco</button>
      <button type="button" class="btn ghost block" data-qgo="0">Editar respostas</button>
      <button type="button" class="btn ghost block" data-pact="clear">Nova pauta</button>
      <p class="hint">Revise a parte técnica com o(a) professor(a) antes de postar. Números e depoimentos: só reais.</p>
    </aside>
  </div>`;
}

function form() { return draft.qstep === 'kit' ? kitView() : quizStep(); }

const STATUS = ['Ideia', 'Briefing pronto', 'Roteiro aprovado', 'Gravado', 'Publicado', 'Descartada'];
function bank(list) {
  if (!list.length) return '<div class="empty"><h3>Nenhuma pauta salva</h3><p>Monte um briefing e clique em Salvar e escolher o dia. Toda pauta fica aqui e no calendário.</p></div>';
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Pauta</th><th>Formato</th><th>Objetivo</th><th>Calendário</th><th>Status</th><th></th></tr></thead><tbody>${list.map((p) => {
    const cal = p.calendarId ? store.get('calendar', p.calendarId) : null;
    return `<tr><td><b>${esc(p.titulo)}</b><small class="cell-sub">${esc(p.form?.curso || '')}</small></td><td>${esc(p.form?.formato || '')}</td><td>${esc((p.form?.objetivo || '').split(' (')[0])}</td><td>${cal ? `<a href="#calendario?d=${esc(cal.data)}">${fmtDate(cal.data)}</a>` : '—'}</td>
    <td><label class="sr" for="ps-${esc(p.id)}">Status</label><select id="ps-${esc(p.id)}" data-pstatus="${esc(p.id)}">${STATUS.map((s) => `<option${s === p.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
    <td class="r nowrap"><button class="btn sm" data-popen="${esc(p.id)}">Abrir</button> <button class="btn sm ghost" data-pdel="${esc(p.id)}">Excluir</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderHooks(root) {
  const q = norm(hq);
  const ul = $('#hooks', root);
  if (!ul) return;
  const list = HOOKS.filter((h) => (cat === 'Todos' || h.cat === cat) && (!q || norm(h.text + ' ' + h.cat + ' ' + h.mech).includes(q)));
  ul.innerHTML = list.length ? list.map((h) => { const on = draft.picked.includes(h.id); return `<li><button type="button" data-hook="${h.id}" aria-pressed="${on}"><span class="box" aria-hidden="true">${on ? '✓' : ''}</span><span class="t"><span>${esc(h.text)}</span><span class="tag">${esc(h.cat + (h.mech ? ' · ' + h.mech : ''))}</span></span></button></li>`; }).join('') : '<li class="hint pad">Nenhum gancho com essa palavra.</li>';
  $('#picked', root).innerHTML = draft.picked.length ? draft.picked.map((id) => `<div class="p"><span>${esc(HOOKS[id].text)}</span><button type="button" class="btn sm" data-unhook="${id}" aria-label="Tirar gancho">Tirar</button></div>`).join('') : '<div class="none">Nenhum gancho marcado ainda.</div>';
}

function readQuiz(root) {
  $$('[data-pd]', root).forEach((el) => { draft[el.dataset.pd] = el.value; });
  $$('[data-pck]', root).forEach((el) => { draft[el.dataset.pck] = el.checked; });
  $$('[data-kedit]', root).forEach((el) => { const gen = buildKit(draft).find((b) => b.id === el.dataset.kedit)?.texto; if (el.value !== gen) draft.kitEdits = { ...draft.kitEdits, [el.dataset.kedit]: el.value }; });
  saveDraft();
}

// Toda pauta salva vai para o calendário: escolhe o dia num mini calendário, com o formato já definido.
const FORMATO_CAL = { 'Reels': 'Reels', 'Vídeo motion': 'Vídeo motion', 'Carrossel': 'Carrossel', 'Stories': 'Stories', 'Post estático': 'Post estático' };
function scheduleDialog(ctx) {
  const s = settings();
  const old = draft._id ? store.get('pautas', draft._id) : null;
  const oldItem = old?.calendarId ? store.get('calendar', old.calendarId) : null;
  let dia = oldItem?.data || '';
  const count = (d) => store.all('calendar').filter((i) => i.data === d && i.status !== 'Cancelado').length;
  const { dlg, form } = openDialog({
    title: 'Em que dia vai ao ar?', saveLabel: 'Agendar', wide: true,
    fields: [
      { name: 'formato', label: 'Formato', type: 'select', options: ['Reels', 'Vídeo motion', 'Carrossel', 'Stories', 'Post estático', 'Arte', 'Live', 'Outro'], value: FORMATO_CAL[draft.formato] || draft.formato },
      { name: 'hora', label: 'Horário (opcional)', type: 'time', value: oldItem?.hora || '' },
      { name: 'pilar', label: 'Pilar', type: 'select', options: ['', ...s.pilares], value: oldItem?.pilar || '' },
      { name: 'responsavel', label: 'Responsável', value: oldItem?.responsavel || '', list: 'resp-list-p' },
      { name: 'gravacao', label: 'Gravar em (opcional)', type: 'date', hint: 'Cria também um item de gravação no calendário.' },
    ],
    html: `<div class="dp" id="dp"></div><p class="note" id="dp-sel">${dia ? 'Dia escolhido: ' + fmtDate(dia) : 'Toque no dia da publicação. Os pontos mostram o que já está agendado.'}</p><datalist id="resp-list-p">${(s.responsaveis || []).map((r) => `<option value="${esc(r)}">`).join('')}</datalist>`,
    onSave: (d) => {
      if (!dia) { const e = $('.form-error', dlg); e.textContent = 'Escolha o dia no calendário.'; e.hidden = false; return false; }
      const c = courseByName(draft.curso);
      const pauta = savePauta();
      const obj = draft.objetivo.split(' (')[0];
      const item = store.put('calendar', { ...(oldItem || {}), data: dia, hora: d.hora, tipo: 'Publicação', titulo: titleOf(draft), cursoId: c?.id || '', formato: d.formato, pilar: d.pilar, objetivo: obj, cta: draft.cta, status: oldItem?.status || 'Em produção', responsavel: d.responsavel, pautaId: pauta.id });
      if (d.gravacao) store.put('calendar', { data: d.gravacao, tipo: 'Gravação', titulo: 'Gravar: ' + titleOf(draft), cursoId: c?.id || '', formato: d.formato, status: 'Planejado', responsavel: d.responsavel, pautaId: pauta.id });
      store.put('pautas', { ...store.get('pautas', pauta.id), calendarId: item.id, status: pauta.status === 'Ideia' ? 'Briefing pronto' : pauta.status });
      toast((d.formato || 'Publicação') + ' agendado para ' + fmtDate(dia) + '.');
      ctx.go('#calendario?d=' + dia);
    },
  });
  dayPicker($('#dp', dlg), { value: dia, markers: count, onPick: (v) => { dia = v; $('#dp-sel', dlg).textContent = 'Dia escolhido: ' + fmtDate(v) + (count(v) ? ' · já tem ' + count(v) + (count(v) > 1 ? ' itens' : ' item') + ' nesse dia' : ''); $('.form-error', dlg).hidden = true; } });
  void form;
}

function titleOf(d) { return (d.ideia || d.curso || 'Pauta sem título').split(/[.\n]/)[0].slice(0, 80); }

function savePauta(extra = {}) {
  const old = draft._id ? store.get('pautas', draft._id) : null;
  const { _id, ...form } = draft;
  const p = store.put('pautas', { ...(old || {}), titulo: titleOf(draft), form, brief: brief(), kit: kitText(kitBlocks()), status: old?.status || 'Briefing pronto', ...extra });
  draft._id = p.id; saveDraft();
  return p;
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (tab === 'nova') readQuiz(root);
    if (ds.ptab) { tab = ds.ptab; ctx.refresh(); return; }
    if (ds.popen) { const p = store.get('pautas', ds.popen); draft = { ...structuredClone(BLANK), ...p.form, _id: p.id, qstep: 'kit' }; saveDraft(); tab = 'nova'; ctx.refresh(); return; }
    if (ds.pdel) { if (!confirmButton(b, 'Confirmar')) return; store.remove('pautas', ds.pdel); ctx.refresh(); return; }
    if (ds.pset) { draft[ds.pset] = ds.pset === 'duracao' ? Number(ds.val) : ds.val; if (ds.pset === 'ambiente') draft.ambienteLivre = ''; saveDraft(); ctx.refresh(); return; }
    if (ds.qgo !== undefined) { draft.qstep = Number(ds.qgo); saveDraft(); ctx.refresh(); return; }
    if (ds.qnav) {
      const i = draft.qstep === 'kit' ? 0 : draft.qstep || 0;
      if (ds.qnav === 'prev') draft.qstep = Math.max(0, i - 1);
      if (ds.qnav === 'next') draft.qstep = i + 1;
      if (ds.qnav === 'kit') { if (!draft.curso && !draft.ideia) { toast('Diga pelo menos o curso ou a ideia (passo 3).', 'warn'); draft.qstep = 2; } else draft.qstep = 'kit'; }
      saveDraft(); ctx.refresh(); window.scrollTo(0, 0); return;
    }
    if (ds.cat) { cat = ds.cat; $$('[data-cat]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderHooks(root); return; }
    if (ds.hook !== undefined || ds.unhook !== undefined) {
      const id = Number(ds.hook ?? ds.unhook);
      const i = draft.picked.indexOf(id);
      if (i >= 0) draft.picked.splice(i, 1);
      else { if (draft.picked.length >= 3) { toast('Já tem 3 ganchos marcados. Tire um para trocar.', 'warn'); return; } draft.picked.push(id); }
      saveDraft(); renderHooks(root); return;
    }
    if (ds.kcopy) { const ta = $(`[data-kedit="${ds.kcopy}"]`, root); return copyText(ta.value, ta); }
    if (ds.kreset) { const k = { ...draft.kitEdits }; delete k[ds.kreset]; draft.kitEdits = k; saveDraft(); ctx.refresh(); return; }
    if (ds.pact === 'copyall') return copyText(kitText(kitBlocks()), $('.kit-main', root));
    if (ds.pact === 'again') { draft.v = (Number(draft.v) || 0) + 1; draft.kitEdits = {}; saveDraft(); ctx.refresh(); toast('Nova versão gerada.'); return; }
    if (ds.pact === 'copy') { copyText(brief(), $('#p-brief', root)); return; }
    if (ds.pact === 'save') { savePauta(); toast('Pauta salva no banco.'); return; }
    if (ds.pact === 'clear') { draft = { ...structuredClone(BLANK), picked: [] }; saveDraft(); ctx.refresh(); toast('Pauta nova. Pode começar.'); return; }
    if (ds.pact === 'agendar') scheduleDialog(ctx);
  });
  root.addEventListener('input', (e) => { if (e.target.matches('[data-pd],[data-kedit]')) readQuiz(root); });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.pstatus) { const p = store.get('pautas', e.target.dataset.pstatus); store.put('pautas', { ...p, status: e.target.value }); toast('Status atualizado.'); }
    if (e.target.matches('[data-pck]')) readQuiz(root);
  });
  $('#p-q', root)?.addEventListener('input', (e) => { hq = e.target.value; renderHooks(root); });
  renderHooks(root);
  void badge; void num;
}
