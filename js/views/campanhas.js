// Campanhas: planejar no método Ciclo CEC e acompanhar até a matrícula.
// 1) quiz → 2) nome, objetivo e 5W3H → 3) modelo validado e estratégias → 4) meta e projeção → 5) revisão.
// Depois de criada, a campanha é acompanhada contra o ritmo esperado: no ritmo segue; fora do ritmo vai
// para "Precisa otimizar" com o motivo e a ação, e vira um teste em Metas › Ideias e testes.

import { store } from '../store.js';
import { auth } from '../auth.js';
import { esc, $, $$, brl, brl2, num, pct, fmtDate, today, addDays, daysBetween, uid } from '../util.js';
import { courseName, settings } from '../metrics.js';
import { openDialog, toast, ICON, badge, meter, empty, confirmButton } from '../ui.js';
import {
  allModelos, modelo, allEstrategias, estrategia, baseCalibrada, CICLO_REF, BENCH, FASES, FAMILIAS, familia, ETAPAS, CENARIOS, STATUS,
  planRates, diagnosePhase, recommend, fromGoal, projection, schedule, split, etapaNome, campaignNameFor, planAlerts, health,
} from '../cec.js';

const DRAFT_KEY = 'liceu.campanha.rascunho';
const STEPS = ['Quiz', 'Nome e 5W3H', 'Modelo e estratégias', 'Meta e projeção', 'Revisão'];

let draft = null;   // plano em criação
let step = 0;       // etapa do assistente
let qi = 0;         // pergunta do quiz

const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } };
const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step, qi })); } catch (e) { /* opcional */ } };
const clearDraft = () => { draft = null; step = 0; qi = 0; try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* opcional */ } };

function blank() {
  const s = settings();
  return {
    cursoId: '', metaMatriculas: 30, turma: addDays(today(), 21), vagas: 30, preco: '', precoPromo: '', prazoPromo: '',
    verba: '', cidade: (s.unidade || '').includes('·') ? s.unidade.split('·').pop().trim() : '', raio: 16, publico: '', perfil: [],
    temValidado: '', validadoNome: '', validadoFamilia: 'C02', validadoCusto: '', isca: '', atendentes: 1,
    nome: '', objetivo: '', w5h: null, w5hEditado: false, modelo: 'cec', estrategias: [], taxas: {}, responsavel: '', extras: [], acoes: [],
  };
}

// ---------- perguntas do quiz ----------
const QUIZ = [
  { id: 'curso', q: 'Qual curso você vai vender?', help: 'A campanha, os criativos e as metas ficam ligados a ele.' },
  { id: 'meta', q: 'Quantas matrículas você quer fechar?', help: 'É daqui que o plano calcula conversas, verba e prazo. Ex.: 30.' },
  { id: 'turma', q: 'Quando começa a turma e quantas vagas tem?', help: 'Tudo é calculado a partir da data da aula (T). O ideal é começar a campanha 18 dias antes.' },
  { id: 'preco', q: 'Qual o preço e a condição de venda?', help: 'Entra na campanha de venda (Conquistar). Escassez e prazo sempre reais.' },
  { id: 'verba', q: 'Quanto você pode investir nessa turma?', help: 'Se não souber, deixe em branco: o plano calcula a verba mínima para bater a meta.' },
  { id: 'onde', q: 'Onde está o seu público?', help: 'Cidade da escola + raio. O padrão que já funcionou: 16 km, 18 a 54 anos, Advantage+.' },
  { id: 'publico', q: 'Quem é a pessoa que mais compra esse curso?', help: 'Usado no criativo e no texto, não na segmentação.' },
  { id: 'validado', q: 'Você já tem um criativo que funcionou?', help: 'A regra é 1 criativo validado + 2 em teste em cada campanha.' },
  { id: 'isca', q: 'Qual material grátis você pode oferecer?', help: 'É a isca da etapa Experimentar. Ex.: guia "3 cuidados antes de aplicar".' },
  { id: 'atendimento', q: 'Quantas pessoas respondem o WhatsApp?', help: 'Acima de 35 conversas por dia por pessoa, a conversão cai.' },
];
const PERFIS = ['Mulheres 25–45', 'Homens 25–45', 'Já atua na área', 'Começando do zero', 'Quer renda extra', 'Cuidador(a) da família'];

function quizBody(d) {
  const q = QUIZ[qi];
  const courses = store.all('courses').filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
  const f = (name, label, type = 'text', attrs = '') => `<div class="field"><label for="d-${name}">${label}</label><input id="d-${name}" data-d="${name}" type="${type}" value="${esc(d[name] ?? '')}" ${attrs}></div>`;
  let inner = '';
  if (q.id === 'curso') inner = `<div class="chips quiz-opts">${courses.map((c) => `<button type="button" class="chip" data-set="cursoId" data-val="${esc(c.id)}" aria-pressed="${d.cursoId === c.id}">${esc(c.nome)}</button>`).join('')}</div>${courses.length ? '' : '<p class="hint">Cadastre os cursos em Configurações.</p>'}`;
  if (q.id === 'meta') inner = `<div class="quiz-big"><input id="d-metaMatriculas" data-d="metaMatriculas" type="number" min="1" inputmode="numeric" value="${esc(d.metaMatriculas)}" aria-label="Matrículas"><span>matrículas</span></div><div class="chips">${[10, 20, 30, 50].map((n) => `<button type="button" class="chip" data-set="metaMatriculas" data-val="${n}" aria-pressed="${Number(d.metaMatriculas) === n}">${n}</button>`).join('')}</div>`;
  if (q.id === 'turma') inner = `<div class="form-grid">${f('turma', 'Data da turma', 'date')}${f('vagas', 'Vagas', 'number', 'min="1" inputmode="numeric"')}</div>`;
  if (q.id === 'preco') inner = `<div class="form-grid">${f('preco', 'Valor normal (R$)', 'number', 'min="0"')}${f('precoPromo', 'Valor promocional (R$)', 'number', 'min="0"')}${f('prazoPromo', 'Promoção vale até', 'date')}</div>`;
  if (q.id === 'verba') inner = `<div class="quiz-big"><span>R$</span><input id="d-verba" data-d="verba" type="number" min="0" inputmode="decimal" value="${esc(d.verba)}" placeholder="calcular" aria-label="Verba total"></div><p class="hint">${(() => { const r = planRates(d.cursoId, d.taxas); const g = fromGoal(Number(d.metaMatriculas) || 1, r); return `Para ${num(d.metaMatriculas)} matrículas, a verba mínima estimada é <b>${brl(g.verba)}</b> (${num(g.conversas)} conversas a ${brl2(r.custoConversa)}, ${pct(r.convMatricula, 0)} viram matrícula · ${esc(r.fonte)}).`; })()}</p>`;
  if (q.id === 'onde') inner = `<div class="form-grid">${f('cidade', 'Cidade da escola')}${f('raio', 'Raio (km)', 'number', 'min="1"')}</div>`;
  if (q.id === 'publico') inner = `<div class="chips">${PERFIS.map((p) => `<button type="button" class="chip" data-toggle="perfil" data-val="${esc(p)}" aria-pressed="${(d.perfil || []).includes(p)}">${esc(p)}</button>`).join('')}</div>${f('publico', 'Descreva com suas palavras (opcional)')}`;
  if (q.id === 'validado') inner = `<div class="chips"><button type="button" class="chip" data-set="temValidado" data-val="sim" aria-pressed="${d.temValidado === 'sim'}">Sim, tenho</button><button type="button" class="chip" data-set="temValidado" data-val="nao" aria-pressed="${d.temValidado === 'nao'}">Ainda não</button></div>
    ${d.temValidado === 'sim' ? `<div class="form-grid">${f('validadoNome', 'Nome do criativo')}<div class="field"><label for="d-validadoFamilia">Tipo</label><select id="d-validadoFamilia" data-d="validadoFamilia">${FAMILIAS.map((x) => `<option value="${x.id}"${x.id === d.validadoFamilia ? ' selected' : ''}>${x.id} · ${esc(x.nome)}</option>`).join('')}</select></div>${f('validadoCusto', 'Custo por conversa (R$)', 'number', 'min="0" step="0.01"')}</div>` : d.temValidado === 'nao' ? '<p class="hint">Sem validado, cada campanha roda 3 testes e o vencedor é eleito no dia 7. É a fase de validação.</p>' : ''}`;
  if (q.id === 'isca') inner = `${f('isca', 'Material grátis')}<div class="chips">${['Guia em PDF', 'Checklist', 'Mini-aula em vídeo', 'Aula experimental presencial'].map((x) => `<button type="button" class="chip" data-set="isca" data-val="${esc(x)}" aria-pressed="${d.isca === x}">${esc(x)}</button>`).join('')}</div>`;
  if (q.id === 'atendimento') inner = `<div class="quiz-big"><input id="d-atendentes" data-d="atendentes" type="number" min="1" inputmode="numeric" value="${esc(d.atendentes)}" aria-label="Atendentes"><span>pessoa(s)</span></div>${f('responsavel', 'Responsável pela campanha')}`;
  return `<div class="quiz">
    <p class="quiz-n">Pergunta ${qi + 1} de ${QUIZ.length}</p>
    <div class="meter quiz-meter"><span style="width:${((qi + 1) / QUIZ.length) * 100}%"></span></div>
    <h2>${esc(q.q)}</h2><p class="muted">${esc(q.help)}</p>
    <div class="quiz-a">${inner}</div>
    <div class="row-actions"><button type="button" class="btn" data-w="qprev"${qi ? '' : ' disabled'}>Voltar</button><span class="grow"></span><button type="button" class="btn primary" data-w="qnext">${qi === QUIZ.length - 1 ? 'Continuar para o 5W3H' : 'Próxima'} ${ICON.arrow}</button></div>
  </div>`;
}

