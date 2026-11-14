// Hoje: a tela inicial. Responde "o que eu faço agora?" para cada papel, sem o resto do app na frente.
// Vendas/atendimento: a fila do dia. Social: o conteúdo do dia. Coordenação: 3 números e quem travou.

import { store } from '../store.js';
import { esc, num, pct, brl2, today, monthStart, daysBetween, fmtDate } from '../util.js';
import { matriculasDash, salesStats, courseName } from '../metrics.js';
import { ICON } from '../ui.js';
import { auth } from '../auth.js';
import { jogo, mount as mountPainel } from './painel.js';

const norm = (x) => (x || '').trim().toLowerCase();
const papel = () => auth.member?.role || 'owner';
const GESTAO = ['owner', 'admin', 'manager', 'editor', 'analyst', 'leitura'];
const VENDAS = ['sales', 'support'];

function eu() { return auth.member?.nome || ''; }
function meus(ls) { const n = norm(eu()); return VENDAS.includes(papel()) && n ? ls.filter((l) => norm(l.responsavel) === n) : ls; }

function linha(l, motivo, href) {
  return `<li><a class="hj-item" href="${href}"><span class="hj-av">${esc((l.nome || '?').trim().charAt(0).toUpperCase())}</span>
    <span class="hj-txt"><b>${esc(l.nome || 'Sem nome')}</b><small>${esc(motivo)}</small></span><span class="hj-go">${ICON.arrow}</span></a></li>`;
}

function filaVendas() {
  const t = today();
  const s = salesStats('2000-01-01', t, {});
  const d = matriculasDash(monthStart(t), t, {});
  const atrasados = meus(s.followVencidos).sort((a, b) => (a.proximaData || '').localeCompare(b.proximaData || ''));
  const novos = meus(s.semContato);
  const reservas = meus(d.reservas || []);
  const grupos = [
    ['Retornos atrasados', 'Prometeu ligar e não ligou: comece por aqui.', atrasados, (l) => `retorno era ${fmtDate(l.proximaData)}`, '#funil?vencidos=1'],
    ['Sem primeiro contato', 'Lead novo esfria em horas. Responda hoje.', novos, (l) => `chegou há ${Math.max(1, daysBetween(l.entrada, t))} dia(s)${l.cursoId ? ' · ' + courseName(l.cursoId) : ''}`, '#funil?etapa=novo'],
    ['Reservas sem pagamento', 'Mande o Pix do sinal antes que a vaga esfrie.', reservas, (l) => `${l.cursoId ? courseName(l.cursoId) : 'reserva'} · aguardando pagamento`, '#matriculas?st=Pendente&todos=1'],
  ].filter((g) => g[2].length);
  const total = grupos.reduce((a, g) => a + g[2].length, 0);
  if (!total) return `<section class="card hj-vazio"><h2>Fila zerada</h2><p class="muted">Nenhum retorno atrasado, lead sem contato ou reserva parada. Hora de puxar novos contatos.</p><a class="btn primary" href="#funil">Abrir o funil ${ICON.arrow}</a></section>`;
  return `<section class="card hj-fila"><header class="hj-head"><div><p class="hj-k">Sua fila agora</p><h2>${total} ${total === 1 ? 'pessoa espera' : 'pessoas esperam'} por você</h2></div>
      <a class="btn primary" href="${grupos[0][4]}">Começar pela primeira ${ICON.arrow}</a></header>
    ${grupos.map(([tit, sub, ls, mot, href]) => `<div class="hj-grupo"><div class="hj-gh"><b>${tit}</b><span class="hj-n">${ls.length}</span><small>${sub}</small></div>
      <ul>${ls.slice(0, 4).map((l) => linha(l, mot(l), href)).join('')}</ul>${ls.length > 4 ? `<a class="link" href="${href}">Ver os ${ls.length} ${ICON.arrow}</a>` : ''}</div>`).join('')}
  </section>`;
}

