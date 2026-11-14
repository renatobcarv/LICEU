// Perfil de quem entra no time: quiz bonito no cadastro (área, nível, objetivos, tempo, jeito de aprender, pontos fortes)
// e quests personalizadas que sobem o nível da pessoa. Quests de trabalho medem dado real; de estudo, a pessoa marca.

import { store } from './store.js';
import { auth } from './auth.js';
import { esc, today } from './util.js';
import { ICON } from './ui.js';

export const PERGUNTAS = [
  { id: 'area', titulo: 'Qual é a sua área no time?', ajuda: 'Assim o painel abre no que você mais usa.', tipo: 'um', opcoes: [
    ['vendas', 'Vendas e atendimento', 'f_live'], ['conteudo', 'Conteúdo e redes sociais', 'f_reels'], ['trafego', 'Tráfego pago', 'raio'],
    ['gestao', 'Coordenação do time', 'medalha'], ['financeiro', 'Financeiro e matrículas', 'check'], ['aluno', 'Estou começando agora', 'ideia']] },
  { id: 'nivel', titulo: 'Quanto de experiência você tem nisso?', ajuda: 'Sem resposta certa. É só o seu ponto de partida.', tipo: 'um', opcoes: [
    ['0', 'Começando agora', 'ideia'], ['1', 'Menos de 1 ano', 'raio'], ['2', 'De 1 a 3 anos', 'fogo'], ['3', 'Mais de 3 anos', 'medalha']] },
  { id: 'objetivos', titulo: 'O que você quer melhorar primeiro?', ajuda: 'Escolha até 3. Suas missões saem daqui.', tipo: 'varios', max: 3, opcoes: [
    ['fechar', 'Atender e fechar mais matrículas', 'check'], ['telefone', 'Falar ao telefone com segurança', 'f_live'], ['conteudo', 'Criar conteúdo que engaja', 'f_reels'],
    ['numeros', 'Entender os números', 'raio'], ['rotina', 'Ter rotina e organização', 'agenda'], ['lideranca', 'Liderar e treinar o time', 'medalha'], ['estudo', 'Estudar para o curso ou certificação', 'ideia']] },
  { id: 'tempo', titulo: 'Quanto tempo por semana para evoluir?', ajuda: 'As missões cabem no seu tempo.', tipo: 'um', opcoes: [
    ['1', 'Até 1 hora', 'agenda'], ['3', 'Umas 3 horas', 'agenda'], ['5', '5 horas ou mais', 'fogo']] },
  { id: 'aprende', titulo: 'Como você aprende melhor?', ajuda: 'A gente sugere do jeito que funciona para você.', tipo: 'um', opcoes: [
    ['exemplo', 'Vendo um exemplo pronto', 'olho'], ['pratica', 'Praticando direto', 'raio'], ['lendo', 'Lendo com calma', 'ideia'], ['junto', 'Com alguém do lado', 'f_live']] },
  { id: 'fortes', titulo: 'O que já é ponto forte seu?', ajuda: 'Escolha quantos quiser. Vira reconhecimento no seu card do time.', tipo: 'varios', max: 6, opcoes: [
    ['comunicacao', 'Comunicação', 'f_live'], ['organizacao', 'Organização', 'agenda'], ['criatividade', 'Criatividade', 'ideia'], ['persistencia', 'Persistência', 'fogo'],
    ['empatia', 'Empatia com o aluno', 'check'], ['numeros', 'Gosto de números', 'raio']] },
];

export const NIVEL_NOME = ['Iniciante', 'Em evolução', 'Experiente', 'Referência'];