// ---------- 5W3H montado a partir do quiz ----------
function autoW5H(d) {
  const r = planRates(d.cursoId, d.taxas);
  const g = fromGoal(Number(d.metaMatriculas), r);
  const m = modelo(d.modelo);
  const sch = schedule(d.turma, d.modelo);
  const verba = Number(d.verba) || g.verba;
  const est = (d.estrategias || []).map((id) => id + ' ' + estrategia(id)?.nome).join(' + ');
  return {
    oque: `${m.nome} para a turma de ${courseName(d.cursoId)}.`,
    porque: `Fechar ${d.metaMatriculas} matrículas (cerca de ${g.pagantes} pagantes) para a turma de ${fmtDate(d.turma)}${d.vagas ? `, que tem ${d.vagas} vagas` : ''}.`,
    onde: `Meta Ads (Instagram e Facebook) levando para o WhatsApp. ${d.cidade} + ${d.raio} km, 18 a 54 anos, Advantage+.`,
    quando: `De ${fmtDate(sch.inicio)} a ${fmtDate(sch.fim)}; controle no dia 3 (${fmtDate(sch.dia3)}) e no dia 7 (${fmtDate(sch.dia7)}); desligar 2 dias antes da aula.`,
    quem: `Público: ${[...(d.perfil || []), d.publico].filter(Boolean).join(', ') || 'a definir'}. Atendimento: ${d.atendentes || 1} pessoa(s)${d.responsavel ? `; responsável: ${d.responsavel}` : ''}.`,
    como: `${m.resumo}${est ? ' Estratégias: ' + est + '.' : ''} Criativos: ${d.temValidado === 'sim' ? '1 validado + 2 testes' : '3 testes, vencedor no dia 7'} em cada campanha.`,
    quanto: `Verba de ${brl(verba)} (mínima para a meta: ${brl(g.verba)}).${d.precoPromo ? ` Oferta: ${brl(d.precoPromo)}${d.preco ? ` (de ${brl(d.preco)})` : ''}${d.prazoPromo ? ` até ${fmtDate(d.prazoPromo)}` : ''}.` : ''}`,
    medida: `${num(g.conversas)} conversas → ${num(d.metaMatriculas)} matrículas → ${num(g.pagantes)} pagantes. Custo por conversa até ${brl2(r.custoConversa)}; CAC alvo ${brl2(verba / d.metaMatriculas)}.`,
  };
}
const W5H = [['oque', 'O quê (What)'], ['porque', 'Por quê (Why)'], ['onde', 'Onde (Where)'], ['quando', 'Quando (When)'], ['quem', 'Quem (Who)'], ['como', 'Como (How)'], ['quanto', 'Quanto custa (How much)'], ['medida', 'Quanto de resultado (How many)']];

function stepW5H(d) {
  if (!d.w5h || !d.w5hEditado) d.w5h = autoW5H(d);
  if (!d.nome) d.nome = `${courseName(d.cursoId)} · turma ${fmtDate(d.turma)}`;
  if (!d.objetivo) d.objetivo = `Fechar ${d.metaMatriculas} matrículas para a turma de ${fmtDate(d.turma)}`;
  return `<div class="form-grid">
      <div class="field full"><label for="d-nome">Nome da campanha</label><input id="d-nome" data-d="nome" value="${esc(d.nome)}"></div>
      <div class="field full"><label for="d-objetivo">Objetivo</label><input id="d-objetivo" data-d="objetivo" value="${esc(d.objetivo)}"></div>
    </div>
    <div class="w5h">${W5H.map(([k, l]) => `<div class="field"><label for="w-${k}">${l}</label><textarea id="w-${k}" data-w5="${k}" rows="3">${esc(d.w5h[k])}</textarea></div>`).join('')}</div>
    <div class="row-actions"><button type="button" class="btn sm ghost" data-w="w5reset">Refazer o 5W3H com as respostas do quiz</button></div>
    <h3 class="sec-title">Suas informações</h3><p class="hint">Acrescente o que for da sua escola: parceria, local da aula, brinde, regra interna, link do material…</p>
    <ul class="ex-list">${(d.extras || []).map((x, i) => `<li class="kv-row"><input data-exk="${i}" value="${esc(x.k)}" placeholder="Item (ex.: Brinde)" aria-label="Item"><input data-exv="${i}" value="${esc(x.v)}" placeholder="Valor (ex.: jaleco na matrícula)" aria-label="Valor"><button type="button" class="icon-btn sm" data-exrm="${i}" aria-label="Remover">×</button></li>`).join('')}</ul>
    <button type="button" class="btn sm" data-w="exadd">${ICON.plus} Adicionar informação</button>
    <h3 class="sec-title">Ações e tarefas</h3><p class="hint">Tudo que precisa ser feito, com data e responsável. As que têm data entram no Calendário.</p>
    <ul class="ex-list">${(d.acoes || []).map((x, i) => `<li class="ac-row"><input data-ack="${i}" value="${esc(x.t)}" placeholder="Ação (ex.: gravar depoimento da aluna Ana)" aria-label="Ação"><input type="date" data-acd="${i}" value="${esc(x.d || '')}" aria-label="Data"><input data-acr="${i}" value="${esc(x.r || '')}" placeholder="Responsável" aria-label="Responsável"><button type="button" class="icon-btn sm" data-acrm="${i}" aria-label="Remover">×</button></li>`).join('')}</ul>
    <button type="button" class="btn sm" data-w="acadd">${ICON.plus} Adicionar ação</button>`;
}

function stepModelo(d) {
  const fase = diagnosePhase(d.cursoId);
  const rec = recommend(fase.id);
  if (!d.estrategias?.length) d.estrategias = rec.map((x) => x.id);
  const sch = schedule(d.turma, 'cec');
  return `<section class="fase"><p class="eyebrow">Fase da operação</p><h3>${fase.id} · ${esc(FASES[fase.id].nome)}: ${esc(FASES[fase.id].objetivo)}</h3><p class="muted">${esc(fase.motivo)} Para avançar: ${esc(FASES[fase.id].avancar)}.</p></section>
    <h3 class="sec-title">Modelo de campanha validado</h3>
    <div class="cards">${allModelos().map((m) => { const curto = sch.diasAteTurma < m.minDias; return `<button type="button" class="card pick${d.modelo === m.id ? ' on' : ''}" data-set="modelo" data-val="${m.id}" aria-pressed="${d.modelo === m.id}"><span class="eyebrow">${esc(m.est)} · ${m.etapas.map(etapaNome).join(' → ')}</span><b>${esc(m.nome)}</b><span class="muted">${esc(m.resumo || '')}</span>${m.custom ? '<span class="badge good">Seu modelo</span>' : ''}${curto ? `<span class="badge warn">Pede ${m.minDias}+ dias; faltam ${sch.diasAteTurma}</span>` : ''}</button>`; }).join('')}
      <button type="button" class="card pick add-pick" data-w="newmodel"><b>${ICON.plus} Criar modelo</b><span class="muted">Monte as suas etapas (nomes livres), a antecedência e a divisão da verba.</span></button></div>
    ${allModelos().some((m) => m.custom) ? `<div class="row-actions">${allModelos().filter((m) => m.custom).map((m) => `<button type="button" class="btn sm ghost" data-editmodel="${esc(m.id)}">Editar "${esc(m.nome)}"</button>`).join('')}</div>` : ''}
    <h3 class="sec-title">Estratégias de alto impacto <span class="muted">(o método recomenda 2 por vez; escolha quantas precisar)</span></h3>
    <p class="hint">Recomendadas para agora: ${rec.map((x) => `<b>${x.id}</b> ${esc(x.motivo)}`).join(' · ')}</p>
    <div class="est-list">${allEstrategias().map((e) => { const on = d.estrategias.includes(e.id); const fit = e.fases.includes(fase.id); return `<button type="button" class="est${on ? ' on' : ''}${fit ? '' : ' off-phase'}" data-est="${e.id}" aria-pressed="${on}"><span class="est-k">${e.id}</span><span class="est-b"><b>${esc(e.nome)}</b><small>${esc(e.quando)}</small><small class="muted">Como: ${esc(e.como)} · Verba: ${esc(e.verba)} · Sucesso: ${esc(e.metrica)}</small></span><span class="badge${fit ? ' good' : ''}">${e.custom ? 'Sua' : e.fases.join(' ')}</span></button>`; }).join('')}
      <button type="button" class="est add-est" data-w="newest"><span class="est-k">${ICON.plus}</span><span class="est-b"><b>Criar estratégia</b><small>Algo que funciona na sua escola e não está aqui.</small></span></button></div>
    ${allEstrategias().some((e) => e.custom) ? `<div class="row-actions">${allEstrategias().filter((e) => e.custom).map((e) => `<button type="button" class="btn sm ghost" data-editest="${esc(e.id)}">Editar "${esc(e.nome)}"</button>`).join('')}</div>` : ''}`;
}

