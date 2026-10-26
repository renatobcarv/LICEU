// Metas e estratégias: o que queremos alcançar, por qual caminho (funis) e o que vamos testar.
// "Estratégias" do LICEU e "ideias, melhorias, testes" viraram uma lista só, priorizada por nota.

import { store } from '../store.js';
import { esc, $, $$, today, monthStart, monthEnd, fmtDate, num, brl2, addDays } from '../util.js';
import { INDICATORS, IND, goalProgress, courseName, campaignName, campaignRows } from '../metrics.js';
import { openDialog, toast, meter, badge, ICON, empty, confirmButton } from '../ui.js';

let tab = 'metas';
let ideaFilter = 'abertas';

const IDEA_STATUS = ['Ideia', 'Priorizada', 'Em teste', 'Validada', 'Descartada'];
const IDEA_TIPOS = ['Teste de anúncio', 'Teste de conteúdo', 'Melhoria no atendimento', 'Novo funil', 'Processo interno', 'Parceria / ação local', 'Outro'];
const FUNNEL_STATUS = ['Rascunho', 'Ativo', 'Pausado', 'Encerrado'];

const TEMPLATES = {
  anuncio: { nome: 'Anúncio → WhatsApp → Matrícula', objetivo: 'Matrículas com custo controlado', etapas: [
    { nome: 'Anúncio de mensagem', canal: 'Meta Ads', peca: 'Reels com gancho do erro comum', metrica: 'Custo por conversa', meta: 'até R$ 8' },
    { nome: 'Primeira resposta', canal: 'WhatsApp', peca: 'Resposta pronta de boas-vindas + pergunta de qualificação', metrica: 'Tempo de resposta', meta: 'até 5 min' },
    { nome: 'Qualificação', canal: 'WhatsApp', peca: 'Datas da turma, valor e forma de pagamento', metrica: 'Conversa → qualificado', meta: '50%' },
    { nome: 'Visita ou aula experimental', canal: 'Presencial', peca: 'Convite para conhecer o laboratório', metrica: 'Qualificado → negociação', meta: '40%' },
    { nome: 'Matrícula', canal: 'Secretaria', peca: 'Link de pagamento', metrica: 'Negociação → matrícula', meta: '60%' }] },
  organico: { nome: 'Conteúdo → palavra-chave → DM → WhatsApp', objetivo: 'Leads orgânicos sem custo de mídia', etapas: [
    { nome: 'Post com palavra-chave', canal: 'Instagram', peca: 'Carrossel educativo com CTA "comente CHECKLIST"', metrica: 'Comentários', meta: '30 por post' },
    { nome: 'Entrega na DM', canal: 'Instagram Direct', peca: 'Material gratuito + pergunta sobre o curso', metrica: 'Respostas na DM', meta: '40%' },
    { nome: 'Levar para o WhatsApp', canal: 'WhatsApp', peca: 'Link do WhatsApp com mensagem pronta', metrica: 'Leads registrados', meta: '20 por mês' },
    { nome: 'Matrícula', canal: 'WhatsApp / secretaria', peca: 'Datas e condição da turma', metrica: 'Lead → matrícula', meta: '15%' }] },
  remarketing: { nome: 'Remarketing de quem já conversou', objetivo: 'Recuperar leads que esfriaram', etapas: [
    { nome: 'Público de quem interagiu', canal: 'Meta Ads', peca: 'Depoimento real de aluna + prova da aula prática', metrica: 'Custo por conversa', meta: 'até R$ 5' },
    { nome: 'Lista de perdidos por preço ou tempo', canal: 'WhatsApp', peca: 'Mensagem de recuperação com condição real', metrica: 'Respostas', meta: '25%' },
    { nome: 'Matrícula', canal: 'Secretaria', peca: 'Fechamento', metrica: 'Recuperados', meta: '5 por turma' }] },
};

