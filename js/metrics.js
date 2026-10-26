// Todos os cálculos ficam aqui, num lugar só. Painel, Meta Ads, Metas e Relatórios
// chamam as mesmas funções, então um número nunca aparece diferente em duas telas.

import { store } from './store.js';
import { sum, div, inRange, daysBetween, addDays, weekStart, toDate, iso, brl, brl2, pct, num, fmtDate, today } from './util.js';

export const STAGES = [
  { id: 'novo', label: 'Novo contato' },
  { id: 'conversa', label: 'Em conversa' },
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'matriculado', label: 'Matriculado' },
];
export const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
export const LOSS_REASONS = ['Preço', 'Sem retorno', 'Horário ou turno', 'Distância', 'Desistiu', 'Escolheu concorrente', 'Sem perfil para o curso'];
export const ORIGENS = ['Meta Ads', 'Instagram orgânico', 'Indicação', 'Google', 'Passante / balcão', 'Site', 'Outro'];

export const settings = () => ({
  unidade: 'TEC Mais · Valparaíso de Goiás',
  instagram: '@tecmais.valparaisodegoias',
  coordenador: 'Coordenação de marketing',
  metaStoriesDia: 5,
  ctrMin: 0.8,
  freqMax: 3,
  pilares: ['Cursos e profissões', 'Captação e vendas', 'Identificação', 'Relacionamento e comunidade', 'Bastidores', 'Prova social'],
  responsaveis: [],
  ...store.settings(),
});

export const courseName = (id) => store.get('courses', id)?.nome || (id ? 'Curso removido' : 'Sem curso');
export const campaignName = (id) => store.get('campaigns', id)?.nome || (id ? 'Campanha removida' : 'Sem campanha');

// Índice da etapa mais avançada que o lead já alcançou (perdidos guardam até onde chegaram).
export const reached = (l) => (l.etapa === 'perdido' ? (l.etapaMax ?? 0) : Math.max(STAGE_IDX[l.etapa] ?? 0, l.etapaMax ?? 0));

// ---------- Mídia ----------
// Uma linha de métrica cobre um intervalo (início–fim). Quando o período escolhido pega só
// parte dele, os valores entram proporcionalmente aos dias. Exporte por dia do Gerenciador
// para não depender dessa proporção.
function share(stat, from, to) {
  const a = stat.inicio || stat.fim, b = stat.fim || stat.inicio;
  if (!a) return 0;
  const s = a > from ? a : from, e = b < to ? b : to;
  if (s > e) return 0;
  return (daysBetween(s, e) + 1) / (daysBetween(a, b) + 1);
}
// Contagens somáveis. Taxas e custos (CTR, CPC, CPM, frequência...) são sempre recalculados a partir
// delas, para nunca divergirem entre telas nem depois de uma correção manual.
export const METRIC_KEYS = ['investimento', 'impressoes', 'alcance', 'cliques', 'cliquesTodos', 'cliquesLinkUnicos', 'cliquesUnicosTodos', 'resultados', 'conversas', 'leadsMeta', 'compras', 'comprasApp', 'comprasSite', 'comprasOffline', 'comprasMeta'];

export function campaignFilter(f = {}) {
  return (c) => (!f.cursoId || c.cursoId === f.cursoId) && (!f.canal || c.canal === f.canal);
}

// Agrega mídia + comercial por campanha no período.
export function campaignRows(from, to, f = {}) {
  const camps = store.all('campaigns').filter(campaignFilter(f));
  const stats = store.all('adStats');
  const leads = store.all('leads');
  return camps.map((c) => {
    const row = { ...c, ads: {} };
    METRIC_KEYS.forEach((k) => (row[k] = 0));
    let hasStats = false;
    stats.filter((s) => s.campanhaId === c.id).forEach((s) => {
      const w = share(s, from, to);
      if (!w) return;
      hasStats = true;
      if (s.tipoResultado) (row.tipos || (row.tipos = new Set())).add(s.tipoResultado);
      const key = s.anuncio || '(sem nome de anúncio)';
      const ad = row.ads[key] || (row.ads[key] = { nome: key, conjunto: s.conjunto || '' });
      METRIC_KEYS.forEach((k) => { const v = (Number(s[k]) || 0) * w; row[k] += v; ad[k] = (ad[k] || 0) + v; });
    });
    row.hasStats = hasStats;
    row.tipoResultado = row.tipos ? Array.from(row.tipos).join(' + ') : '';
    const cl = leads.filter((l) => l.campanhaId === c.id);
    row.leads = cl.filter((l) => inRange(l.entrada, from, to)).length;
    const mats = cl.filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, from, to));
    row.matriculas = mats.length;
    row.receita = sum(mats, (l) => l.valor);
    Object.values(row.ads).forEach((ad) => {
      const al = cl.filter((l) => l.anuncio && l.anuncio === ad.nome);
      ad.leads = al.filter((l) => inRange(l.entrada, from, to)).length;
      ad.matriculas = al.filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, from, to)).length;
      derive(ad);
    });
    row.adList = Object.values(row.ads).sort((a, b) => b.investimento - a.investimento);
    return derive(row);
  }).filter((r) => r.hasStats || r.leads || r.matriculas || r.status === 'Ativa');
}

