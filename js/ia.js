// IA na criação de conteúdo. Com conta (Supabase), chama a função ia-criar (Claude) no servidor;
// a chave nunca passa pelo navegador. No modo demonstração, usa o banco de ganchos local e avisa que não é IA.

import { store } from './store.js';
import { auth } from './auth.js';
import { HOOKS } from './pauta-data.js';

export const iaOnline = () => store.mode === 'supabase' && !!auth.client;

function contextoEscola() {
  const s = store.settings();
  const cursos = store.all('courses').filter((c) => c.ativo !== false).map((c) => c.nome);
  return [s.unidade && `Escola: ${s.unidade}`, s.instagram && `Instagram: ${s.instagram}`, cursos.length && `Cursos: ${cursos.join(', ')}`, s.pilares?.length && `Pilares de conteúdo: ${s.pilares.join(', ')}`].filter(Boolean).join('\n');
}

/** O que já funciona na escola: posts publicados que mais geraram conversa/alcance e as ideias mais votadas.
 *  Vai junto de cada pedido para a IA seguir o estilo da casa (vai "modelando" com o que vocês criam). */
export function historicoCriacao() {
  const pubs = store.all('calendar').filter((i) => i.tipo === 'Publicação' && i.status === 'Publicado')
    .map((i) => ({ t: i.titulo, f: i.formato || '', conv: Number(i.metricas?.conversas) || 0, alc: Number(i.metricas?.alcance) || 0 }))
    .sort((a, b) => b.conv - a.conv || b.alc - a.alc).slice(0, 6);
  const votadas = store.all('pautas').filter((p) => p.brain && (p.fogo || 0) > 0 && p.status !== 'Descartada').sort((a, b) => b.fogo - a.fogo).slice(0, 5);
  const linhas = [];
  if (pubs.length) linhas.push('Posts publicados (do melhor para o pior):', ...pubs.map((x) => `- ${x.f ? x.f + ': ' : ''}${x.t}${x.conv ? ` · ${x.conv} conversas` : ''}${x.alc ? ` · alcance ${x.alc}` : ''}`));
  if (votadas.length) linhas.push('Ideias que o time mais votou:', ...votadas.map((p) => `- ${p.titulo} (${p.fogo} votos)`));
  return linhas.join('\n').slice(0, 2000);
}

/** Pede à IA. modo: 'ideias' | 'roteiro' | 'ganchos'. Retorna { resultado, demo } ou lança Error com mensagem pronta. */
export async function pedirIA(modo, dados) {
  if (!iaOnline()) return { demo: true, resultado: demo(modo, dados) };
  const { data, error } = await auth.client.functions.invoke('ia-criar', { body: { orgId: auth.org?.id, modo, escola: contextoEscola(), historico: historicoCriacao(), ...dados } });
  if (data?.error) throw new Error(data.error);
  if (error) {
    // Erro HTTP da função: a mensagem certa (limite, permissão, IA ocupada) vem no corpo da resposta.
    let msg = '';
    try { msg = (await error.context?.json?.())?.error || ''; } catch (e) { /* corpo vazio */ }
    if (!msg && /Failed to send|fetch/i.test(error.message || '')) msg = 'Sem conexão com o servidor. Confira a internet e tente de novo.';
    throw new Error(msg || 'A IA não respondeu. Tente de novo.');
  }
  return { demo: false, resultado: data.resultado };
}

// ---------- modo demonstração: banco de ganchos, sem IA ----------
const FMT = ['Reels', 'Carrossel', 'Stories', 'Post estático', 'Reels', 'Vídeo motion'];
const preencher = (t, curso) => t.replace(/\[[^\]]*\]/g, curso || 'o curso').replace(/\s*\(tela:.*?\)\s*/g, ' ').trim();
function demo(modo, d) {
  const pool = [...HOOKS].sort(() => Math.random() - 0.5);
  if (modo === 'ideias') return { ideias: pool.slice(0, Math.min(10, Number(d.quantidade) || 6)).map((h, i) => ({ titulo: preencher(h.text, d.curso).slice(0, 90), formato: FMT[i % FMT.length], gancho: preencher(h.text, d.curso), porque: `Gancho do tipo "${h.mech || h.cat}" do banco da Pauta Viral.` })) };
  if (modo === 'ganchos') return { ganchos: pool.slice(0, 5).map((h) => preencher(h.text, d.curso)) };
  const ideia = d.ideia || 'a ideia';
  return { gancho: preencher(pool[0].text, d.curso), cenas: [
    { cena: 'Close no rosto, ambiente da sala de aula', fala: preencher(pool[0].text, d.curso), tela: ideia.slice(0, 40) },
    { cena: 'Mão mostrando o material da aula', fala: 'Muita gente erra isso logo no começo.', tela: 'O erro comum' },
    { cena: 'Professor demonstrando', fala: 'Na prática, o jeito certo é este.', tela: 'Como fazer certo' },
    { cena: 'Turma em atividade', fala: 'É isso que você treina aqui desde a primeira aula.', tela: 'Aula prática' },
  ], legenda: `${ideia}. Quer aprender na prática? Chama no WhatsApp.`, hashtags: ['#cursotecnico', '#educacao', '#carreira'], cta: 'Chama no WhatsApp e garanta sua vaga' };
}

/** Roteiro em texto para salvar na pauta (vira o "kit"). */
export function roteiroTexto(r) {
  return [`GANCHO: ${r.gancho}`, '', ...r.cenas.map((c, i) => `${i + 1}. ${c.fala}\n   Tela: ${c.tela}\n   Câmera: ${c.cena}`), '', `LEGENDA: ${r.legenda}`, `HASHTAGS: ${(r.hashtags || []).join(' ')}`, `CTA: ${r.cta}`].join('\n');
}

/** Ferramentas de IA: o que já funciona e o que está no radar. Nada aqui finge estar conectado. */
export const FERRAMENTAS_IA = [
  { id: 'claude', nome: 'Claude (Anthropic)', faz: 'Ideias, ganchos, roteiros e legendas na Pauta Viral.', status: 'ativo' },
  { id: 'higgsfield', nome: 'Higgsfield', faz: 'Vídeos curtos com IA a partir do roteiro (movimento de câmera, avatar).', status: 'breve' },
  { id: 'imagem', nome: 'Geração de imagem', faz: 'Capas de Reels e slides de carrossel a partir do prompt da pauta.', status: 'breve' },
  { id: 'voz', nome: 'Narração com voz (ex.: ElevenLabs)', faz: 'Locução do roteiro em português, pronta para o vídeo.', status: 'breve' },
  { id: 'canva', nome: 'Canva', faz: 'Mandar o carrossel para um modelo da marca e editar lá.', status: 'breve' },
  { id: 'mcp', nome: 'Servidores MCP', faz: 'Ligar outras ferramentas ao assistente de IA da escola (Drive, Notion, CRM).', status: 'breve' },
];