function stepMeta(d) {
  const r = planRates(d.cursoId, d.taxas);
  const g = fromGoal(Number(d.metaMatriculas), r);
  const verba = Number(d.verba) || g.verba;
  const sch = schedule(d.turma, d.modelo);
  const sp = split(verba, d.modelo);
  const proj = projection(verba);
  const al = planAlerts({ ...d, verba: Number(d.verba) || 0, metaMatriculas: Number(d.metaMatriculas), vagas: Number(d.vagas) }, r);
  return `${al.map((a) => `<p class="banner ${a.nivel === 'bad' ? 'warn' : 'info'}">${esc(a.texto)}</p>`).join('')}
    <section class="kpis">
      <article class="kpi"><h3>Meta</h3><p class="kpi-v">${num(d.metaMatriculas)}</p><p class="kpi-d">matrículas · ~${num(g.pagantes)} pagantes</p></article>
      <article class="kpi"><h3>Conversas necessárias</h3><p class="kpi-v">${num(g.conversas)}</p><p class="kpi-d">${pct(r.convMatricula, 0)} viram matrícula</p></article>
      <article class="kpi"><h3>Verba mínima</h3><p class="kpi-v">${brl(g.verba)}</p><p class="kpi-d">${d.verba ? 'Você informou ' + brl(d.verba) : 'Usando a mínima'}</p></article>
      <article class="kpi"><h3>Tempo</h3><p class="kpi-v">${num(daysBetween(sch.inicio, sch.fim) + 1)} dias</p><p class="kpi-d">${fmtDate(sch.inicio)} a ${fmtDate(sch.fim)}</p></article>
    </section>
    <section class="card"><header class="card-head"><div><h2>Métricas que precisam acontecer</h2><p class="muted">Base: ${esc(r.fonte)}. Ajuste aqui ou calibre a base com um ciclo seu.</p></div><button type="button" class="btn sm" data-w="base">Calibrar base</button></header>
      <div class="form-grid three">
        <div class="field"><label for="t-cc">Custo por conversa (R$)</label><input id="t-cc" data-tx="custoConversa" type="number" step="0.01" min="0.5" value="${r.custoConversa.toFixed(2)}"></div>
        <div class="field"><label for="t-cm">Conversas → matrícula (%)</label><input id="t-cm" data-tx="convMatricula" data-pct type="number" step="1" min="1" max="100" value="${Math.round(r.convMatricula * 100)}"></div>
        <div class="field"><label for="t-cp">Matrícula → pagamento (%)</label><input id="t-cp" data-tx="convPagamento" data-pct type="number" step="1" min="1" max="100" value="${Math.round(r.convPagamento * 100)}"></div>
      </div>
      <dl class="stats wide"><div><dt>Conversas por dia</dt><dd>${num(Math.ceil(g.conversas / Math.max(1, daysBetween(sch.inicio, sch.fim) + 1)))}</dd></div><div><dt>Leads no funil por dia</dt><dd>${num(Math.ceil((g.conversas * 0.8) / Math.max(1, daysBetween(sch.inicio, sch.fim) + 1)))}</dd></div><div><dt>CAC alvo</dt><dd>${brl2(verba / d.metaMatriculas)}</dd></div><div><dt>Frequência máxima</dt><dd>3</dd></div></dl>
    </section>
    <section class="card"><header class="card-head"><h2>Campanhas e verba</h2></header>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Etapa</th><th>Liga</th><th>Desliga</th><th class="r">Verba</th><th class="r">Por dia</th></tr></thead><tbody>${sch.etapas.map((e) => `<tr><td><b>${esc(etapaNome(e.etapa))}</b></td><td>${fmtDate(e.inicio)}</td><td>${fmtDate(e.fim)}</td><td class="r">${brl(sp[e.etapa])}</td><td class="r">${brl2(sp[e.etapa] / e.dias)}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="card"><header class="card-head"><div><h2>Resultado esperado com ${brl(verba)}</h2><p class="muted">Três cenários do método</p></div></header>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Cenário</th><th class="r">Conversas</th><th class="r">Matrículas</th><th class="r">Pagantes</th><th class="r">Custo por pagante</th></tr></thead><tbody>${Object.values(proj).map((c) => `<tr><td>${esc(c.label)}</td><td class="r">${num(c.conversas)}</td><td class="r"><b class="${c.matriculas >= d.metaMatriculas ? 'good' : ''}">${num(c.matriculas)}</b></td><td class="r">${num(c.pagantes)}</td><td class="r">${brl2(c.custoPagante)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
}

function stepRevisao(d) {
  if (!d.w5h || !d.w5hEditado) d.w5h = autoW5H(d);
  const r = planRates(d.cursoId, d.taxas);
  const g = fromGoal(Number(d.metaMatriculas), r);
  const verba = Number(d.verba) || g.verba;
  const sch = schedule(d.turma, d.modelo);
  const escola = (auth.org?.nome || settings().unidade || 'Escola').split('·')[0].trim();
  return `<section class="card"><header class="card-head"><div><p class="eyebrow">${esc(modelo(d.modelo).nome)}</p><h2>${esc(d.nome)}</h2><p class="muted">${esc(d.objetivo)}</p></div></header>
    <dl class="stats wide"><div><dt>Curso</dt><dd>${esc(courseName(d.cursoId))}</dd></div><div><dt>Turma</dt><dd>${fmtDate(d.turma)}</dd></div><div><dt>Meta</dt><dd>${num(d.metaMatriculas)} matrículas</dd></div><div><dt>Verba</dt><dd>${brl(verba)}</dd></div></dl></section>
    <section class="card"><header class="card-head"><div><h2>O que vai ser criado</h2><p class="muted">Use exatamente esses nomes no Gerenciador: a importação do relatório liga os números sozinha.</p></div></header>
      <ul class="create-list">${sch.etapas.map((e) => `<li><b>${esc(campaignNameFor(escola, courseName(d.cursoId), e.etapa, d.turma))}</b><small>${esc(etapaNome(e.etapa))} · ${fmtDate(e.inicio)} a ${fmtDate(e.fim)} · ${esc(e.etapa === 'QUIZ' ? 'Leva ao quiz e depois ao WhatsApp' : ETAPAS.find((x) => x.id === e.etapa)?.cta || '')}</small></li>`).join('')}
        <li><b>Meta de ${num(d.metaMatriculas)} matrículas</b><small>Em Metas, de ${fmtDate(sch.inicio)} a ${fmtDate(d.turma)}</small></li>
        <li><b>${sch.etapas.length + 3} lembretes no Calendário</b><small>Ligar cada campanha, dia 3, dia 7 e desligar</small></li></ul>
    </section>
    <section class="card"><header class="card-head"><h2>5W3H</h2></header><dl class="w5h-view">${W5H.map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(d.w5h?.[k] || '')}</dd></div>`).join('')}${(d.extras || []).filter((x) => x.k || x.v).map((x) => `<div><dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd></div>`).join('')}</dl></section>
    ${(d.acoes || []).some((x) => x.t) ? `<section class="card"><header class="card-head"><h2>Ações</h2></header><ul class="diag">${d.acoes.filter((x) => x.t).map((x) => `<li><h4>${esc(x.t)}</h4><p>${x.d ? fmtDate(x.d) : 'sem data'}${x.r ? ' · ' + esc(x.r) : ''}</p></li>`).join('')}</ul></section>` : ''}`;
}

function wizard() {
  const d = draft;
  const body = [quizBody, stepW5H, stepModelo, stepMeta, stepRevisao][step](d);
  return `<div class="toolbar"><nav class="steps-nav" aria-label="Etapas">${STEPS.map((s, i) => `<button type="button" class="step-pill${i === step ? ' on' : ''}${i < step ? ' done' : ''}" data-goto="${i}"${i > step ? ' disabled' : ''}><span>${i + 1}</span>${esc(s)}</button>`).join('')}</nav><span class="grow"></span><button type="button" class="btn ghost" data-w="cancel">Sair do planejamento</button></div>
    <div class="wiz-body">${body}</div>
    ${step ? `<div class="row-actions wiz-foot"><button type="button" class="btn" data-w="prev">Voltar</button><span class="grow"></span>${step < STEPS.length - 1 ? `<button type="button" class="btn primary" data-w="next">Continuar ${ICON.arrow}</button>` : `<button type="button" class="btn primary" data-w="create">${ICON.plus} Criar campanha</button>`}</div>` : ''}`;
}

// ---------- criar a campanha planejada ----------
function create(ctx) {
  const d = draft;
  if (!d.w5h || !d.w5hEditado) d.w5h = autoW5H(d);
  const r = planRates(d.cursoId, d.taxas);
  const g = fromGoal(Number(d.metaMatriculas), r);
  const verba = Number(d.verba) || g.verba;
  const sch = schedule(d.turma, d.modelo);
  const sp = split(verba, d.modelo);
  const escola = (auth.org?.nome || settings().unidade || 'Escola').split('·')[0].trim();
  const curso = courseName(d.cursoId);
  const fase = diagnosePhase(d.cursoId);
  const planId = 'pl_' + Date.now().toString(36);
  const crit = (e) => {
    const fam = FAMILIAS.filter((f) => f.etapas.includes(e === 'QUIZ' ? 'CEC1' : e));
    const v = d.temValidado === 'sim' ? `[V] ${d.validadoNome || familia(d.validadoFamilia)?.nome}` : `[T3] ${fam[2]?.nome || fam[0]?.nome || 'Criativo 3'}`;
    return [v, `[T1] ${fam[0]?.nome || 'Criativo 1'}`, `[T2] ${fam[1]?.nome || fam[0]?.nome || 'Criativo 2'}`].join('\n');
  };
  const campanhas = sch.etapas.map((e) => {
    const nome = campaignNameFor(escola, curso, e.etapa, d.turma);
    const exist = store.all('campaigns').find((c) => c.nome === nome);
    const et = ETAPAS.find((x) => x.id === e.etapa);
    const c = store.put('campaigns', {
      ...(exist || {}), nome, canal: 'Meta', cursoId: d.cursoId, objetivo: 'Mensagens no WhatsApp',
      formato: e.etapa === 'QUIZ' ? 'Quiz' : 'WhatsApp (mensagens)', inicio: e.inicio, fim: e.fim,
      orcamentoDia: Math.round((sp[e.etapa] / e.dias) * 100) / 100, status: 'Ativa', planoId: planId, etapaCec: e.etapa,
      publico: `${d.cidade} + ${d.raio} km · 18 a 54 · Advantage+`,
      oferta: e.etapa === 'CEC3' ? [d.precoPromo && `${brl(d.precoPromo)}${d.preco ? ` (de ${brl(d.preco)})` : ''}`, d.prazoPromo && `até ${fmtDate(d.prazoPromo)}`].filter(Boolean).join(' ') : e.etapa === 'CEC2' ? d.isca : '',
      metaMatriculas: e.etapa === 'CEC3' || sch.etapas.length === 1 ? Number(d.metaMatriculas) : exist?.metaMatriculas,
      cacMax: Math.round((verba / d.metaMatriculas) * 1.3),
      metaConversas: Math.ceil(g.conversas * (sp[e.etapa] / verba)),
      notas: `Plano: ${d.nome}\nMensagem pronta: "${e.etapa === 'QUIZ' ? 'Fiz o quiz e quero saber da turma' : et?.msg}"\nCTA: ${e.etapa === 'QUIZ' ? 'Faça o quiz e descubra se o curso é para você.' : et?.cta}\nCriativos:\n${crit(e.etapa)}`,
    });
    return { id: c.id, etapa: e.etapa };
  });
  const goal = store.put('goals', { nome: `${d.metaMatriculas} matrículas · ${d.nome}`, indicador: 'matriculas', alvo: Number(d.metaMatriculas), inicio: sch.inicio, fim: d.turma, cursoId: d.cursoId, planoId: planId });
  const cal = [
    ...sch.etapas.map((e) => ({ data: e.inicio, tipo: 'Campanha', titulo: 'Ligar ' + etapaNome(e.etapa) + ' · ' + curso })),
    { data: sch.dia3, tipo: 'Tarefa', titulo: 'Dia 3 · ' + d.nome + ': pausar teste caro (≥ 1,5× o validado)' },
    { data: sch.dia7, tipo: 'Tarefa', titulo: 'Dia 7 · ' + d.nome + ': eleger o validado e decidir escala' },
    { data: sch.fim, tipo: 'Tarefa', titulo: 'Desligar campanhas · ' + d.nome },
  ].map((x) => ({ ...x, cursoId: d.cursoId, status: 'Planejado', planoId: planId }));
  store.putMany('calendar', cal);
  store.put('plans', {
    id: planId, nome: d.nome, objetivo: d.objetivo, w5h: d.w5h, cursoId: d.cursoId, modelo: d.modelo, estrategias: d.estrategias,
    fase: fase.id, turma: d.turma, vagas: Number(d.vagas) || null, metaMatriculas: Number(d.metaMatriculas), metaConversas: g.conversas,
    verba, verbaMinima: g.verba, taxas: { custoConversa: r.custoConversa, convMatricula: r.convMatricula, convPagamento: r.convPagamento },
    inicio: sch.inicio, fim: sch.fim, dia3: sch.dia3, dia7: sch.dia7, campanhas, goalId: goal.id, status: 'Ativa',
    quiz: { preco: d.preco, precoPromo: d.precoPromo, prazoPromo: d.prazoPromo, cidade: d.cidade, raio: d.raio, perfil: d.perfil, publico: d.publico, validado: d.temValidado === 'sim' ? { nome: d.validadoNome, familia: d.validadoFamilia, custo: d.validadoCusto } : null, isca: d.isca, atendentes: d.atendentes, responsavel: d.responsavel },
    otimizacoes: [],
    extras: (d.extras || []).filter((x) => x.k || x.v),
    acoes: (d.acoes || []).filter((x) => x.t).map((x) => ({ ...x, id: uid('ac') })),
  });
  const tarefas = (d.acoes || []).filter((x) => x.t && x.d).map((x) => ({ data: x.d, tipo: 'Tarefa', titulo: x.t + ' · ' + d.nome, responsavel: x.r || '', cursoId: d.cursoId, status: 'Planejado', planoId: planId }));
  if (tarefas.length) store.putMany('calendar', tarefas);
  clearDraft();
  toast('Campanha planejada: ' + campanhas.length + ' campanha(s), a meta e os lembretes foram criados.');
  location.hash = '#campanhas?p=' + planId;
  void ctx;
}

// ---------- lista em Kanban por saúde ----------
function board() {
  const plans = store.all('plans').sort((a, b) => (a.turma || '').localeCompare(b.turma || ''));
  if (!plans.length) return empty('Planeje sua primeira campanha', 'Responda o quiz e o plano sai pronto: nome, 5W3H, modelo validado, verba, prazo e a meta. Depois o sistema avisa se está no ritmo ou se precisa otimizar.');
  const cols = [['planejada', 'Planejada'], ['ritmo', 'No ritmo'], ['atencao', 'Atenção'], ['otimizar', 'Precisa otimizar'], ['encerrada', 'Encerrada']];
  const items = plans.map((p) => ({ p, h: p.status === 'Concluída' ? { ...health(p), status: 'encerrada' } : health(p) }));
  return `<div class="board plan-board">${cols.map(([id, label]) => { const its = items.filter((x) => x.h.status === id); return `<section class="col col-${id}"><header><h3>${label}</h3><span class="count">${its.length}</span></header><div class="col-body">${its.map(({ p, h }) => `<a class="lead plan-c" href="#campanhas?p=${esc(p.id)}"><b>${esc(p.nome)}</b><small class="muted">${esc(courseName(p.cursoId))} · turma ${fmtDate(p.turma)}</small>
      <span class="pc-row"><span>Matrículas</span><b>${num(h.matriculas)} / ${num(p.metaMatriculas)}</b></span>${meter(p.metaMatriculas ? h.matriculas / p.metaMatriculas : 0, h.status === 'otimizar' ? 'bad' : h.status === 'atencao' ? 'warn' : 'ok')}
      <span class="pc-row"><span>Leads</span><b>${num(h.leads)}${h.passados ? ' / ' + num(Math.round(h.esp.leads)) + ' esperados' : ''}</b></span>
      ${h.sinais[0] ? `<small class="${h.sinais[0].nivel === 'bad' ? 'bad' : 'warn-t'}">${esc(h.sinais[0].texto)}</small>` : ''}</a>`).join('') || '<p class="col-empty">Nada aqui</p>'}</div></section>`; }).join('')}</div>`;
}

// ---------- detalhe e acompanhamento ----------
function detail(p) {
  const h = p.status === 'Concluída' ? { ...health(p), status: 'encerrada' } : health(p);
  const st = STATUS[h.status];
  const m = modelo(p.modelo);
  const bar = (label, a, e, fmt = num) => { const ratio = e > 0 ? a / e : null; const cls = ratio === null ? '' : ratio >= 0.9 ? 'ok' : ratio >= 0.7 ? 'warn' : 'bad'; return `<li><div class="gm-top"><span>${label}</span><b>${fmt(a)} <small class="muted">/ ${fmt(Math.round(e))} esperado até hoje</small></b></div>${meter(ratio === null ? 0 : Math.min(1, ratio), cls)}</li>`; };
  const camps = (p.campanhas || []).map((c) => ({ ...c, rec: store.get('campaigns', c.id) })).filter((c) => c.rec);
  const leads = store.all('leads').filter((l) => camps.some((c) => c.id === l.campanhaId) && l.entrada >= p.inicio).sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
  const t = today();
  return `<div class="toolbar"><a class="btn ghost" href="#campanhas">← Todas as campanhas</a><span class="grow"></span>
      <button type="button" class="btn" data-pa="edit">Editar plano</button>${h.status !== 'encerrada' ? '<button type="button" class="btn" data-pa="close">Encerrar e registrar resultado</button>' : ''}<button type="button" class="btn danger" data-pa="del">Excluir plano</button></div>
    <section class="card"><header class="card-head"><div><p class="eyebrow">${esc(m.nome)} · ${esc(courseName(p.cursoId))} · fase ${esc(p.fase)}</p><h2>${esc(p.nome)}</h2><p class="muted">${esc(p.objetivo)}</p></div>${badge(st.label, st.cls)}</header>
      <dl class="stats wide"><div><dt>Turma</dt><dd>${fmtDate(p.turma)}</dd></div><div><dt>Período</dt><dd>${fmtDate(p.inicio)} a ${fmtDate(p.fim)}<small>dia ${num(h.passados)} de ${num(h.total)}</small></dd></div><div><dt>Verba</dt><dd>${brl(p.verba)}<small>gasto ${brl(h.gasto)}</small></dd></div><div><dt>Matrículas</dt><dd>${num(h.matriculas)} / ${num(p.metaMatriculas)}<small>${num(h.pagantes)} pagantes</small></dd></div><div><dt>CAC</dt><dd>${brl2(h.cac)}<small>alvo ${brl2(p.verba / p.metaMatriculas)}</small></dd></div><div><dt>Custo por conversa</dt><dd>${brl2(h.custoConversa)}<small>alvo ${brl2(p.taxas?.custoConversa)}</small></dd></div></dl>
    </section>
    ${h.status === 'planejada' ? `<p class="banner info">A campanha começa em ${fmtDate(p.inicio)}. Crie as campanhas no Gerenciador com os nomes abaixo; quando importar o relatório e registrar os leads com a campanha, o acompanhamento começa sozinho.</p>` : ''}
    ${h.sinais.length ? `<section class="card opt-card"><header class="card-head"><div><h2>${h.status === 'otimizar' ? 'Precisa otimizar' : h.status === 'atencao' ? 'Pontos de atenção' : 'Sinais'}</h2><p class="muted">O que o sistema viu e o que fazer</p></div></header>
      <ul class="diag">${h.sinais.map((s) => { const done = (p.otimizacoes || []).find((o) => o.sinal === s.id); const e = estrategia(s.est); return `<li><h4><span class="badge ${s.nivel}">${s.nivel === 'bad' ? 'Fora do ritmo' : s.nivel === 'good' ? 'Ótimo' : 'Atenção'}</span> ${esc(s.texto)}</h4><p>${esc(s.acao)}${e ? ` Estratégia: <b>${e.id} ${esc(e.nome)}</b>.` : ''}</p>${done ? `<a class="link" href="#metas?tab=ideias">Teste de otimização criado em ${fmtDate(done.data)} ${ICON.arrow}</a>` : `<button type="button" class="btn sm${s.nivel === 'bad' ? ' primary' : ''}" data-opt="${esc(s.id)}">Mandar para otimização</button>`}</li>`; }).join('')}</ul></section>` : h.passados ? '<p class="banner info">No ritmo: leads, conversas e matrículas dentro do esperado até hoje. Siga o plano.</p>' : ''}
    <div class="grid-2">
      <section class="card"><header class="card-head"><div><h2>Ritmo</h2><p class="muted">Realizado x esperado para o dia ${num(h.passados)} de ${num(h.total)}</p></div></header>
        <ul class="goal-mini">${bar('Leads no funil', h.leads, h.esp.leads)}${bar('Conversas (Meta)', h.conversas, h.esp.conversas)}${bar('Matrículas', h.matriculas, h.esp.matriculas)}${bar('Gasto', h.gasto, h.esp.gasto, brl)}</ul></section>
      <section class="card"><header class="card-head"><h2>Calendário de controle</h2></header>
        <ul class="agenda">${h.marcos.map((x) => `<li><span class="ag-date">${fmtDate(x.data)}<small>${x.data < t ? 'passou' : x.data === t ? 'hoje' : 'em ' + daysBetween(t, x.data) + ' d'}</small></span><span class="ag-body">${esc(x.texto)}</span></li>`).join('')}</ul></section>
    </div>
    <section class="card"><header class="card-head"><div><h2>Campanhas no Gerenciador</h2><p class="muted">Crie com estes nomes. Mensagem pronta diferente em cada uma, para saber de onde veio o lead.</p></div></header>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Campanha</th><th>Período</th><th class="r">Verba/dia</th><th>Criativos</th></tr></thead><tbody>${camps.map((c) => `<tr><td><a href="#meta?c=${esc(c.id)}">${esc(c.rec.nome)}</a><small class="cell-sub">${esc(etapaNome(c.etapa))} · ${esc(c.rec.oferta || '')}</small></td><td>${fmtDate(c.rec.inicio)} a ${fmtDate(c.rec.fim)}</td><td class="r">${brl2(c.rec.orcamentoDia)}</td><td class="pre small">${esc((c.rec.notas || '').split('Criativos:\n')[1] || '')}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card"><header class="card-head"><div><h2>Leads desta campanha</h2><p class="muted">Registrados no Funil com uma das campanhas acima. Se eles entram, a campanha vai bem.</p></div><a class="btn sm" href="#funil">Abrir funil</a></header>
      ${leads.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Entrou</th><th>Etapa</th><th>Campanha</th></tr></thead><tbody>${leads.slice(0, 40).map((l) => `<tr><td>${esc(l.nome)}</td><td>${fmtDate(l.entrada)}</td><td>${badge(l.etapa === 'matriculado' ? 'Matriculado' : l.etapa === 'perdido' ? 'Perdido' : 'Em aberto', l.etapa === 'matriculado' ? 'good' : l.etapa === 'perdido' ? 'bad' : '')}</td><td>${esc(etapaNome(camps.find((c) => c.id === l.campanhaId)?.etapa || ''))}</td></tr>`).join('')}</tbody></table></div>${leads.length > 40 ? `<p class="hint">Mostrando 40 de ${leads.length}.</p>` : ''}` : '<p class="empty-sm">Nenhum lead registrado com estas campanhas ainda. No Funil, escolha a campanha ao cadastrar cada conversa.</p>'}</section>
    <section class="card"><header class="card-head"><div><h2>Ações e tarefas</h2><p class="muted">Marque o que já foi feito. Ações com data também aparecem no Calendário.</p></div><button type="button" class="btn sm" data-pa="addacao">${ICON.plus} Nova ação</button></header>
      ${(p.acoes || []).length ? `<ul class="todo">${p.acoes.map((a, i) => `<li class="${a.feito ? 'done' : ''}"><label class="check-field"><input type="checkbox" data-acao="${i}"${a.feito ? ' checked' : ''}> <span><b>${esc(a.t)}</b><small>${a.d ? fmtDate(a.d) : 'sem data'}${a.r ? ' · ' + esc(a.r) : ''}</small></span></label><button type="button" class="icon-btn sm" data-acaorm="${i}" aria-label="Remover ação">×</button></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhuma ação ainda. Adicione o que a equipe precisa fazer: gravar criativo, montar o material grátis, treinar o atendimento.</p>'}</section>
    <section class="card"><header class="card-head"><h2>5W3H</h2></header><dl class="w5h-view">${W5H.map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(p.w5h?.[k] || '')}</dd></div>`).join('')}${(p.extras || []).map((x) => `<div><dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd></div>`).join('')}</dl>${p.notas ? `<p class="pre">${esc(p.notas)}</p>` : ''}</section>
    <section class="card"><header class="card-head"><h2>Estratégias escolhidas</h2></header>${(p.estrategias || []).length ? `<ul class="diag">${p.estrategias.map((id) => { const e = estrategia(id); return e ? `<li><h4>${e.id} · ${esc(e.nome)}</h4><p>${esc(e.como)} Verba: ${esc(e.verba)}. Sucesso: ${esc(e.metrica)}.</p></li>` : ''; }).join('')}</ul>` : '<p class="empty-sm">Nenhuma.</p>'}</section>`;
}

// ---------- personalizar: base, modelos, estratégias, plano ----------
const saveSettings = (patch) => store.put('settings', { ...store.settings(), id: 'main', ...patch });

function baseDialog(ctx) {
  const b = store.settings().cecBase || { nome: CICLO_REF.nome, gasto: CICLO_REF.gasto, conversas: CICLO_REF.conversas, matriculas: CICLO_REF.matriculas };
  openDialog({
    title: 'Base de cálculo', saveLabel: 'Usar esta base',
    fields: [
      { name: 'nome', label: 'Nome do ciclo', value: b.nome, full: true, placeholder: 'ex.: Injetáveis · outubro' },
      { name: 'gasto', label: 'Valor gasto (R$)', type: 'number', value: b.gasto, required: true },
      { name: 'conversas', label: 'Conversas iniciadas', type: 'number', value: b.conversas, required: true, hint: 'No Gerenciador: resultados de "conversas por mensagem iniciadas".' },
      { name: 'matriculas', label: 'Matrículas / vendas', type: 'number', value: b.matriculas, required: true },
      { name: 'pagantes', label: 'Pagantes (opcional)', type: 'number', value: b.pagantes },
    ],
    html: `<p class="hint">O plano calcula verba e conversas com o custo por conversa e a conversão desse ciclo. Use um ciclo real seu, de preferência o mais recente. Referência padrão: ${esc(CICLO_REF.nome)} (R$ 800,72 → 240 conversas → 26 vendas, R$ ${BENCH.custoConversa.toFixed(2).replace('.', ',')} por conversa, ${Math.round(BENCH.convMatricula * 1000) / 10}% de conversão).</p>`,
    onSave: (d) => { if (!(d.gasto > 0 && d.conversas > 0 && d.matriculas > 0)) { toast('Preencha gasto, conversas e matrículas.', 'bad'); return false; } saveSettings({ cecBase: d }); if (draft) { draft.taxas = {}; saveDraft(); } toast('Base atualizada: R$ ' + (d.gasto / d.conversas).toFixed(2).replace('.', ',') + ' por conversa, ' + Math.round((d.matriculas / d.conversas) * 1000) / 10 + '% viram matrícula.'); ctx.refresh(); },
    onDelete: store.settings().cecBase ? () => { saveSettings({ cecBase: null }); toast('Voltou para a base de referência.'); ctx.refresh(); } : null,
    deleteLabel: 'Voltar à referência',
  });
}

const ETAPA_OPTS = [['CEC1', 'Conhecer (aquecimento)'], ['CEC2', 'Experimentar (isca grátis)'], ['QUIZ', 'Quiz de qualificação'], ['CEC3', 'Conquistar (venda)'], ['NOVA', 'Etapa nova (nome livre)']];
function modelDialog(m, ctx) {
  const isNew = !m;
  m = m ? JSON.parse(JSON.stringify(m)) : { nome: '', resumo: '', est: 'E03', minDias: 12, etapas: ['CEC1', 'CEC3'], divisao: { CEC1: 30, CEC3: 70 }, etapasDef: [] };
  const defs = Object.fromEntries((m.etapasDef || []).map((e) => [e.id, e]));
  const rows = m.etapas.map((id) => ({ id, tipo: defs[id] ? 'NOVA' : id, nome: defs[id]?.nome || '', ant: defs[id]?.antecedencia || (id === 'CEC3' ? 12 : 18), pct: m.divisao?.[id] ?? Math.round(100 / m.etapas.length) }));
  const row = (r) => `<li class="md-row" data-id="${esc(r.id || '')}"><select data-k="tipo" aria-label="Etapa">${ETAPA_OPTS.map(([v, t]) => `<option value="${v}"${v === r.tipo ? ' selected' : ''}>${t}</option>`).join('')}</select><input data-k="nome" value="${esc(r.nome)}" placeholder="Nome da etapa nova" aria-label="Nome"><input data-k="ant" type="number" min="1" value="${r.ant}" aria-label="Dias antes da turma" title="Começa quantos dias antes da turma"><input data-k="pct" type="number" min="0" max="100" value="${r.pct}" aria-label="% da verba" title="% da verba"><button type="button" class="icon-btn sm" data-rm aria-label="Remover">×</button></li>`;
  const { dlg } = openDialog({
    title: isNew ? 'Criar modelo de campanha' : 'Editar modelo', wide: true, saveLabel: 'Salvar modelo',
    fields: [
      { name: 'nome', label: 'Nome do modelo', value: m.nome, required: true, placeholder: 'ex.: Aula experimental + venda' },
      { name: 'est', label: 'Estratégia de base', type: 'select', options: allEstrategias().map((e) => [e.id, e.id + ' · ' + e.nome]), value: m.est },
      { name: 'resumo', label: 'Como funciona', type: 'textarea', value: m.resumo, full: true },
      { name: 'minDias', label: 'Dias mínimos antes da turma', type: 'number', value: m.minDias },
    ],
    html: `<h3 class="form-sec">Etapas, na ordem</h3><p class="hint">Cada etapa vira uma campanha no Gerenciador. "Dias antes" é quando ela liga; "%" é a parte da verba.</p><div class="md-head"><span>Etapa</span><span>Nome (se nova)</span><span>Dias antes</span><span>% verba</span><span></span></div><ol class="st-list" id="md-list">${rows.map(row).join('')}</ol><button type="button" class="btn sm" id="md-add">${ICON.plus} Adicionar etapa</button>`,
    onOpen: (form) => { const list = $('#md-list', form); $('#md-add', form).addEventListener('click', () => list.insertAdjacentHTML('beforeend', row({ tipo: 'NOVA', nome: '', ant: 10, pct: 20 }))); list.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) e.target.closest('.md-row').remove(); }); $('[name="nome"]', form).focus(); },
    onSave: (d, form) => {
      const etapas = [], divisao = {}, etapasDef = [];
      $$('.md-row', form).forEach((li) => {
        const tipo = $('[data-k="tipo"]', li).value; const nome = $('[data-k="nome"]', li).value.trim();
        let id = tipo;
        if (tipo === 'NOVA') { if (!nome) return; id = li.dataset.id && li.dataset.id.startsWith('X') ? li.dataset.id : 'X' + Math.random().toString(36).slice(2, 7); etapasDef.push({ id, nome, antecedencia: Number($('[data-k="ant"]', li).value) || 10 }); }
        if (etapas.includes(id)) return;
        etapas.push(id); divisao[id] = Number($('[data-k="pct"]', li).value) || 0;
      });
      if (!etapas.length) { toast('Adicione pelo menos uma etapa.', 'bad'); return false; }
      const rec = { ...m, ...d, id: m.id || 'mc_' + Math.random().toString(36).slice(2, 8), etapas, divisao, etapasDef };
      const list = (store.settings().cecModelos || []).filter((x) => x.id !== rec.id);
      saveSettings({ cecModelos: [...list, rec] });
      if (draft) { draft.modelo = rec.id; draft.w5hEditado = false; saveDraft(); }
      toast('Modelo salvo.'); ctx.refresh();
    },
    onDelete: isNew ? null : () => { saveSettings({ cecModelos: (store.settings().cecModelos || []).filter((x) => x.id !== m.id) }); if (draft?.modelo === m.id) { draft.modelo = 'cec'; saveDraft(); } toast('Modelo excluído.'); ctx.refresh(); },
  });
  return dlg;
}

function estDialog(e, ctx) {
  const isNew = !e;
  e = e || { fases: ['F1', 'F2', 'F3', 'F4'] };
  openDialog({
    title: isNew ? 'Criar estratégia' : 'Editar estratégia', wide: true, saveLabel: 'Salvar estratégia',
    fields: [
      { name: 'nome', label: 'Nome', value: e.nome, required: true, placeholder: 'ex.: Parceria com clínica do bairro' },
      { name: 'verba', label: 'Verba sugerida', value: e.verba, placeholder: 'ex.: R$ 10/dia' },
      { name: 'quando', label: 'Quando usar', value: e.quando, full: true },
      { name: 'como', label: 'Como fazer', type: 'textarea', value: e.como, full: true },
      { name: 'metrica', label: 'Métrica de sucesso', value: e.metrica, full: true },
    ],
    onSave: (d) => {
      const rec = { ...e, ...d, id: e.id || 'S' + String((store.settings().cecEstrategias || []).length + 1).padStart(2, '0') + Math.random().toString(36).slice(2, 4).toUpperCase() };
      saveSettings({ cecEstrategias: [...(store.settings().cecEstrategias || []).filter((x) => x.id !== rec.id), rec] });
      if (draft && isNew) { draft.estrategias = [...(draft.estrategias || []), rec.id]; draft.w5hEditado = false; saveDraft(); }
      toast('Estratégia salva.'); ctx.refresh();
    },
    onDelete: isNew ? null : () => { saveSettings({ cecEstrategias: (store.settings().cecEstrategias || []).filter((x) => x.id !== e.id) }); toast('Estratégia excluída.'); ctx.refresh(); },
  });
}

function editPlan(p, ctx) {
  openDialog({
    title: 'Editar plano', wide: true,
    fields: [
      { name: 'nome', label: 'Nome', value: p.nome, required: true, full: true },
      { name: 'objetivo', label: 'Objetivo', value: p.objetivo, full: true },
      { name: 'metaMatriculas', label: 'Meta de matrículas', type: 'number', value: p.metaMatriculas, required: true },
      { name: 'verba', label: 'Verba total (R$)', type: 'number', value: p.verba, required: true },
      { name: 'vagas', label: 'Vagas', type: 'number', value: p.vagas },
      { name: 'metaConversas', label: 'Meta de conversas', type: 'number', value: p.metaConversas },
      ...W5H.map(([k, l]) => ({ name: 'w_' + k, label: l, type: 'textarea', rows: 2, value: p.w5h?.[k] || '' })),
      { name: 'extrasTxt', label: 'Suas informações (uma por linha, "item: valor")', type: 'textarea', rows: 4, value: (p.extras || []).map((x) => x.k + ': ' + x.v).join('\n'), full: true },
      { name: 'notas', label: 'Anotações', type: 'textarea', value: p.notas, full: true },
    ],
    onSave: (d) => {
      const w5h = Object.fromEntries(W5H.map(([k]) => [k, d['w_' + k]]));
      const extras = String(d.extrasTxt || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: l, v: '' }; });
      store.put('plans', { ...p, nome: d.nome, objetivo: d.objetivo, metaMatriculas: Number(d.metaMatriculas), verba: Number(d.verba), vagas: d.vagas || null, metaConversas: Number(d.metaConversas) || p.metaConversas, w5h, extras, notas: d.notas });
      toast('Plano atualizado.'); ctx.refresh();
    },
  });
}

// ---------- tela ----------
export function render(ctx) {
  const prm = ctx.params;
  if (prm.novo && !draft) { const saved = loadDraft(); if (saved?.draft) ({ draft, step, qi } = saved); else { draft = blank(); step = 0; qi = 0; } }
  if (draft && (prm.novo || !prm.p)) return wizard();
  if (prm.p) { const p = store.get('plans', prm.p); if (p) return detail(p); }
  const plans = store.all('plans');
  const fase = diagnosePhase();
  const rec = recommend(fase.id);
  const ativos = plans.filter((p) => p.status !== 'Concluída').map((p) => health(p));
  const saved = loadDraft();
  return `<div class="toolbar"><div><h2>Campanhas planejadas</h2><p class="muted">Do quiz à matrícula, com o ritmo acompanhado todo dia.</p></div><span class="grow"></span>${saved?.draft ? '<a class="btn" href="#campanhas?novo=1">Continuar rascunho</a>' : ''}<button type="button" class="btn primary" data-w="new">${ICON.plus} Planejar campanha</button></div>
    <section class="kpis compact">
      <article class="kpi"><h3>Fase da operação</h3><p class="kpi-v">${fase.id}</p><p class="kpi-d">${esc(FASES[fase.id].nome)}</p></article>
      <article class="kpi"><h3>Em andamento</h3><p class="kpi-v">${num(ativos.filter((h) => !['planejada', 'encerrada'].includes(h.status)).length)}</p></article>
      <article class="kpi"><h3>No ritmo</h3><p class="kpi-v">${num(ativos.filter((h) => h.status === 'ritmo').length)}</p></article>
      <article class="kpi"><h3>Precisam otimizar</h3><p class="kpi-v${ativos.some((h) => h.status === 'otimizar') ? ' bad' : ''}">${num(ativos.filter((h) => h.status === 'otimizar').length)}</p></article>
    </section>
    ${(() => { const cal = baseCalibrada(); const cc = cal ? cal.custoConversa : BENCH.custoConversa, cm = cal ? cal.convMatricula : BENCH.convMatricula; return `<section class="card base-card"><header class="card-head"><div><p class="eyebrow">Base de cálculo</p><h3>${esc(cal ? cal.nome : CICLO_REF.nome)}</h3><p class="muted">${brl2(cc)} por conversa · ${pct(cm, 1)} das conversas viram matrícula · ${brl2(cc / cm)} por matrícula</p></div><button type="button" class="btn sm" data-w="base">Calibrar com um ciclo seu</button></header></section>`; })()}
    <p class="hint">${esc(fase.motivo)} Próximo movimento: ${rec.map((x) => `<b>${x.id} ${esc(estrategia(x.id)?.nome)}</b>`).join(' e ')}.</p>
    ${board()}`;
}

function readStep(root) {
  $$('[data-d]', root).forEach((el) => { draft[el.dataset.d] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; });
  $$('[data-w5]', root).forEach((el) => { if (draft.w5h && draft.w5h[el.dataset.w5] !== el.value) { draft.w5h[el.dataset.w5] = el.value; draft.w5hEditado = true; } });
  $$('[data-exk]', root).forEach((el) => { const i = Number(el.dataset.exk); draft.extras[i] = { ...(draft.extras[i] || {}), k: el.value }; });
  $$('[data-exv]', root).forEach((el) => { const i = Number(el.dataset.exv); draft.extras[i] = { ...(draft.extras[i] || {}), v: el.value }; });
  $$('[data-ack]', root).forEach((el) => { const i = Number(el.dataset.ack); draft.acoes[i] = { ...(draft.acoes[i] || {}), t: el.value }; });
  $$('[data-acd]', root).forEach((el) => { const i = Number(el.dataset.acd); draft.acoes[i] = { ...(draft.acoes[i] || {}), d: el.value }; });
  $$('[data-acr]', root).forEach((el) => { const i = Number(el.dataset.acr); draft.acoes[i] = { ...(draft.acoes[i] || {}), r: el.value }; });
  $$('[data-tx]', root).forEach((el) => { const v = Number(el.value); if (v > 0) draft.taxas[el.dataset.tx] = el.dataset.pct !== undefined ? v / 100 : v; });
  saveDraft();
}

function validQuiz() {
  const q = QUIZ[qi].id;
  if (q === 'curso' && !draft.cursoId) return 'Escolha o curso.';
  if (q === 'meta' && !(Number(draft.metaMatriculas) > 0)) return 'Diga quantas matrículas você quer.';
  if (q === 'turma' && (!draft.turma || draft.turma <= today())) return 'A data da turma precisa ser no futuro.';
  return '';
}

export function mount(root, ctx) {
  root.addEventListener('input', (e) => {
    if (!draft) return;
    if (e.target.matches('[data-tx]') && step === 3) { readStep(root); }
  });
  root.addEventListener('change', (e) => {
    if (draft && e.target.matches('[data-tx]')) { readStep(root); ctx.refresh(); return; }
    const cb = e.target.closest('[data-acao]');
    const p = cb && ctx.params.p && store.get('plans', ctx.params.p);
    if (p) { const ac = [...(p.acoes || [])]; ac[Number(cb.dataset.acao)] = { ...ac[Number(cb.dataset.acao)], feito: cb.checked }; store.put('plans', { ...p, acoes: ac }); }
  });
  root.addEventListener('keydown', (e) => { if (draft && step === 0 && e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); $('[data-w="qnext"]', root)?.click(); } });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.w === 'base') { if (draft) readStep(root); return baseDialog(ctx); }
    if (ds.w === 'newmodel' || ds.editmodel) { if (draft) readStep(root); return modelDialog(ds.editmodel ? (store.settings().cecModelos || []).find((m) => m.id === ds.editmodel) : null, ctx); }
    if (ds.w === 'newest' || ds.editest) { if (draft) readStep(root); return estDialog(ds.editest ? (store.settings().cecEstrategias || []).find((e) => e.id === ds.editest) : null, ctx); }
    if (ds.w === 'new') { draft = blank(); step = 0; qi = 0; saveDraft(); location.hash = '#campanhas?novo=1'; return; }
    if (draft) readStep(root);
    if (ds.set) { draft[ds.set] = ds.val; if (ds.set === 'modelo' || ds.set === 'cursoId') draft.w5hEditado = false; saveDraft(); return ctx.refresh(); }
    if (ds.toggle) { const a = new Set(draft[ds.toggle] || []); a.has(ds.val) ? a.delete(ds.val) : a.add(ds.val); draft[ds.toggle] = [...a]; saveDraft(); return ctx.refresh(); }
    if (ds.est) { let a = draft.estrategias || []; if (a.includes(ds.est)) a = a.filter((x) => x !== ds.est); else { a = [...a, ds.est]; if (a.length > 2) toast('Mais de 2 estratégias ao mesmo tempo dividem verba e atenção. Use com cuidado.', 'warn'); } draft.estrategias = a; draft.w5hEditado = false; saveDraft(); return ctx.refresh(); }
    if (ds.w === 'qnext') { const err = validQuiz(); if (err) return toast(err, 'warn'); if (qi < QUIZ.length - 1) qi++; else step = 1; saveDraft(); return ctx.refresh(); }
    if (ds.w === 'qprev') { qi = Math.max(0, qi - 1); saveDraft(); return ctx.refresh(); }
    if (ds.w === 'next') { step = Math.min(STEPS.length - 1, step + 1); if (step >= 1 && !draft.w5hEditado) draft.w5h = null; saveDraft(); window.scrollTo(0, 0); return ctx.refresh(); }
    if (ds.w === 'prev') { if (step === 1) { step = 0; qi = QUIZ.length - 1; } else step--; saveDraft(); return ctx.refresh(); }
    if (ds.goto !== undefined) { step = Number(ds.goto); saveDraft(); return ctx.refresh(); }
    if (ds.w === 'w5reset') { draft.w5hEditado = false; draft.w5h = null; saveDraft(); return ctx.refresh(); }
    if (ds.w === 'cancel') { if (!confirmButton(b, 'Sair e manter o rascunho?')) return; draft = null; location.hash = '#campanhas'; return; }
    if (ds.w === 'create') return create(ctx);
    if (ds.w === 'exadd') { draft.extras = [...(draft.extras || []), { k: '', v: '' }]; saveDraft(); return ctx.refresh(); }
    if (ds.exrm !== undefined) { draft.extras.splice(Number(ds.exrm), 1); saveDraft(); return ctx.refresh(); }
    if (ds.w === 'acadd') { draft.acoes = [...(draft.acoes || []), { t: '', d: '', r: draft.responsavel || '' }]; saveDraft(); return ctx.refresh(); }
    if (ds.acrm !== undefined) { draft.acoes.splice(Number(ds.acrm), 1); saveDraft(); return ctx.refresh(); }
    const p = ctx.params.p && store.get('plans', ctx.params.p);
    if (!p) return;
    if (ds.opt) {
      const h = health(p); const s = h.sinais.find((x) => x.id === ds.opt); if (!s) return;
      const cec3 = (p.campanhas || []).find((c) => c.etapa === 'CEC3') || p.campanhas?.[0];
      const ind = { 'poucos-leads': 'c_leads', custo: 'c_custoResultado', freq: 'c_custoResultado', atendimento: 'c_matriculas', pagamento: 'c_matriculas', lotou: 'c_matriculas' }[s.id] || 'c_cac';
      const idea = store.put('ideas', { titulo: `${p.nome}: ${s.texto}`, tipo: 'Teste', hipotese: s.acao, indicador: ind, metaMelhoria: 20, campanhaId: cec3?.id || '', cursoId: p.cursoId, status: 'Priorizada', estrategia: s.est, planoId: p.id, impacto: 8, confianca: 6, facilidade: 7 });
      store.put('plans', { ...p, otimizacoes: [...(p.otimizacoes || []), { sinal: s.id, ideaId: idea.id, data: today() }] });
      toast('Mandado para otimização: o teste está em Metas › Ideias e testes, já priorizado.');
      return ctx.refresh();
    }
    if (ds.pa === 'close') {
      const h = health(p);
      openDialog({
        title: 'Encerrar ' + p.nome, saveLabel: 'Encerrar campanha',
        fields: [
          { name: 'matriculas', label: 'Matrículas', type: 'number', value: h.matriculas },
          { name: 'pagantes', label: 'Pagantes', type: 'number', value: h.pagantes },
          { name: 'gasto', label: 'Gasto total (R$)', type: 'number', value: Math.round(h.gasto) },
          { name: 'aprendizado', label: 'O que aprendemos e o que repetir', type: 'textarea', full: true },
        ],
        html: '<p class="hint">Ciclos dentro da meta fazem a fase da operação avançar (validação → otimização → escala).</p>',
        onSave: (d) => {
          const naMeta = d.matriculas >= p.metaMatriculas * 0.9 && (!d.gasto || !d.matriculas || d.gasto / d.matriculas <= (p.verba / p.metaMatriculas) * 1.15);
          store.put('plans', { ...p, status: 'Concluída', resultado: { ...d, naMeta, em: today() } });
          toast(naMeta ? 'Campanha encerrada dentro da meta.' : 'Campanha encerrada. Use o aprendizado no próximo ciclo.');
          location.hash = '#campanhas';
        },
      });
      return;
    }
    if (b.matches('[data-acao]')) return;
    if (ds.acaorm !== undefined) { const ac = [...(p.acoes || [])]; ac.splice(Number(ds.acaorm), 1); store.put('plans', { ...p, acoes: ac }); return ctx.refresh(); }
    if (ds.pa === 'addacao') {
      return openDialog({ title: 'Nova ação', saveLabel: 'Adicionar',
        fields: [{ name: 't', label: 'O que fazer', required: true, full: true }, { name: 'd', label: 'Data', type: 'date' }, { name: 'r', label: 'Responsável', value: p.quiz?.responsavel || '' }],
        onSave: (d) => { store.put('plans', { ...p, acoes: [...(p.acoes || []), { ...d, id: uid('ac') }] }); if (d.d) store.put('calendar', { data: d.d, tipo: 'Tarefa', titulo: d.t + ' · ' + p.nome, responsavel: d.r, cursoId: p.cursoId, status: 'Planejado', planoId: p.id }); ctx.refresh(); } });
    }
    if (ds.pa === 'edit') return editPlan(p, ctx);
    if (ds.pa === 'del') {
      if (!confirmButton(b, 'Excluir plano? (campanhas e leads ficam)')) return;
      store.remove('plans', p.id);
      toast('Plano excluído. As campanhas, a meta e os leads continuam.');
      location.hash = '#campanhas';
    }
  });
}
