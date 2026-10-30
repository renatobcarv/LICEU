// Método Ciclo CEC (Conhecer → Experimentar → Conquistar) para cursos presenciais que vendem pelo WhatsApp.
// Catálogo fixo (fases, estratégias, famílias de criativo, sinais, benchmarks) e todas as contas do planejador:
// verba mínima, calendário, projeção, fase da operação e saúde da campanha em andamento.
// As telas só leem daqui; nenhuma regra fica espalhada.

import { store } from './store.js';
import { addDays, daysBetween, today, sum, div, inRange, norm } from './util.js';
import { campaignRows } from './metrics.js';

// ---------- benchmarks de referência (caso real: Injetáveis, out/2026). Dados próprios têm prioridade. ----------
export const BENCH = { custoConversa: 3.0, convMatricula: 0.12, convPagamento: 0.69, cpm: 11.4, ctr: 0.0086, freqMax: 3 };
export const META_PADRAO = { custoConversa: 3.5, convMatricula: 0.10, convPagamento: 0.65 };
export const CENARIOS = {
  conservador: { label: 'Conservador', custoConversa: 5.0, convMatricula: 0.08, convPagamento: 0.60 },
  esperado: { label: 'Esperado', custoConversa: 3.0, convMatricula: 0.12, convPagamento: 0.69 },
  otimista: { label: 'Otimista', custoConversa: 2.8, convMatricula: 0.15, convPagamento: 0.75 },
};
export const CONVERSAS_POR_ATENDENTE = 35;
export const DIVISAO = { CEC1: 0.2, CEC2: 0.2, CEC3: 0.6 };

export const ETAPAS = [
  { id: 'CEC1', nome: 'Conhecer', funcao: 'Aquecer e apresentar a escola e o curso', oferta: 'Sem preço e sem data', cta: 'Chama no WhatsApp que te conto como funciona.', msg: 'Quero saber como funciona o curso' },
  { id: 'CEC2', nome: 'Experimentar', funcao: 'Entregar a isca gratuita', oferta: 'Material grátis', cta: 'Chama no WhatsApp e receba o guia agora.', msg: 'Quero receber o material grátis' },
  { id: 'CEC3', nome: 'Conquistar', funcao: 'Vender a turma', oferta: 'Data, vagas reais, preço e condição com prazo', cta: 'Chama no WhatsApp e garanta sua vaga.', msg: 'Quero garantir minha vaga' },
];

export const FASES = {
  F1: { nome: 'Validação', objetivo: 'Descobrir o que funciona', avancar: 'Um criativo com custo estável e matrículas reais' },
  F2: { nome: 'Otimização', objetivo: 'Baixar custo e subir conversão', avancar: 'Dois ciclos seguidos dentro da meta' },
  F3: { nome: 'Escala', objetivo: 'Mais alunos com a mesma eficiência', avancar: 'Turmas lotando antes do prazo de forma recorrente' },
  F4: { nome: 'Perpétuo', objetivo: 'Captação contínua', avancar: 'Manter e diversificar' },
};

export const FAMILIAS = [
  { id: 'C01', nome: 'História real em motion', ex: '"Um ferro atravessou a perna dele. E agora?"', etapas: ['CEC1'] },
  { id: 'C02', nome: 'Bastidor / um dia de aula', ex: '"O que acontece em 1 dia de curso"', etapas: ['CEC1', 'CEC3'] },
  { id: 'C03', nome: 'Erro comum com o professor', ex: '"O erro que mais vejo em quem aplica sem curso"', etapas: ['CEC1', 'CEC2'] },
  { id: 'C04', nome: 'Depoimento de aluno', ex: '"Eu tinha medo de agulha. No fim do dia, já aplicava"', etapas: ['CEC2', 'CEC3'] },
  { id: 'C05', nome: 'Dica técnica + isca', ex: '"3 cuidados antes de aplicar. Quer o guia completo?"', etapas: ['CEC2'] },
  { id: 'C06', nome: 'Arte de oferta', ex: 'Data, vagas, o que inclui, botão do WhatsApp', etapas: ['CEC3'] },
  { id: 'C07', nome: 'Carrossel de entrega', ex: 'Prática, material, certificado, turma', etapas: ['CEC3'] },
  { id: 'C08', nome: 'Criativo por cidade', ex: '"Moradores de Novo Gama: curso a 15 min de você"', etapas: ['ESCALA'] },
  { id: 'C09', nome: 'Prova de lotação', ex: '"A turma lotou. Abrimos turma extra"', etapas: ['ESCALA'] },
];
export const familia = (id) => FAMILIAS.find((f) => f.id === id);