function derive(r) {
  r.ctr = div(r.cliques, r.impressoes);
  r.cpc = div(r.investimento, r.cliques);
  r.cpm = r.impressoes ? (r.investimento / r.impressoes) * 1000 : null;
  r.freq = div(r.impressoes, r.alcance);
  r.custoResultado = div(r.investimento, r.resultados);
  r.cpcUnico = div(r.investimento, r.cliquesUnicosTodos);
  r.custoMilAlcance = r.alcance ? (r.investimento / r.alcance) * 1000 : null;
  r.custoConversa = div(r.investimento, r.conversas || r.leadsMeta);
  r.cpl = div(r.investimento, r.leads);
  r.cac = r.matriculas ? r.investimento / r.matriculas : null;
  r.roas = div(r.receita, r.investimento);
  r.convLead = div(r.matriculas, r.leads);
  return r;
}

export function mediaTotals(rows) {
  const t = {};
  METRIC_KEYS.concat(['leads', 'matriculas', 'receita']).forEach((k) => (t[k] = sum(rows, (r) => r[k])));
  return derive(t);
}

// ---------- Comercial ----------
const leadFilter = (f = {}) => (l) => (!f.cursoId || l.cursoId === f.cursoId);

export function salesStats(from, to, f = {}) {
  const all = store.all('leads').filter(leadFilter(f));
  const entrou = all.filter((l) => inRange(l.entrada, from, to));
  const mats = all.filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, from, to));
  const perdidos = all.filter((l) => l.etapa === 'perdido' && inRange(l.dataPerda || l.updatedAt, from, to));
  const counts = STAGES.map((_, i) => entrou.filter((l) => reached(l) >= i).length);
  const motivos = {};
  perdidos.forEach((l) => { const m = l.motivoPerda || 'Sem motivo registrado'; motivos[m] = (motivos[m] || 0) + 1; });
  const porOrigem = {};
  entrou.forEach((l) => {
    const o = l.origem || 'Outro';
    const x = porOrigem[o] || (porOrigem[o] = { origem: o, leads: 0, matriculas: 0 });
    x.leads++;
    if (l.etapa === 'matriculado') x.matriculas++;
  });
  const t = today();
  const followVencidos = all.filter((l) => !['matriculado', 'perdido'].includes(l.etapa) && l.proximaData && l.proximaData < t);
  const semContato = all.filter((l) => l.etapa === 'novo' && l.entrada && daysBetween(l.entrada, t) >= 1);
  const resp = entrou.map((l) => Number(l.primeiraResposta)).filter((v) => v > 0);
  return {
    leads: entrou.length, matriculas: mats.length, receita: sum(mats, (l) => l.valor), perdidos: perdidos.length,
    funil: counts, motivos, porOrigem: Object.values(porOrigem).sort((a, b) => b.leads - a.leads),
    followVencidos, semContato, abertos: all.filter((l) => !['matriculado', 'perdido'].includes(l.etapa)),
    tempoResposta: resp.length ? sum(resp) / resp.length : null, convLead: div(mats.length, entrou.length),
  };
}

