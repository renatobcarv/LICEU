// Metas e estratégias: o que queremos alcançar (metas), por qual caminho (funis em Kanban)
// e o que estamos testando (ideias e testes em Kanban, medidos contra a linha de base).

import { store } from '../store.js';
import { esc, $, $$, today, monthStart, monthEnd, fmtDate, num, brl2, addDays, daysBetween } from '../util.js';
import { INDICATORS, goalProgress, courseName, campaignName, campaignRows, STAGES, STAGE_IDX, TEST_INDICATORS, TEST_IND, measureTest } from '../metrics.js';
import { openDialog, toast, meter, badge, ICON, empty } from '../ui.js';
import { ice } from './painel.js';
import { pipelines, leadPipeId, leadCol } from '../leads.js';

let tab = 'metas';

const IDEA_COLS = ['Ideia', 'Priorizada', 'Em teste', 'Concluído'];
const IDEA_TIPOS = ['Teste de anúncio', 'Teste de conteúdo', 'Melhoria no atendimento', 'Novo funil', 'Oferta ou preço', 'Processo interno', 'Parceria ou ação local', 'Outro'];
const DECISOES = ['', 'Escalar', 'Manter', 'Ajustar e testar de novo', 'Descartar'];
const FUNNEL_STATUS = ['Rascunho', 'Ativo', 'Pausado', 'Encerrado'];

const TEMPLATES = {
  anuncio: { nome: 'Anúncio → WhatsApp → Matrícula', objetivo: 'Matrículas com custo controlado', etapas: [
    { nome: 'Anúncio de mensagem', canal: 'Meta Ads', peca: 'Reels com gancho do erro comum', metrica: 'Custo por conversa', meta: 'até R$ 8', estagio: '' },
    { nome: 'Primeira resposta', canal: 'WhatsApp', peca: 'Boas-vindas + pergunta de qualificação', metrica: 'Tempo de resposta', meta: 'até 5 min', estagio: 'novo' },
    { nome: 'Conversa', canal: 'WhatsApp', peca: 'Datas da turma, valor e forma de pagamento', metrica: 'Novo → em conversa', meta: '70%', estagio: 'conversa' },
    { nome: 'Qualificação', canal: 'WhatsApp', peca: 'Convite para conhecer o laboratório', metrica: 'Conversa → qualificado', meta: '50%', estagio: 'qualificado' },
    { nome: 'Negociação', canal: 'Presencial ou WhatsApp', peca: 'Condição da turma e link de pagamento', metrica: 'Qualificado → negociação', meta: '60%', estagio: 'negociacao' },
    { nome: 'Matrícula', canal: 'Secretaria', peca: 'Contrato e boas-vindas', metrica: 'Negociação → matrícula', meta: '60%', estagio: 'matriculado' }] },
  organico: { nome: 'Conteúdo → palavra-chave → DM → WhatsApp', objetivo: 'Conversas orgânicas sem custo de mídia', etapas: [
    { nome: 'Post com palavra-chave', canal: 'Instagram', peca: 'Carrossel educativo com CTA "comente CHECKLIST"', metrica: 'Comentários', meta: '30 por post', estagio: '' },
    { nome: 'Entrega na DM', canal: 'Instagram Direct', peca: 'Material gratuito + pergunta sobre o curso', metrica: 'Respostas na DM', meta: '40%', estagio: '' },
    { nome: 'Levar para o WhatsApp', canal: 'WhatsApp', peca: 'Link com mensagem pronta', metrica: 'Conversas no funil', meta: '20 por mês', estagio: 'novo' },
    { nome: 'Matrícula', canal: 'WhatsApp ou secretaria', peca: 'Datas e condição da turma', metrica: 'Conversa → matrícula', meta: '15%', estagio: 'matriculado' }] },
  remarketing: { nome: 'Recuperar quem já conversou', objetivo: 'Trazer de volta leads que esfriaram', etapas: [
    { nome: 'Público de quem interagiu', canal: 'Meta Ads', peca: 'Depoimento real + aula prática', metrica: 'Custo por conversa', meta: 'até R$ 5', estagio: '' },
    { nome: 'Lista de perdidos por preço ou horário', canal: 'WhatsApp', peca: 'Mensagem de recuperação com condição real', metrica: 'Respostas', meta: '25%', estagio: 'perdido' },
    { nome: 'Negociação', canal: 'WhatsApp', peca: 'Nova condição', metrica: 'Recuperados em negociação', meta: '10', estagio: 'negociacao' },
    { nome: 'Matrícula', canal: 'Secretaria', peca: 'Fechamento', metrica: 'Recuperados', meta: '5 por turma', estagio: 'matriculado' }] },
};

