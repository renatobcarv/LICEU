// Estúdio do criador: XP, desafio da semana, sequência e conquistas de CONTEÚDO.
// Mesma regra do resto do jogo: só conta o que foi registrado (ideia anotada, pauta, gravação, post publicado, stories).

import { store } from './store.js';
import { today, addDays, weekStart } from './util.js';
import { STORY_BLOCKS } from './metrics.js';

export const XP_C = { ideia: 2, pauta: 5, aprovado: 10, gravado: 15, publicado: 25, stories: 10 };
const ORDEM = ['Ideia', 'Briefing pronto', 'Roteiro aprovado', 'Gravado', 'Publicado'];
const storiesFeitos = (d) => STORY_BLOCKS.filter((b) => d?.blocos?.[b.id] === 'Feito').length + (Number(d?.extras) || 0);

/** Formatos com ícone (nomes do ICON em ui.js). */
export const FORMATO_ICON = { 'Reels': 'f_reels', 'Vídeo motion': 'f_motion', 'Carrossel': 'f_carrossel', 'Stories': 'f_stories', 'Post estático': 'f_post', 'Arte': 'f_arte', 'Live': 'f_live', 'Outro': 'f_post' };
export const FORMATOS_BRAIN = ['Reels', 'Carrossel', 'Stories', 'Post estático', 'Vídeo motion'];

/** Itens de publicação "feitos": posts do calendário publicados (sem contar duas vezes a pauta ligada). */
function publicados() {
  const cal = store.all('calendar').filter((i) => i.tipo === 'Publicação' && i.status === 'Publicado');
  const ligadas = new Set(cal.map((i) => i.pautaId).filter(Boolean));
  const pautasSoltas = store.all('pautas').filter((p) => p.status === 'Publicado' && !ligadas.has(p.id) && !p.calendarId);
  return [...cal.map((i) => ({ data: i.publicadoEm || i.data, formato: i.formato })), ...pautasSoltas.map((p) => ({ data: (p.publicadoEm || p.updatedAt || '').slice(0, 10), formato: p.form?.formato }))];
}

export function xpConteudo() {
  let xp = 0;
  const meu = (r) => !store.eu?.id || r.criadoPor === store.eu.id || (!r.criadoPor && store.eu.dono);
  for (const p of store.all('pautas').filter(meu)) {
    if (p.brain) xp += XP_C.ideia;
    const i = ORDEM.indexOf(p.status);
    if (i >= 1) xp += XP_C.pauta;
    if (i >= 2) xp += XP_C.aprovado;
    if (i >= 3) xp += XP_C.gravado;
  }
  xp += publicados().length * XP_C.publicado;
  const meta = Number(store.settings().metaStoriesDia) || 5;
  xp += store.all('stories').filter((d) => storiesFeitos(d) >= meta).length * XP_C.stories;
  return xp;
}

export const metaSemana = () => Number(store.settings().metaPostsSemana) || 5;

/** Posts publicados na semana de `ref` (segunda a domingo). */
export function semana(ref = today()) {
  const ini = weekStart(ref), fim = addDays(ini, 6);
  const n = publicados().filter((p) => p.data >= ini && p.data <= fim).length;
  const plan = store.all('calendar').filter((i) => i.tipo === 'Publicação' && i.data >= ini && i.data <= fim && !['Publicado', 'Cancelado'].includes(i.status)).length;
  return { ini, fim, n, meta: metaSemana(), planejados: plan, ok: n >= metaSemana() };
}

/** Semanas seguidas batendo a meta de posts (a atual só conta quando já bateu). */
export function sequenciaSemanas() {
  let n = 0, ref = semana().ok ? today() : addDays(weekStart(today()), -1);
  for (let i = 0; i < 104; i++, ref = addDays(weekStart(ref), -1)) { if (semana(ref).ok) n++; else break; }
  return n;
}

const p = (v, alvo) => ({ v: Math.min(v, alvo), alvo, ok: v >= alvo });
export const CONQUISTAS_CONTEUDO = [
  { id: 'primeiro-post', cat: 'Conteúdo e criação', nome: 'Estreia', regra: 'Publicar o primeiro post registrado no calendário.', check: () => p(publicados().length, 1) },
  { id: 'chuva-ideias', cat: 'Conteúdo e criação', nome: 'Chuva de Ideias', regra: 'Anotar 25 ideias no brainstorm.', check: () => p(store.all('pautas').filter((x) => x.brain).length, 25) },
  { id: 'semana-cheia', cat: 'Conteúdo e criação', nome: 'Semana Cheia', regra: 'Bater a meta de posts da semana.', check: () => p(sequenciaSemanas() > 0 || semana().ok ? 1 : 0, 1) },
  { id: 'maquina-conteudo', cat: 'Conteúdo e criação', nome: 'Máquina de Conteúdo', regra: 'Publicar 30 posts.', check: () => p(publicados().length, 30) },
  { id: 'rei-reels', cat: 'Conteúdo e criação', nome: 'Rei dos Reels', regra: 'Publicar 15 Reels.', check: () => p(publicados().filter((x) => x.formato === 'Reels').length, 15) },
];