// ---------- Conteúdo ----------
export function contentStats(from, to, f = {}) {
  const items = store.all('calendar').filter((i) => inRange(i.data, from, to) && (!f.cursoId || i.cursoId === f.cursoId));
  const posts = items.filter((i) => i.tipo === 'Publicação');
  const pub = posts.filter((i) => i.status === 'Publicado');
  const t = today();
  const atrasados = posts.filter((i) => i.data < t && !['Publicado', 'Cancelado'].includes(i.status));
  const s = settings();
  const stories = store.all('stories').filter((d) => inRange(d.id, from, to));
  const diasCompletos = stories.filter((d) => storiesCount(d) >= (s.metaStoriesDia || 5)).length;
  const score = (i) => { const m = i.metricas || {}; return (Number(m.conversas) || 0) * 10 + (Number(m.comentarios) || 0) * 3 + (Number(m.compartilhamentos) || 0) * 3 + (Number(m.salvamentos) || 0) * 2 + (Number(m.interacoes) || 0) * 0.5 + (Number(m.alcance) || 0) * 0.01; };
  const ranked = pub.filter((i) => score(i) > 0).sort((a, b) => score(b) - score(a));
  const byFormato = {};
  pub.forEach((i) => { byFormato[i.formato || 'Outro'] = (byFormato[i.formato || 'Outro'] || 0) + 1; });
  return {
    planejados: posts.filter((i) => i.status !== 'Cancelado').length, publicados: pub.length, atrasados, ranked, byFormato,
    reels: pub.filter((i) => i.formato === 'Reels' || i.formato === 'Vídeo motion').length,
    gravacoes: items.filter((i) => i.tipo === 'Gravação').length, storiesDias: stories.length, diasCompletos,
    conversasConteudo: sum(pub, (i) => i.metricas?.conversas),
  };
}

export const STORY_BLOCKS = [
  { id: 'bomdia', label: 'Bom dia / Agenda' },
  { id: 'bastidores', label: 'Bastidores' },
  { id: 'aula', label: 'Aula / Movimento' },
  { id: 'interacao', label: 'Interação' },
  { id: 'cta', label: 'Curso / CTA' },
];
export const storiesCount = (d) => STORY_BLOCKS.filter((b) => d?.blocos?.[b.id] === 'Feito').length + (Number(d?.extras) || 0);

// ---------- Visão geral ----------
export function overview(from, to, f = {}) {
  const rows = campaignRows(from, to, f);
  const m = mediaTotals(rows);
  const s = salesStats(from, to, f);
  const c = contentStats(from, to, f);
  const leadsMidia = sum(rows, (r) => r.leads);
  return {
    rows, m, s, c,
    investimento: m.investimento, conversas: m.conversas || m.leadsMeta, leads: s.leads, matriculas: s.matriculas, receita: s.receita,
    custoConversa: m.custoConversa,
    cpl: div(m.investimento, leadsMidia),
    cac: s.matriculas && m.investimento ? m.investimento / sum(rows, (r) => r.matriculas) : null,
    cacGeral: s.matriculas ? m.investimento / s.matriculas : null,
    roas: div(s.receita, m.investimento),
    convLead: s.convLead,
    leadsMidia,
  };
}

export function prevPeriod(from, to) {
  const n = daysBetween(from, to) + 1;
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

// Série semanal (segunda a domingo) dentro do período.
export function weeklySeries(from, to, f = {}) {
  const weeks = [];
  let w = weekStart(from);
  while (w <= to) { weeks.push(w); w = addDays(w, 7); }
  const leads = store.all('leads').filter(leadFilter(f));
  const camps = new Set(store.all('campaigns').filter(campaignFilter(f)).map((c) => c.id));
  const stats = store.all('adStats').filter((s) => camps.has(s.campanhaId));
  return weeks.map((ws) => {
    const a = ws < from ? from : ws, we = addDays(ws, 6), b = we > to ? to : we;
    return {
      inicio: ws, label: fmtDate(a),
      leads: leads.filter((l) => inRange(l.entrada, a, b)).length,
      matriculas: leads.filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, a, b)).length,
      investimento: sum(stats, (s) => (Number(s.investimento) || 0) * share(s, a, b)),
    };
  });
}

