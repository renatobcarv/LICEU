// Motor das automações do Klasso. Puro e sem dependências: o MESMO código roda no servidor (Edge Functions,
// quando chega mensagem ou passa o tempo) e no navegador (simulador "Testar"). Efeitos só pelo objeto `io`:
//   io.enviar(texto) -> {ok, erro?}    io.ia({...}) -> {resposta, transferir, campos}    io.lead(patch)
//   io.notificar(texto)    io.rodizio() -> nome    io.sistema?(texto) (só no simulador)
// Estado por lead (`st`, coleção autoexec): { fluxo: {autId, ptr, aguardando, retomarEm, tent, hist, turnos} | null,
//   dia: {d, n} (mensagens do robô hoje), apresentado, ultimos: {autId: iso} }.
// Ponteiro: caminho nos passos, ex. [2] ou [2, 'o1', 0] (passo 2 → ramo da opção 1 → primeiro passo).

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const lista = (x) => (Array.isArray(x) ? x : String(x || '').split(/[,\n]/)).map((s) => String(s).trim()).filter(Boolean);
const TZ = 'America/Sao_Paulo';

// ---------- limites (a escola ajusta; os fixos não) ----------
export const REGRAS_PADRAO = {
  escola: 'nossa escola',
  apresentacao: 'Oi{nome_virgula}! Aqui é a assistente virtual da {escola}.',
  horario: { inicio: '08:00', fim: '18:00', dias: [1, 2, 3, 4, 5, 6] },
  maxPorLeadDia: 8,
  pausaHumanoH: 24,
  palavrasHumano: ['atendente', 'humano', 'falar com uma pessoa', 'falar com alguem'],
  palavrasSair: ['sair', 'parar', 'pare', 'cancelar mensagens'],
  msgHumanoDentro: 'Certo! Já chamei alguém do nosso time para falar com você.',
  msgHumanoFora: 'Certo! Nosso time atende das {inicio} às {fim}. Assim que abrir, alguém fala com você.',
  msgSair: 'Pronto, você não vai mais receber mensagens automáticas. Se precisar, é só chamar.',
  base: '',
};
/** Regras que ninguém desliga (aparecem na tela e valem no servidor). */
export const LIMITES_FIXOS = [
  'O robô sempre se apresenta como assistente virtual na primeira mensagem.',
  'Quem pede "atendente" sai do robô na hora e o time é avisado.',
  'Quem pede "sair" para de receber mensagens automáticas (opt-out).',
  'Quando alguém do time responde, o robô se cala naquele contato.',
  'A IA não promete desconto, não inventa preço e não confirma matrícula ou pagamento.',
  'Limite diário de mensagens do robô por contato; no QR Code o teto é menor (4).',
  'Lembretes por tempo só saem dentro do horário de atendimento.',
  'Na API oficial, fora da janela de 24h o robô não envia: cria uma tarefa para o time.',
];

export const GATILHOS = {
  primeira_mensagem: { nome: 'Primeira mensagem de um contato novo', msg: true },
  palavra_chave: { nome: 'Mensagem com palavra-chave', msg: true },
  qualquer_mensagem: { nome: 'Qualquer mensagem (quando nada mais disparou)', msg: true },
  sem_resposta: { nome: 'Lead parou de responder', msg: false },
  parado_etapa: { nome: 'Lead parado numa etapa do funil', msg: false },
  agendado: { nome: 'Agendado (todo dia num horário)', msg: false },
  webhook: { nome: 'Webhook de entrada (site, formulário, n8n, Zapier)', msg: false },
};

export const PASSOS = {
  mensagem: { nome: 'Enviar mensagem', grupo: 'Conversa' },
  menu: { nome: 'Menu de opções', grupo: 'Conversa', ramos: true },
  pergunta: { nome: 'Perguntar e salvar', grupo: 'Conversa' },
  ia: { nome: 'Atendente com IA', grupo: 'Conversa' },
  esperar: { nome: 'Esperar', grupo: 'Fluxo' },
  condicao: { nome: 'Condição (se/senão)', grupo: 'Fluxo', ramos: true },
  humano: { nome: 'Passar para humano', grupo: 'Fluxo' },
  fim: { nome: 'Encerrar', grupo: 'Fluxo' },
  etapa: { nome: 'Mover no funil', grupo: 'Funil' },
  responsavel: { nome: 'Definir responsável', grupo: 'Funil' },
  etiqueta: { nome: 'Adicionar etiqueta', grupo: 'Funil' },
  campo: { nome: 'Preencher campo', grupo: 'Funil' },
  tarefa: { nome: 'Criar retorno (tarefa)', grupo: 'Funil' },
  notificar: { nome: 'Avisar o time', grupo: 'Funil' },
  http: { nome: 'Chamada HTTP (webhook de saída)', grupo: 'Integração' },
};