export function render(ctx) {
  const p = ctx.params;
  if (p.ideia) { tab = 'ideias'; setTimeout(() => ideaFromParams(p, ctx), 0); history.replaceState(null, '', '#metas'); }
  const tabs = [['metas', 'Metas'], ['funis', 'Funis'], ['ideias', 'Ideias e testes']];
  return `<div class="toolbar"><div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" class="tab" role="tab" data-mtab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div><span class="grow"></span>
    ${tab === 'metas' ? `<button class="btn primary" data-mact="goal">${ICON.plus} Nova meta</button>` : tab === 'funis' ? `<button class="btn primary" data-mact="funnel">${ICON.plus} Novo funil</button>` : `<button class="btn primary" data-mact="idea">${ICON.plus} Nova ideia ou teste</button>`}</div>
  ${tab === 'metas' ? goals() : tab === 'funis' ? funnels() : ideas()}`;
}

// ---------- metas ----------
function goals() {
  const t = today();
  const list = store.all('goals').map((g) => ({ g, p: goalProgress(g) }));
  const ativas = list.filter(({ g }) => g.fim >= t).sort((a, b) => a.g.fim.localeCompare(b.g.fim));
  const passadas = list.filter(({ g }) => g.fim < t).sort((a, b) => b.g.fim.localeCompare(a.g.fim));
  if (!list.length) return empty('Nenhuma meta cadastrada', 'Cadastre metas de matrículas, custo por lead, publicações ou seguidores. O progresso é calculado sozinho a partir dos dados do painel.');
  const card = ({ g, p }) => `<article class="card goal">
    <header class="card-head"><div><p class="eyebrow">${esc(p.ind.label)}${g.cursoId ? ' · ' + esc(courseName(g.cursoId)) : ''}</p><h3>${esc(g.nome)}</h3></div><button class="btn sm" data-goal="${esc(g.id)}">Editar</button></header>
    <p class="big">${esc(p.ind.fmt(p.atual))} <small>${p.ind.dir === 'down' ? 'limite' : 'de'} ${esc(p.ind.fmt(p.alvo))}</small></p>
    ${meter(p.progresso, p.status)}
    <p class="goal-status ${p.status}">${esc(p.texto)}</p>
    <p class="hint">${fmtDate(g.inicio)} a ${fmtDate(g.fim)} · ${Math.round(p.tempo * 100)}% do prazo passou${g.indicador === 'manual' ? ' · atualizado à mão' : ' · calculado automaticamente'}</p>
    ${g.notas ? `<p class="small">${esc(g.notas)}</p>` : ''}
  </article>`;
  return `<div class="cards">${ativas.map(card).join('') || '<p class="empty-sm">Nenhuma meta em andamento.</p>'}</div>
  ${passadas.length ? `<details class="more"><summary>Metas encerradas (${passadas.length})</summary><div class="cards">${passadas.map(card).join('')}</div></details>` : ''}`;
}

function goalDialog(g, ctx) {
  const t = today();
  const isNew = !g;
  g = g || { indicador: 'matriculas', inicio: monthStart(t), fim: monthEnd(t) };
  const { dlg } = openDialog({
    title: isNew ? 'Nova meta' : 'Editar meta',
    fields: [
      { name: 'nome', label: 'Nome da meta', value: g.nome, required: true, full: true, placeholder: 'ex.: 15 matrículas em Enfermagem em novembro' },
      { name: 'indicador', label: 'Indicador', type: 'select', options: INDICATORS.map((i) => [i.id, i.label]), value: g.indicador },
      { name: 'alvo', label: 'Valor alvo', type: 'number', value: g.alvo, required: true, hint: 'Para conversão, use fração: 0,15 = 15%.' },
      { name: 'inicio', label: 'De', type: 'date', value: g.inicio, required: true },
      { name: 'fim', label: 'Até', type: 'date', value: g.fim, required: true },
      { name: 'cursoId', label: 'Só deste curso (opcional)', type: 'select', options: [['', 'Todos os cursos'], ...store.all('courses').map((c) => [c.id, c.nome])], value: g.cursoId },
      { name: 'atualManual', label: 'Valor atual (só para "Outro")', type: 'number', value: g.atualManual },
      { name: 'notas', label: 'Como vamos chegar lá', type: 'textarea', value: g.notas, full: true },
    ],
    onSave: (d) => { if (d.inicio > d.fim) { toast('A data inicial é depois da final.', 'bad'); return false; } store.put('goals', { ...g, ...d }); toast('Meta salva.'); ctx.refresh(); },
    onDelete: isNew ? null : () => { store.remove('goals', g.id); ctx.refresh(); },
  });
  const sync = () => { const ind = $('#f_indicador', dlg).value; $('#f_atualManual', dlg).closest('.field').hidden = ind !== 'manual'; };
  $('#f_indicador', dlg).addEventListener('change', sync); sync();
}

