// Relatórios gerenciais: o sistema monta o rascunho com os números do período e os pontos
// que encontrou; o coordenador revisa, escreve as decisões e salva. O histórico fica guardado.

import { store } from '../store.js';
import { esc, $, $$, brl, brl2, num, pct, fmtRange, fmtDate, today } from '../util.js';
import { overview, prevPeriod, delta, diagnostics, NIVEL, STAGES, goalProgress, courseName, settings } from '../metrics.js';
import { toast, copyText, downloadFile, ICON, confirmButton, badge } from '../ui.js';

export const autoRefresh = false;

let draft = null; // relatório montado agora (números sempre recalculados)
const edits = {};  // textos que você escreveu, por período e curso: sobrevivem a novas importações
const TEXTOS = ['problemas', 'oportunidades', 'proximos', 'metasProximas', 'notas'];
let viewing = null; // id de um relatório salvo aberto

function build(from, to, f) {
  const o = overview(from, to, f);
  const P = prevPeriod(from, to);
  const p = overview(P.from, P.to, f);
  const diag = diagnostics(from, to, f);
  const s = settings();
  const kpis = [
    ['Investimento em mídia', brl2(o.investimento), brl2(p.investimento), delta(o.investimento, p.investimento, null)],
    ['Resultados no Meta', num(o.m.resultados), num(p.m.resultados), delta(o.m.resultados, p.m.resultados, 'up')],
    ['Custo por resultado', brl2(o.m.custoResultado), brl2(p.m.custoResultado), delta(o.m.custoResultado, p.m.custoResultado, 'down')],
    ['Conversas no funil', num(o.leads), num(p.leads), delta(o.leads, p.leads, 'up')],
    ['Matrículas', num(o.matriculas), num(p.matriculas), delta(o.matriculas, p.matriculas, 'up')],
    ['Conversão lead → matrícula', pct(o.convLead), pct(p.convLead), delta(o.convLead, p.convLead, 'up')],
    ['CAC de mídia', brl2(o.cac), brl2(p.cac), delta(o.cac, p.cac, 'down')],
    ['Receita de matrículas', brl(o.receita), brl(p.receita), delta(o.receita, p.receita, 'up')],
    ['Publicações', num(o.c.publicados) + ' de ' + num(o.c.planejados), num(p.c.publicados), delta(o.c.publicados, p.c.publicados, 'up')],
  ];
  const camps = o.rows.filter((r) => r.hasStats).sort((a, b) => (a.cac ?? 1e12) - (b.cac ?? 1e12) || b.investimento - a.investimento);
  const motivos = Object.entries(o.s.motivos).sort((a, b) => b[1] - a[1]);
  const goals = store.all('goals').filter((g) => g.inicio <= to && g.fim >= from).map((g) => ({ g, pr: goalProgress(g) }));
  const prob = diag.filter((d) => d.nivel !== 'oportunidade');
  const opp = diag.filter((d) => d.nivel === 'oportunidade');
  const ideas = store.all('ideas').filter((i) => ['Priorizada', 'Em teste'].includes(i.status));
  const validadas = store.all('ideas').filter((i) => i.status === 'Validada' && i.updatedAt?.slice(0, 10) >= from);
  return {
    titulo: 'Relatório de marketing · ' + fmtRange(from, to), inicio: from, fim: to, cursoId: f.cursoId || '', unidade: s.unidade,
    kpis: kpis.map(([l, v, pv, d]) => ({ l, v, pv, d: d.txt, cls: d.cls })),
    midia: camps.slice(0, 8).map((r) => ({ nome: r.nome, inv: brl2(r.investimento), cc: brl2(r.custoResultado) + (r.tipoResultado ? ' por ' + r.tipoResultado.toLowerCase().replace(/s$/, '') : ''), leads: num(r.leads), mat: num(r.matriculas), cac: brl2(r.cac) })),
    funil: STAGES.map((st, i) => ({ l: st.label, n: o.s.funil[i] })),
    conteudo: { pub: o.c.publicados, plan: o.c.planejados, reels: o.c.reels, stories: o.c.diasCompletos, melhor: o.c.ranked.slice(0, 3).map((i) => `${i.titulo} (${i.formato || ''}, ${fmtDate(i.data)})`) },
    comercial: { motivos, origem: o.s.porOrigem, abertos: o.s.abertos.length, tempo: o.s.tempoResposta },
    metas: goals.map(({ g, pr }) => ({ nome: g.nome, atual: pr.ind.fmt(pr.atual), alvo: pr.ind.fmt(pr.alvo), texto: pr.texto, status: pr.status })),
    problemas: prob.map((d) => '- ' + d.titulo + '. ' + d.texto).join('\n'),
    oportunidades: [...opp.map((d) => '- ' + d.titulo + '. ' + d.texto), ...validadas.map((i) => '- Validado: ' + i.titulo + (i.resultado ? ' (' + i.resultado + ')' : ''))].join('\n'),
    proximos: [...ideas.map((i) => '- ' + i.titulo + (i.prazo ? ' (até ' + fmtDate(i.prazo) + ')' : '') + (i.proximaAcao ? ': ' + i.proximaAcao : '')), ...prob.slice(0, 3).filter((d) => d.acao).map((d) => '- ' + d.acao.label + ': ' + d.titulo)].join('\n'),
    metasProximas: '',
    notas: '',
  };
}

