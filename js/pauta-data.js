import { settings } from './metrics.js';
// Conteúdo da Pauta Viral original (banco de ganchos, moldes de roteiro e regras de escrita).
// Mantido igual ao artefato que já funcionava; só mudou de lugar.

export const BANK = [
  { cat: 'Motion TecMais', items: [
    ['Esse erro pode custar uma vida bem na sua frente. (tela: o erro nomeado, ex.: ACHAR QUE ELE TÁ RESPIRANDO)', 'Alerta'],
    ['Você acha que ele tá respirando. Mas o coração dele parou.', 'Opinião contrária'],
    ['Você conhece [primeiros socorros]. Mas provavelmente nunca viu essa parte.', 'Curiosidade'],
    ['Você não é covarde. Só nunca aprendeu o que fazer.', 'Identificação'],
    ['Fiz um curso achando que nunca ia usar. Aí isso aconteceu.', 'História']] },
  { cat: 'Opinião contrária', items: [
    '[Tema] não morreu. As pessoas é que estão fazendo errado.',
    '"[Conselho comum]" é um dos piores conselhos sobre [assunto].',
    'Pare de [ação comum].',
    'Você acha que o problema é [X]. Mas é [Y].',
    '[Pessoa ou empresa] só fala o que você quer ouvir.',
    'Fazer mais [ação] não vai resolver [problema].',
    'Esqueça [método famoso]. Teste [outro método].',
    'Todo mundo quer [objetivo]. Eu acho uma péssima ideia.',
    'Você ainda acredita que [crença comum]?',
    'Pare de buscar [objetivo comum]. Busque [objetivo melhor].'] },
  { cat: 'Comportamentos', items: [
    'Quer [resultado]? Vai ter que parar de [hábito].',
    'Não consegue [resultado]? Veja se você está fazendo isso.',
    'Quem faz [comportamento] demonstra [característica].',
    'Tentou [método] e não funcionou? Confira esta etapa.',
    'Você ainda faz [hábito]? Comece a [ação].',
    'Você é [público] e quer [resultado]? Comece por aqui.',
    '[Problema] acontece toda hora? Confira [possível causa].',
    'Você espera [condição ideal] para [ação]?',
    'Você faz [comportamento]? Isso pode ser sinal de [problema].',
    'Você consegue explicar [tema] sem complicar?'] },
  { cat: 'Curiosidade', items: [
    'Troque "[frase comum]" por "[frase melhor]".',
    'Quem começa faz [X]. Quem tem resultado faz [Y].',
    '[Grupo inesperado] faz [atividade] melhor que [grupo esperado].',
    'É por isso que [pessoa de sucesso] nunca [ação comum].',
    'Esse detalhe é o motivo de [problema].',
    'Como um [iniciante] conseguiu superar um [especialista]?',
    'Antes de [atividade], os melhores fazem isso.',
    'Você conhece [tema]. Mas provavelmente nunca viu essa parte.',
    'Quase ninguém fala disso em [área].',
    'Conhece a regra [nome]? Ela ajuda a resolver [problema].'] },
  { cat: 'Identificação', items: [
    'Se você é [público], vai entender isso.',
    'Já aconteceu de você [situação frustrante]?',
    'Você não é [rótulo negativo]. Só precisa aprender [habilidade].',
    'Você chama de [desculpa]. Mas o motivo é [causa real].',
    'Todo [profissional] tem medo de [situação].',
    'Você fica nervoso só de pensar em [situação]?',
    'Cansou de [problema]? Veja isso.',
    'Quem trabalha com [área] já passou por [situação].',
    'Já cometeu [erro]? Veja como corrigir.',
    'Deu errado com [algo]? Veja o que fazer agora.'] },
  { cat: 'Histórias', items: [
    'Fiz [erro]. Não me orgulho, mas vou contar.',
    'Achei que já teria [conquista] a essa altura.',
    'Perguntei a [pessoa] como resolver [problema]. Não esperava essa resposta.',
    'Quase desisti de [atividade]. Aí isso aconteceu.',
    'Fiz [ação] por [tempo]. Deu nisso.',
    'Tomei uma péssima decisão sobre [assunto]. Aprendi isso.',
    'Consegui [resultado] sem [recurso que parece obrigatório].',
    'Disseram que eu [crítica]. Foi isso que eu fiz depois.',
    'Se eu começasse [atividade] do zero hoje, faria isso.',
    'Errei em [atividade] por [tempo]. Vou te mostrar onde.'] },
  { cat: 'Passo a passo', items: [
    'Use a regra [nome] para evitar [problema].',
    'Para [objetivo], você precisa de [número] coisas.',
    'Antes de [ação], faça este teste.',
    '[Número] passos que eu sigo para [resultado].',
    'Para entender [tema], comece por [princípio].',
    'Faça [passo 1], depois [passo 2] e termine com [passo 3].',
    '[Número] formas de melhorar [atividade].',
    'Você ainda faz [atividade] desse jeito? Veja outra forma.',
    'Responda a estas [número] perguntas antes de [decisão].',
    'Vai [ação]? Siga esta regra.'] },
  { cat: 'Autoridade', items: [
    'Ajudei [pessoa] a conseguir [resultado]. Veja o que funcionou.',
    'Trabalho com [área] há [tempo]. Este é o conselho que eu daria.',
    'Analisei [número] [exemplos]. Os melhores têm isso em comum.',
    '[Pessoa conhecida] faz [ação] todo [período]. Entenda por quê.',
    'Um [especialista] me ensinou isso sobre [assunto].',
    'Os melhores [profissionais] que conheço fazem isso.',
    'Esse erro custou [valor] à [empresa].',
    'Perguntei a [especialista] como [ação]. Ele me respondeu isso.',
    'Quer aprender [habilidade]? Estude estas [número] pessoas.',
    'Quem consegue [resultado] já entendeu isso sobre [tema].'] },
  { cat: 'Alerta', items: [
    'Esse erro pode fazer você perder [conquista].',
    'Antes de decidir [ação importante], responda a estas perguntas.',
    'Quer acabar com [algo]? Continue fazendo isso.',
    'Não faça [ação arriscada] sem saber disso.',
    '[Área] mudou. Você ainda faz tudo do mesmo jeito?',
    'Cada [período] que você adia [ação] custa [perda].',
    'Se você pular [etapa], pode acabar com [problema].',
    'Você não consegue [resultado] porque continua fazendo [ação].',
    'Vai trabalhar com [área]? Não erre nisso.',
    'Viu [sinal de alerta]? Resolva antes que vire [problema].'] },
  { cat: 'Fortes (com ciência)', items: [
    ['Você está perdendo [valor ou tempo concreto] todo [período] sem perceber. Está aqui.', 'Aversão à perda'],
    ['Se você ainda [prática comum], está pagando [custo invisível] por isso.', 'Aversão à perda'],
    ['Existe um motivo pelo qual [fenômeno que todo mundo já viu]. E não é o que você pensa.', 'Lacuna de curiosidade'],
    ['Analisei [número real] [casos]. O padrão estava no lugar mais óbvio.', 'Lacuna de curiosidade'],
    ['[Coisa que todo mundo considera boa] está te atrapalhando.', 'Quebra de expectativa'],
    ['Esse é o [resultado final]. Agora olha como começou.', 'Quebra de expectativa'],
    ['Existem dois tipos de [público]: os que [X] e os que [Y]. Em 10 segundos você descobre qual é o seu.', 'Identidade'],
    ['Isso não é pra quem [comportamento]. É pra quem [identidade desejada].', 'Identidade'],
    ['Se você [comportamento muito específico do público], esse vídeo é sobre você.', 'Autorreferência'],
    ['Responde rápido: você [pergunta diagnóstica]?', 'Autorreferência'],
    ['O erro mais caro que cometi em [área] parecia uma decisão inteligente.', 'Negatividade'],
    ['Parei de [prática popular]. [Resultado concreto] em [tempo].', 'Negatividade'],
    ['São 3 [erros]. O terceiro é o que quase todo mundo comete.', 'Laço aberto'],
    ['No final eu mostro [resultado], mas o segredo está no passo 2.', 'Laço aberto'],
    ['[Número real] pessoas já [ação]. Quase todas erraram a mesma coisa no começo.', 'Prova social'],
    ['Toda vez que mostro isso pra alguém de [área], a reação é a mesma.', 'Prova social'],
    ['R$ [valor exato]. Foi o que [decisão] me custou, e eu faria de novo.', 'Precisão'],
    ['[Resultado] em [tempo exato], sem [recurso que parece obrigatório].', 'Precisão'],
    ['Jeito comum: [X]. Jeito de quem tem resultado: [Y]. Olha a diferença.', 'Contraste'],
    ['Você acha que entende [tema]. Tenta explicar [pergunta específica] em uma frase.', 'Ilusão de conhecimento']] },
];