// ---------- funis ----------
function funnels() {
  const list = store.all('funnels').sort((a, b) => FUNNEL_STATUS.indexOf(a.status) - FUNNEL_STATUS.indexOf(b.status));
  return `<div class="row-actions"><span class="muted">Começar de um modelo:</span>${Object.entries(TEMPLATES).map(([k, v]) => `<button class="btn sm" data-tpl="${k}">${esc(v.nome)}</button>`).join('')}</div>
  ${list.length ? `<div class="cards wide">${list.map((fn) => `<article class="card funnel-plan">
    <header class="card-head"><div><p class="eyebrow">${esc(fn.status || 'Rascunho')}${fn.cursoId ? ' · ' + esc(courseName(fn.cursoId)) : ''}</p><h3>${esc(fn.nome)}</h3>${fn.objetivo ? `<p class="muted">${esc(fn.objetivo)}</p>` : ''}</div><button class="btn sm" data-fn="${esc(fn.id)}">Editar</button></header>
    <ol class="flow">${(fn.etapas || []).map((e, i) => `<li><span class="flow-n">${i + 1}</span><div><b>${esc(e.nome)}</b><small>${esc(e.canal || '')}${e.peca ? ' · ' + esc(e.peca) : ''}</small>${e.metrica ? `<small class="flow-m">${esc(e.metrica)}${e.meta ? ': ' + esc(e.meta) : ''}</small>` : ''}</div></li>`).join('')}</ol>
    ${fn.publico ? `<p class="hint">Público: ${esc(fn.publico)}</p>` : ''}
  </article>`).join('')}</div>` : empty('Nenhum funil planejado', 'Escolha um modelo acima e ajuste as etapas para o curso. Cada etapa tem a peça, o canal e a métrica que mostra se está funcionando.')}`;
}

function funnelDialog(fn, ctx) {
  const isNew = !fn?.id;
  fn = fn || { status: 'Rascunho', etapas: [{}] };
  let etapas = (fn.etapas || []).map((e) => ({ ...e }));
  const stepsHTML = () => etapas.map((e, i) => `<fieldset class="step-row"><legend>Etapa ${i + 1}</legend>
    ${[['nome', 'Etapa'], ['canal', 'Canal'], ['peca', 'Peça ou ação'], ['metrica', 'Métrica'], ['meta', 'Meta']].map(([k, l]) => `<div class="field"><label for="st_${i}_${k}">${l}</label><input id="st_${i}_${k}" data-step="${i}" data-k="${k}" value="${esc(e[k] || '')}"></div>`).join('')}
    <button type="button" class="btn sm ghost" data-rmstep="${i}">Remover etapa</button></fieldset>`).join('');
  const { dlg } = openDialog({
    title: isNew ? 'Novo funil' : 'Editar funil', wide: true,
    fields: [
      { name: 'nome', label: 'Nome', value: fn.nome, required: true, full: true },
      { name: 'objetivo', label: 'Objetivo', value: fn.objetivo, full: true },
      { name: 'cursoId', label: 'Curso', type: 'select', options: [['', 'Vários'], ...store.all('courses').map((c) => [c.id, c.nome])], value: fn.cursoId },
      { name: 'status', label: 'Status', type: 'select', options: FUNNEL_STATUS, value: fn.status },
      { name: 'publico', label: 'Público', value: fn.publico, full: true },
    ],
    html: `<div id="steps">${stepsHTML()}</div><button type="button" class="btn sm" id="addstep">${ICON.plus} Adicionar etapa</button>`,
    onSave: (d) => { store.put('funnels', { ...fn, ...d, etapas: etapas.filter((e) => e.nome) }); toast('Funil salvo.'); ctx.refresh(); },
    onDelete: isNew ? null : () => { store.remove('funnels', fn.id); ctx.refresh(); },
  });
  const box = $('#steps', dlg);
  const rebind = () => {
    $$('[data-step]', box).forEach((inp) => inp.addEventListener('input', () => { etapas[Number(inp.dataset.step)][inp.dataset.k] = inp.value; }));
    $$('[data-rmstep]', box).forEach((b) => b.addEventListener('click', () => { etapas.splice(Number(b.dataset.rmstep), 1); box.innerHTML = stepsHTML(); rebind(); }));
  };
  rebind();
  $('#addstep', dlg).addEventListener('click', () => { etapas.push({}); box.innerHTML = stepsHTML(); rebind(); $$('[data-k="nome"]', box).pop().focus(); });
}

