// Pauta Viral integrada: o mesmo formulário e banco de ganchos do artefato original,
// agora com banco de pautas, envio direto para o calendário e dados reais do curso no briefing.

import { store } from '../store.js';
import { esc, $, $$, norm, today, addDays, fmtDate, pct, num } from '../util.js';
import { HOOKS, BANK, FORMATOS, OBJETIVOS, CONSCIENCIA, OBJECOES, CENARIOS, buildBrief } from '../pauta-data.js';
import { salesStats, contentStats, settings } from '../metrics.js';
import { openDialog, toast, copyText, ICON, badge, confirmButton, dayPicker } from '../ui.js';

export const autoRefresh = false; // não redesenha no meio da digitação

const DRAFT_KEY = 'liceu.intelligence.pauta.draft';
const BLANK = { formato: 'Reels', objetivo: OBJETIVOS[0][0], consciencia: 'Claude avalia', objecao: '', cenario: 'Claude escolhe', validado: 'Ainda não', curso: '', ideia: '', erro: '', protagonista: '', publico: '', entrega: '', prova: '', refs: '', cta: '', restricoes: '', voz: '', anuncio: false, picked: [], usarDados: true };
let draft = loadDraft();
let tab = 'nova';
let cat = 'Todos';
let hq = '';

function loadDraft() { try { return { ...BLANK, ...(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}) }; } catch (e) { return { ...BLANK }; } }
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
    draft = { ...BLANK };
    if (p.curso) draft.curso = store.get('courses', p.curso)?.nome || '';
    if (p.anuncio) { draft.anuncio = true; draft.objetivo = 'Conversas no WhatsApp'; }
    if (p.objecao) { const hit = OBJECOES.find(([v]) => norm(v).includes(norm(p.objecao)) || norm(p.objecao).includes(norm(v || '#'))); draft.objecao = hit ? hit[0] : ''; draft.ideia = 'Conteúdo que responde a objeção "' + p.objecao + '" antes da conversa no WhatsApp.'; }
    if (p.de) { const it = store.get('calendar', p.de); if (it) { draft.curso = store.get('courses', it.cursoId)?.nome || ''; draft.formato = FORMATOS.includes(it.formato) ? it.formato : 'Reels'; draft.ideia = 'Variação de um conteúdo que funcionou: "' + (it.titulo || '') + '". Mesmo assunto, gancho diferente.'; } }
    if (p.id) { const pt = store.get('pautas', p.id); if (pt) draft = { ...BLANK, ...pt.form, _id: pt.id }; }
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