export const ESTRATEGIAS = [
  { id: 'E01', nome: 'Sandbox de criativos', fases: ['F1', 'F2'], quando: 'Descobrir novos vencedores sem contaminar a campanha principal', como: 'Campanha separada, 1 conjunto, 3 a 5 criativos; o vencedor migra para a principal', verba: 'R$ 10 a 15/dia', metrica: 'Custo por conversa ≤ validado' },
  { id: 'E02', nome: 'Teste de oferta', fases: ['F1', 'F2'], quando: 'Muita conversa e pouca matrícula ou pagamento', como: 'Mesmo criativo com condições diferentes: preço cheio, desconto, parcelamento, sinal via Pix', verba: 'Igual ao CEC3', metrica: 'Taxa de pagamento' },
  { id: 'E03', nome: 'Ciclo CEC completo', fases: ['F2'], quando: 'Base padrão de toda turma', como: 'CEC1 + CEC2 + CEC3, 1 validado + 2 testes', verba: '20/20/60 da verba', metrica: 'Custo por pagante' },
  { id: 'E04', nome: 'Escada de remarketing', fases: ['F2', 'F3'], quando: 'Muita gente viu vídeos ou o perfil e não chamou', como: '25% do vídeo → bastidor; 75% → depoimento; visitou o perfil → vagas', verba: 'R$ 5 a 10/dia', metrica: 'Custo por conversa < média' },
  { id: 'E05', nome: 'Recuperação de lead parado', fases: ['F2', 'F3'], quando: 'Leads conversaram e não pagaram', como: 'Público personalizado de contatos não pagantes; anúncio com o prazo da turma', verba: 'R$ 5 a 10/dia', metrica: 'Pagantes recuperados' },
  { id: 'E06', nome: 'Escala vertical controlada', fases: ['F3'], quando: 'Custo estável 3 dias e frequência < 3', como: '+20% de verba a cada 48 a 72h; volta se o custo subir mais de 30%', verba: 'Progressiva', metrica: 'Custo estável com mais volume' },
  { id: 'E07', nome: 'Expansão geográfica', fases: ['F3'], quando: 'Público local saturando (frequência > 3)', como: '1 conjunto por cidade vizinha, criativo citando a cidade (C08)', verba: 'R$ 8 a 15/dia por cidade', metrica: 'Custo por conversa por cidade' },
  { id: 'E08', nome: 'Lookalike de pagantes', fases: ['F3'], quando: '50+ pagantes na base', como: 'Subir a lista de pagantes e criar semelhante 1%', verba: 'R$ 10 a 20/dia', metrica: 'Taxa de pagamento ≥ média' },
  { id: 'E09', nome: 'Turma extra', fases: ['F3'], quando: 'A turma lotou antes do prazo', como: 'Manter a campanha e trocar o texto para turma extra (C09)', verba: 'Mantém', metrica: 'Ocupação da turma extra' },
  { id: 'E10', nome: 'Campanha consolidada (CBO)', fases: ['F3'], quando: '3+ conjuntos vencedores', como: 'Unir os conjuntos numa campanha com orçamento no nível da campanha', verba: 'Soma dos conjuntos', metrica: 'Custo por pagante consolidado' },
  { id: 'E11', nome: 'Always-on por curso', fases: ['F4'], quando: 'Demanda constante', como: 'Campanha sem fim, verba baixa, alimentando lista de espera', verba: 'R$ 15 a 20/dia', metrica: 'Leads na lista de espera' },
  { id: 'E12', nome: 'Calendário fixo de turmas', fases: ['F4'], quando: 'Turmas lotando todo mês', como: 'Datas recorrentes por curso; o anúncio sempre tem a próxima turma', verba: '—', metrica: 'Ocupação média' },
  { id: 'E13', nome: 'Trilha de cursos (upsell)', fases: ['F3', 'F4'], quando: 'Base de ex-alunos', como: 'Público de ex-alunos com a oferta do próximo curso da trilha', verba: 'R$ 5/dia', metrica: 'Recompra' },
  { id: 'E14', nome: 'Programa de indicação', fases: ['F3', 'F4'], quando: 'Alunos satisfeitos', como: 'Desconto por amigo indicado; campanha para alunos', verba: 'R$ 5/dia', metrica: 'Matrículas por indicação' },
  { id: 'E15', nome: 'B2B para empresas', fases: ['F2', 'F3', 'F4'], quando: 'Cursos com demanda corporativa (APH, NR-23, primeiros socorros)', como: 'Segmentar por cargo (RH, gerente, síndico) com mensagem de proposta', verba: 'R$ 10 a 20/dia', metrica: 'Propostas fechadas' },
  { id: 'E16', nome: 'Mini-lançamento de turma', fases: ['F3', 'F4'], quando: 'Curso de ticket maior', como: '7 dias de conteúdo → abertura com condição de 48h → fechamento', verba: 'Concentrada no lançamento', metrica: 'Vendas na janela' },
  { id: 'E17', nome: 'Campanha sazonal', fases: ['F1', 'F2', 'F3', 'F4'], quando: 'Data com demanda natural', como: 'Início do ano, Dia do Enfermeiro (12/05), férias, fim de ano', verba: 'Variável', metrica: 'Pico de conversas' },
  { id: 'E18', nome: 'Reativação de contatos antigos', fases: ['F2', 'F3', 'F4'], quando: 'Lista grande de contatos que nunca compraram', como: 'Subir a lista como público, oferta nova a cada trimestre', verba: 'R$ 5 a 10/dia', metrica: 'Pagantes reativados' },
];
export const estrategia = (id) => ESTRATEGIAS.find((e) => e.id === id);

