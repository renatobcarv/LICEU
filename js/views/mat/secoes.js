// Seções da Matrículas › Visão geral. Cada função recebe o resultado de matriculasDash (metrics.js)
// e devolve o HTML da sua seção. Nenhuma conta aqui: só apresentação.

import { esc, brl, brl2, num, pct, fmtDate } from '../../util.js';
import { meter, lineChart, donut, ICON } from '../../ui.js';

const delta = (a, b, dir = 'up') => {
  if (a === null || a === undefined || b === null || b === undefined) return '<span class="kpi-d">sem comparação</span>';
  if (!b) return a ? '<span class="kpi-d good">novo no período</span>' : '<span class="kpi-d">igual ao anterior</span>';
  const d = a / b - 1;
  if (Math.abs(d) < 0.005) return '<span class="kpi-d">igual ao anterior</span>';
  const bom = dir === 'up' ? d > 0 : d < 0;
  return `<span class="kpi-d ${bom ? 'good' : 'bad'}">${d > 0 ? '↗' : '↘'} ${pct(Math.abs(d), 0)} vs anterior</span>`;
};
const card = (titulo, valor, extra = '', cls = '') => `<article class="kpi ${cls}"><h3>${titulo}</h3><p class="kpi-v">${valor}</p>${extra}</article>`;

export function kpis(d, { financeiro = true } = {}) {
  const k = d.kpi;
  const metaBar = k.meta ? `${meter(k.metaPct, k.metaPct >= 1 ? 'ok' : k.metaPct >= k.tempo * 0.9 ? 'ok' : k.metaPct >= 0.5 ? 'warn' : 'bad')}<span class="kpi-d">${num(k.pagas)} de ${num(k.meta)} · ${Math.round(k.tempo * 100)}% do período</span>` : '<span class="kpi-d"><a href="#metas">Definir meta de matrículas pagas</a></span>';
  return `<section class="kpis mat-kpis" aria-label="Indicadores">
    ${card('Matrículas pagas', num(k.pagas), delta(k.pagas, k.pagasP), 'hero')}
    ${card('Meta atingida', k.meta ? pct(k.metaPct, 0) : '—', metaBar)}
    ${financeiro ? card('Valor arrecadado', brl(k.arrecadado), delta(k.arrecadado, k.arrecadadoP) + '<span class="kpi-src">taxas de matrícula pagas</span>') : ''}
    ${financeiro ? card('Receita contratada', brl(k.contratada), delta(k.contratada, k.contratadaP) + '<span class="kpi-src">mensalidade × parcelas restantes</span>') : ''}
    ${financeiro ? card('Investido em anúncios', brl(k.investido), delta(k.investido, k.investidoP, 'down') + '<span class="kpi-src"><a href="#meta">lançar em Meta Ads</a></span>') : ''}
    ${financeiro ? card('Custo por matrícula', brl2(k.cpm), delta(k.cpm, k.cpmP, 'down') + `<span class="kpi-src">ROI ${k.roi === null ? '—' : num1x(k.roi)} · ${num(k.pagasMidia)} de origem paga</span>`) : ''}
    ${card('Conversão', pct(k.conv, 1), delta(k.conv, k.convP) + `<span class="kpi-src">${num(k.pagas)} pagas de ${num(k.leads)} leads</span>`)}
    ${card('Tempo até fechar', k.tempoFechar === null ? '—' : num(Math.round(k.tempoFechar)) + ' dias', delta(k.tempoFechar, k.tempoFecharP, 'down') + '<span class="kpi-src">do primeiro contato ao pagamento</span>')}
  </section>`;
}
const num1x = (v) => v.toFixed(1).replace('.', ',') + 'x';

export function evolucao(d) {
  return `<section class="card"><header class="card-head"><div><h2>Evolução</h2><p class="muted">Matrículas pagas por ${d.porSemana ? 'semana' : 'dia'}</p></div></header>${d.kpi.pagas ? lineChart(d.serie, { label: 'Matrículas pagas' }) : '<p class="empty-sm">Nenhuma matrícula paga no período. Registre o pagamento na matrícula (status Pago ou Parcial) para ver a curva.</p>'}</section>`;
}