export function novoPasso(tipo) {
  const p = { tipo };
  if (tipo === 'mensagem') p.texto = '';
  if (tipo === 'menu') { p.texto = 'Como posso ajudar?'; p.opcoes = [{ rotulo: 'Opção 1' }, { rotulo: 'Opção 2' }]; p.ramos = { o0: [], o1: [] }; }
  if (tipo === 'pergunta') { p.texto = ''; p.campo = 'nome'; }
  if (tipo === 'ia') { p.objetivo = 'Tirar dúvidas sobre os cursos e descobrir o curso de interesse e o melhor horário para o time ligar.'; p.maxTurnos = 6; }
  if (tipo === 'esperar') { p.quanto = 1; p.unidade = 'h'; }
  if (tipo === 'condicao') { p.se = 'horario'; p.ramos = { sim: [], nao: [] }; }
  if (tipo === 'etapa') p.etapa = 'conversa';
  if (tipo === 'responsavel') p.nome = '__rodizio';
  if (tipo === 'tarefa') { p.dias = 0; p.texto = 'Ligar para {nome}'; }
  if (tipo === 'notificar') p.texto = '{nome} precisa de atenção.';
  if (tipo === 'http') { p.url = 'https://'; p.metodo = 'POST'; p.corpo = '{"nome":"{nome}","telefone":"{telefone}","etapa":"{etapa}"}'; }
  return p;
}

// ---------- tempo local da escola ----------
function partes(d) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(d);
  const g = (t) => f.find((x) => x.type === t)?.value;
  return { data: `${g('year')}-${g('month')}-${g('day')}`, hm: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
}
export function dentroHorario(regras, agora = new Date()) {
  const h = { ...REGRAS_PADRAO.horario, ...(regras?.horario || {}) }; const p = partes(agora);
  return (h.dias || []).map(Number).includes(p.dow) && p.hm >= h.inicio && p.hm < h.fim;
}
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Number(n || 0)); return d.toISOString().slice(0, 10); };

// ---------- texto com variáveis ----------
function preencher(c, t) {
  const nome = String(c.lead.nome || '').trim().split(/\s+/)[0] || '';
  const ok = nome && !/^\+?\d+$/.test(nome); // nome que é só número não vira saudação
  const h = { ...REGRAS_PADRAO.horario, ...(c.regras.horario || {}) };
  return String(t || '').replace(/\{nome_virgula\}/g, ok ? ', ' + nome : '').replace(/\{nome\}/g, ok ? nome : '')
    .replace(/\{curso\}/g, c.lead.cursoInteresse || c.lead.curso || 'o curso').replace(/\{escola\}/g, c.regras.escola || '')
    .replace(/\{telefone\}/g, c.lead.telefone || '').replace(/\{etapa\}/g, c.lead.etapa || '').replace(/\{email\}/g, c.lead.email || '')
    .replace(/\{responsavel\}/g, c.lead.responsavel || 'nosso time').replace(/\{inicio\}/g, h.inicio).replace(/\{fim\}/g, h.fim)
    .replace(/[ \t]+([,.!?])/g, '$1').trim();
}

