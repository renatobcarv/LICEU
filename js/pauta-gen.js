// Gerador da Pauta Viral: transforma as respostas do quiz num kit pronto para produzir.
// Roda no navegador, sem IA: são moldes testados (gancho nos 3 primeiros segundos, entrega antes da metade,
// CTA pequeno e natural) preenchidos com curso, ideia, objeção, ambiente, tom e quem aparece.
// "Outra versão" troca as variações. O briefing para o Claude continua disponível para quem quiser ir além.

import { settings } from './metrics.js';
import { HOOKS } from './pauta-data.js';

export const AMBIENTES = [
  { id: 'lab', nome: 'Sala de aula / laboratório', pt: 'Sala de aula prática da escola, bancada com material do curso à vista, alunos ao fundo em atividade.', luz: 'Luz natural da janela + uma luz branca suave de frente (ring light a 45°).', obj: 'Material real do curso na bancada, jaleco ou uniforme, quadro com anotação à mão.', som: 'Burburinho baixo da turma, sem música alta por cima da fala.', en: 'a bright hands-on vocational classroom with a workbench full of real course materials, students practicing in the background' },
  { id: 'padaria', nome: 'Padaria', pt: 'Fila de padaria de bairro de manhã, balcão de pães, gente comum esperando.', luz: 'Luz quente do estabelecimento; evite contraluz da porta.', obj: 'Pão na mão, celular, sacola; nada de cenário montado.', som: 'Barulho de café e conversa ao fundo.', en: 'a neighborhood bakery line in the morning, warm light, ordinary people waiting at the counter' },
  { id: 'onibus', nome: 'Ônibus / ponto', pt: 'Ponto de ônibus ou corredor de ônibus em horário de pico.', luz: 'Luz do dia; grave de costas para o sol.', obj: 'Mochila, crachá de trabalho, fone de ouvido.', som: 'Trânsito e freio de ônibus, baixo.', en: 'a crowded city bus stop at rush hour, daylight, commuters with backpacks' },
  { id: 'casa', nome: 'Casa', pt: 'Sala ou cozinha de casa simples, família por perto.', luz: 'Luz da janela de lado; uma lâmpada quente acesa.', obj: 'Mesa com café, criança ou idoso na cena, objetos do dia a dia.', som: 'Silêncio de casa, TV baixinha.', en: 'a simple Brazilian home kitchen with family members around, soft window light' },
  { id: 'trabalho', nome: 'Trabalho / obra', pt: 'Local de trabalho real (obra, loja, farmácia, escritório) onde o curso faz diferença.', luz: 'Luz do ambiente; evite sombra dura no rosto.', obj: 'EPI, uniforme, ferramentas ou balcão de atendimento.', som: 'Som ambiente do trabalho, baixo.', en: 'a real workplace such as a construction site or pharmacy counter, workers in uniform' },
  { id: 'rua', nome: 'Rua / cidade', pt: 'Rua movimentada da cidade da escola, de preferência com ponto conhecido ao fundo.', luz: 'Fim de tarde (luz dourada) ou dia nublado.', obj: 'Algo que identifique a cidade.', som: 'Rua ao fundo, fala em primeiro plano.', en: 'a busy street in a Brazilian city at golden hour, recognizable local landmark in the background' },
  { id: 'estudio', nome: 'Fundo neutro (estúdio)', pt: 'Parede lisa grafite ou clara, pessoa em primeiro plano.', luz: 'Uma luz principal suave de frente e uma de recorte atrás.', obj: 'Só o objeto-chave do assunto na mão.', som: 'Silêncio, microfone de lapela.', en: 'a clean graphite studio background, one person in the foreground holding a single key object' },
];
export const QUEM = [
  ['professor', 'Professor(a) falando para a câmera'], ['aluno', 'Aluno(a) contando a experiência'], ['dramatizacao', 'Dramatização (uma situação acontecendo)'],
  ['locucao', 'Só locução + imagens da aula'], ['motion', 'Animação / motion'],
];
export const TONS = ['Direto', 'Emocional', 'Bem-humorado', 'Autoridade técnica', 'Inspirador'];
const TRILHA = { 'Direto': 'Batida leve e constante (lo-fi ou pop instrumental), volume baixo sob a fala.', 'Emocional': 'Piano ou cordas suaves, crescendo na virada da história.', 'Bem-humorado': 'Som em alta nos Reels com tom leve; corte seco no gancho.', 'Autoridade técnica': 'Instrumental discreto; deixe a fala dominar.', 'Inspirador': 'Instrumental com crescendo no CTA.' };