function form() {
  const courses = store.all('courses').filter((c) => c.ativo !== false);
  return `
  <p class="lead-text">Monte o briefing em poucos cliques e cole no chat do Claude. Ele cria os ganchos finais, o roteiro e a legenda. Depois salve a pauta e mande para o calendário.</p>
  <div class="pauta">
    <form id="pf" class="pauta-form" autocomplete="off">
      <fieldset><legend><span class="n">01</span>Formato</legend>${radios('formato', FORMATOS.map((f) => [f, f]))}</fieldset>
      <fieldset><legend><span class="n">02</span>O que esse post precisa gerar</legend>${radios('objetivo', OBJETIVOS)}</fieldset>
      <fieldset><legend><span class="n">02b</span>Em que ponto a pessoa está</legend><p class="hint">Muda o tom inteiro. Quem nem sabe que precisa não pode receber "últimas vagas".</p>${radios('consciencia', CONSCIENCIA)}</fieldset>
      <fieldset><label class="lbl" for="p-curso"><span class="n">03</span>Curso ou tema</label><input type="text" id="p-curso" name="curso" list="p-cursos" value="${esc(draft.curso)}" placeholder="Ex.: Primeiros Socorros"><datalist id="p-cursos">${courses.map((c) => `<option value="${esc(c.nome)}">`).join('')}</datalist></fieldset>
      <fieldset><label class="lbl" for="p-ideia"><span class="n">04</span>A ideia, do seu jeito</label><p class="hint">Pode ser crua. Ex.: "mostrar o erro que todo mundo comete quando alguém desmaia".</p><textarea id="p-ideia" name="ideia" rows="3">${esc(draft.ideia)}</textarea></fieldset>
      <fieldset id="motionBox" class="motion"${draft.formato === 'Vídeo motion' ? '' : ' hidden'}>
        <legend><span class="n">M</span>Detalhes do vídeo motion</legend>
        <p class="hint">O briefing chama a skill /tecmais-reel-motion: história do dia a dia em que o curso decide o final, sem terror nem milagre.</p>
        <span class="sublbl">Onde a história acontece</span>${radios('cenario', CENARIOS)}
        <label class="sublbl" for="p-erro">O erro que a história derruba</label><input type="text" id="p-erro" name="erro" value="${esc(draft.erro)}" placeholder="Ex.: achar que a pessoa caída tá respirando">
        <label class="sublbl" for="p-prot">Protagonista (opcional)</label><input type="text" id="p-prot" name="protagonista" value="${esc(draft.protagonista)}" placeholder="Ex.: motorista de app, boné e relógio verde">
        <span class="sublbl">A professora já validou a parte técnica?</span>${radios('validado', [['Ainda não', 'Ainda não'], ['Sim', 'Sim']])}
      </fieldset>
      <fieldset><legend><span class="n">05</span>Ganchos que mais combinam (até 3)</legend><p class="hint">Toque para marcar. Os colchetes o Claude adapta ao tema. Se não marcar nenhum, ele escolhe.</p>
        <div class="picked" id="picked"></div>
        <div class="bank">
          <div class="bank-top"><input type="search" id="p-q" placeholder="Buscar gancho por palavra" aria-label="Buscar gancho" value="${esc(hq)}">
          <div class="chips scroll-x" id="p-tabs" role="toolbar" aria-label="Categorias de gancho">${['Todos', ...BANK.map((g) => g.cat)].map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join('')}</div></div>
          <ul class="hooks" id="hooks"></ul>
        </div>
      </fieldset>
      <details class="more"${draft.publico || draft.prova || draft.cta ? ' open' : ''}><summary>Mais detalhes (opcional, deixa o briefing melhor)</summary><div class="inner">
        <fieldset><legend>O que mais trava a decisão</legend>${radios('objecao', OBJECOES)}</fieldset>
        <label class="toggle"><input type="checkbox" name="anuncio"${draft.anuncio ? ' checked' : ''}> Esse post também vai virar anúncio pago</label>
        <label class="toggle"><input type="checkbox" name="usarDados"${draft.usarDados ? ' checked' : ''}> Incluir dados reais do painel (leads, perdas, melhores conteúdos)</label>
        ${[['publico', 'Para quem', 'Ex.: estudantes de enfermagem do Entorno do DF'], ['entrega', 'O que a pessoa leva de graça', 'Ex.: checklist enviado por DM para quem comentar'], ['prova', 'O que temos de real para mostrar', 'Ex.: vídeos da aula prática, depoimento de aluna']].map(([n, l, ph]) => `<fieldset><label class="lbl" for="p-${n}">${l}</label><input type="text" id="p-${n}" name="${n}" value="${esc(draft[n])}" placeholder="${esc(ph)}"></fieldset>`).join('')}
        <fieldset><label class="lbl" for="p-refs">Referências</label><textarea id="p-refs" name="refs" rows="2" placeholder="Links de posts ou criadores e o que você gostou neles">${esc(draft.refs)}</textarea></fieldset>
        <div class="row2"><fieldset><label class="lbl" for="p-cta">Ação final</label><input type="text" id="p-cta" name="cta" value="${esc(draft.cta)}" placeholder="Ex.: comentar CHECKLIST"></fieldset><fieldset><label class="lbl" for="p-restr">Não pode</label><input type="text" id="p-restr" name="restricoes" value="${esc(draft.restricoes)}" placeholder="Ex.: rosto da professora, preço"></fieldset></div>
        <fieldset><label class="lbl" for="p-voz">Amostras da nossa voz</label><textarea id="p-voz" name="voz" rows="3" placeholder="Cole 1 a 3 legendas de vocês que funcionaram">${esc(draft.voz)}</textarea></fieldset>
      </div></details>
    </form>
    <section class="monitor" aria-label="Briefing">
      <div class="mon-head"><span><span class="rec-dot" aria-hidden="true"></span> BRIEFING</span><span id="p-count"></span></div>
      <ul class="check" id="p-check"></ul>
      <pre class="brief" id="p-brief"></pre>
      <div class="mon-foot">
        <button type="button" class="btn primary" data-pact="agendar">${ICON.calendario} Salvar e escolher o dia</button>
        <div class="row2"><button type="button" class="btn" data-pact="copy">${ICON.copy} Copiar briefing</button><button type="button" class="btn ghost" data-pact="clear">Nova pauta</button></div>
      </div>
    </section>
  </div>`;
}

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
  const list = HOOKS.filter((h) => (cat === 'Todos' || h.cat === cat) && (!q || norm(h.text + ' ' + h.cat + ' ' + h.mech).includes(q)));
  ul.innerHTML = list.length ? list.map((h) => { const on = draft.picked.includes(h.id); return `<li><button type="button" data-hook="${h.id}" aria-pressed="${on}"><span class="box" aria-hidden="true">${on ? '✓' : ''}</span><span class="t"><span>${esc(h.text)}</span><span class="tag">${esc(h.cat + (h.mech ? ' · ' + h.mech : ''))}</span></span></button></li>`; }).join('') : '<li class="hint pad">Nenhum gancho com essa palavra.</li>';
  $('#picked', root).innerHTML = draft.picked.length ? draft.picked.map((id) => `<div class="p"><span>${esc(HOOKS[id].text)}</span><button type="button" class="btn sm" data-unhook="${id}" aria-label="Tirar gancho">Tirar</button></div>`).join('') : '<div class="none">Nenhum gancho marcado ainda.</div>';
}