// ---------- navegação nos passos ----------
const aut = (c) => c.auts.find((a) => a.id === c.st.fluxo?.autId);
function passo(c, ptr) {
  let arr = aut(c)?.passos, p;
  for (let i = 0; i < ptr.length; i += 2) { p = arr?.[ptr[i]]; if (i + 1 < ptr.length) arr = p?.ramos?.[ptr[i + 1]]; }
  return p;
}
function avancar(c) {
  let ptr = [...c.st.fluxo.ptr];
  for (;;) {
    ptr[ptr.length - 1]++;
    if (passo(c, ptr)) { c.st.fluxo.ptr = ptr; return; }
    if (ptr.length > 1) ptr = ptr.slice(0, -2); else { c.st.fluxo = null; return; }
  }
}
function entrarRamo(c, chave) {
  const ptr = [...c.st.fluxo.ptr, chave, 0];
  if (passo(c, ptr)) c.st.fluxo.ptr = ptr; else avancar(c);
}

// ---------- ações ----------
async function falar(c, texto, { contar = true } = {}) {
  const hoje = partes(c.agora).data;
  if (c.st.dia?.d !== hoje) c.st.dia = { d: hoje, n: 0 };
  if (contar && c.st.dia.n >= Number(c.regras.maxPorLeadDia || 8)) { c.limite = true; return false; }
  let t = preencher(c, texto); if (!t) return true;
  if (!c.st.apresentado) { t = preencher(c, c.regras.apresentacao || REGRAS_PADRAO.apresentacao) + '\n\n' + t; c.st.apresentado = true; }
  const r = await c.io.enviar(t);
  if (!r?.ok) { c.falha = r?.erro || 'erro'; return false; }
  if (contar) c.st.dia.n++;
  return true;
}
async function setLead(c, patch) {
  if (patch.etapa && patch.etapa !== c.lead.etapa) patch.historico = [...(c.lead.historico || []), { data: partes(c.agora).data, etapa: patch.etapa, col: patch.etapaFunil || patch.etapa, por: 'Robô' }];
  c.lead = { ...c.lead, ...patch };
  await c.io.lead(patch);
}
async function humano(c, texto, silencioso = false) {
  const dentro = dentroHorario(c.regras, c.agora);
  if (!silencioso) await falar(c, texto || (dentro ? c.regras.msgHumanoDentro : c.regras.msgHumanoFora), { contar: false });
  await setLead(c, { roboPausadoAte: new Date(c.agora.getTime() + Number(c.regras.pausaHumanoH || 24) * 3600e3).toISOString(), precisaHumano: true });
  await c.io.notificar(`${c.lead.nome || 'Um contato'} quer falar com uma pessoa${dentro ? '' : ' (chegou fora do horário)'}.`);
  c.st.fluxo = null;
}
async function parar(c) {
  if (c.limite) {
    await setLead(c, { roboPausadoAte: new Date(c.agora.getTime() + 12 * 3600e3).toISOString(), precisaHumano: true });
    await c.io.notificar(`O robô chegou ao limite diário de mensagens com ${c.lead.nome || 'um contato'}. Assuma a conversa.`);
  } else if (c.falha === 'janela') {
    await setLead(c, { proximaData: partes(c.agora).data, proximaAcao: 'O robô não pôde enviar: passou de 24h sem resposta. Envie um modelo aprovado ou ligue.' });
  } else if (c.falha) await c.io.notificar(`O robô não conseguiu enviar para ${c.lead.nome || 'um contato'}: ${c.falha}`);
  c.st.fluxo = null;
}

function casarOpcao(opcoes = [], texto) {
  const t = sem(texto); const n = Number(t.replace(/\D/g, ''));
  if (/^\d+\D{0,3}$/.test(t) && n >= 1 && n <= opcoes.length) return n - 1;
  const i = opcoes.findIndex((o) => sem(o.rotulo) === t);
  if (i >= 0) return i;
  return opcoes.findIndex((o) => { const r = sem(o.rotulo); return t.length >= 3 && (r.includes(t) || t.includes(r)); });
}
function avaliar(c, p) {
  if (p.se === 'horario') return dentroHorario(c.regras, c.agora);
  const v = sem(c.lead[p.campo]); const alvo = sem(p.valor);
  if (p.op === 'vazio') return !v;
  if (p.op === 'igual') return v === alvo;
  if (p.op === 'contem') return !!alvo && v.includes(alvo);
  return !!v; // preenchido
}

