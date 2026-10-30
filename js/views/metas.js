// Metas e estratégias: o que queremos alcançar (metas), por qual caminho (funis em Kanban)
// e o que estamos testando (ideias e testes em Kanban, medidos contra a linha de base).

import { store } from '../store.js';
import { esc, $, $$, today, monthStart, monthEnd, fmtDate, num, brl2, addDays, daysBetween } from '../util.js';
import { INDICATORS, IND, GRUPOS_META, goalProgress, courseName, campaignName, campaignRows, STAGES, STAGE_IDX, TEST_INDICATORS, TEST_IND, measureTest } from '../metrics.js';
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
// Cada tipo de meta tem formulário, conta e card próprios (ver INDICATORS em metrics.js).
const TIPO_ICON = {
  contagem: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>', taxa: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M19 5 5 19"/>',
  custo: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', orcamento: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M16 15h2"/>',
  crescimento: '<path d="m3 17 6-6 4 4 8-8M14 7h7v7"/>', manual: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};
const TIPO_COR = { contagem: 'var(--primary)', taxa: 'var(--chart-2)', custo: 'var(--warning)', orcamento: 'var(--warning)', crescimento: 'var(--success)', manual: 'var(--muted-foreground)' };
const icon = (tipo) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TIPO_ICON[tipo] || TIPO_ICON.manual}</svg>`;

function goalCard({ g, p }) {
  const ind = p.ind;
  const cor = TIPO_COR[p.tipo];
  const head = `<header class="card-head"><div class="goal-h"><span class="goal-ic" style="--gc:${cor}">${icon(p.tipo)}</span><div><p class="eyebrow">${esc(ind.label)}${g.cursoId ? ' · ' + esc(courseName(g.cursoId)) : ''}</p><h3>${esc(g.nome)}</h3></div></div><div class="row-actions">${['manual', 'crescimento'].includes(p.tipo) ? `<button class="btn sm" data-gupd="${esc(g.id)}">Atualizar</button>` : ''}<button class="btn sm ghost" data-goal="${esc(g.id)}">Editar</button></div></header>`;
  const v = (x) => (x === null || x === undefined ? '—' : ind.fmt(x));
  let corpo = '';
  if (p.tipo === 'contagem' || p.tipo === 'manual') {
    corpo = `<p class="big">${v(p.atual)} <small>de ${v(p.alvo)} ${esc(ind.unidade || '')}</small></p>${meter(p.progresso, p.status)}<div class="goal-ritmo"><span class="gr-now" style="left:${Math.min(100, p.tempo * 100)}%" title="Hoje: ${Math.round(p.tempo * 100)}% do prazo"></span></div>`;
  } else if (p.tipo === 'taxa') {
    corpo = `<div class="goal-split"><div><p class="muted">Agora</p><p class="big">${v(p.atual)}</p></div><div><p class="muted">Mínimo</p><p class="big muted-big">${v(p.alvo)}</p></div></div>${meter(p.progresso, p.status)}`;
  } else if (p.tipo === 'custo') {
    corpo = `<div class="goal-split"><div><p class="muted">Custo atual</p><p class="big">${v(p.atual)}</p></div><div><p class="muted">Limite</p><p class="big muted-big">${v(p.alvo)}</p></div></div>${meter(p.progresso, p.status)}`;
  } else if (p.tipo === 'orcamento') {
    corpo = `<p class="big">${v(p.atual)} <small>gastos de ${v(p.alvo)}</small></p>${meter(p.progresso, p.status)}<div class="goal-ritmo"><span class="gr-now" style="left:${Math.min(100, p.tempo * 100)}%" title="Tempo passado"></span></div>`;
  } else if (p.tipo === 'crescimento') {
    corpo = `<div class="goal-steps"><div><p class="muted">Início</p><b>${v(p.base)}</b></div><span>→</span><div><p class="muted">Agora</p><b class="hl-num">${v(p.atual)}</b></div><span>→</span><div><p class="muted">Meta</p><b>${v(p.alvo)}</b></div></div>${meter(p.progresso, p.status)}`;
  }
  const hist = (g.historico || []).slice(-3).reverse();
  return `<article class="card goal goal-${p.tipo}" style="--gc:${cor}">${head}${corpo}
    <p class="goal-status ${p.status}">${esc(p.texto)}</p>${p.detalhe ? `<p class="hint">${esc(p.detalhe)}</p>` : ''}
    <p class="hint">${fmtDate(g.inicio)} a ${fmtDate(g.fim)} · ${p.restantes ? p.restantes + ' dias restantes' : 'prazo encerrado'}${['manual', 'crescimento'].includes(p.tipo) ? ' · valor informado à mão' : ' · calculado sozinho'}</p>
    ${hist.length ? `<p class="hint">Últimas atualizações: ${hist.map((h) => fmtDate(h.data) + ' ' + esc(ind.fmt(Number(h.valor))) + (h.delta ? ` (${h.delta > 0 ? '+' : '−'}${num(Math.abs(h.delta))})` : '')).join(' · ')}</p>` : ''}
    ${g.notas ? `<p class="small goal-notas">${esc(g.notas)}</p>` : ''}
  </article>`;
}

function goals() {
  const t = today();
  const list = store.all('goals').map((g) => ({ g, p: goalProgress(g) }));
  if (!list.length) return empty('Defina o que você quer alcançar', 'Escolha o tipo de meta (matrículas, conversão, custo por aluno, orçamento, seguidores…). Cada uma tem o seu jeito de medir e o progresso é calculado sozinho.');
  const ativas = list.filter(({ g }) => g.fim >= t);
  const passadas = list.filter(({ g }) => g.fim < t).sort((a, b) => b.g.fim.localeCompare(a.g.fim));
  const ok = ativas.filter(({ p }) => p.status === 'ok').length, warn = ativas.filter(({ p }) => p.status === 'warn').length, bad = ativas.filter(({ p }) => p.status === 'bad').length;
  return `<section class="kpis compact"><article class="kpi"><h3>Metas ativas</h3><p class="kpi-v">${ativas.length}</p></article><article class="kpi"><h3>No ritmo</h3><p class="kpi-v good">${ok}</p></article><article class="kpi"><h3>Atenção</h3><p class="kpi-v warn">${warn}</p></article><article class="kpi"><h3>Fora da meta</h3><p class="kpi-v bad">${bad}</p></article></section>
  ${GRUPOS_META.map(([gid, nome]) => { const its = ativas.filter(({ p }) => p.ind.grupo === gid).sort((a, b) => a.g.fim.localeCompare(b.g.fim)); return its.length ? `<h2 class="sec-title">${esc(nome)}</h2><div class="cards">${its.map(goalCard).join('')}</div>` : ''; }).join('') || '<p class="empty-sm">Nenhuma meta em andamento.</p>'}
  ${passadas.length ? `<details class="more"><summary>Metas encerradas (${passadas.length})</summary><div class="cards">${passadas.map(goalCard).join('')}</div></details>` : ''}`;
}

// Passo 1: escolher o tipo de meta.
function goalPicker(ctx) {
  const { dlg } = openDialog({
    title: 'Que meta você quer criar?', wide: true,
    html: GRUPOS_META.map(([gid, nome, desc]) => `<h3 class="form-sec">${esc(nome)} <small class="muted">${esc(desc)}</small></h3><div class="goal-pick">${INDICATORS.filter((i) => i.grupo === gid).map((i) => `<button type="button" class="goal-opt" data-pickind="${i.id}" style="--gc:${TIPO_COR[i.tipo]}"><span class="goal-ic">${icon(i.tipo)}</span><span><b>${esc(i.label)}</b><small>${esc({ contagem: 'Somar no período, com ritmo', taxa: 'Percentual mínimo', custo: 'Limite máximo de custo', orcamento: 'Teto de gasto', crescimento: 'De um número até outro', manual: 'Você atualiza à mão' }[i.tipo])}</small></span></button>`).join('')}</div>`).join(''),
  });
  dlg.querySelectorAll('[data-pickind]').forEach((b) => b.addEventListener('click', () => { dlg.close(); goalDialog(null, ctx, b.dataset.pickind); }));
}

// Passo 2: formulário do tipo escolhido.
function goalDialog(g, ctx, indId) {
  const t = today();
  const isNew = !g;
  g = g || { indicador: indId || 'matriculas', inicio: monthStart(t), fim: monthEnd(t) };
  const ind = IND[g.indicador] || IND.manual;
  const tipo = ind.tipo;
  const alvoVal = ind.pctInput && g.alvo != null && g.alvo !== '' ? Math.round(Number(g.alvo) * 1000) / 10 : g.alvo;
  const mesNome = new Date(g.inicio + 'T12:00').toLocaleDateString('pt-BR', { month: 'long' });
  const fields = [
    { name: 'alvo', label: ind.pergunta, type: 'number', value: alvoVal, required: true, hint: tipo === 'taxa' ? 'Em porcentagem. Ex.: 15 para 15%.' : tipo === 'custo' ? 'Acima disso a meta acende o alerta.' : tipo === 'orcamento' ? 'O card compara o gasto com o tempo que passou.' : '' },
    ...(tipo === 'crescimento' ? [{ name: 'base', label: 'Quantos tinha no início', type: 'number', value: g.base, required: true }, { name: 'atualManual', label: 'Quantos tem hoje', type: 'number', value: (g.historico || []).slice(-1)[0]?.valor ?? g.atualManual }] : []),
    ...(tipo === 'manual' ? [{ name: 'unidade', label: 'Unidade (opcional)', value: g.unidade, placeholder: 'ex.: parcerias, visitas, inscrições' }, { name: 'atualManual', label: 'Valor atual', type: 'number', value: (g.historico || []).slice(-1)[0]?.valor ?? g.atualManual }] : []),
    { name: 'inicio', label: 'De', type: 'date', value: g.inicio, required: true },
    { name: 'fim', label: 'Até', type: 'date', value: g.fim, required: true },
    ...(['comercial', 'midia', 'conteudo'].includes(ind.grupo) ? [{ name: 'cursoId', label: 'Só deste curso (opcional)', type: 'select', options: [['', 'Todos os cursos'], ...store.all('courses').map((c) => [c.id, c.nome])], value: g.cursoId }] : []),
    { name: 'nome', label: 'Nome da meta', value: g.nome, full: true, placeholder: 'Deixe em branco para criar sozinho' },
    { name: 'notas', label: 'Como vamos chegar lá', type: 'textarea', value: g.notas, full: true, placeholder: 'Plano, responsável, o que muda se não bater…' },
  ];
  openDialog({
    title: (isNew ? 'Nova meta · ' : 'Editar meta · ') + ind.label,
    fields,
    html: `<p class="hint">${esc({ contagem: 'Soma tudo que acontecer no período e mostra se está no ritmo para chegar lá.', taxa: 'Compara o percentual do período com o mínimo que você definir.', custo: 'Quanto menor, melhor: avisa quando passar do limite.', orcamento: 'Mostra quanto do teto já foi gasto em relação ao tempo que passou.', crescimento: 'Mede o caminho do número inicial até a meta. Atualize o valor de hoje sempre que olhar o perfil.', manual: 'Para qualquer número que o sistema não mede sozinho. Atualize quando quiser; o histórico fica guardado.' }[tipo])}</p>`,
    onSave: (d) => {
      if (d.inicio > d.fim) { toast('A data inicial é depois da final.', 'bad'); return false; }
      if (!(d.alvo > 0)) { toast('Informe um alvo maior que zero.', 'bad'); return false; }
      if (tipo === 'crescimento' && d.base != null && d.alvo <= d.base) { toast('A meta precisa ser maior que o número inicial.', 'bad'); return false; }
      const alvo = ind.pctInput ? d.alvo / 100 : d.alvo;
      const dup = store.all('goals').find((x) => x.id !== g.id && x.indicador === g.indicador && (x.cursoId || '') === (d.cursoId || '') && x.inicio <= d.fim && x.fim >= d.inicio && g.indicador !== 'manual');
      if (dup && isNew) { toast('Já existe uma meta de ' + ind.label.toLowerCase() + ' nesse período ("' + dup.nome + '"). Abri ela para você editar.', 'warn'); setTimeout(() => goalDialog(dup, ctx), 0); return; }
      const auto = { contagem: `${num(d.alvo)} ${ind.unidade} em ${mesNome}`, taxa: `${String(d.alvo).replace('.', ',')}% de ${ind.label.toLowerCase()}`, custo: `${ind.label} até ${brl2(d.alvo)}`, orcamento: `Orçamento de ${brl2(d.alvo)} em ${mesNome}`, crescimento: `Chegar a ${num(d.alvo)} ${ind.unidade}`, manual: `${num(d.alvo)} ${d.unidade || ''}`.trim() }[tipo];
      const nome = d.nome || (auto + (d.cursoId ? ' · ' + courseName(d.cursoId) : ''));
      const rec = { ...g, ...d, alvo, nome };
      if ((tipo === 'crescimento' || tipo === 'manual') && d.atualManual !== null && d.atualManual !== undefined && d.atualManual !== '' && Number(d.atualManual) !== Number((g.historico || []).slice(-1)[0]?.valor)) rec.historico = [...(g.historico || []), { data: today(), valor: Number(d.atualManual) }];
      store.put('goals', rec); toast('Meta salva.'); ctx.refresh();
    },
    onDelete: isNew ? null : () => { store.remove('goals', g.id); ctx.refresh(); },
  });
}

// Atualização rápida do valor (seguidores, avaliações, metas manuais): somar o que ganhou ou informar o total.
function goalUpdate(g, ctx) {
  const ind = IND[g.indicador] || IND.manual;
  const p = goalProgress(g);
  const atual = p.atual ?? (g.base !== '' && g.base != null ? Number(g.base) : 0);
  const un = ind.unidade || g.unidade || '';
  const { dlg } = openDialog({
    title: 'Atualizar: ' + g.nome, saveLabel: 'Salvar',
    fields: [
      { name: 'modo', label: 'Como você quer informar', type: 'select', options: [['somar', 'Ganhei mais'], ['tirar', 'Perdi'], ['total', 'Tenho agora (total)']], value: 'somar', full: true },
      { name: 'valor', label: 'Quantos', type: 'number', required: true, placeholder: 'ex.: 100' },
      { name: 'data', label: 'Data', type: 'date', value: today() },
    ],
    html: `<p class="note">Hoje está em <b>${num(atual)}</b> ${esc(un)}. <span id="gu-prev"></span></p>`,
    onOpen: (form) => {
      const prev = () => {
        const v = Number($('[name="valor"]', form).value) || 0; const m = $('[name="modo"]', form).value;
        const novo = m === 'somar' ? atual + v : m === 'tirar' ? atual - v : v;
        $('#gu-prev', form).textContent = v ? 'Vai ficar em ' + num(novo) + (g.alvo ? ' de ' + num(g.alvo) + '.' : '.') : '';
      };
      form.addEventListener('input', prev); form.addEventListener('change', prev);
      $('[name="valor"]', form).focus();
    },
    onSave: (d) => {
      const novo = d.modo === 'somar' ? atual + d.valor : d.modo === 'tirar' ? atual - d.valor : d.valor;
      if (novo < 0) { toast('O total não pode ficar negativo.', 'bad'); return false; }
      store.put('goals', { ...g, historico: [...(g.historico || []), { data: d.data || today(), valor: novo, delta: d.modo === 'total' ? novo - atual : d.modo === 'somar' ? d.valor : -d.valor }] });
      toast((d.modo === 'total' ? 'Total atualizado: ' : (d.modo === 'somar' ? '+' : '−') + num(d.valor) + ' · agora ') + num(novo) + ' ' + un + '.');
      ctx.refresh();
    },
  });
  void dlg;
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
    if (ds.mact === 'goal') return goalPicker(ctx);
    if (ds.mact === 'funnel') return funnelDialog(null, ctx);
    if (ds.mact === 'idea') return ideaDialog(null, ctx);
    if (ds.goal) return goalDialog(store.get('goals', ds.goal), ctx);
    if (ds.gupd) return goalUpdate(store.get('goals', ds.gupd), ctx);
    if (ds.fn) return funnelDialog(store.get('funnels', ds.fn), ctx);
    if (ds.tpl) { const tp = TEMPLATES[ds.tpl]; return funnelDialog({ ...tp, status: 'Rascunho', etapas: tp.etapas.map((x) => ({ ...x })) }, ctx); }
    if (ds.idea) return ideaDialog(store.get('ideas', ds.idea), ctx);
    if (ds.imove) { const [id, col] = ds.imove.split('|'); return moveIdea(id, col, ctx); }
  });
}