// ---------- ideias e testes ----------
const score = (i) => Math.round(((Number(i.impacto) || 0) + (Number(i.confianca) || 0) + (Number(i.facilidade) || 0)) / 3 * 10) / 10;

function ideas() {
  const all = store.all('ideas');
  const open = (i) => !['Validada', 'Descartada'].includes(i.status);
  const list = all.filter((i) => ideaFilter === 'todas' || (ideaFilter === 'abertas' ? open(i) : i.status === ideaFilter))
    .sort((a, b) => (['Em teste', 'Priorizada', 'Ideia', 'Validada', 'Descartada'].indexOf(a.status) - ['Em teste', 'Priorizada', 'Ideia', 'Validada', 'Descartada'].indexOf(b.status)) || score(b) - score(a));
  const filters = [['abertas', 'Abertas'], ['Em teste', 'Em teste'], ['Validada', 'Validadas'], ['Descartada', 'Descartadas'], ['todas', 'Todas']];
  return `<p class="note">Nota de prioridade = média de impacto, confiança e facilidade (1 a 10). Teste primeiro o que tem nota alta. Ao terminar, registre o resultado: é o que vira a memória da operação.</p>
  <div class="chips" role="group" aria-label="Filtro">${filters.map(([v, l]) => `<button type="button" class="chip" data-ifil="${esc(v)}" aria-pressed="${ideaFilter === v}">${l} <span class="count">${v === 'todas' ? all.length : v === 'abertas' ? all.filter(open).length : all.filter((i) => i.status === v).length}</span></button>`).join('')}</div>
  ${list.length ? `<div class="cards wide">${list.map((i) => `<article class="card idea">
    <header class="card-head"><div><p class="eyebrow">${esc(i.tipo || 'Ideia')}${i.campanhaId ? ' · ' + esc(campaignName(i.campanhaId)) : ''}${i.prazo ? ' · até ' + fmtDate(i.prazo) : ''}</p><h3>${esc(i.titulo)}</h3></div>
      <div class="idea-score" title="Nota de prioridade"><b>${score(i) || '—'}</b><small>prioridade</small></div></header>
    <div class="row-actions">${badge(i.status, i.status === 'Validada' ? 'good' : i.status === 'Descartada' ? 'neutral' : i.status === 'Em teste' ? 'warn' : '')}${i.indicador ? `<span class="muted small">Indicador: ${esc(i.indicador)}</span>` : ''}</div>
    ${i.hipotese ? `<p><b class="small-label">Hipótese</b> ${esc(i.hipotese)}</p>` : ''}
    ${i.resultado ? `<p><b class="small-label">Resultado</b> ${esc(i.resultado)}</p>` : ''}
    ${i.proximaAcao ? `<p><b class="small-label">Próxima ação</b> ${esc(i.proximaAcao)}</p>` : ''}
    <div class="row-actions"><button class="btn sm" data-idea="${esc(i.id)}">Editar</button>${i.status === 'Ideia' || i.status === 'Priorizada' ? `<button class="btn sm ghost" data-istart="${esc(i.id)}">Começar teste</button>` : ''}</div>
  </article>`).join('')}</div>` : '<p class="empty-sm">Nada neste filtro.</p>'}`;
}