async function turnoIA(c, p, texto) {
  const f = c.st.fluxo;
  f.hist = [...(f.hist || []), { de: 'cliente', t: String(texto).slice(0, 1000) }].slice(-16);
  let r = null;
  try { r = await c.io.ia({ objetivo: p.objetivo, coletar: p.coletar, hist: f.hist, lead: c.lead, base: c.regras.base }); } catch { r = null; }
  if (!r?.resposta) return humano(c, null); // IA indisponível: nunca deixa o lead sem resposta
  const campos = {};
  for (const k of ['nome', 'cursoInteresse', 'email', 'melhorHorario']) if (r.campos?.[k] && String(r.campos[k]).trim()) campos[k] = String(r.campos[k]).trim().slice(0, 120);
  if (Object.keys(campos).length) await setLead(c, campos);
  if (!(await falar(c, r.resposta))) return parar(c);
  if (!c.st.fluxo) return;
  f.hist.push({ de: 'robo', t: r.resposta }); f.turnos = (f.turnos || 0) + 1;
  if (r.transferir || f.turnos >= Number(p.maxTurnos || 6)) {
    f.aguardando = null;
    if (p.aoTerminar === 'humano') return humano(c, null, true);
    return avancar(c);
  }
  f.aguardando = 'ia';
}

async function executar(c, p) {
  const f = c.st.fluxo;
  switch (p.tipo) {
    case 'mensagem': if (!(await falar(c, p.texto))) return parar(c); return avancar(c);
    case 'menu': {
      const txt = `${p.texto || ''}\n\n${(p.opcoes || []).map((o, i) => `${i + 1}. ${o.rotulo}`).join('\n')}`;
      if (!(await falar(c, txt))) return parar(c);
      f.aguardando = 'menu'; f.tent = 0; return;
    }
    case 'pergunta': if (!(await falar(c, p.texto))) return parar(c); f.aguardando = 'pergunta'; f.tent = 0; return;
    case 'ia': {
      f.hist = []; f.turnos = 0;
      if (p.abertura && !(await falar(c, p.abertura))) return parar(c);
      const primeira = c.msgInicial; c.msgInicial = null;
      if (primeira && !p.abertura) return turnoIA(c, p, primeira);
      f.aguardando = 'ia'; return;
    }
    case 'esperar': {
      const ms = Number(p.quanto || 0) * (p.unidade === 'd' ? 864e5 : p.unidade === 'min' ? 6e4 : 3600e3);
      if (c.simular) { c.io.sistema?.(`Espera de ${p.quanto} ${p.unidade === 'd' ? 'dia(s)' : p.unidade === 'min' ? 'min' : 'hora(s)'} (pulada no teste)`); return avancar(c); }
      f.retomarEm = new Date(c.agora.getTime() + ms).toISOString(); f.aguardando = 'tempo'; return;
    }
    case 'condicao': return entrarRamo(c, avaliar(c, p) ? 'sim' : 'nao');
    case 'etapa': if (p.etapa) await setLead(c, { etapa: p.etapa, etapaFunil: p.etapa }); return avancar(c);
    case 'responsavel': { const n = p.nome === '__rodizio' ? await c.io.rodizio() : p.nome; if (n) await setLead(c, { responsavel: n }); return avancar(c); }
    case 'etiqueta': if (p.tag) await setLead(c, { etiquetas: [...new Set([...(c.lead.etiquetas || []), p.tag])] }); return avancar(c);
    case 'campo': if (p.campo) await setLead(c, { [p.campo]: preencher(c, p.valor) }); return avancar(c);
    case 'tarefa': await setLead(c, { proximaData: somaDias(partes(c.agora).data, p.dias), proximaAcao: preencher(c, p.texto) }); return avancar(c);
    case 'notificar': await c.io.notificar(preencher(c, p.texto)); return avancar(c);
    case 'http': {
      // Só no servidor (o adaptador confere https, bloqueia endereços internos e limita o tempo). Resposta JSON pode preencher campos.
      if (c.simular) { c.io.sistema?.(`${p.metodo || 'POST'} ${p.url} (não enviado no teste)`); return avancar(c); }
      try { const r = await c.io.http({ url: preencher(c, p.url), metodo: p.metodo || 'POST', corpo: preencher(c, p.corpo || '') }); if (p.salvarEm && r != null) await setLead(c, { [p.salvarEm]: String(typeof r === 'object' ? JSON.stringify(r) : r).slice(0, 500) }); }
      catch (e) { await c.io.notificar(`Automação: a chamada para ${p.url} falhou (${e?.message || 'erro'}).`); }
      return avancar(c);
    }
    case 'humano': return humano(c, p.texto);
    case 'fim': c.st.fluxo = null; return;
    default: return avancar(c);
  }
}