export const HOOKS = [];
BANK.forEach((g) => g.items.forEach((it) => {
  const text = Array.isArray(it) ? it[0] : it, mech = Array.isArray(it) ? it[1] : '';
  HOOKS.push({ id: HOOKS.length, cat: g.cat, text, mech });
}));

export const FORMATOS = ['Reels', 'Vídeo motion', 'Carrossel', 'Stories', 'Post estático'];
export const OBJETIVOS = [
  ['Comentários (palavra-chave)', 'Comentários'], ['Novos seguidores (conhecer o perfil)', 'Seguidores'], ['Salvamentos', 'Salvamentos'],
  ['Compartilhamentos', 'Compartilhamentos'], ['Conversas no WhatsApp', 'WhatsApp'], ['Matrículas', 'Matrícula'],
];
export const CONSCIENCIA = [
  ['Claude avalia', 'Deixar o Claude avaliar (no chat)'],
  ['Nível 1: nem sabe que precisa (eduque, não venda)', 'Nem sabe que precisa'],
  ['Nível 2: sente o problema, não conhece a solução (mostre o caminho, não a marca)', 'Sente o problema'],
  ['Nível 3: sabe que um curso resolve, não escolheu onde (por que a TecMais)', 'Sabe que curso resolve'],
  ['Nível 4: já conhece a TecMais, está comparando (prova e objeção)', 'Já conhece a TecMais'],
  ['Nível 5: já quer, falta o empurrão (oferta real, urgência real, CTA direto)', 'Já quer, falta o empurrão'],
];
export const OBJECOES = [['', 'Não sei'], ['Preço', 'Preço'], ['Falta de tempo', 'Tempo'], ['Medo de não conseguir acompanhar', 'Medo de não conseguir'], ['Não confia na escola ainda', 'Confiança'], ['Não vê necessidade', 'Não vê necessidade']];
export const CENARIOS = [['Padaria', 'Padaria'], ['Ônibus / ponto de ônibus', 'Ônibus'], ['Festa de família', 'Festa'], ['Casa', 'Casa'], ['Obra / trabalho', 'Obra'], ['Claude escolhe', 'Deixar o Claude escolher (no chat)']];

