// Dados de teste: 3 meses realistas de captação e matrículas, todos com demo:true.
// Configurações › "Carregar dados de teste" cria; "Remover dados de teste" apaga só estes registros.

import { store } from './store.js';
import { today, addDays, monthStart, daysBetween } from './util.js';

let seed = 7;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Mariana', 'Nathan', 'Olívia', 'Paulo', 'Raquel', 'Sabrina', 'Thiago', 'Vanessa', 'Yasmin'];
const SOBRE = ['Souza', 'Lima', 'Costa', 'Pereira', 'Alves', 'Rocha', 'Dias', 'Martins', 'Gomes', 'Ribeiro'];
const CONSULTORES = ['Carla Mendes', 'Diego Rocha', 'Fernanda Luz'];

export function loadTestData() {
  seed = 7;
  const t = today();
  const ini = monthStart(addDays(monthStart(addDays(monthStart(t), -1)), -1)); // 1º dia de 2 meses atrás
  let courses = store.all('courses').filter((c) => c.ativo !== false);
  if (!courses.length) courses = store.putMany('courses', [{ nome: '[Teste] Injetáveis', preco: 1600, demo: true }, { nome: '[Teste] Técnico em Enfermagem', preco: 3200, demo: true }, { nome: '[Teste] Primeiros Socorros', preco: 600, demo: true }]);
  const turmas = store.putMany('turmas', courses.slice(0, 3).flatMap((c, i) => [
    { nome: `${c.nome.startsWith('[Teste]') ? '' : '[Teste] '}${c.nome} · T${10 + i}`, cursoId: c.id, inicio: addDays(t, 10 + i * 7), vagas: [20, 25, 15][i], meta: [18, 20, 12][i], turno: ['Noite', 'Sábado', 'Manhã'][i], status: 'Inscrições abertas', cor: ['lima', 'azul', 'verde'][i], demo: true },
    ...(i === 0 ? [{ nome: `${c.nome.startsWith('[Teste]') ? '' : '[Teste] '}${c.nome} · T${20 + i}`, cursoId: c.id, inicio: addDays(t, 40), vagas: 30, meta: 25, turno: 'Tarde', status: 'Planejando', cor: 'ambar', demo: true }] : []),
  ]));
  const camps = store.putMany('campaigns', [{ nome: '[Teste] Matrículas · WhatsApp', canal: 'Meta', objetivo: 'Mensagens no WhatsApp', cursoId: courses[0].id, status: 'Ativa', demo: true }, { nome: '[Teste] Google · Pesquisa', canal: 'Google', objetivo: 'Pesquisa (Google)', cursoId: courses[1 % courses.length].id, status: 'Ativa', demo: true }]);
  const stats = [];
  // Investimento semanal, como no relatório do Gerenciador com detalhamento por semana.
  for (let w = ini; w <= t; w = addDays(w, 7)) {
    const fim = addDays(w, 6) > t ? t : addDays(w, 6);
    const dd = daysBetween(w, fim) + 1;
    stats.push({ campanhaId: camps[0].id, inicio: w, fim, investimento: Math.round((24 + rnd() * 6) * dd), resultados: Math.round((7 + rnd() * 3) * dd), conversas: Math.round((7 + rnd() * 3) * dd), impressoes: 2000 * dd, alcance: 800 * dd, cliques: 17 * dd, demo: true });
    stats.push({ campanhaId: camps[1].id, inicio: w, fim, investimento: Math.round((5 + rnd() * 3) * dd), resultados: Math.round(1.3 * dd), impressoes: 260 * dd, alcance: 170 * dd, cliques: 5 * dd, demo: true });
  }
  store.putMany('adStats', stats);
  const leads = [];
  const dias = daysBetween(ini, t);
  for (let d = 0; d <= dias; d++) {
    const dia = addDays(ini, d);
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const r = rnd();
      const origem = r < 0.55 ? 'Meta Ads' : r < 0.65 ? 'Google' : r < 0.8 ? 'Indicação' : r < 0.95 ? 'Instagram orgânico' : 'Outro';
      const c = pick(courses);
      const ts = turmas.filter((x) => x.cursoId === c.id);
      const l = { nome: `[Teste] ${pick(NOMES)} ${pick(SOBRE)}`, telefone: '6199' + String(1000000 + leads.length * 7919).slice(0, 7), cursoId: c.id, origem, campanhaId: origem === 'Meta Ads' ? camps[0].id : origem === 'Google' ? camps[1].id : '', responsavel: pick(CONSULTORES), entrada: dia, etapa: 'novo', etapaMax: 0, demo: true };
      if (chance(0.82)) { l.etapa = 'conversa'; l.etapaMax = 1; }
      if (l.etapa === 'conversa' && chance(0.5)) { l.visitouEm = addDays(dia, 1 + Math.floor(rnd() * 4)); l.etapa = 'qualificado'; l.etapaMax = 2; }
      const fecha = addDays(dia, 2 + Math.floor(rnd() * 10));
      if (l.visitouEm && chance(0.45) && fecha <= t) {
        const sp = rnd();
        Object.assign(l, { etapa: 'matriculado', etapaMax: 4, dataMatricula: fecha, turmaId: ts.length ? pick(ts).id : '', taxaMatricula: 100, mensalidade: Math.round((c.preco || 1600) / 6), parcelasTotal: 6, parcelasPagas: sp < 0.85 ? 1 : 0, valor: 100 + Math.round((c.preco || 1600) / 6) * 6, formaPagamento: chance(0.55) ? 'Pix' : chance(0.75) ? 'Cartão de crédito' : 'Boleto', statusPagamento: sp < 0.75 ? 'Pago' : sp < 0.85 ? 'Parcial' : 'Pendente', valorPago: sp >= 0.75 && sp < 0.85 ? 50 : null });
        if (l.statusPagamento !== 'Pendente') l.dataPagamento = chance(0.7) ? fecha : addDays(fecha, 1);
      } else if (daysBetween(dia, t) > 10 && chance(0.55)) { Object.assign(l, { etapa: 'perdido', dataPerda: addDays(dia, 8), motivoPerda: pick(['Preço', 'Sem retorno', 'Horário ou turno', 'Distância']) }); }
      leads.push(l);
    }
  }
  store.putMany('leads', leads);
  store.put('goals', { nome: '[Teste] 25 matrículas pagas no mês', indicador: 'matriculasPagas', alvo: 25, inicio: monthStart(t), fim: addDays(monthStart(addDays(monthStart(t), 32)), -1), demo: true });
  return { leads: leads.length, matriculas: leads.filter((l) => l.etapa === 'matriculado').length };
}