function ideaDialog(i, ctx) {
  const isNew = !i?.id;
  i = { status: 'Ideia', impacto: 5, confianca: 5, facilidade: 5, ...(i || {}) };
  openDialog({
    title: isNew ? 'Nova ideia ou teste' : 'Editar', wide: true,
    fields: [
      { name: 'titulo', label: 'O que vamos fazer', value: i.titulo, required: true, full: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: IDEA_TIPOS, value: i.tipo },
      { name: 'status', label: 'Status', type: 'select', options: IDEA_STATUS, value: i.status },
      { name: 'campanhaId', label: 'Campanha relacionada', type: 'select', options: [['', 'Nenhuma'], ...store.all('campaigns').map((c) => [c.id, c.nome])], value: i.campanhaId },
      { name: 'indicador', label: 'Indicador que decide', type: 'select', options: ['', 'CAC de mídia', 'Custo por conversa', 'CTR', 'Conversão lead → matrícula', 'Tempo de resposta', 'Matrículas', 'Comentários / salvamentos', 'Seguidores'], value: i.indicador },
      { name: 'impacto', label: 'Impacto (1 a 10)', type: 'number', value: i.impacto },
      { name: 'confianca', label: 'Confiança (1 a 10)', type: 'number', value: i.confianca },
      { name: 'facilidade', label: 'Facilidade (1 a 10)', type: 'number', value: i.facilidade },
      { name: 'prazo', label: 'Prazo', type: 'date', value: i.prazo },
      { name: 'hipotese', label: 'Hipótese: se fizermos X, esperamos Y, porque Z', type: 'textarea', value: i.hipotese, full: true },
      { name: 'resultado', label: 'Resultado observado', type: 'textarea', value: i.resultado, full: true },
      { name: 'proximaAcao', label: 'Próxima ação', value: i.proximaAcao, full: true },
    ],
    onSave: (d) => { store.put('ideas', { ...i, ...d }); toast('Salvo.'); ctx.refresh(); },
    onDelete: isNew ? null : () => { store.remove('ideas', i.id); ctx.refresh(); },
  });
}

function ideaFromParams(p, ctx) {
  const t = today();
  const c = p.c ? store.get('campaigns', p.c) : null;
  if (p.ideia === 'escalar' && c) {
    const r = campaignRows(addDays(t, -29), t, {}).find((x) => x.id === c.id);
    return ideaDialog({ titulo: 'Aumentar 20% a verba de ' + c.nome, tipo: 'Teste de anúncio', campanhaId: c.id, indicador: 'CAC de mídia', impacto: 7, confianca: 6, facilidade: 9, prazo: addDays(t, 7), hipotese: 'A campanha tem o menor CAC. Com 20% a mais de verba, o CAC deve subir menos de 15%.', resultado: r ? 'Ponto de partida (30 dias): CAC ' + brl2(r.cac) + ' com ' + num(r.matriculas) + ' matrículas.' : '' }, ctx);
  }
  if (p.ideia === 'campanha' && c) return ideaDialog({ titulo: 'Teste em ' + c.nome, tipo: 'Teste de anúncio', campanhaId: c.id, indicador: 'Custo por conversa', prazo: addDays(t, 7) }, ctx);
  if (p.ideia === 'resposta') return ideaDialog({ titulo: 'Resposta automática fora do horário no WhatsApp', tipo: 'Melhoria no atendimento', indicador: 'Tempo de resposta', impacto: 7, confianca: 6, facilidade: 8, hipotese: 'Responder em segundos fora do expediente evita que o lead esfrie até o dia seguinte.' }, ctx);
  return ideaDialog(null, ctx);
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.mtab) { tab = ds.mtab; ctx.refresh(); return; }
    if (ds.mact === 'goal') return goalDialog(null, ctx);
    if (ds.mact === 'funnel') return funnelDialog(null, ctx);
    if (ds.mact === 'idea') return ideaDialog(null, ctx);
    if (ds.goal) return goalDialog(store.get('goals', ds.goal), ctx);
    if (ds.fn) return funnelDialog(store.get('funnels', ds.fn), ctx);
    if (ds.tpl) { const tp = TEMPLATES[ds.tpl]; return funnelDialog({ ...tp, status: 'Rascunho', etapas: tp.etapas.map((x) => ({ ...x })) }, ctx); }
    if (ds.idea) return ideaDialog(store.get('ideas', ds.idea), ctx);
    if (ds.istart) { const i = store.get('ideas', ds.istart); store.put('ideas', { ...i, status: 'Em teste', inicioTeste: today() }); toast('Teste iniciado. Registre o resultado ao fim do prazo.'); ctx.refresh(); return; }
    if (ds.ifil) { ideaFilter = ds.ifil; ctx.refresh(); }
  });
  void IND; void confirmButton;
}