function toText(r) {
  const L = [];
  L.push('# ' + r.titulo, r.unidade + (r.cursoId ? ' · ' + courseName(r.cursoId) : ''), '');
  L.push('## Resultados do período', ...r.kpis.map((k) => `- ${k.l}: ${k.v} (antes: ${k.pv}; ${k.d})`), '');
  if (r.midia.length) L.push('## Mídia paga (menor CAC primeiro)', ...r.midia.map((m) => `- ${m.nome}: investimento ${m.inv}, custo por resultado ${m.cc}, ${m.leads} leads, ${m.mat} matrículas, CAC ${m.cac}`), '');
  L.push('## Funil comercial', r.funil.map((s) => `${s.l}: ${s.n}`).join(' → '), '');
  L.push('## Conteúdo', `- ${r.conteudo.pub} de ${r.conteudo.plan} publicações planejadas · ${r.conteudo.reels} reels · ${r.conteudo.stories} dias com stories completos`, ...r.conteudo.melhor.map((m) => '- Destaque: ' + m), '');
  if (r.comercial.motivos.length) L.push('## Motivos de perda', ...r.comercial.motivos.map(([m, n]) => `- ${m}: ${n}`), '');
  if (r.metas.length) L.push('## Metas', ...r.metas.map((m) => `- ${m.nome}: ${m.atual} de ${m.alvo} (${m.texto})`), '');
  L.push('## Problemas identificados', r.problemas || '- Nenhum.', '');
  L.push('## Oportunidades', r.oportunidades || '- Nenhuma registrada.', '');
  L.push('## Próximos passos', r.proximos || '-', '');
  if (r.metasProximas) L.push('## Metas para o próximo período', r.metasProximas, '');
  if (r.notas) L.push('## Notas do coordenador', r.notas, '');
  return L.join('\n');
}