export function funil(d) {
  const f = d.funil, max = Math.max(1, f[0].n);
  return `<section class="card"><header class="card-head"><div><h2>Funil do período</h2><p class="muted">De quem entrou no período, até onde chegou</p></div><a class="link" href="#funil">Abrir funil ${ICON.arrow}</a></header>
    ${f[0].n ? `<ul class="mfun">${f.map((e, i) => `<li><div class="mfun-top"><span>${esc(e.label)}</span><b>${num(e.n)}</b>${i ? `<small class="${f[i - 1].n && e.n / f[i - 1].n < 0.3 ? 'bad' : ''}">${f[i - 1].n ? pct(e.n / f[i - 1].n, 0) : '—'} da etapa anterior</small>` : ''}</div><div class="mfun-track"><span style="width:${(e.n / max) * 100}%"></span></div></li>`).join('')}</ul>
      <p class="hint">"Visitaram" conta quem tem visita marcada no cartão do Funil (botão Visitou) ou já se matriculou.</p>` : '<p class="empty-sm">Nenhum lead entrou no período. Registre as conversas no Funil.</p>'}</section>`;
}

export function turmas(d) {
  return `<section class="card"><header class="card-head"><div><h2>Vagas por turma</h2><p class="muted">Matriculados ÷ vagas das turmas abertas</p></div><a class="link" href="#matriculas?tab=turmas">Turmas ${ICON.arrow}</a></header>
    ${d.turmas.length ? `<ul class="vagas">${d.turmas.map((x) => { const cls = x.ocup >= 0.9 ? 'bad' : x.ocup >= 0.4 ? 'ok' : 'warn'; return `<li><a href="#matriculas?turma=${encodeURIComponent(x.tm.id)}"><span class="vg-n">${esc(x.tm.nome)}<small>${x.tm.inicio ? 'início ' + fmtDate(x.tm.inicio) : ''}${x.tm.turno ? ' · ' + esc(x.tm.turno) : ''}</small></span><b>${num(x.n)}/${num(x.vagas)}</b></a>${meter(Math.min(1, x.ocup), cls)}</li>`; }).join('')}</ul>` : '<p class="empty-sm">Nenhuma turma aberta com vagas. Crie em Matrículas › Turmas.</p>'}</section>`;
}

export function consultores(d) {
  return `<section class="card"><header class="card-head"><div><h2>Consultores</h2><p class="muted">Matrículas pagas e conversão dos leads de cada um</p></div></header>
    ${d.consultores.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Consultor</th><th class="r">Pagas</th><th class="r">Leads</th><th class="r">Conversão</th></tr></thead><tbody>${d.consultores.map((x, i) => `<tr><td>${esc(x.nome)}</td><td class="r"><b>${num(x.pagas)}</b></td><td class="r">${num(x.leads)}</td><td class="r">${pct(x.conv, 0)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Sem leads com responsável no período. Defina o responsável no cartão do lead.</p>'}</section>`;
}

export function origem(d) {
  const tot = Object.values(d.formas).reduce((a, b) => a + b, 0);
  return `<section class="card"><header class="card-head"><div><h2>Origem e pagamento</h2><p class="muted">Das matrículas pagas no período</p></div></header>
    <div class="og-grid">${donut(Object.entries(d.origem).map(([label, v]) => ({ label, v })), { label: 'Origem das matrículas pagas' })}
    <div><h3 class="sub-h">Forma de pagamento</h3>${tot ? `<ul class="hbars">${Object.entries(d.formas).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k)}</span><span class="hb-track"><span style="width:${(v / tot) * 100}%"></span></span><b>${pct(v / tot, 0)}</b></li>`).join('')}</ul>` : '<p class="empty-sm">Sem matrículas pagas.</p>'}</div></div></section>`;
}

export function alertas(d) {
  if (!d.alertas.length) return `<section class="card"><header class="card-head"><h2>Precisa de ação hoje</h2></header><p class="empty-sm">Nada urgente: sem reservas paradas, turmas no limite ou meta em risco.</p></section>`;
  return `<section><h2 class="sec-title">Precisa de ação hoje</h2><div class="cards alerts">${d.alertas.map((a) => `<article class="card alert alert-${a.nivel}"><h3>${esc(a.titulo)}</h3><p class="muted">${esc(a.texto)}</p>${a.lista ? `<p class="hint">${a.lista.map(esc).join(', ')}${d.reservas.length > 5 ? '…' : ''}</p>` : ''}<a class="btn sm" href="${a.href}">${esc(a.acao)} ${ICON.arrow}</a></article>`).join('')}</div></section>`;
}

export const skeleton = () => `<div class="skel-grid">${'<div class="skel"></div>'.repeat(8)}</div><div class="skel skel-tall"></div>`;