export const ROTEIRO = {
  'Reels': 'Roteiro cena a cena, de 20 a 45 segundos. Para cada cena: **00:00–00:03** · Imagem · Fala · Texto na tela. O gancho ocupa só os 3 primeiros segundos. A entrega útil chega antes da metade. Termine com a ação final dita de forma natural, sem cara de anúncio.',
  'Vídeo motion': 'Roteiro de vídeo motion animado em código (2.5D, bonecos sem rosto, 45 a 70 segundos, 1080x1920, tudo importante na faixa central 4:5). Molde que já funcionou na TecMais: história dramatizada numa situação comum do dia a dia (fila da padaria, ponto de ônibus, casa, trabalho) em que alguém usa o que se aprende no curso e derruba um erro que quase todo mundo comete. Entregue: premissa e o erro derrubado; personagens com silhueta e figurino marcantes, sem rosto, sempre de corpo inteiro; mapa de retenção (segundo e evento); cena a cena com **00:00–00:04** · Cenário · Ação · Narração · Fala de personagem · Texto na tela · Som. Regras: estabeleça lugar e pessoas logo no início com o gancho por cima (vale flash-forward); o gancho pode ser sonoro; a cor esfria na tensão e esquenta na resolução; frase final emocional e pessoal, sem carga horária nem preço; cartão final convidando a seguir @tecmais.valparaisodegoias com a logo (azul #000066 e laranja #F06022). No fim, separe as falas por voz (narrador e cada personagem) prontas para o ElevenLabs.',
  'Carrossel': 'Roteiro slide a slide (7 a 10). Slide 1 é o gancho. Slide 2 aumenta a tensão para a pessoa arrastar. Do 3 em diante, uma ideia por slide, até 25 palavras. Último slide: ação final. Diga o visual de cada slide.',
  'Stories': 'Sequência de 4 a 7 telas: o que aparece, texto curto e, em pelo menos 2 telas, uma figurinha de interação (enquete, caixa de pergunta, quiz ou slider) com o texto exato. A última tela leva para o direct ou WhatsApp.',
  'Post estático': 'Arte única: título (até 8 palavras), linha de apoio, elemento visual principal (foto real de preferência) e o motivo concreto para alguém comentar ou salvar.',
};

