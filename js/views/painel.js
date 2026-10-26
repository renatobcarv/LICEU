// Painel: matrículas primeiro, depois metas e testes, depois mídia e funil. Resumo antes do detalhe.

import { store } from '../store.js';
import { esc, brl, brl2, num, pct, fmtDate, fmtDow, today, addDays, inRange, sum, daysBetween } from '../util.js';
import { overview, prevPeriod, delta, diagnostics, NIVEL, weeklySeries, goalProgress, STAGES, courseName, measureTest } from '../metrics.js';
import { barChart, funnel, meter, badge, ICON } from '../ui.js';
import { recebido } from '../leads.js';

export function render(ctx) {
  const { from, to, f } = ctx;
  const o = overview(from, to, f);
  const P = prevPeriod(from, to);
  const p = overview(P.from, P.to, f);
  const hasDemo = store.all('leads').some((l) => l.demo) || store.all('adStats').some((s) => s.demo);
  const t = today();

  // Matrículas
  const mats = store.all('leads').filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, from, to) && (!f.cursoId || l.cursoId === f.cursoId));
  const dMat = delta(mats.length, p.matriculas, 'up');
  const goal = store.all('goals').find((g) => g.indicador === 'matriculas' && g.inicio <= to && g.fim >= from && (!f.cursoId || !g.cursoId || g.cursoId === f.cursoId));
  const gp = goal ? goalProgress(goal) : null;
  const byCourse = {};
  mats.forEach((l) => { byCourse[l.cursoId || ''] = (byCourse[l.cursoId || ''] || 0) + 1; });
  const topCourses = Object.entries(byCourse).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const falta = gp && gp.alvo > (gp.atual || 0) ? gp.alvo - (gp.atual || 0) : 0;
  const diasRest = goal ? Math.max(0, daysBetween(t, goal.fim)) : 0;

  // Metas e estratégias
  const goals = store.all('goals').filter((g) => g.fim >= t && g.inicio <= addDays(t, 30)).sort((a, b) => a.fim.localeCompare(b.fim)).slice(0, 4);
  const testes = store.all('ideas').filter((i) => i.status === 'Em teste');
  const prioridades = store.all('ideas').filter((i) => i.status === 'Priorizada').sort((a, b) => ice(b) - ice(a)).slice(0, 3);

  const kpis = [
    { label: 'Investimento em mídia', value: brl2(o.investimento), d: delta(o.investimento, p.investimento, null), src: 'Meta Ads' },
    { label: 'Resultados no Meta', value: num(o.m.resultados), d: delta(o.m.resultados, p.m.resultados, 'up'), src: 'Custo por resultado: ' + brl2(o.m.custoResultado) },
    { label: 'Conversas no funil', value: num(o.leads), d: delta(o.leads, p.leads, 'up'), src: num(o.leadsMidia) + ' vindas de campanha' },
    { label: 'Conversão em matrícula', value: pct(o.convLead), d: delta(o.convLead, p.convLead, 'up'), src: 'Matrículas ÷ conversas' },
    { label: 'CAC de mídia', value: brl2(o.cac), d: delta(o.cac, p.cac, 'down'), src: 'Investimento ÷ matrículas de campanha' },
    { label: 'Valor matriculado', value: brl(o.receita), d: delta(o.receita, p.receita, 'up'), src: 'Recebido: ' + brl(sum(mats, recebido)) },
  ];

  const fullFunnel = [
    { label: 'Impressões', count: Math.round(o.m.impressoes), source: 'Meta' },
    { label: 'Cliques no link', count: Math.round(o.m.cliques), source: 'Meta' },
    { label: 'Resultados no Meta', count: Math.round(o.m.resultados), source: 'Meta' },
    { label: 'Conversas de campanha no funil', count: o.leadsMidia, source: 'Funil' },
  ];
  const salesF = STAGES.map((s, i) => ({ label: s.label, count: o.s.funil[i] }));
  let worst = -1, worstR = 1;
  for (let i = 1; i < salesF.length; i++) { const prev = salesF[i - 1].count; if (prev >= 5) { const r = salesF[i].count / prev; if (r < worstR) { worstR = r; worst = i; } } }

  const diag = diagnostics(from, to, f);
  const weeks = weeklySeries(from, to, f);
  const agenda = store.all('calendar').filter((i) => inRange(i.data, t, addDays(t, 6)) && i.status !== 'Cancelado').sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))).slice(0, 7);
  const follow = o.s.followVencidos.length + o.s.semContato.length;

  return `
  ${hasDemo ? `<div class="banner warn">Este painel tem dados de exemplo misturados. Remova em <a href="#config">Configurações</a> antes de usar os números.</div>` : ''}

  <div class="hero-grid">
    <section class="card mat-hero hero-ring">
      <div class="mh-main">
        <p class="eyebrow">Matrículas no período</p>
        <p class="mh-num">${num(mats.length)}${gp ? `<small>de ${num(gp.alvo)}</small>` : ''}</p>
        <p class="kpi-d ${dMat.cls}">${esc(dMat.txt)}</p>
        ${gp ? `${meter(gp.progresso, gp.status)}<p class="goal-status ${gp.status}">${esc(gp.texto)}${falta && diasRest ? ` · faltam ${num(falta)} em ${diasRest} ${diasRest > 1 ? 'dias' : 'dia'}` : ''}</p>` : '<p class="muted">Defina uma meta de matrículas em <a href="#metas">Metas</a> para acompanhar o ritmo.</p>'}
      </div>
      ${topCourses.length ? `<ul class="mh-courses">${topCourses.map(([k, n]) => `<li><span>${esc(courseName(k))}</span><b>${n}</b></li>`).join('')}</ul>` : ''}
      <div class="mh-actions"><a class="btn primary" href="#matriculas">${ICON.plus} Registrar matrícula</a><a class="btn" href="#matriculas">Ver matrículas</a></div>
    </section>

    <section class="card">
      <header class="card-head"><div><h2>Metas e estratégias</h2><p class="muted">O que estamos perseguindo e testando agora</p></div><a class="link" href="#metas">Abrir ${ICON.arrow}</a></header>
      ${goals.length ? `<ul class="goal-mini">${goals.map((g) => { const pr = goalProgress(g); return `<li><div class="gm-top"><span>${esc(g.nome)}</span><b>${esc(pr.ind.fmt(pr.atual))} / ${esc(pr.ind.fmt(pr.alvo))}</b></div>${meter(pr.progresso, pr.status)}<small class="${pr.status}">${esc(pr.texto)} · até ${fmtDate(g.fim)}</small></li>`; }).join('')}</ul>` : '<p class="empty-sm">Nenhuma meta ativa. <a href="#metas">Cadastrar meta</a></p>'}
      <h4 class="sub-h">Testes em andamento</h4>
      ${testes.length ? `<ul class="test-mini">${testes.map((i) => { const m = measureTest(i); return `<li><a href="#metas">${esc(i.titulo)}</a>${m && !m.erro ? `<span class="tm-v">${esc(m.ind.label)}: ${esc(m.ind.fmt(m.base))} → <b>${esc(m.ind.fmt(m.cur))}</b> ${m.delta !== null ? `<em class="${m.improved ? 'good' : 'bad'}">${m.delta > 0 ? '+' : ''}${(m.delta * 100).toFixed(0)}%</em>` : ''}</span>` : '<span class="tm-v muted">Sem indicador para medir</span>'}${i.fimTeste ? `<small>${i.fimTeste < t ? 'prazo terminou, registre a decisão' : 'termina em ' + fmtDate(i.fimTeste)}</small>` : ''}</li>`; }).join('')}</ul>` : '<p class="empty-sm">Nenhum teste rodando. <a href="#metas">Planejar um teste</a></p>'}
      ${prioridades.length ? `<h4 class="sub-h">Próximos na fila</h4><ul class="test-mini">${prioridades.map((i) => `<li><span>${esc(i.titulo)}</span><small>nota ${ice(i)}</small></li>`).join('')}</ul>` : ''}
    </section>
  </div>

  <section class="kpis" aria-label="Indicadores do período">
    ${kpis.map((k) => `<article class="kpi"><h3>${esc(k.label)}</h3><p class="kpi-v">${esc(k.value)}</p><p class="kpi-d ${k.d.cls}">${esc(k.d.txt)}</p><p class="kpi-src">${esc(k.src)}</p></article>`).join('')}
  </section>

  <div class="grid-2">
    <section class="card">
      <header class="card-head"><div><h2>Prioridades agora</h2><p class="muted">Geradas a partir dos dados. Confirme antes de mudar verba ou processo.</p></div></header>
      ${diag.length ? `<ul class="diag">${diag.slice(0, 5).map((d) => `<li>${badge(NIVEL[d.nivel].label + ' · ' + d.area, NIVEL[d.nivel].cls)}<h4>${esc(d.titulo)}</h4><p>${esc(d.texto)}</p>${d.acao ? `<a class="link" href="${esc(d.acao.href)}">${esc(d.acao.label)} ${ICON.arrow}</a>` : ''}</li>`).join('')}</ul>${diag.length > 5 ? `<a class="link" href="#relatorios">Ver os ${diag.length} pontos no relatório ${ICON.arrow}</a>` : ''}` : '<p class="empty-sm">Nada fora do padrão neste período.</p>'}
    </section>
    <section class="card">
      <header class="card-head"><div><h2>Do anúncio à matrícula</h2><p class="muted">Mídia (Meta) e funil comercial no mesmo caminho</p></div><a class="link" href="#funil">Funil ${ICON.arrow}</a></header>
      <h4 class="sub-h">Mídia</h4>
      ${o.m.impressoes ? funnel(fullFunnel) : '<p class="empty-sm">Sem métricas de anúncio no período. <a href="#meta">Importar do Gerenciador</a></p>'}
      <h4 class="sub-h">Funil · quem entrou no período</h4>
      ${o.s.leads ? funnel(salesF, { highlight: worst }) : '<p class="empty-sm">Nenhuma conversa registrada no período. <a href="#funil">Abrir funil</a></p>'}
      ${worst > 0 ? `<p class="note">Maior queda: <b>${esc(salesF[worst - 1].label)} → ${esc(salesF[worst].label)}</b> (${pct(worstR, 0)}).</p>` : ''}
    </section>
  </div>

  <section class="card">
    <header class="card-head"><div><h2>Semana a semana</h2><p class="muted">Cada gráfico tem sua própria escala</p></div></header>
    <div class="grid-3">
      <div><h4 class="sub-h">Investimento</h4>${barChart(weeks, { valueKey: 'investimento', fmt: brl, label: 'Investimento por semana' })}</div>
      <div><h4 class="sub-h">Conversas no funil</h4>${barChart(weeks, { valueKey: 'leads', label: 'Conversas por semana' })}</div>
      <div><h4 class="sub-h">Matrículas</h4>${barChart(weeks, { valueKey: 'matriculas', label: 'Matrículas por semana' })}</div>
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <header class="card-head"><h2>Próximos 7 dias</h2><a class="link" href="#calendario">Calendário ${ICON.arrow}</a></header>
      ${agenda.length ? `<ul class="agenda">${agenda.map((i) => `<li><span class="ag-date"><b>${fmtDate(i.data)}</b><small>${fmtDow(i.data)}${i.hora ? ' · ' + esc(i.hora) : ''}</small></span><span class="ag-body"><span><span class="type-dot t-${esc(slug(i.tipo))}"></span>${esc(i.titulo || i.tipo)}</span><small>${esc(i.formato || i.tipo)} · ${esc(i.status || '')}</small></span></li>`).join('')}</ul>` : '<p class="empty-sm">Nada agendado. <a href="#pauta">Criar uma pauta</a></p>'}
    </section>
    <section class="card">
      <header class="card-head"><h2>Operação</h2></header>
      <dl class="stats">
        <div><dt>Publicações</dt><dd>${num(o.c.publicados)} <small>de ${num(o.c.planejados)} planejadas</small></dd></div>
        <div><dt>Reels publicados</dt><dd>${num(o.c.reels)}</dd></div>
        <div><dt>Dias com stories completos</dt><dd>${num(o.c.diasCompletos)}</dd></div>
        <div><dt>Conversas em aberto</dt><dd>${num(o.s.abertos.length)}</dd></div>
        <div><dt>Retornos atrasados ou sem contato</dt><dd class="${follow ? 'bad' : ''}">${num(follow)}</dd></div>
        <div><dt>Primeira resposta média</dt><dd>${o.s.tempoResposta === null ? '—' : num(o.s.tempoResposta) + ' min'}</dd></div>
      </dl>
    </section>
  </div>

  ${o.rows.filter((r) => r.hasStats || r.leads).length ? `
  <section class="card">
    <header class="card-head"><div><h2>Campanhas</h2><p class="muted">Menor custo por matrícula primeiro</p></div><a class="link" href="#meta">Meta Ads ${ICON.arrow}</a></header>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Campanha</th><th>Curso</th><th class="r">Valor gasto</th><th class="r">Resultados</th><th class="r">Conversas no funil</th><th class="r">Matrículas</th><th class="r">CAC</th></tr></thead>
      <tbody>${o.rows.filter((r) => r.hasStats || r.leads).sort((a, b) => (a.cac ?? 1e12) - (b.cac ?? 1e12) || b.investimento - a.investimento).slice(0, 6).map((r) => `<tr><td><a href="#meta?c=${esc(r.id)}">${esc(r.nome)}</a></td><td>${esc(courseName(r.cursoId))}</td><td class="r">${brl2(r.investimento)}</td><td class="r">${num(r.resultados)}${r.tipoResultado ? `<small class="cell-sub">${esc(r.tipoResultado)}</small>` : ''}</td><td class="r">${num(r.leads)}</td><td class="r">${num(r.matriculas)}</td><td class="r"><b>${brl2(r.cac)}</b></td></tr>`).join('')}</tbody>
    </table></div>
  </section>` : ''}
  `;
}

export const ice = (i) => Math.round(((Number(i.impacto) || 0) + (Number(i.confianca) || 0) + (Number(i.facilidade) || 0)) / 3 * 10) / 10;
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');