export function render(ctx) {
  const p = ctx.params;
  if (p.ideia) { tab = 'ideias'; setTimeout(() => ideaFromParams(p, ctx), 0); history.replaceState(null, '', '#metas'); }
  if (p.tab) tab = p.tab;
  const tabs = [['metas', 'Metas'], ['funis', 'Funis'], ['ideias', 'Ideias e testes']];
  const btn = tab === 'metas' ? `<button class="btn primary" data-mact="goal">${ICON.plus} Nova meta</button>` : tab === 'funis' ? `<button class="btn primary" data-mact="funnel">${ICON.plus} Novo funil</button>` : `<button class="btn primary" data-mact="idea">${ICON.plus} Nova ideia</button>`;
  return `<div class="toolbar"><div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" class="tab" role="tab" data-mtab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div><span class="grow"></span>${btn}</div>
  ${tab === 'metas' ? goals() : tab === 'funis' ? funnels() : ideas()}`;
}

// ---------- metas ----------
function goals() {
  const t = today();
  const list = store.all('goals').map((g) => ({ g, p: goalProgress(g) }));
  const ativas = list.filter(({ g }) => g.fim >= t).sort((a, b) => a.g.fim.localeCompare(b.g.fim));
  const passadas = list.filter(({ g }) => g.fim < t).sort((a, b) => b.g.fim.localeCompare(a.g.fim));
  if (!list.length) return empty('Nenhuma meta cadastrada', 'Cadastre metas de matrículas, custo por resultado, publicações ou seguidores. O progresso é calculado sozinho a partir dos dados.');
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
  const sync = () => { $('#f_atualManual', dlg).closest('.field').hidden = $('#f_indicador', dlg).value !== 'manual'; };
  $('#f_indicador', dlg).addEventListener('change', sync); sync();
}

// ---------- funis em Kanban ----------
function liveCount(estagio) {
  if (!estagio) return null;
  const leads = store.all('leads');
  if (estagio === 'perdido') return leads.filter((l) => l.etapa === 'perdido').length;
  return leads.filter((l) => l.etapa === estagio).length;
}

// Visão rápida dos funis comerciais: só leitura, um clique abre o Kanban completo.
function pipesQuick() {
  const leads = store.all('leads');
  const t = today();
  return `<h2 class="sec-title">Funis comerciais <em>agora</em></h2>
  <div class="pipe-quick">${pipelines().map((p) => {
    const mine = leads.filter((l) => leadPipeId(l) === p.id);
    const open = mine.filter((l) => !['matriculado', 'perdido'].includes(l.etapa));
    const ganhosMes = mine.filter((l) => l.etapa === 'matriculado' && (l.dataMatricula || '') >= monthStart(t)).length;
    const cols = p.etapas.map((e) => ({ e, items: open.filter((l) => leadCol(l, p) === e.id) }));
    return `<a class="card pq" href="#funil?pipe=${encodeURIComponent(p.id)}">
      <header class="card-head"><div><h3>${esc(p.nome)}</h3><p class="muted">${open.length} em aberto · ${ganhosMes} ganho${ganhosMes === 1 ? '' : 's'} no mês</p></div><span class="btn sm">Abrir ${ICON.arrow}</span></header>
      <div class="pq-board">${cols.map(({ e, items }) => `<div class="pq-col${e.limite && items.length > e.limite ? ' over' : ''}"><p class="pq-h"><span>${esc(e.nome)}</span><b>${items.length}${e.limite ? '/' + e.limite : ''}</b></p>${items.slice(0, 3).map((l) => `<p class="pq-card">${esc(l.nome)}</p>`).join('')}${items.length > 3 ? `<p class="pq-more">+${items.length - 3}</p>` : ''}</div>`).join('')}
        <div class="pq-col win"><p class="pq-h"><span>Ganho</span><b>${ganhosMes}</b></p></div></div>
    </a>`;
  }).join('')}</div>
  <h2 class="sec-title">Funis <em>planejados</em></h2>`;
}