// Modelos de campanha já validados que o planejador sabe montar.
export const MODELOS = [
  { id: 'cec', nome: 'Ciclo CEC completo', est: 'E03', resumo: 'Conhecer (20%) + Experimentar (20%) + Conquistar (60%). O padrão de toda turma, com 18 dias de antecedência.', etapas: ['CEC1', 'CEC2', 'CEC3'], minDias: 14 },
  { id: 'quiz', nome: 'Quiz de qualificação + Conquistar', est: 'E03', resumo: 'O anúncio leva a um quiz curto ("Você tem perfil para aplicar injetáveis?") e o resultado chama no WhatsApp. Junta aquecimento e isca; o CEC3 vende a turma.', etapas: ['QUIZ', 'CEC3'], minDias: 12, quiz: true },
  { id: 'direto', nome: 'Conquistar direto (prazo curto)', est: 'E03', resumo: 'Só a campanha de venda. Use com menos de 10 dias para a turma; o funil fica sem aquecimento.', etapas: ['CEC3'], minDias: 4 },
  { id: 'lancamento', nome: 'Mini-lançamento', est: 'E16', resumo: '7 dias de conteúdo, abertura com condição de 48h e fechamento. Para curso de ticket maior.', etapas: ['CEC1', 'CEC3'], minDias: 12 },
  { id: 'recuperacao', nome: 'Recuperação de leads parados', est: 'E05', resumo: 'Anúncio para quem já conversou e não pagou, com o prazo da turma. Verba baixa, retorno alto.', etapas: ['CEC3'], minDias: 5 },
  { id: 'b2b', nome: 'B2B para empresas', est: 'E15', resumo: 'Proposta para RH, gerentes e síndicos. Para APH, NR-23 e primeiros socorros.', etapas: ['CEC3'], minDias: 10 },
];
export const modelo = (id) => MODELOS.find((m) => m.id === id) || MODELOS[0];

// Sinais → estratégias (no máximo 2 por vez).
export const SINAIS = [
  { id: 'lotando', diag: 'O motor funciona', est: ['E06', 'E07'] },
  { id: 'cansado', diag: 'Público cansado (custo subindo, frequência > 3)', est: ['E01', 'E07'] },
  { id: 'vazamento', diag: 'Vazamento no atendimento (muita conversa, pouca matrícula)', est: ['E05'] },
  { id: 'compromisso', diag: 'Falta compromisso (matrícula alta, pagamento baixo)', est: ['E02'] },
  { id: 'cheio', diag: 'Demanda maior que a oferta', est: ['E11', 'E12'] },
  { id: 'base', diag: 'Base de ex-alunos parada', est: ['E13', 'E14'] },
  { id: 'lista', diag: 'Lista de contatos sem compra', est: ['E05', 'E18'] },
];