/** Quests: as de "dado" medem o que a pessoa registrou no app; as de "estudo" ela marca quando fizer. */
const meu = (l) => String(l.responsavel || '').trim().toLowerCase() === String(auth.member?.nome || '').trim().toLowerCase();
const ligacoes = () => store.all('leads').reduce((a, l) => a + (l.contatos || []).filter((c) => c.canal === 'tel' && (!c.por || c.por === auth.member?.nome)).length, 0);
const QUESTS = {
  fechar: [
    { id: 'q-pagas', titulo: 'Fechar 3 matrículas pagas', tipo: 'dado', alvo: 3, conta: () => store.all('leads').filter((l) => meu(l) && l.etapa === 'matriculado' && ['Pago', 'Parcial'].includes(l.statusPagamento)).length },
    { id: 'q-objecoes', titulo: 'Ler as respostas prontas do Funil e escolher 3 para usar', tipo: 'estudo' },
  ],
  telefone: [
    { id: 'q-lig', titulo: 'Registrar 20 ligações no Modo ligação', tipo: 'dado', alvo: 20, conta: ligacoes },
    { id: 'q-roteiro', titulo: 'Treinar o roteiro de ligação em voz alta 3 vezes', tipo: 'estudo' },
  ],
  conteudo: [
    { id: 'q-ideias', titulo: 'Anotar 10 ideias no Brainstorm', tipo: 'dado', alvo: 10, conta: () => store.all('pautas').filter((p) => p.brain).length },
    { id: 'q-post', titulo: 'Publicar 3 posts pelo Calendário', tipo: 'dado', alvo: 3, conta: () => store.all('calendar').filter((i) => i.tipo === 'Publicação' && i.status === 'Publicado').length },
  ],
  numeros: [
    { id: 'q-cpm', titulo: 'Explicar para alguém o custo por matrícula do mês', tipo: 'estudo' },
    { id: 'q-relatorio', titulo: 'Gerar e salvar um relatório do período', tipo: 'dado', alvo: 1, conta: () => store.all('reports').length },
  ],
  rotina: [
    { id: 'q-missoes', titulo: 'Fechar as missões do dia 5 vezes', tipo: 'dado', alvo: 5, conta: () => Object.values(store.settings().jogo?.dias || {}).filter((r) => r.total && r.feitas?.length >= r.total).length },
    { id: 'q-retornos', titulo: 'Zerar os retornos atrasados do Funil', tipo: 'dado', alvo: 1, conta: () => (store.all('leads').some((l) => meu(l) && l.proximaData && l.proximaData < today() && !['matriculado', 'perdido'].includes(l.etapa)) ? 0 : 1) },
  ],
  lideranca: [
    { id: 'q-kudos', titulo: 'Dar 5 reconhecimentos no Time', tipo: 'dado', alvo: 5, conta: () => store.all('team').reduce((a, m) => a + Object.values(m.kudos || {}).filter((v) => v.includes(auth.member?.nome || 'Eu')).length, 0) },
    { id: 'q-meta', titulo: 'Cadastrar uma meta do mês com o time', tipo: 'dado', alvo: 1, conta: () => store.all('goals').length },
  ],
  estudo: [
    { id: 'q-estudo1', titulo: 'Separar 2 horas na semana só para estudar', tipo: 'estudo' },
    { id: 'q-estudo2', titulo: 'Fazer um resumo do que aprendeu e mostrar para alguém', tipo: 'estudo' },
  ],
};
const BASE = [{ id: 'q-perfil', titulo: 'Completar seu perfil', tipo: 'dado', alvo: 1, conta: () => (perfil() ? 1 : 0) }];

export const perfil = () => auth.user?.user_metadata?.perfil || (() => { try { return JSON.parse(localStorage.getItem('flowclass.perfil') || 'null'); } catch (e) { return null; } })();
const feitas = () => auth.user?.user_metadata?.quests_feitas || (() => { try { return JSON.parse(localStorage.getItem('flowclass.quests') || '[]'); } catch (e) { return []; } })();

export function minhasQuests() {
  const p = perfil(); if (!p) return BASE.map(avaliar);
  const lista = [...BASE, ...(p.objetivos || []).flatMap((o) => QUESTS[o] || [])].slice(0, 7);
  return lista.map(avaliar);
}
function avaliar(q) {
  if (q.tipo === 'estudo') { const ok = feitas().includes(q.id); return { ...q, v: ok ? 1 : 0, alvo: 1, ok }; }
  const v = Math.min(q.conta(), q.alvo); return { ...q, v, ok: v >= q.alvo };
}
export async function marcarEstudo(id) {
  const f = new Set(feitas()); f.has(id) ? f.delete(id) : f.add(id);
  try { localStorage.setItem('flowclass.quests', JSON.stringify([...f])); } catch (e) { /* opcional */ }
  if (auth.client && auth.user) { const { data } = await auth.client.auth.updateUser({ data: { quests_feitas: [...f] } }); if (data?.user) auth.user = data.user; }
}

/** Salva o perfil na conta (e no card do time, quando a pessoa pode escrever nele). */
export async function salvarPerfil(r) {
  const p = { ...r, nivel: Number(r.nivel) || 0, em: today() };
  try { localStorage.setItem('flowclass.perfil', JSON.stringify(p)); } catch (e) { /* opcional */ }
  if (auth.client && auth.user) { const { data } = await auth.client.auth.updateUser({ data: { perfil: p } }); if (data?.user) auth.user = data.user; }
  return p;
}