function funnels() {
  const list = store.all('funnels').sort((a, b) => FUNNEL_STATUS.indexOf(a.status) - FUNNEL_STATUS.indexOf(b.status));
  return `${pipesQuick()}<div class="row-actions"><span class="muted">Começar de um modelo:</span>${Object.entries(TEMPLATES).map(([k, v]) => `<button class="btn sm" data-tpl="${k}">${esc(v.nome)}</button>`).join('')}</div>
  ${list.length ? list.map((fn) => `<section class="card funnel-board">
    <header class="card-head"><div><p class="eyebrow">${esc(fn.status || 'Rascunho')}${fn.cursoId ? ' · ' + esc(courseName(fn.cursoId)) : ''}</p><h2>${esc(fn.nome)}</h2>${fn.objetivo ? `<p class="muted">${esc(fn.objetivo)}${fn.publico ? ' · Público: ' + esc(fn.publico) : ''}</p>` : ''}</div><div class="row-actions"><a class="btn sm" href="#funil">Abrir funil comercial</a><button class="btn sm" data-fn="${esc(fn.id)}">Editar</button></div></header>
    <div class="board kanban-plan">${(fn.etapas || []).map((e, i) => { const n = liveCount(e.estagio); return `<section class="col"><header><h3><span class="flow-n">${i + 1}</span>${esc(e.nome)}</h3>${n !== null ? `<span class="count" title="Pessoas nesta etapa agora">${n}</span>` : ''}</header>
      <div class="col-body"><article class="lead plan-card">${e.canal ? `<p class="lead-meta">${esc(e.canal)}</p>` : ''}${e.peca ? `<p>${esc(e.peca)}</p>` : ''}${e.metrica ? `<p class="plan-m"><span>${esc(e.metrica)}</span>${e.meta ? `<b>${esc(e.meta)}</b>` : ''}</p>` : ''}${e.estagio ? `<p class="lead-meta">Ligado à etapa <b>${esc(e.estagio === 'perdido' ? 'Perdido' : STAGES[STAGE_IDX[e.estagio]]?.label)}</b> do funil</p>` : ''}</article></div></section>`; }).join('')}</div>
  </section>`).join('') : empty('Nenhum funil planejado', 'Escolha um modelo acima. Cada etapa vira uma coluna com a peça, o canal e a métrica. Ligue a etapa ao funil comercial para ver quantas pessoas estão nela agora.')}`;
}

