// Jogo da FLOWCLASS: patentes, sequência e missões. O XP sai só de registro real
// (avanço de lead, reserva, matrícula paga, missão cumprida, meta batida). Nada de ponto por clique vazio.

import { store } from './store.js';
import { today, addDays } from './util.js';
import { salesStats, matriculasDash, goalProgress, campaignRows } from './metrics.js';

// Patentes: evolução geral. Especialidade fica nas conquistas (não se misturam).
export const RANKS = [
  { min: 1, nome: 'Novato do Digital', sentido: 'Está entrando no jogo e aprendendo os fundamentos.', lema: 'Todo expert já foi iniciante.' },
  { min: 3, nome: 'Ninja do Copy', sentido: 'Domina palavras, criativos e comunicação persuasiva.', lema: 'Palavra certa abre carteira.' },
  { min: 6, nome: 'Máquina de Leads', sentido: 'Sabe atrair atenção e gerar oportunidades.', lema: 'Atenção é a moeda do jogo.' },
  { min: 10, nome: 'Brabo do Tráfego', sentido: 'Domina campanhas, segmentação e aquisição.', lema: 'Dado na mão, decisão sem achismo.' },
  { min: 15, nome: 'Monstro das Vendas', sentido: 'Transforma oportunidades em faturamento.', lema: 'Lead não compra produto, compra confiança.' },
  { min: 21, nome: 'Predador de Conversões', sentido: 'Otimiza funis e transforma visitantes em clientes.', lema: 'Cada etapa é uma chance de ganhar ou perder.' },
  { min: 28, nome: 'Mestre dos Lançamentos', sentido: 'Constrói ofertas, campanhas e estratégias de lançamento.', lema: 'Quem planeja o lançamento colhe a turma cheia.' },
  { min: 36, nome: 'Rei do ROI', sentido: 'Faz cada investimento trabalhar com inteligência.', lema: 'Verba não se gasta, se investe.' },
  { min: 45, nome: 'Tubarão do Marketing', sentido: 'Domina diferentes áreas e sabe jogar o jogo do mercado.', lema: 'Resultado não é sorte, é processo.' },
  { min: 55, nome: 'Magnata Digital', sentido: 'Constrói operações, ativos e negócios escaláveis.', lema: 'Construa ativos, não só campanhas.' },
  { min: 66, nome: 'Lenda do Marketing', sentido: 'Uma referência em estratégia, execução e resultados.', lema: 'Grande é quem faz outros crescerem.' },
];

export const FAIXAS = [
  { min: 0, nome: 'Offline' }, { min: 1, nome: 'Aquecendo' }, { min: 3, nome: 'Engajado' }, { min: 7, nome: 'Em alta' },
  { min: 14, nome: 'Viralizando' }, { min: 30, nome: 'Escala' }, { min: 60, nome: 'Modo Tubarão' },
];

export const XP = { avanco: 5, reserva: 15, paga: 30, missao: 10, dia: 50, meta: 100 };

export const xpForLevel = (n) => 50 * (n - 1) * n;
export function levelOf(xp) {
  let n = 1; while (xpForLevel(n + 1) <= xp) n++;
  const base = xpForLevel(n), next = xpForLevel(n + 1);
  return { level: n, into: xp - base, need: next - base, progress: (xp - base) / (next - base) };
}
export const rankIdx = (level) => RANKS.reduce((i, r, k) => (level >= r.min ? k : i), 0);
export const faixaOf = (n) => FAIXAS.reduce((a, f) => (n >= f.min ? f : a), FAIXAS[0]);

const jogo = () => store.settings().jogo || {};
const diasFeitos = () => jogo().dias || {}; // { 'AAAA-MM-DD': { feitas: [ids], total: n } }

/** Missões de hoje, tiradas dos dados. Quando não há pendência, entram missões de rotina. */
export function missoes() {
  const t = today();
  const s = salesStats(addDays(t, -365), t, {});
  const d = matriculasDash(addDays(t, -365), t, {});
  const m = [];
  if (s.semContato.length) m.push({ id: 'contato', t: `Fazer o 1º contato com ${s.semContato.length} lead${s.semContato.length > 1 ? 's' : ''} novo${s.semContato.length > 1 ? 's' : ''}`, href: '#funil?etapa=novo', principal: true });
  if (s.followVencidos.length) m.push({ id: 'retorno', t: `Retornar ${s.followVencidos.length} lead${s.followVencidos.length > 1 ? 's' : ''} atrasado${s.followVencidos.length > 1 ? 's' : ''}`, href: '#funil?vencidos=1' });
  if (d.reservas.length) m.push({ id: 'cobrar', t: `Cobrar ${d.reservas.length} reserva${d.reservas.length > 1 ? 's' : ''} sem pagamento`, href: '#matriculas?st=Pendente&todos=1' });
  const rotina = [
    { id: 'responder', t: 'Responder todas as conversas do dia', href: '#funil' },
    { id: 'conteudo', t: 'Publicar a pauta do dia', href: '#pauta' },
    { id: 'numeros', t: 'Conferir custo por matrícula das campanhas', href: '#meta' },
  ];
  for (const r of rotina) { if (m.length >= 3) break; m.push(r); }
  if (!m.some((x) => x.principal)) m[0].principal = true;
  return m.slice(0, 3);
}