// ---------- números reais da escola (últimos 90 dias), com o benchmark como reserva ----------
export function realRates(cursoId = '') {
  const t = today();
  const from = addDays(t, -89);
  const rows = campaignRows(from, t, cursoId ? { cursoId } : {}).filter((r) => r.hasStats);
  const inv = sum(rows, (r) => r.investimento);
  const conv = sum(rows, (r) => r.conversas || r.leadsMeta || r.resultados);
  const leads = store.all('leads').filter((l) => (!cursoId || l.cursoId === cursoId));
  const mats = leads.filter((l) => l.etapa === 'matriculado' && inRange(l.dataMatricula, from, t));
  const matsCamp = sum(rows, (r) => r.matriculas);
  const pagos = mats.filter((l) => l.statusPagamento !== 'Pendente');
  const freq = div(sum(rows, (r) => r.impressoes), sum(rows, (r) => r.alcance));
  return {
    custoConversa: conv >= 30 ? inv / conv : null,
    convMatricula: conv >= 30 && matsCamp ? matsCamp / conv : null,
    convPagamento: mats.length >= 5 ? pagos.length / mats.length : null,
    freq, investimento: inv, conversas: conv, matriculas: matsCamp, pagantes: pagos.length, amostra: conv,
  };
}
// Taxas usadas no plano: as da escola quando há amostra, senão as de referência.
export function planRates(cursoId = '', override = {}) {
  const r = realRates(cursoId);
  const pick = (k) => (override[k] ? Number(override[k]) : r[k] ?? BENCH[k]);
  return { custoConversa: pick('custoConversa'), convMatricula: pick('convMatricula'), convPagamento: pick('convPagamento'), fonte: r.custoConversa ? 'dados da escola (90 dias)' : 'referência do método', real: r };
}

// Diagnóstico da fase da operação a partir do histórico.
export function diagnosePhase(cursoId = '') {
  const r = realRates(cursoId);
  const plans = store.all('plans').filter((p) => p.status === 'Concluída' && (!cursoId || p.cursoId === cursoId));
  const naMeta = plans.filter((p) => p.resultado?.naMeta).length;
  if (!r.matriculas || r.amostra < 30) return { id: 'F1', motivo: r.amostra < 30 ? 'Poucas conversas de anúncio registradas nos últimos 90 dias para saber o que funciona.' : 'Ainda não há matrícula comprovada vinda de campanha.' };
  const custoOk = r.custoConversa !== null && r.custoConversa <= META_PADRAO.custoConversa;
  const convOk = r.convMatricula !== null && r.convMatricula >= META_PADRAO.convMatricula;
  const pagOk = r.convPagamento === null || r.convPagamento >= META_PADRAO.convPagamento;
  if (naMeta >= 3 && custoOk && convOk && pagOk) return { id: 'F4', motivo: 'Três ou mais ciclos fechados dentro da meta.' };
  if (naMeta >= 2 && custoOk && convOk && pagOk) return { id: 'F3', motivo: 'Dois ciclos seguidos dentro da meta.' };
  const fora = [!custoOk && 'custo por conversa acima de R$ 3,50', !convOk && 'conversão em matrícula abaixo de 10%', !pagOk && 'pagamento abaixo de 65%'].filter(Boolean);
  return { id: 'F2', motivo: fora.length ? 'Já há matrículas vindas de anúncio, mas: ' + fora.join(', ') + '.' : 'Dentro da meta; feche mais um ciclo assim para escalar.' };
}