/** Quiz em tela cheia. onFim(perfil) é chamado ao terminar (ou ao pular, com null). */
export function montarQuiz(root, { nome = '', escola = '', onFim }) {
  const r = { objetivos: [], fortes: [] }; let i = 0;
  const desenhar = () => {
    if (i >= PERGUNTAS.length) return resultado();
    const q = PERGUNTAS[i]; const val = r[q.id];
    root.innerHTML = `<div class="pq">
      <div class="pq-top"><span>${i + 1} de ${PERGUNTAS.length}</span><div class="pq-bar"><i style="width:${((i + 1) / PERGUNTAS.length) * 100}%"></i></div><button type="button" class="link" data-pq-pular>Pular</button></div>
      ${i === 0 ? `<p class="pq-ola">${nome ? `Oi, ${esc(nome.split(' ')[0])}!` : 'Bem-vindo!'} ${escola ? `Você agora faz parte de <b>${esc(escola)}</b>.` : ''} Seis perguntas rápidas para montar o seu caminho.</p>` : ''}
      <h1 class="pq-h">${esc(q.titulo)}</h1><p class="pq-ajuda">${esc(q.ajuda)}</p>
      <div class="pq-ops ${q.opcoes.length > 4 ? 'grade' : ''}">${q.opcoes.map(([v, t, ic]) => { const on = q.tipo === 'varios' ? (val || []).includes(v) : val === v; return `<button type="button" class="pq-op${on ? ' on' : ''}" data-pq-v="${esc(v)}" aria-pressed="${on}"><span class="pq-ic">${ICON[ic] || ''}</span><span>${esc(t)}</span>${on ? `<i>${ICON.check}</i>` : ''}</button>`; }).join('')}</div>
      <div class="pq-nav">${i ? '<button type="button" class="btn" data-pq-voltar>Voltar</button>' : '<span></span>'}${q.tipo === 'varios' ? `<button type="button" class="btn primary" data-pq-seguir${(val || []).length ? '' : ' disabled'}>Continuar ${ICON.arrow}</button>` : ''}</div>
    </div>`;
  };
  const resultado = () => {
    const n = Number(r.nivel) || 0;
    const prev = { ...r, nivel: n };
    try { localStorage.setItem('flowclass.perfil.rascunho', JSON.stringify(prev)); } catch (e) { /* opcional */ }
    const qs = (r.objetivos || []).flatMap((o) => QUESTS[o] || []).slice(0, 4);
    root.innerHTML = `<div class="pq pq-fim">
      <div class="pq-selo"><span>${ICON.medalha}</span></div>
      <p class="pq-k">Seu ponto de partida</p><h1 class="pq-h">${NIVEL_NOME[n]}</h1>
      <p class="pq-ajuda">Você começa com ${qs.length} missões feitas para você. Cada uma concluída sobe o seu nível no time.</p>
      <ul class="pq-quests">${qs.map((q) => `<li><span>${q.tipo === 'estudo' ? ICON.ideia : ICON.raio}</span><div><b>${esc(q.titulo)}</b><small>${q.tipo === 'estudo' ? 'Estudo · você marca quando fizer' : 'Trabalho · o painel conta sozinho'}</small></div></li>`).join('')}</ul>
      ${(r.fortes || []).length ? `<p class="pq-fortes">Pontos fortes: ${r.fortes.map((f) => `<span>${esc(PERGUNTAS[5].opcoes.find(([v]) => v === f)?.[1] || f)}</span>`).join('')}</p>` : ''}
      <button type="button" class="btn primary block" data-pq-entrar>Entrar no painel ${ICON.arrow}</button>
    </div>`;
  };
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-pq-pular]')) return onFim(null);
    if (b.matches('[data-pq-voltar]')) { i = Math.max(0, i - 1); return desenhar(); }
    if (b.matches('[data-pq-seguir]')) { i++; return desenhar(); }
    if (b.matches('[data-pq-entrar]')) { b.disabled = true; b.classList.add('loading'); const p = await salvarPerfil(r); return onFim(p); }
    const v = b.dataset.pqV; if (v === undefined) return;
    const q = PERGUNTAS[i];
    if (q.tipo === 'varios') { const l = new Set(r[q.id] || []); l.has(v) ? l.delete(v) : (l.size < q.max && l.add(v)); r[q.id] = [...l]; return desenhar(); }
    r[q.id] = v; b.classList.add('on'); setTimeout(() => { i++; desenhar(); }, 220);
  });
  desenhar();
}