const pick = (arr, v, k = 0) => arr[(v + k) % arr.length];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const fill = (txt, d) => txt.replace(/\[(tema|Tema|assunto|primeiros socorros)\]/g, d.topico).replace(/\[[^\]]+\]/g, (m) => m);

function topico(d) { return clean(d.curso) || 'o curso'; }
function cidade() { const u = settings().unidade || ''; return u.includes('·') ? u.split('·').pop().trim() : ''; }
function hashtags(d) {
  const words = (d.curso || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !['curso', 'para', 'tecnico', 'administracao'].includes(w));
  const tags = [];
  if (words.length) tags.push('#' + words.slice(0, 2).join(''));
  words.slice(0, 2).forEach((w) => tags.push('#' + w));
  const c = cidade().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '');
  if (c) tags.push('#' + c.toLowerCase());
  tags.push('#cursoprofissionalizante', '#qualificacaoprofissional');
  return [...new Set(tags)].slice(0, 5).join(' ');
}
const keyword = (d) => (clean(d.palavra) || (d.curso || 'QUERO').split(/\s+/).filter((w) => w.length > 3)[0] || 'QUERO').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ctaPor = (d) => {
  const kw = keyword(d);
  return {
    'Comentários (palavra-chave)': [`Comenta ${kw} que eu te mando o passo a passo.`, `Escreve ${kw} aqui embaixo e eu te respondo no direct.`, `Quer o material completo? Comenta ${kw}.`],
    'Novos seguidores (conhecer o perfil)': ['Segue o perfil: toda semana tem uma dessas.', 'Me segue pra não perder a parte 2.', 'Segue pra aprender mais um desses por semana.'],
    'Salvamentos': ['Salva esse vídeo pra lembrar na hora que precisar.', 'Salva e manda pra quem precisa ver isso.', 'Guarda esse post: um dia ele faz falta.'],
    'Compartilhamentos': ['Manda pra alguém que precisa saber disso.', 'Compartilha com quem trabalha na área.', 'Envia pra aquela pessoa que vive dizendo que vai fazer o curso.'],
    'Conversas no WhatsApp': ['Chama no WhatsApp que eu te conto como funciona a próxima turma.', 'Toca no botão e fala com a gente no WhatsApp.', 'Quer saber datas e valores? Chama no WhatsApp.'],
    'Matrículas': ['As vagas da próxima turma estão abertas: chama no WhatsApp e garanta a sua.', 'Reserve sua vaga pelo WhatsApp hoje.', 'Toca no link e fala com a gente para se matricular.'],
  }[d.objetivo] || ['Chama no WhatsApp.'];
};

function hooksFor(d) {
  const t = d.topico;
  const erro = clean(d.erro);
  const base = (d.picked || []).map((i) => HOOKS[i]).filter(Boolean).map((h) => fill(h.text.replace(/\s*\(tela:.*?\)\s*/, ' '), d).trim());
  const obj = {
    'Preço': [`Quanto custa aprender ${t}? Menos do que errar sem saber.`, `"É caro." Caro é o que acontece quando ninguém sabe ${t}.`],
    'Falta de tempo': [`Dá pra aprender ${t} sem largar o trabalho. Olha como.`, `Sem tempo? Esse curso cabe no seu fim de semana.`],
    'Medo de não conseguir acompanhar': [`"Eu não vou dar conta." Foi o que ela disse no primeiro dia.`, `Você não precisa saber nada antes. Só precisa começar.`],
    'Não confia na escola ainda': [`Mostrei a aula de verdade. Sem edição.`, `Antes de você escolher onde estudar, olha isso.`],
    'Não vê necessidade': [`Você acha que nunca vai precisar de ${t}. Até precisar.`, `Isso parece detalhe. Até acontecer na sua frente.`],
  }[d.objecao] || [];
  const nivel = d.consciencia || '';
  const gen = [
    erro ? `O erro que quase todo mundo comete: ${erro}.` : `O erro que quase todo mundo comete em ${t}.`,
    `Ninguém te conta isso sobre ${t}.`,
    nivel.startsWith('Nível 5') ? `Últimas vagas reais para ${t}. Olha o que você aprende.` : `Faz isso antes de pensar em ${t}.`,
    `3 coisas que eu queria ter sabido antes de ${t}.`,
    d.quem === 'aluno' ? `Eu quase desisti de ${t}. Ainda bem que não.` : `Você faria isso certo? Testa em 10 segundos.`,
  ];
  const all = [...base, ...obj, ...gen].map(cap);
  const out = [];
  for (let k = 0; out.length < 3 && k < all.length * 2; k++) { const h = pick(all, d.v, k * (base.length ? 1 : 2)); if (!out.includes(h)) out.push(h); }
  return out;
}