async function rodar(c) {
  while (c.st.fluxo && !c.st.fluxo.aguardando) {
    if (++c.passos > 40) { c.st.fluxo = null; await c.io.notificar('Uma automação parou por segurança (passos demais em sequência). Revise o fluxo.'); break; }
    const p = passo(c, c.st.fluxo.ptr);
    if (!p) { c.st.fluxo = null; break; }
    await executar(c, p);
  }
}

async function iniciar(c, a, texto) {
  c.st.fluxo = { autId: a.id, ptr: [0], aguardando: null, tent: 0, hist: [], turnos: 0 };
  c.st.ultimos = { ...(c.st.ultimos || {}), [a.id]: c.agora.toISOString() };
  c.msgInicial = texto || null; c.disparou = a.id;
  if (!passo(c, [0])) { c.st.fluxo = null; return; }
  await rodar(c);
}

async function resposta(c, texto) {
  const f = c.st.fluxo; const p = passo(c, f.ptr);
  if (!p) { c.st.fluxo = null; return; }
  if (f.aguardando === 'menu') {
    const i = casarOpcao(p.opcoes, texto);
    if (i < 0) {
      if (++f.tent >= 2) return humano(c, null);
      if (!(await falar(c, p.erro || 'Não entendi. Responda só com o número da opção, por favor.'))) return parar(c);
      return;
    }
    f.aguardando = null; entrarRamo(c, 'o' + i); return rodar(c);
  }
  if (f.aguardando === 'pergunta') {
    const v = String(texto).trim();
    if (p.validar === 'email' && !/^\S+@\S+\.\S+$/.test(v) && ++f.tent < 2) { if (!(await falar(c, 'Esse e-mail parece incompleto. Pode mandar de novo?'))) return parar(c); return; }
    if (p.campo && (p.validar !== 'email' || /^\S+@\S+\.\S+$/.test(v))) await setLead(c, { [p.campo]: v.slice(0, 200) });
    f.aguardando = null; f.tent = 0; avancar(c); return rodar(c);
  }
  if (f.aguardando === 'ia') { await turnoIA(c, p, texto); return rodar(c); }
}

function escolher(c, ev) {
  const t = sem(ev.texto);
  const kw = c.auts.find((a) => a.gatilho?.tipo === 'palavra_chave' && lista(a.gatilho.palavras).some((p) => t.includes(sem(p))));
  if (kw) return kw;
  if (ev.novo) { const p = c.auts.find((a) => a.gatilho?.tipo === 'primeira_mensagem'); if (p) return p; }
  return c.auts.find((a) => {
    if (a.gatilho?.tipo !== 'qualquer_mensagem') return false;
    const u = c.st.ultimos?.[a.id]; return !u || c.agora - new Date(u) >= Number(a.gatilho.intervaloH ?? 24) * 3600e3;
  });
}