export const RULES = [
  'REGRAS DE ESCRITA HUMANA',
  '- Português do Brasil falado, como alguém da equipe falaria com um aluno. Frases curtas. Detalhe concreto em vez de adjetivo.',
  '- Proibido: "não é X, é Y" e "não é apenas... é..."; revelação com dois-pontos ("A melhor parte: ..."); "Sinceramente?", "Vamos lá", "Spoiler:", "No mundo de hoje", "Chegou a hora de", "Imagine...", "Uma experiência única"; trios de adjetivos; listas de 3 itens que dizem a mesma coisa; fechamento que repete a promessa do começo; travessão como muleta; perguntas retóricas em sequência; descubra, transforme, desbloqueie, jornada, potencialize, incrível, revolucionário; emoji como marcador; exclamação em toda frase; caixa alta sem motivo.',
  '- Teste do concorrente: se tirar o nome da TecMais e a frase servir para qualquer escola, reescreva com situação, tensão e um fato concreto.',
  '- Uma única ideia central por peça. Frase que pode sair sem perder o sentido é enchimento: corte.',
  '- CTA é o próximo passo pequeno e natural (comentar uma palavra, responder uma pergunta, pedir as datas). Nunca "Saiba mais" por hábito.',
  '- Urgência só se for real (data de turma, vagas do laboratório). Nunca escassez fabricada.',
  '- A legenda complementa o criativo, não transcreve o vídeo.',
  '- Nunca invente número, depoimento, resultado ou fala de aluno. Deixe [número real] ou [depoimento real] para a equipe preencher.',
  '- Saúde: nada de instrução técnica errada ou arriscada. A parte técnica precisa ser validada pela professora do curso antes de postar; lembre disso no fim.',
  '- Revise tudo uma segunda vez caçando frase com cara de IA e entregue só a versão final.',
];

function stratLines(d) {
  return [
    'Ponto de consciência do público: ' + (d.consciencia === 'Claude avalia' ? 'avalie e diga qual nível você assumiu' : d.consciencia),
    d.objecao ? 'O que mais trava a decisão: ' + d.objecao : null,
    d.anuncio ? 'Também vai virar anúncio pago (Meta Ads).' : null,
  ];
}
function finalSteps(d, n) {
  return [
    n + '. Crítica com nota: dê de 0 a 10 para gancho, especificidade, prova, naturalidade e CTA. Reescreva o que ficar abaixo de 7 e mostre só as notas finais em uma linha.',
    d.anuncio ? (n + 1) + '. Anúncio: 3 variações para teste mudando só o ângulo do gancho (ex.: dor, prova, objeção), mantendo o resto igual, e a métrica para decidir o vencedor (hook rate nos 3 primeiros segundos e custo por conversa).' : null,
  ];
}
const fmtHooks = (d) => (d.picked || []).filter((i) => HOOKS[i]).map((i) => '  - "' + HOOKS[i].text + '" (' + HOOKS[i].cat + (HOOKS[i].mech ? ', ' + HOOKS[i].mech : '') + ')').join('\n');

// Contexto de dados reais que o painel acrescenta ao briefing (desempenho do curso, objeções registradas).
function dataLines(d) {
  return d.contexto ? ['', 'DADOS REAIS DO PAINEL (use para escolher ângulo e objeção, não cite números no post)', d.contexto] : [];
}