export function toggleMissao(id, total) {
  const t = today(); const dias = { ...diasFeitos() };
  const cur = dias[t]?.feitas || [];
  const feitas = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  dias[t] = { feitas, total };
  store.put('settings', { ...store.settings(), id: 'main', jogo: { ...jogo(), dias } });
}
export const feitasHoje = () => diasFeitos()[today()]?.feitas || [];

const completo = (r) => r && r.total && r.feitas.length >= r.total;

/** Dias seguidos com todas as missões feitas. Domingo é folga: não quebra nem soma. Hoje só conta se já fechou. */
export function sequencia() {
  const dias = diasFeitos(); const t = today();
  let n = 0, d = completo(dias[t]) ? t : addDays(t, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (completo(dias[d])) { n++; continue; }
    if (new Date(d + 'T12:00').getDay() === 0) continue;
    break;
  }
  return n;
}
export function recorde() {
  const dias = diasFeitos(); const ks = Object.keys(dias).sort();
  let best = 0, run = 0, prev = null;
  for (const k of ks) {
    if (!completo(dias[k])) { continue; }
    let gap = prev ? 0 : -1;
    if (prev) { for (let d = addDays(prev, 1); d < k; d = addDays(d, 1)) if (new Date(d + 'T12:00').getDay() !== 0) gap++; }
    run = gap === 0 ? run + 1 : 1; prev = k; best = Math.max(best, run);
  }
  return Math.max(best, sequencia());
}

/** XP total recalculado dos registros. */
export function xpTotal() {
  let xp = 0;
  for (const l of store.all('leads')) {
    xp += Math.max(0, (l.historico || []).length - 1) * XP.avanco;
    if (l.etapa === 'matriculado') xp += ['Pago', 'Parcial'].includes(l.statusPagamento) ? XP.paga : XP.reserva;
  }
  for (const r of Object.values(diasFeitos())) { xp += (r.feitas?.length || 0) * XP.missao; if (completo(r)) xp += XP.dia; }
  for (const g of store.all('goals')) { if (g.fim < today()) { try { const p = goalProgress(g); if (p && p.alvo && (p.atual || 0) >= p.alvo) xp += XP.meta; } catch { /* meta sem dado */ } } }
  return xp;
}

export function estado() {
  const xp = xpTotal(); const lv = levelOf(xp); const ri = rankIdx(lv.level);
  const seq = sequencia();
  return { xp, ...lv, rank: RANKS[ri], rankIdx: ri, prox: RANKS[ri + 1], seq, best: recorde(), faixa: faixaOf(seq) };
}

// ---------- Conquistas: feitos específicos, comprovados pelos dados (nunca declarados) ----------
const camps = () => { try { return campaignRows('2000-01-01', today(), {}); } catch { return []; } };
const pagas = () => store.all('leads').filter((l) => l.etapa === 'matriculado' && ['Pago', 'Parcial'].includes(l.statusPagamento));
const p = (v, alvo) => ({ v: Math.min(v, alvo), alvo, ok: v >= alvo });