const telaDe = (h) => h.split(/(?<=[.?!])\s+/)[0].replace(/[.?!]+$/, '').split(/\s+/).slice(0, 7).join(' ').toUpperCase();

function entregaLines(d) {
  const ideia = clean(d.ideia);
  if (ideia) {
    const parts = ideia.split(/[.;\n]+/).map(clean).filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, 3);
    return [ideia, `Por que isso importa: ${d.objecao ? 'é o que trava quem pensa em ' + d.topico : 'é o que separa quem sabe de quem acha que sabe'}.`, `O que muda na prática quando você aprende do jeito certo.`];
  }
  return [`O erro mais comum em ${d.topico} e por que ele acontece.`, `O jeito certo, em um passo simples de mostrar.`, `Onde aprender com prática de verdade.`];
}

function roteiro(d, hooks) {
  const h = hooks[0];
  const e = entregaLines(d);
  const cta = pick(ctaPor(d), d.v);
  const quem = { professor: 'Professor(a) olhando para a câmera', aluno: 'Aluno(a) em close, falando natural', dramatizacao: 'Cena acontecendo, sem olhar para a câmera', locucao: 'Imagens da aula com locução', motion: 'Animação 2.5D, bonecos sem rosto' }[d.quem] || 'Pessoa da escola falando para a câmera';
  const prova = clean(d.prova) || '[material real: aula prática, depoimento real de aluno]';
  const dur = Number(d.duracao) || 30;
  const T = (a, b) => `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}–${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`;
  if (d.formato === 'Carrossel') {
    return [`SLIDE 1 (capa) · ${telaDe(h)}\nVisual: foto real do ambiente, rosto ou mão em ação.`,
      `SLIDE 2 · A tensão\n${d.objecao ? 'Quem trava em "' + d.objecao.toLowerCase() + '" pensa assim…' : 'Quase todo mundo faz assim, e é aí que erra.'}`,
      ...e.map((x, i) => `SLIDE ${i + 3} · ${x}\nVisual: um detalhe por slide, até 25 palavras.`),
      `SLIDE ${e.length + 3} · Prova\n${prova}`,
      `SLIDE ${e.length + 4} · Ação\n${cta}`].join('\n\n');
  }
  if (d.formato === 'Stories') {
    return [`TELA 1 · ${h}\nFigurinha: enquete "Você sabia disso?" (Sim / Não)`, `TELA 2 · ${e[0]}`, `TELA 3 · ${e[1] || e[0]}\nFigurinha: caixa de pergunta "Qual sua maior dúvida sobre ${d.topico}?"`, `TELA 4 · ${prova}`, `TELA 5 · Quiz: "${e[2] || 'Qual o jeito certo?'}" (2 opções)`, `TELA 6 · ${cta}\nLink: WhatsApp`].join('\n\n');
  }
  if (d.formato === 'Post estático') {
    return `Título (até 8 palavras): ${telaDe(h)}\nLinha de apoio: ${e[0]}\nVisual: foto real em ${(AMBIENTES.find((a) => a.id === d.ambiente)?.nome || 'ambiente da escola').toLowerCase()}, rosto ou mão em ação.\nMotivo para salvar/comentar: ${cta}`;
  }
  const c1 = Math.round(dur * 0.1) || 3, c2 = Math.round(dur * 0.3), c3 = Math.round(dur * 0.65), c4 = Math.round(dur * 0.85);
  const cenas = [
    [0, c1, 'GANCHO', d.formato === 'Vídeo motion' ? `Abre já na situação: ${clean(d.erro) || 'o erro acontecendo'}` : `${quem}. Primeiro frame já mostra a ação, sem "oi, gente".`, h, telaDe(h)],
    [c1, c2, 'TENSÃO', d.formato === 'Vídeo motion' ? `Personagem ${clean(d.protagonista) || 'comum do dia a dia'} faz o que todo mundo faria.` : 'Corte rápido, ângulo diferente.', d.objecao ? `Muita gente trava aqui: ${d.objecao.toLowerCase()}.` : 'E quase todo mundo faz exatamente isso.', ''],
    [c2, c3, 'ENTREGA', 'Mostre o passo na prática, mão em close.', e.slice(0, 2).map((x) => x.replace(/[.]+$/, '') + '.').join(' '), telaDe(e[0])],
    [c3, c4, 'PROVA', prova, e[2] || 'É isso que a gente pratica na aula, com supervisão.', ''],
    [c4, dur, 'AÇÃO', 'Volta para o rosto ou plano aberto da turma.', cta, keyword(d)],
  ];
  return cenas.map(([a, b, n, img, fala, tela]) => `${T(a, b)} · ${n}\nImagem: ${img}\nFala: ${fala}${tela ? `\nTela: ${tela}` : ''}`).join('\n\n');
}