// ---------- Metas ----------
export const INDICATORS = [
  { id: 'matriculas', label: 'Matrículas', dir: 'up', fmt: num, calc: (a, b, f) => salesStats(a, b, f).matriculas },
  { id: 'leads', label: 'Leads no WhatsApp', dir: 'up', fmt: num, calc: (a, b, f) => salesStats(a, b, f).leads },
  { id: 'receita', label: 'Receita de matrículas', dir: 'up', fmt: brl, calc: (a, b, f) => salesStats(a, b, f).receita },
  { id: 'convLead', label: 'Conversão lead → matrícula', dir: 'up', fmt: pct, pctInput: true, calc: (a, b, f) => salesStats(a, b, f).convLead },
  { id: 'cac', label: 'CAC de mídia (máximo)', dir: 'down', fmt: brl2, calc: (a, b, f) => overview(a, b, f).cac },
  { id: 'cpl', label: 'Custo por lead (máximo)', dir: 'down', fmt: brl2, calc: (a, b, f) => overview(a, b, f).cpl },
  { id: 'custoConversa', label: 'Custo por conversa (máximo)', dir: 'down', fmt: brl2, calc: (a, b, f) => overview(a, b, f).custoConversa },
  { id: 'investimento', label: 'Investimento em mídia (teto)', dir: 'down', fmt: brl, calc: (a, b, f) => overview(a, b, f).investimento },
  { id: 'publicacoes', label: 'Publicações no feed', dir: 'up', fmt: num, calc: (a, b, f) => contentStats(a, b, f).publicados },
  { id: 'reels', label: 'Reels publicados', dir: 'up', fmt: num, calc: (a, b, f) => contentStats(a, b, f).reels },
  { id: 'stories', label: 'Dias com stories completos', dir: 'up', fmt: num, calc: (a, b, f) => contentStats(a, b, f).diasCompletos },
  { id: 'seguidores', label: 'Novos seguidores', dir: 'up', fmt: num, calc: (a, b) => weeklyField(a, b, (w) => (w.seguidoresFim != null && w.seguidoresInicio != null ? w.seguidoresFim - w.seguidoresInicio : null)) },
  { id: 'depoimentos', label: 'Depoimentos gravados', dir: 'up', fmt: num, calc: (a, b) => weeklyField(a, b, (w) => w.depoimentos) },
  { id: 'avaliacoes', label: 'Avaliações no Google', dir: 'up', fmt: num, calc: (a, b) => weeklyField(a, b, (w) => w.avaliacoesGoogle) },
  { id: 'manual', label: 'Outro (valor atualizado à mão)', dir: 'up', fmt: num, calc: () => null },
];
export const IND = Object.fromEntries(INDICATORS.map((i) => [i.id, i]));

function weeklyField(a, b, get) {
  const vals = store.all('weekly').filter((w) => inRange(w.id, addDays(a, -6), b) && w.id >= weekStart(a)).map(get).filter((v) => v !== null && v !== undefined && v !== '');
  return vals.length ? sum(vals) : null;
}

export function goalProgress(g) {
  const ind = IND[g.indicador] || IND.manual;
  const f = { cursoId: g.cursoId || '' };
  const t = today();
  const end = g.fim < t ? g.fim : t;
  let atual = g.indicador === 'manual' ? (g.atualManual === '' || g.atualManual == null ? null : Number(g.atualManual)) : ind.calc(g.inicio, end < g.inicio ? g.inicio : end, f);
  const alvo = Number(g.alvo);
  const total = daysBetween(g.inicio, g.fim) + 1;
  const passados = t < g.inicio ? 0 : Math.min(total, daysBetween(g.inicio, t) + 1);
  const tempo = total ? passados / total : 1;
  let progresso = null, status = 'sem-dado', texto = 'Sem dado no período';
  if (atual !== null && alvo) {
    if (ind.dir === 'up') {
      progresso = atual / alvo;
      const esperado = alvo * tempo;
      if (atual >= alvo) { status = 'ok'; texto = 'Meta atingida'; }
      else if (t > g.fim) { status = 'bad'; texto = 'Encerrada abaixo da meta'; }
      else if (t < g.inicio) { status = 'neutral'; texto = 'Começa em ' + fmtDate(g.inicio); }
      else if (atual >= esperado * 0.9) { status = 'ok'; texto = 'No ritmo'; }
      else { status = 'warn'; texto = 'Abaixo do ritmo: esperado ' + ind.fmt(ind.pctInput ? esperado : Math.round(esperado)) + ' até hoje'; }
    } else {
      progresso = atual <= alvo ? 1 : alvo / atual;
      if (atual <= alvo) { status = 'ok'; texto = 'Dentro do limite'; }
      else { status = t > g.fim ? 'bad' : 'warn'; texto = 'Acima do limite em ' + pct(atual / alvo - 1, 0); }
    }
  }
  return { ind, atual, alvo, progresso, status, texto, tempo };
}