// Estratégias de maior retorno para a fase e os sinais atuais (no máximo 2).
export function recommend(phaseId, r = realRates()) {
  const out = [];
  const add = (id, motivo) => { if (out.length < 2 && !out.some((x) => x.id === id)) out.push({ id, motivo }); };
  const parados = store.all('leads').filter((l) => ['conversa', 'qualificado', 'negociacao'].includes(l.etapa)).length;
  const pendentes = store.all('leads').filter((l) => l.etapa === 'matriculado' && l.statusPagamento === 'Pendente').length;
  if (r.freq && r.freq > 3) add('E01', 'Frequência ' + r.freq.toFixed(1).replace('.', ',') + ': o público já viu demais os mesmos criativos.');
  if (r.convMatricula !== null && r.convMatricula < 0.08) add('E05', 'Só ' + Math.round(r.convMatricula * 100) + '% das conversas viram matrícula: há gente parada no funil.');
  if (pendentes >= 3) add('E02', pendentes + ' matrículas sem pagamento: teste sinal via Pix.');
  if (parados >= 20) add('E05', parados + ' leads parados no funil podem ser recuperados com anúncio.');
  if (phaseId === 'F1') add('E01', 'Fase de validação: descubra o criativo vencedor sem queimar a verba principal.');
  if (phaseId === 'F2') add('E03', 'Base de toda turma: aquecer, entregar a isca e vender.');
  if (phaseId === 'F3') { add('E06', 'Custo estável: escale +20% a cada 48 a 72h.'); add('E07', 'Abra cidades vizinhas em conjuntos separados.'); }
  if (phaseId === 'F4') { add('E11', 'Demanda constante: campanha sempre ligada com lista de espera.'); add('E12', 'Datas fixas de turma por curso.'); }
  add('E03', 'Base de toda turma.');
  return out;
}

// ---------- contas do plano ----------
const floor = (v) => Math.floor(v + 1e-9);

// Do objetivo (matrículas) para trás: conversas, verba e pagantes esperados.
export function fromGoal(metaMatriculas, rates) {
  const conversas = Math.ceil(metaMatriculas / rates.convMatricula);
  const verba = Math.ceil(conversas * rates.custoConversa);
  return { conversas, verba, pagantes: floor(metaMatriculas * rates.convPagamento), cac: verba / metaMatriculas };
}
// Da verba para frente, nos três cenários.
export function projection(verba) {
  return Object.fromEntries(Object.entries(CENARIOS).map(([k, c]) => {
    const conversas = floor(verba / c.custoConversa);
    const matriculas = floor(conversas * c.convMatricula);
    const pagantes = floor(matriculas * c.convPagamento);
    return [k, { ...c, conversas, matriculas, pagantes, custoPagante: pagantes ? verba / pagantes : null }];
  }));
}

// Calendário a partir da data da turma (T).
export function schedule(turma, modeloId) {
  const m = modelo(modeloId);
  const t = today();
  const dias = daysBetween(t, turma);
  const fim = addDays(turma, -2);
  const clampStart = (d) => (d < t ? t : d);
  const etapas = m.etapas.map((e) => {
    const longo = e === 'CEC1' || e === 'CEC2' || e === 'QUIZ';
    let inicio = clampStart(addDays(turma, longo ? -18 : -12));
    if (m.id === 'direto' || m.id === 'recuperacao' || m.id === 'b2b') inicio = clampStart(addDays(turma, -Math.min(12, Math.max(dias - 2, 2))));
    return { etapa: e, inicio, fim, dias: Math.max(1, daysBetween(inicio, fim) + 1) };
  });
  const inicio = etapas.reduce((a, e) => (e.inicio < a ? e.inicio : a), etapas[0].inicio);
  return { etapas, inicio, fim, turma, diasAteTurma: dias, dia3: addDays(inicio, 2), dia7: addDays(inicio, 6), corteVerba: addDays(turma, -11) };
}

// Divide a verba entre as etapas do modelo.
export function split(verba, modeloId) {
  const m = modelo(modeloId);
  if (m.etapas.length === 1) return { [m.etapas[0]]: verba };
  if (m.id === 'quiz') return { QUIZ: Math.round(verba * 0.4), CEC3: verba - Math.round(verba * 0.4) };
  if (m.id === 'lancamento') return { CEC1: Math.round(verba * 0.3), CEC3: verba - Math.round(verba * 0.3) };
  return { CEC1: Math.round(verba * DIVISAO.CEC1), CEC2: Math.round(verba * DIVISAO.CEC2), CEC3: verba - 2 * Math.round(verba * DIVISAO.CEC1) };
}

export const etapaNome = (e) => (e === 'QUIZ' ? 'Quiz de qualificação' : 'CEC' + e.slice(3) + ' ' + (ETAPAS.find((x) => x.id === e)?.nome || ''));
const tag = (s) => '[' + norm(s).toUpperCase().replace(/[^A-Z0-9 +-]/g, '').replace(/\s+/g, ' ').trim() + ']';
const MES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
// Padrão de nomes do Gerenciador: [ESCOLA] [CURSO] [CEC1-CONHECER] [MÊSANO] [WHATSAPP]
export function campaignNameFor(escola, curso, etapa, turma) {
  const e = etapa === 'QUIZ' ? 'QUIZ' : etapa + '-' + (ETAPAS.find((x) => x.id === etapa)?.nome || '');
  const d = new Date(turma + 'T12:00');
  return [tag(escola), tag(curso), tag(e), '[' + MES[d.getMonth()] + String(d.getFullYear()).slice(2) + ']', '[WHATSAPP]'].join(' ');
}