function ambiente(d) {
  const a = AMBIENTES.find((x) => x.id === d.ambiente) || AMBIENTES[0];
  const custom = clean(d.ambienteLivre);
  return [`Onde: ${custom || a.pt}`, `Luz: ${a.luz}`, `Objetos e figurino: ${a.obj}`, `Enquadramento: vertical 9:16, o importante no centro (faixa 4:5), câmera na altura dos olhos; um plano detalhe por cena de entrega.`, `Som: ${a.som}`, `Trilha: ${TRILHA[d.tom] || TRILHA.Direto}`].join('\n');
}

function legenda(d, hooks) {
  const e = entregaLines(d);
  const cta = pick(ctaPor(d), d.v, 1);
  const abert = { 'Emocional': 'Isso aconteceu de verdade, e mudou como eu vejo o assunto.', 'Bem-humorado': 'Todo mundo já fez isso. Confessa.', 'Autoridade técnica': 'Vou ser direta, porque esse detalhe importa.', 'Inspirador': 'Começar é a parte mais difícil. Depois, vira prática.', 'Direto': '' }[d.tom] || '';
  return [hooks[1] || hooks[0], abert, '', ...e.map((x) => '→ ' + x), '', cta, '', hashtags(d)].filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n').trim();
}

function promptImagem(d) {
  const a = AMBIENTES.find((x) => x.id === d.ambiente) || AMBIENTES[0];
  const who = { professor: 'a confident instructor in uniform explaining with hands, looking at the camera', aluno: 'an adult student smiling proudly, practicing the skill', dramatizacao: 'an everyday person in the middle of the situation, candid moment', locucao: 'close-up of hands practicing the skill with real materials', motion: '2.5D flat illustration style, faceless characters' }[d.quem] || 'a student practicing the skill';
  const mood = { 'Emocional': 'emotional, warm tones', 'Bem-humorado': 'playful, bright', 'Autoridade técnica': 'professional, clean, precise', 'Inspirador': 'hopeful, cinematic', 'Direto': 'clear, natural' }[d.tom] || 'natural';
  const curso = clean(d.curso) || 'vocational course';
  const base = `${d.quem === 'motion' ? 'Vector 2.5D illustration' : 'Realistic photo'}, ${who}, ${a.en}, topic: "${curso}" (vocational training in Brazil), ${mood}, natural light, shallow depth of field, accent details in lime green #C4F15A over graphite #101214, authentic Brazilian people, vertical ${d.formato === 'Carrossel' || d.formato === 'Post estático' ? '4:5' : '9:16'}, high detail`;
  const neg = 'Negative: text, letters, watermark, logos, blood, needles piercing skin, distorted hands, extra fingers, stock-photo smile, fake medical procedure';
  const capa = `CAPA / THUMBNAIL\n${base}, strong focal point in the center, space at the top for a headline.\n${neg}`;
  const extra = d.formato === 'Carrossel' ? '\n\nSLIDES (mesmo estilo, troque só o detalhe)\n' + entregaLines(d).map((x, i) => `Slide ${i + 3}: ${base}, close-up detail illustrating: "${x}"`).join('\n') : '';
  return capa + extra;
}

