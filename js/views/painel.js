// Painel: do anúncio à matrícula numa tela. Resumo primeiro, detalhe depois.

import { store } from '../store.js';
import { esc, brl, brl2, num, pct, fmtDate, fmtDow, today, addDays, inRange } from '../util.js';
import { overview, prevPeriod, delta, diagnostics, NIVEL, weeklySeries, goalProgress, STAGES, courseName } from '../metrics.js';
import { barChart, funnel, meter, badge, ICON } from '../ui.js';

export function render(ctx) {
  const { from, to, f } = ctx;
  const o = overview(from, to, f);
  const P = prevPeriod(from, to);
  const p = overview(P.from, P.to, f);
  const hasDemo = store.all('leads').some((l) => l.demo) || store.all('adStats').some((s) => s.demo);

  const kpis = [
    { label: 'Investimento em mídia', value: brl(o.investimento), d: delta(o.investimento, p.investimento, null), src: 'Meta Ads importado' },
    { label: 'Conversas iniciadas', value: num(o.conversas), d: delta(o.conversas, p.conversas, 'up'), src: 'Contadas pelo Meta', sub: 'Custo por conversa: ' + brl2(o.custoConversa) },
    { label: 'Leads registrados', value: num(o.leads), d: delta(o.leads, p.leads, 'up'), src: 'WhatsApp e vendas', sub: num(o.leadsMidia) + ' vindos de campanha' },
    { hero: true, label: 'Matrículas', value: num(o.matriculas), d: delta(o.matriculas, p.matriculas, 'up'), src: 'Leads marcados como matriculados', sub: 'Conversão lead → matrícula: ' + pct(o.convLead) },
    { label: 'CAC de mídia', value: brl2(o.cac), d: delta(o.cac, p.cac, 'down'), src: 'Investimento ÷ matrículas de campanha', sub: 'CPL: ' + brl2(o.cpl) },
    { label: 'Receita de matrículas', value: brl(o.receita), d: delta(o.receita, p.receita, 'up'), src: 'Valor informado na matrícula', sub: 'Retorno sobre mídia: ' + (o.roas === null ? '—' : o.roas.toFixed(1).replace('.', ',') + 'x') },
  ];

  const fullFunnel = [
    { label: 'Impressões', count: Math.round(o.m.impressoes), source: 'Meta' },
    { label: 'Cliques no link', count: Math.round(o.m.cliques), source: 'Meta' },
    { label: 'Conversas iniciadas', count: Math.round(o.conversas), source: 'Meta' },
    { label: 'Leads de campanha registrados', count: o.leadsMidia, source: 'WhatsApp' },
  ];
  const salesF = STAGES.map((s, i) => ({ label: s.label, count: o.s.funil[i] }));
  let worst = -1, worstR = 1;
  for (let i = 1; i < salesF.length; i++) { const prev = salesF[i - 1].count; if (prev >= 5) { const r = salesF[i].count / prev; if (r < worstR) { worstR = r; worst = i; } } }

  const diag = diagnostics(from, to, f);
  const weeks = weeklySeries(from, to, f);
  const t = today();
  const agenda = store.all('calendar').filter((i) => inRange(i.data, t, addDays(t, 6)) && i.status !== 'Cancelado').sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))).slice(0, 8);
  const goals = store.all('goals').filter((g) => g.fim >= t && g.inicio <= addDays(t, 30)).slice(0, 5);
  const follow = o.s.followVencidos.length + o.s.semContato.length;

  return `
  ${hasDemo ? `<div class="banner warn">Este painel tem dados de exemplo misturados. Remova em <a href="#config">Configurações</a> antes de usar os números.</div>` : ''}
  <section class="kpis" aria-label="Indicadores do período">
    ${kpis.map((k) => `<article class="kpi${k.hero ? ' hero' : ''}"><h3>${esc(k.label)}</h3><p class="kpi-v">${esc(k.value)}</p>${k.sub ? `<p class="kpi-sub">${esc(k.sub)}</p>` : ''}<p class="kpi-d ${k.d.cls}">${esc(k.d.txt)}</p><p class="kpi-src">${esc(k.src)}</p></article>`).join('')}
  </section>

  <div class="grid-2">
    <section class="card">
      <header class="card-head"><div><h2>Prioridades agora</h2><p class="muted">Geradas a partir dos dados. Confirme antes de mudar verba ou processo.</p></div></header>
      ${diag.length ? `<ul class="diag">${diag.slice(0, 6).map((d) => `<li class="diag-${NIVEL[d.nivel].cls}">${badge(NIVEL[d.nivel].label + ' · ' + d.area, NIVEL[d.nivel].cls)}<h4>${esc(d.titulo)}</h4><p>${esc(d.texto)}</p>${d.acao ? `<a class="link" href="${esc(d.acao.href)}">${esc(d.acao.label)} ${ICON.arrow}</a>` : ''}</li>`).join('')}</ul>${diag.length > 6 ? `<a class="link" href="#relatorios">Ver os ${diag.length} pontos no relatório ${ICON.arrow}</a>` : ''}` : '<p class="empty-sm">Nada fora do padrão neste período.</p>'}
    </section>

    <section class="card">
      <header class="card-head"><div><h2>Do anúncio à matrícula</h2><p class="muted">Mídia (Meta) e atendimento (WhatsApp) no mesmo funil</p></div></header>
      <h4 class="sub-h">Mídia</h4>
      ${o.m.impressoes ? funnel(fullFunnel) : '<p class="empty-sm">Sem métricas de anúncio no período. <a href="#meta">Importar do Gerenciador</a></p>'}
      <h4 class="sub-h">Atendimento · leads que entraram no período</h4>
      ${o.s.leads ? funnel(salesF, { highlight: worst }) : '<p class="empty-sm">Nenhum lead registrado no período. <a href="#vendas">Registrar leads</a></p>'}
      ${worst > 0 ? `<p class="note">Maior queda: <b>${esc(salesF[worst - 1].label)} → ${esc(salesF[worst].label)}</b> (${pct(worstR, 0)}).</p>` : ''}
    </section>
  </div>

  <section class="card">
    <header class="card-head"><div><h2>Semana a semana</h2><p class="muted">Cada gráfico tem sua própria escala</p></div></header>
    <div class="grid-3">
      <div><h4 class="sub-h">Investimento</h4>${barChart(weeks, { valueKey: 'investimento', fmt: brl, label: 'Investimento por semana' })}</div>
      <div><h4 class="sub-h">Leads registrados</h4>${barChart(weeks, { valueKey: 'leads', label: 'Leads por semana' })}</div>
      <div><h4 class="sub-h">Matrículas</h4>${barChart(weeks, { valueKey: 'matriculas', label: 'Matrículas por semana' })}</div>
    </div>
  </section>

  <div class="grid-3">
    <section class="card">
      <header class="card-head"><h2>Próximos 7 dias</h2><a class="link" href="#calendario">Calendário</a></header>
      ${agenda.length ? `<ul class="agenda">${agenda.map((i) => `<li><span class="ag-date"><b>${fmtDate(i.data)}</b><small>${fmtDow(i.data)}${i.hora ? ' · ' + esc(i.hora) : ''}</small></span><span class="ag-body"><span class="type-dot t-${esc(slug(i.tipo))}"></span>${esc(i.titulo || i.tipo)}<small>${esc(i.tipo)} · ${esc(i.status || '')}</small></span></li>`).join('')}</ul>` : '<p class="empty-sm">Nada agendado. <a href="#calendario">Planejar a semana</a></p>'}
    </section>
    <section class="card">
      <header class="card-head"><h2>Metas em andamento</h2><a class="link" href="#metas">Metas</a></header>
      ${goals.length ? `<ul class="goal-mini">${goals.map((g) => { const pr = goalProgress(g); return `<li><div class="gm-top"><span>${esc(g.nome)}</span><b>${esc(pr.ind.fmt(pr.atual))} / ${esc(pr.ind.fmt(pr.alvo))}</b></div>${meter(pr.progresso, pr.status)}<small class="${pr.status}">${esc(pr.texto)}</small></li>`; }).join('')}</ul>` : '<p class="empty-sm">Nenhuma meta ativa. <a href="#metas">Cadastrar metas</a></p>'}
    </section>
    <section class="card">
      <header class="card-head"><h2>Operação</h2></header>
      <dl class="stats">
        <div><dt>Publicações</dt><dd>${num(o.c.publicados)} <small>de ${num(o.c.planejados)} planejadas</small></dd></div>
        <div><dt>Reels publicados</dt><dd>${num(o.c.reels)}</dd></div>
        <div><dt>Dias com stories completos</dt><dd>${num(o.c.diasCompletos)} <small>de ${num(o.c.storiesDias)} registrados</small></dd></div>
        <div><dt>Leads em aberto</dt><dd>${num(o.s.abertos.length)}</dd></div>
        <div><dt>Retornos atrasados ou sem contato</dt><dd class="${follow ? 'bad' : ''}">${num(follow)}</dd></div>
        <div><dt>Primeira resposta média</dt><dd>${o.s.tempoResposta === null ? '—' : num(o.s.tempoResposta) + ' min'}</dd></div>
      </dl>
    </section>
  </div>

  ${o.rows.filter((r) => r.hasStats || r.leads).length ? `
  <section class="card">
    <header class="card-head"><div><h2>Campanhas por CAC</h2><p class="muted">Menor custo por matrícula primeiro</p></div><a class="link" href="#meta">Ver todas</a></header>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Campanha</th><th>Curso</th><th class="r">Investimento</th><th class="r">Conversas</th><th class="r">Leads</th><th class="r">Matrículas</th><th class="r">CAC</th></tr></thead>
      <tbody>${o.rows.filter((r) => r.hasStats || r.leads).sort((a, b) => (a.cac ?? 1e12) - (b.cac ?? 1e12)).slice(0, 6).map((r) => `<tr><td><a href="#meta?c=${esc(r.id)}">${esc(r.nome)}</a></td><td>${esc(courseName(r.cursoId))}</td><td class="r">${brl(r.investimento)}</td><td class="r">${num(r.conversas)}</td><td class="r">${num(r.leads)}</td><td class="r">${num(r.matriculas)}</td><td class="r"><b>${brl2(r.cac)}</b></td></tr>`).join('')}</tbody>
    </table></div>
  </section>` : ''}
  `;
}

export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');