function preview(r, editable) {
  const ta = (k, label, rows = 5) => editable
    ? `<div class="field full"><label for="r-${k}">${label}</label><textarea id="r-${k}" data-rk="${k}" rows="${rows}">${esc(r[k])}</textarea></div>`
    : `<h3>${label}</h3><p class="pre">${esc(r[k] || '—')}</p>`;
  return `<article class="report">
    <header><p class="eyebrow">${esc(r.unidade)}${r.cursoId ? ' · ' + esc(courseName(r.cursoId)) : ''}</p><h2>${esc(r.titulo)}</h2></header>
    <h3>Resultados do período</h3>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Indicador</th><th class="r">Período</th><th class="r">Anterior</th><th>Variação</th></tr></thead><tbody>${r.kpis.map((k) => `<tr><td>${esc(k.l)}</td><td class="r"><b>${esc(k.v)}</b></td><td class="r">${esc(k.pv)}</td><td class="${k.cls}">${esc(k.d)}</td></tr>`).join('')}</tbody></table></div>
    ${r.midia.length ? `<h3>Mídia paga</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Campanha</th><th class="r">Investimento</th><th class="r">Custo por resultado</th><th class="r">Leads</th><th class="r">Matrículas</th><th class="r">CAC</th></tr></thead><tbody>${r.midia.map((m) => `<tr><td>${esc(m.nome)}</td><td class="r">${m.inv}</td><td class="r">${m.cc}</td><td class="r">${m.leads}</td><td class="r">${m.mat}</td><td class="r">${m.cac}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3>Funil comercial</h3><p>${r.funil.map((s) => `${esc(s.l)} <b>${num(s.n)}</b>`).join(' → ')}</p>
    <h3>Conteúdo</h3><p>${r.conteudo.pub} de ${r.conteudo.plan} publicações · ${r.conteudo.reels} reels · ${r.conteudo.stories} dias com stories completos</p>${r.conteudo.melhor.length ? `<ul>${r.conteudo.melhor.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${r.comercial.motivos.length ? `<h3>Motivos de perda</h3><ul>${r.comercial.motivos.map(([m, n]) => `<li>${esc(m)}: ${n}</li>`).join('')}</ul>` : ''}
    ${r.metas.length ? `<h3>Metas</h3><ul class="goal-mini">${r.metas.map((m) => `<li><div class="gm-top"><span>${esc(m.nome)}</span><b>${esc(m.atual)} / ${esc(m.alvo)}</b></div><small class="${m.status}">${esc(m.texto)}</small></li>`).join('')}</ul>` : ''}
    ${ta('problemas', 'Problemas identificados')}
    ${ta('oportunidades', 'Oportunidades')}
    ${ta('proximos', 'Próximos passos (quem, o quê, até quando)')}
    ${ta('metasProximas', 'Metas para o próximo período', 3)}
    ${ta('notas', 'Notas do coordenador', 4)}
  </article>`;
}

export function render(ctx) {
  const saved = store.all('reports').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const inClaude = !!window.claude?.use;
  if (viewing) {
    const r = store.get('reports', viewing);
    if (r) return `<div class="toolbar"><button class="btn" data-ract="back">${ICON.left} Voltar</button><span class="grow"></span><button class="btn" data-ract="copy-saved">${ICON.copy} Copiar texto</button><button class="btn" data-ract="dl-saved">${ICON.download} Baixar .md</button>${inClaude ? '' : '<button class="btn" data-ract="print">Imprimir / PDF</button>'}</div>${preview(r.dados, false)}<pre class="sr" id="r-text">${esc(r.texto)}</pre>`;
    viewing = null;
  }
  // Sempre recalcula os números com os dados atuais e reaplica só os textos editados.
  const key = ctx.from + '|' + ctx.to + '|' + (ctx.f.cursoId || '');
  draft = { ...build(ctx.from, ctx.to, ctx.f), ...(edits[key] || {}) };
  draft._key = key;
  return `
  <div class="toolbar"><p class="muted">O rascunho usa o período e o curso escolhidos no topo. Revise os textos antes de salvar.</p><span class="grow"></span>
    <button class="btn" data-ract="regen">Gerar de novo</button>
    <button class="btn" data-ract="copy">${ICON.copy} Copiar texto</button>
    <button class="btn" data-ract="dl">${ICON.download} Baixar .md</button>
    ${inClaude ? '' : '<button class="btn" data-ract="print">Imprimir / PDF</button>'}
    <button class="btn primary" data-ract="save">Salvar relatório</button></div>
  <div class="report-layout">
    <div>${preview(draft, true)}</div>
    <aside class="card"><h2>Relatórios salvos</h2>${saved.length ? `<ul class="saved">${saved.map((r) => `<li><button class="link" data-ropen="${esc(r.id)}">${esc(r.titulo)}</button><small>salvo em ${fmtDate(r.createdAt.slice(0, 10))}</small><button class="btn sm ghost" data-rdel="${esc(r.id)}" aria-label="Excluir ${esc(r.titulo)}">Excluir</button></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhum ainda. Salve um por semana ou por mês para comparar a evolução.</p>'}</aside>
  </div>
  <pre class="sr" id="r-text"></pre>`;
}

export function mount(root, ctx) {
  $$('[data-rk]', root).forEach((ta) => ta.addEventListener('input', () => { draft[ta.dataset.rk] = ta.value; (edits[draft._key] || (edits[draft._key] = {}))[ta.dataset.rk] = ta.value; }));
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.ropen) { viewing = ds.ropen; ctx.refresh(); return; }
    if (ds.rdel) { if (!confirmButton(b, 'Confirmar')) return; store.remove('reports', ds.rdel); ctx.refresh(); return; }
    const a = ds.ract;
    if (a === 'back') { viewing = null; ctx.refresh(); }
    if (a === 'regen') { delete edits[draft._key]; ctx.refresh(); toast('Textos refeitos a partir dos dados atuais.'); }
    if (a === 'print') window.print();
    const txt = viewing ? store.get('reports', viewing)?.texto : toText(draft);
    if (a === 'copy' || a === 'copy-saved') { const el = $('#r-text', root); el.textContent = txt; copyText(txt, el); }
    if (a === 'dl' || a === 'dl-saved') downloadFile('relatorio-marketing-' + (viewing ? store.get('reports', viewing).inicio : draft.inicio) + '.md', txt, 'text/markdown');
    if (a === 'save') { store.put('reports', { titulo: draft.titulo, inicio: draft.inicio, fim: draft.fim, dados: draft, texto: toText(draft) }); toast('Relatório salvo no histórico.'); ctx.refresh(); }
  });
  void NIVEL; void badge; void today;
}