function promptVideo(d, hooks) {
  if (!['Reels', 'Vídeo motion'].includes(d.formato)) return '';
  const a = AMBIENTES.find((x) => x.id === d.ambiente) || AMBIENTES[0];
  return `Vertical 9:16 video, ${Number(d.duracao) || 30} seconds, ${d.formato === 'Vídeo motion' ? '2.5D motion graphics, faceless characters' : 'handheld realistic footage'}, set in ${a.en}. Opening shot (0–3s) shows the action immediately: "${hooks[0]}". Smooth cuts every 2–3 seconds, close-ups of hands practicing, ends on a wide shot of the class. Lime green #C4F15A accents, graphite tones, no on-screen text, no logos.`;
}

function dm(d) {
  return `Oi, [nome]! Vi que você comentou ${keyword(d)} 😊 Aqui está o que prometi: [material ou link].\nVocê já trabalha com ${d.topico} ou está pensando em começar?`;
}

function anuncio(d, hooks) {
  if (!d.anuncio) return '';
  return ['Teste 3 ângulos mudando só o gancho (o resto igual):', `A · Dor: ${hooks[0]}`, `B · Prova: "Olha a aula de verdade" + ${clean(d.prova) || '[cena real da aula]'}`, `C · Objeção: ${hooksFor({ ...d, v: d.v + 1, objecao: d.objecao || 'Preço' })[0]}`, 'Decida pelo hook rate (3 primeiros segundos) e pelo custo por conversa depois de 3 dias.'].join('\n');
}

function checklist(d) {
  return ['☐ Celular na vertical, lente limpa, modo 1080p 30fps', '☐ Microfone de lapela ou ambiente silencioso', '☐ Gravar o gancho 3 vezes (versões diferentes)', '☐ Planos detalhe das mãos e do material', d.quem === 'aluno' || d.quem === 'dramatizacao' ? '☐ Autorização de uso de imagem assinada' : '☐ Conferir fundo e objetos em cena', '☐ Parte técnica validada pelo(a) professor(a)', '☐ Legenda na tela em todas as falas (muita gente assiste no mudo)'].join('\n');
}

// Monta o kit. d.v = variação (0, 1, 2…).
export function buildKit(form) {
  const d = { ...form, v: Number(form.v) || 0, topico: topico(form) };
  const hooks = hooksFor(d);
  const blocos = [
    { id: 'ganchos', titulo: 'Ganchos (3 primeiros segundos)', texto: hooks.map((h, i) => `${i + 1}. ${h}\n   Tela: ${telaDe(h)}`).join('\n') },
    { id: 'roteiro', titulo: d.formato === 'Carrossel' ? 'Roteiro slide a slide' : d.formato === 'Stories' ? 'Sequência de stories' : d.formato === 'Post estático' ? 'Arte' : 'Roteiro cena a cena', texto: roteiro(d, hooks) },
    { id: 'ambiente', titulo: 'Ambiente e direção', texto: ambiente(d) },
    { id: 'legenda', titulo: 'Legenda', texto: legenda(d, hooks) },
    { id: 'imagem', titulo: 'Prompt de imagem (IA)', texto: promptImagem(d) },
    ...(promptVideo(d, hooks) ? [{ id: 'video', titulo: 'Prompt de vídeo (IA)', texto: promptVideo(d, hooks) }] : []),
    { id: 'dm', titulo: 'Resposta para quem comentar', texto: dm(d) },
    ...(anuncio(d, hooks) ? [{ id: 'anuncio', titulo: 'Variações para anúncio', texto: anuncio(d, hooks) }] : []),
    { id: 'checklist', titulo: 'Checklist de gravação', texto: checklist(d) },
  ];
  return blocos;
}
export const kitText = (blocos) => blocos.map((b) => `■ ${b.titulo.toUpperCase()}\n${b.texto}`).join('\n\n');