// ---------- Diagnóstico ----------
// Regras simples e explícitas. Cada item diz o que foi visto, por que importa e o próximo passo.
export function diagnostics(from, to, f = {}) {
  const out = [];
  const st = settings();
  const o = overview(from, to, f);
  const P = prevPeriod(from, to);
  const po = overview(P.from, P.to, f);
  const add = (nivel, area, titulo, texto, acao) => out.push({ nivel, area, titulo, texto, acao });
  const withStats = o.rows.filter((r) => r.hasStats);

  if (!withStats.length) add('dados', 'Dados', 'Nenhuma métrica de anúncio no período', 'Sem investimento registrado, o painel não calcula custo por lead nem CAC. Importe o relatório do Gerenciador de Anúncios.', { label: 'Importar Meta Ads', href: '#meta' });
  if (o.conversas > 0 && o.leadsMidia < o.conversas * 0.5) add('dados', 'Dados', 'Conversas do anúncio não estão virando registro no WhatsApp', `O Meta contou ${num(o.conversas)} conversas e só ${num(o.leadsMidia)} leads foram registrados com campanha. Sem esse registro não dá para saber qual anúncio matricula.`, { label: 'Registrar leads', href: '#vendas' });

  const avgCC = o.custoConversa;
  withStats.forEach((r) => {
    if (r.impressoes > 1000 && r.ctr !== null && r.ctr * 100 < st.ctrMin) add('problema', 'Mídia', `${r.nome}: CTR de ${pct(r.ctr, 2)}`, `Abaixo de ${st.ctrMin}%. O criativo não está fazendo a pessoa parar. Teste um gancho novo nos 3 primeiros segundos.`, { label: 'Criar pauta de anúncio', href: '#pauta?curso=' + (r.cursoId || '') + '&anuncio=1' });
    if (r.freq !== null && r.freq > st.freqMax) add('atencao', 'Mídia', `${r.nome}: frequência ${String(r.freq.toFixed(1)).replace('.', ',')}`, 'O mesmo público está vendo o anúncio muitas vezes. Troque o criativo ou amplie o público antes que o custo suba.', { label: 'Ver campanha', href: '#meta?c=' + r.id });
    if (avgCC && r.custoConversa && r.custoConversa > avgCC * 1.3 && withStats.length > 1) add('problema', 'Mídia', `${r.nome}: custo por conversa ${pct(r.custoConversa / avgCC - 1, 0)} acima da média`, `${brl2(r.custoConversa)} contra ${brl2(avgCC)} de média. Revise público e criativo ou mova verba para a campanha mais barata.`, { label: 'Comparar campanhas', href: '#meta' });
    if (r.leads >= 8 && r.matriculas === 0) add('problema', 'Comercial', `${r.nome}: ${num(r.leads)} leads e nenhuma matrícula`, 'O anúncio atrai, mas a conversa não fecha. Veja os motivos de perda e o tempo de resposta desses leads.', { label: 'Ver funil', href: '#vendas' });
  });
  const goodCac = withStats.filter((r) => r.cac !== null && r.matriculas >= 2).sort((a, b) => a.cac - b.cac);
  if (goodCac.length > 1 && o.cac && goodCac[0].cac < o.cac * 0.8) {
    const b = goodCac[0];
    add('oportunidade', 'Mídia', `${b.nome} tem o menor CAC`, `${brl2(b.cac)} por matrícula, ${pct(1 - b.cac / o.cac, 0)} abaixo da média, com ${b.matriculas} matrículas. Teste aumentar a verba em 20% e acompanhe por uma semana.`, { label: 'Registrar teste', href: '#metas?ideia=escalar&c=' + b.id });
  }

  // Funil comercial: maior queda entre etapas, comparando com o período anterior.
  const fn = o.s.funil, pf = po.s.funil;
  let worst = null;
  for (let i = 1; i < fn.length; i++) {
    const r = div(fn[i], fn[i - 1]), pr = div(pf[i], pf[i - 1]);
    if (r === null || fn[i - 1] < 5) continue;
    const drop = pr !== null ? pr - r : 0;
    if (!worst || r < worst.r) worst = { i, r, pr, drop };
  }
  if (worst && worst.r < 0.5) add(worst.drop > 0.05 ? 'problema' : 'atencao', 'Comercial', `Gargalo: ${STAGES[worst.i - 1].label} → ${STAGES[worst.i].label} (${pct(worst.r, 0)})`, 'É a etapa onde mais gente para.' + (worst.pr !== null ? ` No período anterior era ${pct(worst.pr, 0)}.` : '') + ' Revise o roteiro de atendimento dessa etapa.', { label: 'Abrir funil', href: '#vendas' });
  if (o.s.semContato.length) add('problema', 'Comercial', `${o.s.semContato.length} ${o.s.semContato.length > 1 ? 'leads estão' : 'lead está'} sem primeiro contato há mais de 1 dia`, 'Lead de anúncio esfria rápido. Responda hoje.', { label: 'Ver leads novos', href: '#vendas?etapa=novo' });
  if (o.s.followVencidos.length) add('atencao', 'Comercial', `${o.s.followVencidos.length} ${o.s.followVencidos.length > 1 ? 'retornos atrasados' : 'retorno atrasado'}`, 'Leads com próxima ação vencida. Cada dia sem retorno reduz a chance de matrícula.', { label: 'Ver retornos', href: '#vendas?vencidos=1' });
  const mot = Object.entries(o.s.motivos).sort((a, b) => b[1] - a[1])[0];
  if (mot && o.s.perdidos >= 4 && mot[1] / o.s.perdidos >= 0.3) add('atencao', 'Comercial', `"${mot[0]}" explica ${pct(mot[1] / o.s.perdidos, 0)} das perdas`, 'Crie uma resposta pronta para essa objeção e um conteúdo que a trate antes da conversa.', { label: 'Criar pauta sobre a objeção', href: '#pauta?objecao=' + encodeURIComponent(mot[0]) });
  if (o.s.tempoResposta && o.s.tempoResposta > 30) add('atencao', 'Comercial', `Tempo médio de primeira resposta: ${num(o.s.tempoResposta)} min`, 'Acima de 30 minutos a conversa costuma esfriar. Use respostas rápidas ou uma mensagem automática fora do horário.', { label: 'Registrar ideia', href: '#metas?ideia=resposta' });

  // Conteúdo
  if (o.c.atrasados.length) add('atencao', 'Conteúdo', `${o.c.atrasados.length} ${o.c.atrasados.length > 1 ? 'publicações passaram da data' : 'publicação passou da data'} sem publicar`, o.c.atrasados.slice(0, 3).map((i) => fmtDate(i.data) + ' ' + (i.titulo || '')).join(' · '), { label: 'Abrir calendário', href: '#calendario' });
  if (o.c.planejados && o.c.publicados / o.c.planejados < 0.7 && to <= today()) add('atencao', 'Conteúdo', `Só ${pct(o.c.publicados / o.c.planejados, 0)} do planejado foi publicado`, `${o.c.publicados} de ${o.c.planejados} publicações. Planeje menos e cumpra tudo, ou grave em lote.`, { label: 'Abrir calendário', href: '#calendario' });
  if (o.c.ranked[0]) { const b = o.c.ranked[0]; add('oportunidade', 'Conteúdo', `Melhor conteúdo: ${b.titulo || b.formato}`, `${b.formato || ''} de ${fmtDate(b.data)}. ${b.metricas?.conversas ? num(b.metricas.conversas) + ' conversas geradas. ' : ''}Faça uma variação com outro gancho ou impulsione como anúncio.`, { label: 'Criar variação', href: '#pauta?de=' + b.id }); }

  // Metas
  store.all('goals').filter((g) => g.inicio <= to && g.fim >= from).forEach((g) => {
    const p = goalProgress(g);
    if (p.status === 'warn' || p.status === 'bad') add(p.status === 'bad' ? 'problema' : 'atencao', 'Metas', `${g.nome}: ${p.ind.fmt(p.atual)} de ${p.ind.fmt(p.alvo)}`, p.texto + '.', { label: 'Ver metas', href: '#metas' });
  });

  const order = { problema: 0, dados: 1, atencao: 2, oportunidade: 3 };
  return out.sort((a, b) => order[a.nivel] - order[b.nivel]);
}

export const NIVEL = {
  problema: { label: 'Problema', cls: 'bad' },
  atencao: { label: 'Atenção', cls: 'warn' },
  oportunidade: { label: 'Oportunidade', cls: 'good' },
  dados: { label: 'Dados', cls: 'info' },
};

export function delta(cur, prev, dir) {
  if (cur === null || cur === undefined || prev === null || prev === undefined || !prev) return { txt: 'sem base de comparação', cls: 'neutral' };
  const d = (cur - prev) / Math.abs(prev);
  const txt = (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100).toFixed(0) + '% vs. período anterior';
  if (!dir || Math.abs(d) < 0.005) return { txt, cls: 'neutral' };
  const better = dir === 'up' ? d > 0 : d < 0;
  return { txt, cls: better ? 'good' : 'bad' };
}

export { iso, toDate };