function filaConteudo() {
  const t = today();
  const cal = store.all('calendar').filter((i) => i.status !== 'Publicado' && i.status !== 'Cancelado');
  const hojeIt = cal.filter((i) => i.data === t);
  const atras = cal.filter((i) => i.data < t);
  const prox = cal.filter((i) => i.data > t).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  const it = (i, m) => `<li><a class="hj-item" href="#calendario"><span class="hj-av">${ICON.agenda}</span><span class="hj-txt"><b>${esc(i.titulo || i.tipo)}</b><small>${esc(m)}</small></span><span class="hj-go">${ICON.arrow}</span></a></li>`;
  const blocos = [['Atrasado', atras, (i) => `era ${fmtDate(i.data)} · ${i.status || ''}`], ['Para hoje', hojeIt, (i) => `${i.formato || i.tipo || ''} · ${i.status || ''}`], ['Próximos', prox, (i) => `${fmtDate(i.data)} · ${i.formato || i.tipo || ''}`]].filter((b) => b[1].length);
  return `<section class="card hj-fila"><header class="hj-head"><div><p class="hj-k">Seu conteúdo</p><h2>${hojeIt.length + atras.length ? `${hojeIt.length + atras.length} ${hojeIt.length + atras.length === 1 ? 'post pede' : 'posts pedem'} atenção` : 'Nada pendente para hoje'}</h2></div>
      <a class="btn primary" href="#pauta">Criar pauta ${ICON.arrow}</a></header>
    ${blocos.length ? blocos.map(([tit, ls, m]) => `<div class="hj-grupo"><div class="hj-gh"><b>${tit}</b><span class="hj-n">${ls.length}</span></div><ul>${ls.slice(0, 4).map((i) => it(i, m(i))).join('')}</ul></div>`).join('') : '<p class="muted">Calendário em dia. Use o Brainstorm para garantir a semana que vem.</p>'}
  </section>`;
}

function numerosGestao() {
  const t = today(); const d = matriculasDash(monthStart(t), t, {}); const k = d.kpi;
  const s = salesStats('2000-01-01', t, {});
  const travados = {};
  [...s.followVencidos, ...s.semContato].forEach((l) => { const r = l.responsavel || 'Sem responsável'; travados[r] = (travados[r] || 0) + 1; });
  const lista = Object.entries(travados).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return `<section class="card hj-num"><header class="hj-head"><div><p class="hj-k">Seu mês em 3 números</p><h2>Como está a escola</h2></div><a class="link" href="#painel">Ver todos os números ${ICON.arrow}</a></header>
    <div class="hj-kpis"><a href="#matriculas"><small>Matrículas pagas</small><b>${num(k.pagas)}</b></a><a href="#meta"><small>Custo por matrícula</small><b>${brl2(k.cpm)}</b></a><a href="#funil"><small>Conversão</small><b>${pct(k.conv, 1)}</b></a></div>
    ${lista.length ? `<div class="hj-grupo"><div class="hj-gh"><b>Quem precisa de ajuda</b><small>Leads parados por responsável</small></div><ul>${lista.map(([n, c]) => `<li><a class="hj-item" href="#funil?vencidos=1"><span class="hj-av">${esc(n.charAt(0).toUpperCase())}</span><span class="hj-txt"><b>${esc(n)}</b><small>${c} lead(s) sem retorno ou sem contato</small></span><span class="hj-go">${ICON.arrow}</span></a></li>`).join('')}</ul></div>` : '<p class="muted">Time em dia: nenhum lead parado.</p>'}
  </section>`;
}

export function render() {
  const r = papel(); const nome = (eu() || '').split(' ')[0];
  const h = new Date().getHours(); const ola = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const principal = r === 'social' ? filaConteudo() : VENDAS.includes(r) ? filaVendas() : numerosGestao() + filaVendas();
  return `<p class="hj-ola">${ola}${nome ? ', ' + esc(nome) : ''}. Aqui está só o que importa hoje.</p>
    ${jogo()}
    ${principal}`;
}

export function mount(root, ctx) { mountPainel(root, ctx); }