// Alertas de planejamento: verba, prazo e atendimento.
export function planAlerts(p, rates) {
  const out = [];
  const g = fromGoal(p.metaMatriculas, rates);
  const sch = schedule(p.turma, p.modelo);
  if (p.verba && p.verba < g.verba) {
    const proj = floor(floor(p.verba / rates.custoConversa) * rates.convMatricula);
    out.push({ nivel: 'bad', texto: `Com R$ ${p.verba} a projeção é de ${proj} matrículas para a meta de ${p.metaMatriculas}. Faltam cerca de R$ ${g.verba - p.verba} de verba, ou baixe a meta.` });
  }
  if (p.vagas && p.metaMatriculas > p.vagas) out.push({ nivel: 'warn', texto: `A meta (${p.metaMatriculas}) passa das vagas da turma (${p.vagas}). Planeje turma extra (E09) ou ajuste a meta.` });
  if (sch.diasAteTurma < 10) out.push({ nivel: 'bad', texto: `Faltam ${sch.diasAteTurma} dias para a turma: rode só a campanha de venda (Conquistar direto). O funil fica sem aquecimento.` });
  else if (sch.diasAteTurma < 14 && modelo(p.modelo).minDias >= 14) out.push({ nivel: 'warn', texto: `Faltam ${sch.diasAteTurma} dias: o prazo saudável é 14 ou mais. O aquecimento vai ser curto.` });
  const verba = p.verba || g.verba;
  const diasVenda = Math.max(1, daysBetween(sch.inicio, sch.fim) + 1);
  const convDia = verba / diasVenda / rates.custoConversa;
  const cap = (Number(p.atendentes) || 1) * CONVERSAS_POR_ATENDENTE;
  if (convDia > cap) out.push({ nivel: 'warn', texto: `Cerca de ${Math.round(convDia)} conversas por dia para ${p.atendentes || 1} atendente(s). Acima de ${CONVERSAS_POR_ATENDENTE} por pessoa a conversão cai: reforce o atendimento.` });
  Object.entries(split(verba, p.modelo)).forEach(([e, v]) => { const d = sch.etapas.find((x) => x.etapa === e)?.dias || 1; if (v / d < 5) out.push({ nivel: 'warn', texto: `${etapaNome(e)} ficaria com menos de R$ 5 por dia. Junte as etapas ou aumente a verba.` }); });
  return out;
}