/** Processa um evento de um lead. ev: {tipo:'msg', texto, novo} | {tipo:'tempo'} | {tipo:'gatilho', autId}. */
export async function processar({ auts = [], regras = {}, st = {}, lead = {}, ev, io, agora = new Date(), simular = false }) {
  const c = { auts: auts.filter((a) => a && (simular || a.ativo)), regras: { ...REGRAS_PADRAO, ...regras }, st: JSON.parse(JSON.stringify(st || {})), lead: { ...lead }, io, agora, simular, passos: 0 };
  c.st.ultimos = c.st.ultimos || {};
  if (c.lead.optOut) { c.st.fluxo = null; return { st: c.st, lead: c.lead }; }
  if (ev.tipo === 'msg') {
    const t = sem(ev.texto);
    if (lista(c.regras.palavrasSair).some((p) => t === sem(p))) {
      await falar(c, c.regras.msgSair, { contar: false }); await setLead(c, { optOut: true }); c.st.fluxo = null;
    } else if (lista(c.regras.palavrasHumano).some((p) => t.includes(sem(p)))) {
      await humano(c, null);
    } else if (!(c.lead.roboPausadoAte && new Date(c.lead.roboPausadoAte) > c.agora)) {
      const f = c.st.fluxo;
      if (f?.aguardando === 'tempo') { const p = passo(c, f.ptr); if (p?.seResponder === 'continuar') return { st: c.st, lead: c.lead }; c.st.fluxo = null; }
      if (c.st.fluxo?.aguardando) await resposta(c, ev.texto);
      else { const a = escolher(c, ev); if (a) await iniciar(c, a, ev.texto); }
    }
  } else if (ev.tipo === 'tempo') {
    const f = c.st.fluxo;
    if (f?.aguardando === 'tempo' && new Date(f.retomarEm) <= c.agora) {
      if (c.lead.roboPausadoAte && new Date(c.lead.roboPausadoAte) > c.agora) c.st.fluxo = null;
      else { f.aguardando = null; f.retomarEm = null; avancar(c); await rodar(c); }
    }
  } else if (ev.tipo === 'gatilho') {
    const a = c.auts.find((x) => x.id === ev.autId);
    if (a && !c.st.fluxo && !(c.lead.roboPausadoAte && new Date(c.lead.roboPausadoAte) > c.agora)) await iniciar(c, a, null);
  }
  return { st: c.st, lead: c.lead, disparou: c.disparou || null };
}

/** Gatilhos por tempo (rodam no relógio do servidor). ultimas: Map(leadId -> {dir, em}); sts: Map(leadId -> st). */
export function disparosTempo({ auts = [], regras = {}, leads = [], ultimas = new Map(), sts = new Map(), agora = new Date() }) {
  const r = { ...REGRAS_PADRAO, ...regras };
  if (!dentroHorario(r, agora)) return [];
  const out = []; const usados = new Set();
  const p0 = partes(agora);
  for (const a of auts.filter((x) => x.ativo && ['sem_resposta', 'parado_etapa', 'agendado'].includes(x.gatilho?.tipo))) {
    if (a.gatilho.tipo === 'agendado' && p0.hm < (a.gatilho.hora || '09:00')) continue;
    for (const l of leads) {
      if (usados.has(l.id) || l.optOut || ['matriculado', 'perdido'].includes(l.etapa)) continue;
      if (l.roboPausadoAte && new Date(l.roboPausadoAte) > agora) continue;
      const st = sts.get(l.id) || {}; if (st.fluxo) continue;
      const ja = st.ultimos?.[a.id] ? new Date(st.ultimos[a.id]) : null;
      if (a.gatilho.tipo === 'agendado') {
        if (a.gatilho.etapa && l.etapa !== a.gatilho.etapa) continue; // filtro opcional por etapa
        if (ja && partes(ja).data === p0.data) continue; // uma vez por dia
      } else if (a.gatilho.tipo === 'sem_resposta') {
        const u = ultimas.get(l.id); if (!u || u.dir !== 'out') continue;
        const idade = agora - new Date(u.em); const h = Number(a.gatilho.horas || 24) * 3600e3;
        if (idade < h || idade > h + 48 * 3600e3) continue; // não acorda conversa antiga demais
        if (ja && ja >= new Date(u.em)) continue;
      } else {
        if (l.etapa !== a.gatilho.etapa) continue;
        const desde = (l.historico || []).filter((x) => x.etapa === l.etapa).at(-1)?.data || l.entrada; if (!desde) continue;
        if (agora - new Date(desde + 'T12:00:00Z') < Number(a.gatilho.dias || 3) * 864e5) continue;
        if (ja && ja >= new Date(desde + 'T00:00:00Z')) continue;
      }
      out.push({ aut: a, lead: l }); usados.add(l.id);
    }
  }
  return out;
}