function update(root) {
  $('#motionBox', root).hidden = draft.formato !== 'Vídeo motion';
  $('#p-brief', root).textContent = brief();
  const items = [['Formato e objetivo', !!(draft.formato && draft.objetivo)], ['Curso ou tema', !!draft.curso], ['Ideia', !!draft.ideia], ...(draft.formato === 'Vídeo motion' ? [['Erro que a história derruba', !!draft.erro]] : []), ['Ganchos marcados (' + draft.picked.length + '/3)', draft.picked.length > 0]];
  $('#p-check', root).innerHTML = items.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${esc(t)}</li>`).join('');
  const extras = ['publico', 'entrega', 'prova', 'refs', 'cta', 'restricoes', 'voz'].filter((k) => draft[k]).length;
  $('#p-count', root).textContent = extras ? extras + ' detalhe' + (extras > 1 ? 's' : '') + ' extra' + (extras > 1 ? 's' : '') : '';
  saveDraft();
}

function readForm(root) {
  const f = $('#pf', root);
  $$('input[type=radio]:checked', f).forEach((r) => (draft[r.name] = r.value));
  $$('input[type=text],textarea', f).forEach((el) => (draft[el.name] = el.value.trim()));
  $$('input[type=checkbox]', f).forEach((el) => (draft[el.name] = el.checked));
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
  const p = store.put('pautas', { ...(old || {}), titulo: titleOf(draft), form, brief: brief(), status: old?.status || 'Briefing pronto', ...extra });
  draft._id = p.id; saveDraft();
  return p;
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.ptab) { tab = ds.ptab; ctx.refresh(); return; }
    if (ds.popen) { const p = store.get('pautas', ds.popen); draft = { ...BLANK, ...p.form, _id: p.id }; saveDraft(); tab = 'nova'; ctx.refresh(); return; }
    if (ds.pdel) { if (!confirmButton(b, 'Confirmar')) return; store.remove('pautas', ds.pdel); ctx.refresh(); return; }
    if (ds.cat) { cat = ds.cat; $$('[data-cat]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderHooks(root); return; }
    if (ds.hook !== undefined || ds.unhook !== undefined) {
      const id = Number(ds.hook ?? ds.unhook);
      const i = draft.picked.indexOf(id);
      if (i >= 0) draft.picked.splice(i, 1);
      else { if (draft.picked.length >= 3) { toast('Já tem 3 ganchos marcados. Tire um para trocar.', 'warn'); return; } draft.picked.push(id); }
      renderHooks(root); update(root); return;
    }
    if (ds.pact === 'copy') { if (!draft.curso && !draft.ideia) { toast('Escreva pelo menos o curso ou a ideia.', 'warn'); $('#p-ideia', root).focus(); return; } copyText(brief(), $('#p-brief', root)); if (draft._id) store.put('pautas', { ...store.get('pautas', draft._id), brief: brief() }); return; }
    if (ds.pact === 'save') { if (!draft.curso && !draft.ideia) { toast('Escreva pelo menos o curso ou a ideia.', 'warn'); return; } savePauta(); toast('Pauta salva no banco.'); return; }
    if (ds.pact === 'clear') { draft = { ...BLANK }; saveDraft(); ctx.refresh(); toast('Pauta nova. Pode começar.'); return; }
    if (ds.pact === 'agendar') {
      if (!draft.curso && !draft.ideia) { toast('Escreva pelo menos o curso ou a ideia.', 'warn'); $('#p-ideia', root).focus(); return; }
      scheduleDialog(ctx);
    }
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.pstatus) { const p = store.get('pautas', e.target.dataset.pstatus); store.put('pautas', { ...p, status: e.target.value }); toast('Status atualizado.'); }
  });
  const f = $('#pf', root);
  if (!f) return;
  f.addEventListener('input', () => { readForm(root); update(root); });
  f.addEventListener('change', () => { readForm(root); update(root); });
  f.addEventListener('submit', (e) => e.preventDefault());
  $('#p-q', root).addEventListener('input', (e) => { hq = e.target.value; renderHooks(root); });
  renderHooks(root); update(root);
  void badge; void num;
}