export const CONQUISTAS = [
  { id: 'predador-leads', cat: 'Tráfego e aquisição', nome: 'Predador de Leads', regra: 'Gerar 100 leads vindos de campanhas.', check: () => p(store.all('leads').filter((l) => l.campanhaId || /meta|google|ads/i.test(l.origem || '')).length, 100) },
  { id: 'sniper', cat: 'Tráfego e aquisição', nome: 'Sniper do Tráfego', regra: 'Conseguir 10 matrículas em uma única campanha.', check: () => p(Math.max(0, ...camps().map((c) => c.matriculas || 0)), 10) },
  { id: 'remarketing', cat: 'Tráfego e aquisição', nome: 'Rei do Remarketing', regra: 'Fechar uma campanha de remarketing (nome com "remarketing") com matrícula.', check: () => p(camps().some((c) => /remarketing|rmkt/i.test(c.nome || '') && c.matriculas > 0) ? 1 : 0, 1) },
  { id: 'closer', cat: 'Vendas e conversão', nome: 'Closer Implacável', regra: 'Fechar 10 matrículas pagas.', check: () => p(pagas().length, 10) },
  { id: 'faturamento', cat: 'Vendas e conversão', nome: 'Máquina de Faturamento', regra: 'Alcançar R$ 10 mil em matrículas pagas.', check: () => p(Math.round(pagas().reduce((a, l) => a + (Number(l.valor) || 0), 0)), 10000), moeda: true },
  { id: 'conversao', cat: 'Vendas e conversão', nome: 'Conversão Brutal', regra: 'Superar uma meta de conversão cadastrada em Metas.', check: () => p(store.all('goals').some((g) => /conv/i.test(g.indicador || '') && (() => { try { const r = goalProgress(g); return r && r.alvo && (r.atual || 0) >= r.alvo; } catch { return false; } })()) ? 1 : 0, 1) },
  { id: 'growth', cat: 'Estratégia e inteligência', nome: 'Hacker do Growth', regra: 'Concluir 5 experimentos (ideias validadas ou descartadas com resultado).', check: () => p(store.all('ideas').filter((i) => ['Validada', 'Descartada'].includes(i.status)).length, 5) },
  { id: 'roi', cat: 'Estratégia e inteligência', nome: 'Cérebro do ROI', regra: 'ROAS de 5x ou mais numa campanha com pelo menos R$ 300 investidos.', check: () => p(Math.max(0, ...camps().filter((c) => c.investimento >= 300).map((c) => c.roas || 0)) >= 5 ? 1 : 0, 1) },
  { id: 'funis', cat: 'Estratégia e inteligência', nome: 'Arquiteto de Funis', regra: 'Criar um funil próprio e passar 20 leads por ele.', check: () => p(Math.max(0, ...store.all('pipelines').filter((x) => x.id !== 'principal').map((x) => store.all('leads').filter((l) => l.funilId === x.id).length)), 20) },
  { id: 'criativos', cat: 'Branding e criatividade', nome: 'Mestre dos Criativos', regra: 'Ter 10 anúncios diferentes rodando com dados do Meta.', check: () => p(new Set(store.all('adStats').map((s) => s.anuncio).filter(Boolean)).size, 10) },
  { id: 'copy', cat: 'Branding e criatividade', nome: 'Copy Killer', regra: 'Criar 20 pautas ou roteiros na Pauta Viral.', check: () => p(store.all('pautas').length, 20) },
  { id: 'branding', cat: 'Branding e criatividade', nome: 'Lenda do Branding', regra: 'Em breve: depende do registro de identidade de marca.', breve: true, check: () => p(0, 1) },
  { id: 'dragao', cat: 'Lendárias', nome: 'Dragão do Digital', regra: 'Desbloquear 10 conquistas diferentes.', lendaria: true, check: (n) => p(n, 10) },
  { id: 'fenix', cat: 'Lendárias', nome: 'Fênix do Marketing', regra: 'Voltar depois de 14 dias parado e fechar 7 dias seguidos de missões.', lendaria: true, check: () => p(fenix() ? 1 : 0, 1) },
  { id: 'absoluta', cat: 'Lendárias', nome: 'Lenda Absoluta', regra: 'Chegar a Lenda do Marketing e ter 13 conquistas.', lendaria: true, ultra: true, check: (n, lv) => p(lv >= RANKS[RANKS.length - 1].min && n >= 13 ? 1 : 0, 1) },
];

function fenix() {
  const ks = Object.keys(diasFeitos()).filter((k) => completo(diasFeitos()[k])).sort();
  for (let i = 1; i < ks.length; i++) {
    const gap = (new Date(ks[i]) - new Date(ks[i - 1])) / 864e5;
    if (gap >= 14) { let run = 1; for (let j = i + 1; j < ks.length && (new Date(ks[j]) - new Date(ks[j - 1])) / 864e5 <= 2; j++) run++; if (run >= 7) return true; }
  }
  return false;
}

export function conquistas(level) {
  const base = CONQUISTAS.filter((c) => !c.lendaria).map((c) => ({ ...c, ...c.check() }));
  const n = base.filter((c) => c.ok).length;
  const lend = CONQUISTAS.filter((c) => c.lendaria).map((c) => ({ ...c, ...c.check(n, level) }));
  return [...base, ...lend];
}
export const tituloAtivo = () => jogo().titulo || '';
export function usarTitulo(id) { store.put('settings', { ...store.settings(), id: 'main', jogo: { ...jogo(), titulo: id } }); }