/** Modelos prontos (a escola edita tudo depois). */
export function modelos() {
  const P = novoPasso;
  return [
    { chave: 'ia', nome: 'Atendente com IA 24h', desc: 'Responde dúvidas com a base da escola, descobre curso e horário e passa o lead quente ao vendedor.',
      gatilho: { tipo: 'primeira_mensagem' }, passos: [{ ...P('ia'), aoTerminar: 'seguir' }, { tipo: 'etapa', etapa: 'qualificado' }, { tipo: 'responsavel', nome: '__rodizio' }, { tipo: 'notificar', texto: 'Lead qualificado pela IA: {nome} quer {curso}. Responsável: {responsavel}.' }, { tipo: 'humano', texto: 'Perfeito! Vou te passar para {responsavel}, do nosso time, que vai continuar com você.' }] },
    { chave: 'menu', nome: 'Menu de boas-vindas', desc: 'Menu numerado: cursos, valores, falar com atendente. Cada opção leva a um caminho.',
      gatilho: { tipo: 'primeira_mensagem' }, passos: [{ tipo: 'menu', texto: 'Sobre o que você quer saber?', opcoes: [{ rotulo: 'Cursos e turmas' }, { rotulo: 'Valores e pagamento' }, { rotulo: 'Falar com atendente' }],
        ramos: { o0: [{ tipo: 'pergunta', texto: 'Qual curso te interessa?', campo: 'cursoInteresse' }, { tipo: 'etapa', etapa: 'conversa' }, { tipo: 'humano', texto: 'Ótimo! Já passei para o nosso time te mandar as turmas de {curso}.' }],
          o1: [{ tipo: 'etiqueta', tag: 'quer valores' }, { tipo: 'humano', texto: 'Já chamei o nosso time para te passar valores e condições.' }], o2: [{ tipo: 'humano' }] } }] },
    { chave: 'fora', nome: 'Fora do horário', desc: 'Fora do expediente: avisa o horário, anota o curso e agenda o retorno para o time.',
      gatilho: { tipo: 'qualquer_mensagem', intervaloH: 12 }, passos: [{ tipo: 'condicao', se: 'horario', ramos: { sim: [], nao: [
        { tipo: 'mensagem', texto: 'Nosso time atende das {inicio} às {fim}, mas já deixo tudo anotado.' }, { tipo: 'pergunta', texto: 'Qual curso você quer conhecer?', campo: 'cursoInteresse' },
        { tipo: 'tarefa', dias: 0, texto: 'Retornar {nome} sobre {curso} (chegou fora do horário)' }, { tipo: 'mensagem', texto: 'Anotado! Amanhã cedo alguém do time fala com você sobre {curso}.' }] } }] },
    { chave: 'retomar', nome: 'Retomar quem sumiu', desc: 'Lead parou de responder: lembrete gentil em 1 dia; sem resposta em mais 2, vira tarefa de ligação.',
      gatilho: { tipo: 'sem_resposta', horas: 22 }, passos: [{ tipo: 'mensagem', texto: 'Oi{nome_virgula}! Ficou alguma dúvida sobre {curso}? Ainda tenho vaga na próxima turma.' }, { tipo: 'esperar', quanto: 2, unidade: 'd' }, { tipo: 'tarefa', dias: 0, texto: 'Ligar para {nome}: não respondeu o lembrete' }] },
    { chave: 'parado', nome: 'Reserva parada na negociação', desc: 'Lead há 2 dias em negociação: avisa o responsável e cria retorno para hoje.',
      gatilho: { tipo: 'parado_etapa', etapa: 'negociacao', dias: 2 }, passos: [{ tipo: 'notificar', texto: '{nome} está há 2 dias em negociação. {responsavel}, vale ligar hoje.' }, { tipo: 'tarefa', dias: 0, texto: 'Fechar matrícula de {nome}' }] },
    { chave: 'palavra', nome: 'Palavra-chave do anúncio', desc: 'Quem manda a palavra do anúncio (ex.: "INJETÁVEIS") recebe a apresentação do curso e entra no funil já etiquetado.',
      gatilho: { tipo: 'palavra_chave', palavras: 'injetaveis' }, passos: [{ tipo: 'etiqueta', tag: 'anúncio injetáveis' }, { tipo: 'campo', campo: 'cursoInteresse', valor: 'Injetáveis' }, { tipo: 'mensagem', texto: 'Que bom que você quer saber de {curso}!' }, { ...P('ia'), aoTerminar: 'humano' }] },
  ];
}