function buildMotion(d) {
  const hooks = fmtHooks(d);
  const cen = d.cenario === 'Claude escolhe' ? 'escolha a situação do dia a dia mais forte para esse curso' : d.cenario;
  return [
    '/tecmais-reel-motion', '',
    'BRIEFING DE CRIAÇÃO · Vídeo motion · TecMais Valparaíso de Goiás (@tecmais.valparaisodegoias)', '',
    'Objetivo: ' + d.objetivo,
    'Curso: ' + (d.curso || '(não informado)'),
    'Ideia: ' + (d.ideia || '(não informada)'),
    'Situação: ' + cen,
    'Erro que a história derruba: ' + (d.erro || '(proponha o mais forte para esse curso)'),
    d.protagonista ? 'Protagonista: ' + d.protagonista : null,
    'Protocolo validado pela professora: ' + d.validado,
    ...stratLines(d),
    'Ganchos escolhidos como base: ' + (hooks ? '\n' + hooks : 'nenhum, use os modelos da skill'),
    d.publico ? 'Público: ' + d.publico : null,
    d.prova ? 'Material real disponível: ' + d.prova : null,
    d.refs ? 'Referências: ' + d.refs : null,
    d.cta ? 'Ação final: ' + d.cta : null,
    d.restricoes ? 'Não pode: ' + d.restricoes : null,
    d.voz ? 'Amostras da nossa voz (imite o jeito, não o conteúdo):\n"""\n' + d.voz + '\n"""' : null,
    ...dataLines(d),
    '',
    'O QUE EU PRECISO (siga o fluxo da skill, com aprovações)',
    '1. Conceito: confirme curso, situação e erro. Se algo estiver fraco ou errado, diga e proponha a versão mais forte.',
    '2. Gancho: 3 a 4 opções partindo dos ganchos escolhidos, cada uma com o texto de tela do 1º segundo (tem que funcionar no mudo). Recomende uma e espere minha escolha.',
    '3. Narração com direção de voz, só depois da escolha do gancho.',
    '4. Roteiro cena a cena na estrutura da skill. Pare e espere o "pode produzir".',
    'Se faltar algo decisivo, pergunte antes (até 3 perguntas). Confira os dados reais do curso (carga horária) antes de citá-los.',
    ...finalSteps(d, 5).map((s) => s && s.replace(/^5\. /, 'Em cada entrega: ').replace(/^6\. Anúncio: /, 'Depois do roteiro aprovado, para o anúncio: ')),
    d.validado === 'Sim' ? null : 'Atenção: o protocolo ainda não foi validado pela professora. Marque no roteiro os trechos técnicos que ela precisa aprovar.',
    '',
    ...RULES,
  ].filter((x) => x !== null).join('\n');
}

// A unidade e o @ vêm das Configurações; o texto-base foi escrito para a unidade de Valparaíso.
export function buildBrief(d) {
  const st = settings();
  return briefRaw(d).replaceAll('TecMais Valparaíso de Goiás', st.unidade || 'TecMais Valparaíso de Goiás').replaceAll('@tecmais.valparaisodegoias', st.instagram || '@tecmais.valparaisodegoias');
}

function briefRaw(d) {
  if (d.formato === 'Vídeo motion') return buildMotion(d);
  const hooks = fmtHooks(d);
  return [
    'BRIEFING DE CRIAÇÃO · TecMais Valparaíso de Goiás (@tecmais.valparaisodegoias)', '',
    'Formato: ' + d.formato,
    'Objetivo: ' + d.objetivo,
    'Curso/tema: ' + (d.curso || '(não informado)'),
    'Ideia: ' + (d.ideia || '(não informada)'),
    ...stratLines(d),
    'Ganchos escolhidos como base: ' + (hooks ? '\n' + hooks : 'nenhum, escolha os melhores'),
    d.publico ? 'Público: ' + d.publico : null,
    d.entrega ? 'O que a pessoa leva de graça: ' + d.entrega : null,
    d.prova ? 'Material real disponível: ' + d.prova : null,
    d.refs ? 'Referências: ' + d.refs : null,
    d.cta ? 'Ação final: ' + d.cta : null,
    d.restricoes ? 'Não pode: ' + d.restricoes : null,
    d.voz ? 'Amostras da nossa voz (imite o jeito, não o conteúdo):\n"""\n' + d.voz + '\n"""' : null,
    ...dataLines(d),
    '',
    'O QUE EU PRECISO',
    '1. Diagnóstico: em 2 a 4 frases, diga se a ideia segura alguém nos 3 primeiros segundos e se combina com o ponto de consciência do público. Escreva a ideia central da peça em uma frase. Se estiver fraca, proponha a versão mais forte e siga com ela.',
    '2. Ganchos: adapte os ganchos escolhidos ao tema e traga 5 opções no total, de mecanismos diferentes. Para cada uma: frase falada, texto na tela (até 8 palavras), primeiro frame e por que funciona. Marque a recomendada.',
    '3. Roteiro: ' + ROTEIRO[d.formato],
    '4. Legenda pronta para colar, com a primeira linha funcionando sozinha no feed, a entrega útil resumida e a ação final. Até 5 hashtags relevantes (amplas e de nicho), nunca #viral, #fyp ou #explorar.',
    '5. Palavra-chave de comentário e a mensagem curta e humana para mandar no direct ou WhatsApp de quem comentar.',
    '6. O que falta: antes de tudo, se faltar algo decisivo (referência, material real, número verdadeiro), me pergunte em até 3 perguntas. Se nada faltar, siga direto.',
    ...finalSteps(d, 7),
    '',
    ...RULES,
  ].filter((x) => x !== null).join('\n');
}