function funnelDialog(fn, ctx) {
  const isNew = !fn?.id;
  fn = fn || { status: 'Rascunho', etapas: [{}] };
  const etapas = (fn.etapas || []).map((e) => ({ ...e }));
  const estOpts = [['', 'Nenhuma'], ...STAGES.map((s) => [s.id, s.label]), ['perdido', 'Perdido']];
  const stepsHTML = () => etapas.map((e, i) => `<fieldset class="step-row"><legend>Coluna ${i + 1}</legend>
    ${[['nome', 'Etapa'], ['canal', 'Canal'], ['peca', 'Peça ou ação'], ['metrica', 'Métrica'], ['meta', 'Meta']].map(([k, l]) => `<div class="field"><label for="st_${i}_${k}">${l}</label><input id="st_${i}_${k}" data-step="${i}" data-k="${k}" value="${esc(e[k] || '')}"></div>`).join('')}
    <div class="field"><label for="st_${i}_estagio">Ligar à etapa do funil</label><select id="st_${i}_estagio" data-step="${i}" data-k="estagio">${estOpts.map(([v, l]) => `<option value="${v}"${v === (e.estagio || '') ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="row-actions">${i ? `<button type="button" class="btn sm ghost" data-up="${i}">Mover para a esquerda</button>` : ''}<button type="button" class="btn sm ghost" data-rmstep="${i}">Remover coluna</button></div></fieldset>`).join('');
  const { dlg } = openDialog({
    title: isNew ? 'Novo funil' : 'Editar funil', wide: true,
    fields: [
      { name: 'nome', label: 'Nome', value: fn.nome, required: true, full: true },
      { name: 'objetivo', label: 'Objetivo', value: fn.objetivo, full: true },
      { name: 'cursoId', label: 'Curso', type: 'select', options: [['', 'Vários'], ...store.all('courses').map((c) => [c.id, c.nome])], value: fn.cursoId },
      { name: 'status', label: 'Status', type: 'select', options: FUNNEL_STATUS, value: fn.status },
      { name: 'publico', label: 'Público', value: fn.publico, full: true },
    ],
    html: `<div id="steps">${stepsHTML()}</div><button type="button" class="btn sm" id="addstep">${ICON.plus} Adicionar coluna</button>`,
    onSave: (d) => { store.put('funnels', { ...fn, ...d, etapas: etapas.filter((e) => e.nome) }); toast('Funil salvo.'); ctx.refresh(); },
    onDelete: isNew ? null : () => { store.remove('funnels', fn.id); ctx.refresh(); },
  });
  const box = $('#steps', dlg);
  const rebind = () => {
    $$('[data-step]', box).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { etapas[Number(inp.dataset.step)][inp.dataset.k] = inp.value; }));
    $$('[data-rmstep]', box).forEach((b) => b.addEventListener('click', () => { etapas.splice(Number(b.dataset.rmstep), 1); box.innerHTML = stepsHTML(); rebind(); }));
    $$('[data-up]', box).forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.up); [etapas[i - 1], etapas[i]] = [etapas[i], etapas[i - 1]]; box.innerHTML = stepsHTML(); rebind(); }));
  };
  rebind();
  $('#addstep', dlg).addEventListener('click', () => { etapas.push({}); box.innerHTML = stepsHTML(); rebind(); $$('[data-k="nome"]', box).pop().focus(); });
}

// ---------- ideias e testes em Kanban ----------
function ideaCard(i) {
  const m = i.status === 'Em teste' || i.status === 'Concluído' ? measureTest(i) : null;
  const t = today();
  const ind = TEST_IND[i.indicador];
  return `<article class="lead idea-card" draggable="true" data-drag="${esc(i.id)}">
    <button type="button" class="lead-open" data-idea="${esc(i.id)}"><b>${esc(i.titulo)}</b><small>${esc(i.tipo || 'Ideia')}${i.campanhaId ? ' · ' + esc(campaignName(i.campanhaId)) : ''}</small></button>
    <div class="idea-row"><span class="ice" title="Nota de prioridade (impacto, confiança, facilidade)">${ice(i) || '—'}</span>${ind ? `<span class="lead-meta">${esc(ind.label)}</span>` : '<span class="lead-meta bad">Sem indicador</span>'}</div>
    ${m && !m.erro ? `<p class="measure"><span>${esc(m.ind.fmt(m.base))}</span>${ICON.arrow}<b>${esc(m.ind.fmt(m.cur))}</b>${m.delta !== null ? `<em class="${m.improved ? 'good' : 'bad'}">${m.delta > 0 ? '+' : ''}${(m.delta * 100).toFixed(0)}%</em>` : ''}</p>` : m?.erro ? `<p class="lead-meta bad">${esc(m.erro)}</p>` : ''}
    ${i.status === 'Em teste' && i.fimTeste ? `<p class="lead-meta">${i.fimTeste < t ? '<span class="bad">Prazo terminou: registre a decisão</span>' : 'Faltam ' + daysBetween(t, i.fimTeste) + ' dias · até ' + fmtDate(i.fimTeste)}</p>` : ''}
    ${i.status === 'Concluído' ? `<p>${badge(i.decisao || 'Sem decisão', i.decisao === 'Escalar' || i.decisao === 'Manter' ? 'good' : i.decisao === 'Descartar' ? 'bad' : 'warn')}</p>${i.aprendizado ? `<p class="lead-next">${esc(i.aprendizado)}</p>` : ''}` : ''}
    <div class="lead-actions">${i.status === 'Ideia' ? `<button type="button" class="btn sm" data-imove="${esc(i.id)}|Priorizada">Priorizar</button>` : i.status === 'Priorizada' ? `<button type="button" class="btn sm" data-imove="${esc(i.id)}|Em teste">Começar teste</button>` : i.status === 'Em teste' ? `<button type="button" class="btn sm" data-imove="${esc(i.id)}|Concluído">Concluir</button>` : ''}</div>
  </article>`;
}

function ideas() {
  const all = store.all('ideas');
  if (!all.length) return empty('Nenhuma ideia ou teste ainda', 'Cada ideia vira um teste com hipótese, indicador e prazo. O sistema mede o indicador durante o teste e compara com o período anterior. Ao terminar, você registra a decisão e o aprendizado.', `<button class="btn primary" data-mact="idea">${ICON.plus} Nova ideia</button>`);
  const conclEm = (i) => i.concluidoEm || i.updatedAt || '';
  return `<p class="note">Arraste entre as colunas. Ao começar um teste, ele passa a ser medido contra o mesmo número de dias anterior ao início. A nota de prioridade é a média de impacto, confiança e facilidade.</p>
  <div class="board ideas-board">${IDEA_COLS.map((c) => {
    let items = all.filter((i) => (i.status === 'Validada' || i.status === 'Descartada' ? 'Concluído' : i.status || 'Ideia') === c);
    items = c === 'Concluído' ? items.sort((a, b) => conclEm(b).localeCompare(conclEm(a))) : items.sort((a, b) => ice(b) - ice(a));
    return `<section class="col" data-drop="${c}"><header><h3>${c}</h3><span class="count">${items.length}</span></header><div class="col-body">${items.map(ideaCard).join('') || '<p class="col-empty">Solte um cartão aqui</p>'}</div></section>`;
  }).join('')}</div>`;
}

function ideaDialog(i, ctx) {
  const isNew = !i?.id;
  i = { status: 'Ideia', impacto: 5, confianca: 5, facilidade: 5, ...(i || {}) };
  const { dlg, form } = openDialog({
    title: isNew ? 'Nova ideia ou teste' : 'Ideia ou teste', wide: true,
    fields: [
      { name: 'titulo', label: 'O que vamos fazer', value: i.titulo, required: true, full: true, placeholder: 'ex.: Esconder o preço no criativo de Injetáveis' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: IDEA_TIPOS, value: i.tipo },
      { name: 'status', label: 'Coluna', type: 'select', options: IDEA_COLS, value: i.status === 'Validada' || i.status === 'Descartada' ? 'Concluído' : i.status },
      { name: 'hipotese', label: 'Hipótese: se fizermos X, esperamos Y, porque Z', type: 'textarea', value: i.hipotese, full: true },
      { name: 'indicador', label: 'Indicador que decide', type: 'select', options: [['', 'Escolha o indicador'], ...TEST_INDICATORS.map((x) => [x.id, x.label])], value: i.indicador },
      { name: 'metaMelhoria', label: 'Melhoria esperada (%)', type: 'number', value: i.metaMelhoria ?? '', hint: 'Ex.: 20 = o indicador precisa melhorar 20% para validar.' },
      { name: 'campanhaId', label: 'Campanha (para indicadores da campanha)', type: 'select', options: [['', 'Nenhuma'], ...store.all('campaigns').map((c) => [c.id, c.nome])], value: i.campanhaId },
      { name: 'cursoId', label: 'Curso (opcional)', type: 'select', options: [['', 'Todos'], ...store.all('courses').map((c) => [c.id, c.nome])], value: i.cursoId },
      { name: 'inicioTeste', label: 'Início do teste', type: 'date', value: i.inicioTeste },
      { name: 'fimTeste', label: 'Fim do teste', type: 'date', value: i.fimTeste },
      { name: 'responsavel', label: 'Responsável', value: i.responsavel },
      { name: 'impacto', label: 'Impacto (1 a 10)', type: 'number', value: i.impacto },
      { name: 'confianca', label: 'Confiança (1 a 10)', type: 'number', value: i.confianca },
      { name: 'facilidade', label: 'Facilidade (1 a 10)', type: 'number', value: i.facilidade },
      { name: 'decisao', label: 'Decisão (ao concluir)', type: 'select', options: DECISOES, value: i.decisao },
      { name: 'resultado', label: 'Resultado observado', type: 'textarea', value: i.resultado, full: true },
      { name: 'aprendizado', label: 'Aprendizado', type: 'textarea', value: i.aprendizado, full: true },
      { name: 'proximaAcao', label: 'Próxima ação', value: i.proximaAcao, full: true },
    ],
    html: '<div class="card measure-box" id="i-measure" hidden></div>',
    onSave: (d) => {
      if (d.inicioTeste && d.fimTeste && d.inicioTeste > d.fimTeste) { toast('O início do teste é depois do fim.', 'bad'); return false; }
      const rec = { ...i, ...d };
      if (rec.status === 'Em teste' && !rec.inicioTeste) rec.inicioTeste = today();
      if (rec.status === 'Concluído' && !i.concluidoEm) rec.concluidoEm = today();
      store.put('ideas', rec); toast('Salvo.'); ctx.refresh();
    },
    onDelete: isNew ? null : () => { store.remove('ideas', i.id); ctx.refresh(); },
  });
  const box = $('#i-measure', dlg);
  const upd = () => {
    const d = {}; ['indicador', 'campanhaId', 'cursoId', 'inicioTeste', 'fimTeste', 'metaMelhoria'].forEach((k) => (d[k] = $('#f_' + k, form).value));
    const m = d.inicioTeste && d.indicador ? measureTest(d) : null;
    box.hidden = !m;
    if (!m) return;
    box.innerHTML = m.erro ? `<p class="bad">${esc(m.erro)}</p>` : `<h3 class="sub-h">Medição automática</h3>
      <dl class="stats wide"><div><dt>Linha de base</dt><dd>${esc(m.ind.fmt(m.base))}<small>${fmtDate(m.baseDe)} a ${fmtDate(m.baseAte)}</small></dd></div>
      <div><dt>Durante o teste</dt><dd>${esc(m.ind.fmt(m.cur))}<small>${fmtDate(d.inicioTeste)} a ${fmtDate(m.ate)}</small></dd></div>
      <div><dt>Variação</dt><dd class="${m.improved ? 'good' : m.improved === false ? 'bad' : ''}">${m.delta === null ? '—' : (m.delta > 0 ? '+' : '') + (m.delta * 100).toFixed(1).replace('.', ',') + '%'}<small>${m.improved === null ? 'sem base para comparar' : m.improved ? 'melhorou' : 'piorou'}${d.metaMelhoria ? ' · meta ' + d.metaMelhoria + '%' + (m.reached ? ' atingida' : ' não atingida') : ''}</small></dd></div></dl>`;
  };
  form.addEventListener('input', upd); form.addEventListener('change', upd); upd();
}

function concludeDialog(i, ctx) {
  const m = measureTest(i);
  const auto = m && !m.erro ? `${m.ind.label}: ${m.ind.fmt(m.base)} antes (${fmtDate(m.baseDe)} a ${fmtDate(m.baseAte)}) e ${m.ind.fmt(m.cur)} durante o teste (${fmtDate(i.inicioTeste)} a ${fmtDate(m.ate)})${m.delta !== null ? ', variação de ' + (m.delta > 0 ? '+' : '') + (m.delta * 100).toFixed(1).replace('.', ',') + '%' : ''}.` : '';
  openDialog({
    title: 'Concluir: ' + i.titulo, saveLabel: 'Concluir teste',
    fields: [
      { name: 'decisao', label: 'Decisão', type: 'select', options: DECISOES.slice(1), value: m?.reached ? 'Escalar' : m?.improved === false ? 'Descartar' : 'Ajustar e testar de novo', required: true },
      { name: 'resultado', label: 'Resultado observado', type: 'textarea', value: i.resultado || auto, full: true },
      { name: 'aprendizado', label: 'O que aprendemos', type: 'textarea', value: i.aprendizado, full: true, required: true },
      { name: 'proximaAcao', label: 'Próxima ação', value: i.proximaAcao, full: true },
    ],
    onSave: (d) => { store.put('ideas', { ...i, ...d, status: 'Concluído', concluidoEm: today(), fimTeste: i.fimTeste || today() }); toast('Teste concluído. O aprendizado fica registrado.'); ctx.refresh(); },
  });
}

function moveIdea(id, col, ctx) {
  const i = store.get('ideas', id);
  if (!i || i.status === col) return;
  if (col === 'Concluído') return concludeDialog(i, ctx);
  const patch = { status: col };
  if (col === 'Em teste') {
    if (!i.indicador) { toast('Escolha o indicador que decide o teste antes de começar.', 'warn'); return ideaDialog({ ...i, status: 'Em teste', inicioTeste: i.inicioTeste || today(), fimTeste: i.fimTeste || addDays(today(), 14) }, ctx); }
    patch.inicioTeste = i.inicioTeste || today();
    patch.fimTeste = i.fimTeste || addDays(today(), 14);
  }
  store.put('ideas', { ...i, ...patch });
  toast(i.titulo + ' → ' + col);
  ctx.refresh();
}

function ideaFromParams(p, ctx) {
  const t = today();
  const c = p.c ? store.get('campaigns', p.c) : null;
  if (p.ideia === 'escalar' && c) {
    const r = campaignRows(addDays(t, -29), t, {}).find((x) => x.id === c.id);
    return ideaDialog({ titulo: 'Aumentar 20% a verba de ' + c.nome, tipo: 'Teste de anúncio', campanhaId: c.id, indicador: 'c_cac', metaMelhoria: 0, impacto: 7, confianca: 6, facilidade: 9, hipotese: 'A campanha tem o menor CAC. Com 20% a mais de verba, o CAC deve se manter.', resultado: r ? 'Ponto de partida (30 dias): CAC ' + brl2(r.cac) + ' com ' + num(r.matriculas) + ' matrículas.' : '' }, ctx);
  }
  if (p.ideia === 'campanha' && c) return ideaDialog({ titulo: 'Teste em ' + c.nome, tipo: 'Teste de anúncio', campanhaId: c.id, indicador: 'c_custoResultado' }, ctx);
  if (p.ideia === 'resposta') return ideaDialog({ titulo: 'Resposta automática fora do horário no WhatsApp', tipo: 'Melhoria no atendimento', indicador: 'tempoResposta', metaMelhoria: 30, hipotese: 'Responder em segundos fora do expediente evita que o lead esfrie até o dia seguinte.' }, ctx);
  return ideaDialog(null, ctx);
}

function bindDrag(root, ctx) {
  let dragId = null;
  $$('.ideas-board [data-drag]', root).forEach((card) => {
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.drag; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (_) { /* ok */ } });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); $$('.col.over', root).forEach((c) => c.classList.remove('over')); });
  });
  $$('.ideas-board [data-drop]', root).forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); const id = dragId || e.dataTransfer.getData('text/plain'); dragId = null; if (id) moveIdea(id, col.dataset.drop, ctx); });
  });
}

export function mount(root, ctx) {
  bindDrag(root, ctx);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.mtab) { tab = ds.mtab; if (ctx.params.tab) history.replaceState(null, '', '#metas'); ctx.params.tab = ''; ctx.refresh(); return; }
    if (ds.mact === 'goal') return goalDialog(null, ctx);
    if (ds.mact === 'funnel') return funnelDialog(null, ctx);
    if (ds.mact === 'idea') return ideaDialog(null, ctx);
    if (ds.goal) return goalDialog(store.get('goals', ds.goal), ctx);
    if (ds.fn) return funnelDialog(store.get('funnels', ds.fn), ctx);
    if (ds.tpl) { const tp = TEMPLATES[ds.tpl]; return funnelDialog({ ...tp, status: 'Rascunho', etapas: tp.etapas.map((x) => ({ ...x })) }, ctx); }
    if (ds.idea) return ideaDialog(store.get('ideas', ds.idea), ctx);
    if (ds.imove) { const [id, col] = ds.imove.split('|'); return moveIdea(id, col, ctx); }
  });
}