// ---------- acompanhamento: o plano está no ritmo? ----------
// Compara o realizado com o esperado até hoje. No ritmo → segue; fora → vai para otimização com o motivo.
export function health(p) {
  const t = today();
  const camps = (p.campanhas || []).map((c) => c.id).filter((id) => store.get('campaigns', id));
  const ate = t < p.fim ? t : p.fim;
  const started = t >= p.inicio;
  const rows = started ? campaignRows(p.inicio, ate).filter((r) => camps.includes(r.id)) : [];
  const gasto = sum(rows, (r) => r.investimento);
  const conversas = sum(rows, (r) => r.conversas || r.leadsMeta || r.resultados);
  const impress = sum(rows, (r) => r.impressoes), alcance = sum(rows, (r) => r.alcance);
  const leads = store.all('leads').filter((l) => camps.includes(l.campanhaId) && inRange(l.entrada, p.inicio, addDays(p.turma, 0)));
  const matsLeads = leads.filter((l) => l.etapa === 'matriculado');
  const extra = sum(camps.map((id) => store.get('campaigns', id)), (c) => sum((c?.matriculasExtras || []).filter((e) => inRange(e.data, p.inicio, p.turma)), (e) => e.qtd));
  const matriculas = matsLeads.length + extra;
  const pagantes = matsLeads.filter((l) => l.statusPagamento !== 'Pendente').length + extra;
  const total = Math.max(1, daysBetween(p.inicio, p.fim) + 1);
  const passados = !started ? 0 : Math.min(total, daysBetween(p.inicio, ate) + 1);
  const frac = passados / total;
  // A venda (CEC3) concentra matrículas no fim: a curva esperada de matrículas é mais lenta no começo.
  const fracMat = Math.pow(frac, 1.4);
  const esp = { gasto: p.verba * frac, conversas: p.metaConversas * frac, leads: p.metaConversas * frac * 0.8, matriculas: p.metaMatriculas * fracMat };
  const rate = (a, e) => (e > 0.5 ? a / e : null);
  const r = { gasto: rate(gasto, esp.gasto), conversas: rate(conversas || leads.length, esp.conversas), leads: rate(leads.length, esp.leads), matriculas: rate(matriculas, esp.matriculas) };
  const custoConversa = div(gasto, conversas || leads.length);
  const freq = div(impress, alcance);
  const sinais = [];
  if (started && passados >= 3 && (r.leads ?? 1) < 0.7) sinais.push({ id: 'poucos-leads', nivel: 'bad', texto: `Entraram ${leads.length} leads no funil; o esperado até hoje era ${Math.round(esp.leads)}.`, acao: 'Confira se o time está registrando as conversas no Funil com a campanha. Se estiver, o anúncio não está gerando conversa: troque o criativo de teste pior (regra do dia 3).', est: 'E01' });
  if (custoConversa !== null && passados >= 2 && custoConversa > 5) sinais.push({ id: 'custo', nivel: 'bad', texto: `Custo por conversa de R$ ${custoConversa.toFixed(2).replace('.', ',')}, acima de R$ 5.`, acao: 'Troque o criativo antes de mexer na verba.', est: 'E01' });
  if (freq && freq > 3) sinais.push({ id: 'freq', nivel: 'warn', texto: `Frequência ${freq.toFixed(1).replace('.', ',')}: o público está cansando.`, acao: 'Criativo novo ou público ampliado (cidades vizinhas).', est: 'E07' });
  if (passados >= 5 && (r.conversas ?? 0) >= 0.9 && (r.matriculas ?? 1) < 0.6) sinais.push({ id: 'atendimento', nivel: 'bad', texto: `Conversas no ritmo, matrículas não (${matriculas} de ${Math.round(esp.matriculas)} esperadas).`, acao: 'O problema está no atendimento, não no anúncio: revise a primeira resposta, o follow-up de 24h e o sinal via Pix.', est: 'E05' });
  if (matriculas >= 3 && pagantes / matriculas < 0.6) sinais.push({ id: 'pagamento', nivel: 'warn', texto: `Só ${pagantes} de ${matriculas} matrículas pagaram.`, acao: 'Teste a oferta com sinal via Pix (R$ 30 a 50).', est: 'E02' });
  if (p.vagas && matriculas >= p.vagas) sinais.push({ id: 'lotou', nivel: 'good', texto: 'A turma lotou.', acao: 'Desligue a campanha de venda e abra a próxima turma (E09).', est: 'E09' });
  let status = 'planejada';
  if (t > p.fim) status = 'encerrada';
  else if (started) status = sinais.some((s) => s.nivel === 'bad') ? 'otimizar' : sinais.some((s) => s.nivel === 'warn') ? 'atencao' : 'ritmo';
  const marcos = [
    { id: 'dia3', data: p.dia3, texto: 'Dia 3: pausar teste com custo ≥ 1,5× o validado' },
    { id: 'dia7', data: p.dia7, texto: 'Dia 7: teste mais barato vira o validado; decidir escala' },
    { id: 'corte', data: addDays(p.turma, -11), texto: 'Reduzir a verba de Conhecer e Experimentar' },
    { id: 'fim', data: p.fim, texto: 'Desligar tudo (2 dias antes da aula)' },
  ];
  return { status, gasto, conversas, leads: leads.length, matriculas, pagantes, custoConversa, freq, esp, r, passados, total, frac, sinais, marcos, cac: matriculas ? gasto / matriculas : null };
}
export const STATUS = {
  planejada: { label: 'Planejada', cls: '' },
  ritmo: { label: 'No ritmo', cls: 'good' },
  atencao: { label: 'Atenção', cls: 'warn' },
  otimizar: { label: 'Precisa otimizar', cls: 'bad' },
  encerrada: { label: 'Encerrada', cls: 'info' },
};
