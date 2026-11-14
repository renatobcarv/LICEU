// Automações: o construtor de fluxos do Klasso (gatilho → passos com ramos), no espírito do n8n,
// mas já ligado ao WhatsApp, ao Funil e aos leads. O MESMO motor roda no servidor e no simulador ao lado.
// Dados: coleção 'automacoes' (cada fluxo + '_regras'); estado por lead em 'autoexec' (só o servidor grava).

import { store } from '../store.js';
import { esc, uid } from '../util.js';
import { openDialog, toast, ICON, confirmButton } from '../ui.js';
import { auth } from '../auth.js';
import { podeEscrever } from '../access.js';
import { STAGES } from '../metrics.js';
import { SUPABASE_URL } from '../config.js';
import { processar, GATILHOS, PASSOS, LIMITES_FIXOS, REGRAS_PADRAO, novoPasso, modelos, lista } from '../../supabase/functions/_shared/motor.js';

export const autoRefresh = false; // o editor guarda o rascunho na memória; não redesenha a cada mudança do banco

const RESERVADOS = ['_regras', '_rodizio'];
const pode = () => podeEscrever(auth.member?.role, 'automacoes');
const auts = () => store.all('automacoes').filter((a) => !RESERVADOS.includes(a.id)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
const regras = () => ({ ...REGRAS_PADRAO, escola: auth.org?.nome || store.settings().unidade || REGRAS_PADRAO.escola, ...(store.get('automacoes', '_regras') || {}) });
const ETAPAS = [...STAGES.map((s) => [s.id, s.label]), ['perdido', 'Perdido']];
const etapaNome = (id) => ETAPAS.find((e) => e[0] === id)?.[1] || id;
const CAMPOS = [['nome', 'Nome'], ['cursoInteresse', 'Curso de interesse'], ['email', 'E-mail'], ['melhorHorario', 'Melhor horário'], ['cidade', 'Cidade'], ['observacao', 'Observação']];
const campoNome = (k) => CAMPOS.find((c) => c[0] === k)?.[1] || k;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
const clone = (o) => JSON.parse(JSON.stringify(o));

let ed = null;      // automação em edição (rascunho)
let sujo = false;

// ---------- resumos ----------
function resumoGatilho(g = {}) {
  const n = GATILHOS[g.tipo]?.nome || 'Sem gatilho';
  if (g.tipo === 'palavra_chave') return `${n}: ${lista(g.palavras).map((p) => `"${p}"`).join(', ') || '—'}`;
  if (g.tipo === 'sem_resposta') return `${n} há ${g.horas || 24}h`;
  if (g.tipo === 'parado_etapa') return `${n}: ${etapaNome(g.etapa)} há ${g.dias || 3} dia(s)`;
  if (g.tipo === 'agendado') return `Todo dia às ${g.hora || '09:00'}${g.etapa ? ` · leads em ${etapaNome(g.etapa)}` : ''}`;
  if (g.tipo === 'qualquer_mensagem') return `${n} · no máximo a cada ${g.intervaloH ?? 24}h`;
  return n;
}
function resumoPasso(p) {
  const t = (s, n = 90) => esc(String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));
  switch (p.tipo) {
    case 'mensagem': return t(p.texto) || '<i>sem texto</i>';
    case 'menu': return `${t(p.texto, 60)} · ${(p.opcoes || []).length} opções`;
    case 'pergunta': return `${t(p.texto, 60)} → salva em <b>${esc(campoNome(p.campo))}</b>`;
    case 'ia': return `${t(p.objetivo, 80)} · até ${p.maxTurnos || 6} respostas · depois ${p.aoTerminar === 'humano' ? 'passa para humano' : 'segue o fluxo'}`;
    case 'esperar': return `${p.quanto} ${p.unidade === 'd' ? 'dia(s)' : p.unidade === 'min' ? 'minuto(s)' : 'hora(s)'}${p.seResponder === 'continuar' ? '' : ' · se o lead responder, para'}`;
    case 'condicao': return p.se === 'horario' ? 'Dentro do horário de atendimento?' : `${esc(campoNome(p.campo))} ${({ preenchido: 'está preenchido', vazio: 'está vazio', igual: 'é igual a', contem: 'contém' })[p.op || 'preenchido']} ${t(p.valor, 30)}`;
    case 'etapa': return `Para <b>${esc(etapaNome(p.etapa))}</b>`;
    case 'responsavel': return p.nome === '__rodizio' ? 'Rodízio entre vendas e atendimento' : esc(p.nome);
    case 'etiqueta': return esc(p.tag || '');
    case 'campo': return `${esc(campoNome(p.campo))} = ${t(p.valor, 40)}`;
    case 'tarefa': return `${t(p.texto, 60)} · ${Number(p.dias) ? `em ${p.dias} dia(s)` : 'hoje'}`;
    case 'notificar': return t(p.texto);
    case 'http': return `${esc(p.metodo || 'POST')} ${t(p.url, 60)}`;
    case 'humano': return t(p.texto) || 'Mensagem padrão das regras';
    default: return '';
  }
}

// ---------- lista ----------
function telaLista() {
  const as = auts(); const ativas = as.filter((a) => a.ativo).length;
  const emFluxo = store.all('autoexec').filter((s) => s.fluxo).length;
  const r = regras();
  return `<section class="card au-hero"><div><p class="hj-k">Robô, fluxos e integrações</p><h2>${ativas ? `${ativas} automação${ativas > 1 ? 'ões' : ''} trabalhando` : 'Nenhuma automação ligada'}</h2>
      <p class="muted">${emFluxo ? `${emFluxo} contato(s) dentro de um fluxo agora. ` : ''}Gatilho dispara, os passos rodam: responder, perguntar, IA, mover no funil, avisar o time, chamar outro sistema.</p></div>
      ${pode() ? `<button class="btn primary" data-au="nova">${ICON.plus} Nova automação</button>` : '<span class="badge">Só visualização</span>'}</section>
    ${as.length ? `<div class="au-grid">${as.map((a) => `<article class="card au-card${a.ativo ? ' on' : ''}">
        <header><span class="au-ico">${ICON.automacoes}</span><div><h3>${esc(a.nome || 'Sem nome')}</h3><small>${esc(resumoGatilho(a.gatilho))}</small></div>
        ${pode() ? `<label class="au-sw" title="${a.ativo ? 'Desligar' : 'Ligar'}"><input type="checkbox" data-sw="${esc(a.id)}"${a.ativo ? ' checked' : ''}><span aria-hidden="true"></span><b class="sr-only">Ligada</b></label>` : `<span class="badge ${a.ativo ? 'good' : ''}">${a.ativo ? 'Ligada' : 'Desligada'}</span>`}</header>
        <p class="muted">${contar(a.passos)} passo(s)</p>
        <footer><a class="btn sm" href="#automacoes?ed=${encodeURIComponent(a.id)}">${pode() ? 'Editar e testar' : 'Ver e testar'}</a>${pode() ? `<button class="btn sm ghost" data-dup="${esc(a.id)}">Duplicar</button>` : ''}</footer></article>`).join('')}</div>`
      : `<section class="card hj-vazio"><h2>Comece por um modelo</h2><p class="muted">Atendente com IA, menu de boas-vindas, fora do horário, retomar quem sumiu… Todos editáveis.</p>${pode() ? `<button class="btn primary" data-au="nova">Ver modelos ${ICON.arrow}</button>` : ''}</section>`}
    <section class="card"><header class="card-head"><div><h2>Regras e limites do robô</h2><p class="muted">Valem para todas as automações. Atendimento ${esc(r.horario.inicio)}–${esc(r.horario.fim)} · até ${esc(r.maxPorLeadDia)} mensagens por contato/dia · robô se cala ${esc(r.pausaHumanoH)}h quando o time assume</p></div>
      ${pode() ? '<button class="btn sm" data-au="regras">Editar regras e base da IA</button>' : ''}</header>
      <ul class="au-limites">${LIMITES_FIXOS.map((l) => `<li>${ICON.check}<span>${esc(l)}</span></li>`).join('')}</ul>
      ${r.base ? '' : '<p class="hint">A IA ainda não tem base de conhecimento: preencha horários, endereço, formas de pagamento e diferenciais em "Editar regras".</p>'}</section>`;
}
const contar = (ps = []) => ps.reduce((n, p) => n + 1 + Object.values(p.ramos || {}).reduce((m, r) => m + contar(r), 0), 0);

// ---------- editor ----------
const arr = (path) => { let a = ed.passos; for (let i = 0; i < path.length; i += 2) a = a[path[i]].ramos[path[i + 1]]; return a; };
function rotulosRamos(p) {
  if (p.tipo === 'menu') return (p.opcoes || []).map((o, i) => ['o' + i, `Se escolher ${i + 1}. ${o.rotulo}`]);
  if (p.tipo === 'condicao') return [['sim', 'Se sim'], ['nao', 'Se não']];
  return [];
}
function blocoPassos(ps, path) {
  const P = JSON.stringify(path);
  const add = (i) => pode() ? `<button class="au-add" data-add='${esc(P)}' data-i="${i}" aria-label="Adicionar passo aqui">${ICON.plus}<span>passo</span></button>` : '';
  return `<ol class="au-steps">${ps.map((p, i) => `<li>${add(i)}<div class="au-step t-${esc(p.tipo)}">
      <div class="au-sh"><span class="au-tag">${esc(PASSOS[p.tipo]?.grupo || '')}</span><b>${esc(PASSOS[p.tipo]?.nome || p.tipo)}</b>
        ${pode() ? `<span class="au-acts"><button class="icon-btn sm" data-mv='${esc(P)}' data-i="${i}" data-d="-1" aria-label="Subir"${i ? '' : ' disabled'}>${ICON.up}</button><button class="icon-btn sm au-down" data-mv='${esc(P)}' data-i="${i}" data-d="1" aria-label="Descer"${i < ps.length - 1 ? '' : ' disabled'}>${ICON.up}</button><button class="icon-btn sm" data-rm='${esc(P)}' data-i="${i}" aria-label="Excluir passo">${ICON.lixo}</button></span>` : ''}</div>
      <button class="au-sb" data-edit='${esc(P)}' data-i="${i}">${resumoPasso(p)}</button>
      ${rotulosRamos(p).map(([k, rot]) => `<div class="au-ramo"><p class="au-rl">${esc(rot)}</p>${blocoPassos((p.ramos || {})[k] || [], [...path, i, k])}</div>`).join('')}
    </div></li>`).join('')}<li class="au-end">${add(ps.length)}${path.length ? '' : '<span class="au-fim">Fim do fluxo</span>'}</li></ol>`;
}
function camposGatilho(g) {
  const t = g.tipo;
  const url = t === 'webhook' && ed.id ? `${SUPABASE_URL}/functions/v1/automacao-entrada?o=${auth.org?.id || 'SUA_EMPRESA'}&a=${encodeURIComponent(ed.id)}&k=${g.token || ''}` : '';
  return `${t === 'palavra_chave' ? `<label class="field"><span>Palavras (separe por vírgula)</span><input data-g="palavras" value="${esc(g.palavras || '')}" placeholder="injetaveis, enfermagem"></label>` : ''}
    ${t === 'qualquer_mensagem' ? `<label class="field"><span>Repetir no mesmo contato no máximo a cada (horas)</span><input type="number" min="0" data-g="intervaloH" value="${esc(g.intervaloH ?? 24)}"></label>` : ''}
    ${t === 'sem_resposta' ? `<label class="field"><span>Depois de quantas horas sem resposta</span><input type="number" min="1" data-g="horas" value="${esc(g.horas || 24)}"></label><p class="hint">Na API oficial, passou de 24h o WhatsApp só aceita modelo aprovado: use até 22h ou o robô cria uma tarefa.</p>` : ''}
    ${t === 'parado_etapa' ? `<label class="field"><span>Etapa</span><select data-g="etapa">${ETAPAS.map(([v, l]) => `<option value="${v}"${g.etapa === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label><label class="field"><span>Parado há quantos dias</span><input type="number" min="1" data-g="dias" value="${esc(g.dias || 3)}"></label>` : ''}
    ${t === 'agendado' ? `<label class="field"><span>Horário</span><input type="time" data-g="hora" value="${esc(g.hora || '09:00')}"></label><label class="field"><span>Só leads na etapa (opcional)</span><select data-g="etapa"><option value="">Todos os abertos</option>${ETAPAS.map(([v, l]) => `<option value="${v}"${g.etapa === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
    ${t === 'webhook' ? `<div class="au-wh full"><p class="hint">Envie um POST com JSON <code>{"nome","telefone","email","curso"}</code> para esta URL. O lead é criado ou atualizado pelo telefone e o fluxo roda.</p>
      ${url ? `<code class="au-url">${esc(url)}</code><div class="row-actions"><button class="btn sm" data-au="copiar-url">${ICON.copy} Copiar URL</button>${pode() ? '<button class="btn sm ghost" data-au="novo-token">Trocar token</button>' : ''}</div>` : '<p class="hint">Salve a automação para gerar a URL.</p>'}</div>` : ''}`;
}
function telaEditor() {
  const g = ed.gatilho || {};
  const dis = pode() ? '' : ' disabled';
  return `<div class="au-ed">
    <section class="card au-top"><a class="link" href="#automacoes">${ICON.left} Automações</a>
      <input class="au-nome" data-au-nome value="${esc(ed.nome || '')}" placeholder="Nome da automação" aria-label="Nome da automação"${dis}>
      <span class="grow"></span>
      ${pode() ? `<label class="au-sw"><input type="checkbox" data-au-ativo${ed.ativo ? ' checked' : ''}><span aria-hidden="true"></span><b>${ed.ativo ? 'Ligada' : 'Desligada'}</b></label>
      ${store.get('automacoes', ed.id) ? '<button class="btn sm ghost danger" data-au="excluir">Excluir</button>' : ''}<button class="btn primary" data-au="salvar">Salvar${sujo ? ' •' : ''}</button>` : ''}</section>
    <div class="au-cols">
      <section class="card au-flow">
        <div class="au-trig"><span class="au-tag">Gatilho</span><b>Quando…</b>
          <label class="field"><span class="sr-only">Tipo de gatilho</span><select data-g="tipo"${dis}>${Object.entries(GATILHOS).map(([k, v]) => `<option value="${k}"${g.tipo === k ? ' selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>
          <div class="au-gf">${camposGatilho(g)}</div></div>
        ${blocoPassos(ed.passos || [], [])}
      </section>
      <aside class="card au-sim" aria-label="Simulador">
        <header><div><b>Testar</b><small>Mesmo motor do robô de verdade. Nada é enviado.</small></div>
          <select data-sim-hora aria-label="Horário simulado"><option value="agora">Agora</option><option value="dentro">Dentro do horário</option><option value="fora">Fora do horário</option></select>
          <button class="btn sm ghost" data-sim="reset">Reiniciar</button></header>
        <div class="au-chat" id="au-chat" aria-live="polite"></div>
        <form class="au-in" data-sim-form><input id="au-msg" placeholder="${GATILHOS[g.tipo]?.msg ? 'Escreva como se fosse o cliente…' : 'Responda como o cliente…'}" autocomplete="off" aria-label="Mensagem do cliente"><button class="btn primary sm">Enviar</button></form>
        <div class="au-lead" id="au-lead"></div>
      </aside>
    </div></div>`;
}

export function render(ctx = {}) {
  const id = ctx.params?.ed;
  if (!id) { ed = null; sujo = false; return telaLista(); }
  if (!ed || ed.id !== id) {
    const a = store.get('automacoes', id);
    if (!a) return `<section class="card hj-vazio"><h2>Automação não encontrada</h2><a class="btn" href="#automacoes">Voltar</a></section>`;
    ed = clone(a); sujo = false;
  }
  return telaEditor();
}

// ---------- diálogos de passo ----------
function camposDoPasso(p) {
  const etapas = ETAPAS; const time = store.all('team').filter((m) => m.ativo !== false).map((m) => m.nome);
  const VARS = 'Variáveis: {nome} {curso} {escola} {responsavel} {telefone}';
  switch (p.tipo) {
    case 'mensagem': return [{ name: 'texto', label: 'Mensagem', type: 'textarea', rows: 4, value: p.texto, required: true, full: true, hint: VARS }];
    case 'menu': return [{ name: 'texto', label: 'Pergunta do menu', type: 'textarea', value: p.texto, required: true, full: true },
      { name: 'opcoes', label: 'Opções (uma por linha, até 9)', type: 'textarea', rows: 5, value: (p.opcoes || []).map((o) => o.rotulo).join('\n'), required: true, full: true, hint: 'Cada opção ganha o seu próprio caminho. O cliente responde com o número ou o texto.' },
      { name: 'erro', label: 'Se responder algo fora das opções', value: p.erro || '', full: true, placeholder: 'Não entendi. Responda só com o número da opção, por favor.', hint: 'Na segunda tentativa errada, passa para humano.' }];
    case 'pergunta': return [{ name: 'texto', label: 'Pergunta', type: 'textarea', value: p.texto, required: true, full: true, hint: VARS },
      { name: 'campo', label: 'Salvar a resposta em', type: 'select', options: CAMPOS, value: p.campo }, { name: 'validar', label: 'Conferir', type: 'select', options: [['', 'Qualquer texto'], ['email', 'E-mail']], value: p.validar || '' }];
    case 'ia': return [{ name: 'objetivo', label: 'Objetivo da IA nesta etapa', type: 'textarea', rows: 3, value: p.objetivo, required: true, full: true, hint: 'Ex.: tirar dúvidas e descobrir curso e melhor horário. A IA usa só a base das Regras e os cursos cadastrados.' },
      { name: 'abertura', label: 'Mensagem de abertura (opcional)', value: p.abertura || '', full: true, hint: 'Vazio: a IA já responde a mensagem que o cliente mandou.' },
      { name: 'maxTurnos', label: 'Máximo de respostas da IA', type: 'number', value: p.maxTurnos || 6, step: 1 },
      { name: 'aoTerminar', label: 'Quando terminar ou o cliente estiver pronto', type: 'select', options: [['seguir', 'Seguir para o próximo passo'], ['humano', 'Passar para humano']], value: p.aoTerminar || 'seguir' }];
    case 'esperar': return [{ name: 'quanto', label: 'Quanto', type: 'number', value: p.quanto, step: 1, required: true }, { name: 'unidade', label: 'Unidade', type: 'select', options: [['min', 'Minutos'], ['h', 'Horas'], ['d', 'Dias']], value: p.unidade },
      { name: 'seResponder', label: 'Se o lead responder durante a espera', type: 'select', options: [['parar', 'Parar este fluxo (recomendado)'], ['continuar', 'Continuar esperando']], value: p.seResponder || 'parar', full: true }];
    case 'condicao': return [{ name: 'se', label: 'Verificar', type: 'select', options: [['horario', 'Está dentro do horário de atendimento'], ['campo', 'Um campo do lead']], value: p.se, full: true },
      { name: 'campo', label: 'Campo', type: 'select', options: [...CAMPOS, ['etapa', 'Etapa'], ['origem', 'Origem'], ['responsavel', 'Responsável']], value: p.campo || 'cursoInteresse' },
      { name: 'op', label: 'Regra', type: 'select', options: [['preenchido', 'Está preenchido'], ['vazio', 'Está vazio'], ['igual', 'É igual a'], ['contem', 'Contém']], value: p.op || 'preenchido' },
      { name: 'valor', label: 'Valor (para "igual" e "contém")', value: p.valor || '', full: true }];
    case 'etapa': return [{ name: 'etapa', label: 'Mover para', type: 'select', options: etapas, value: p.etapa, full: true }];
    case 'responsavel': return [{ name: 'nome', label: 'Responsável', type: 'select', options: [['__rodizio', 'Rodízio (vendas e atendimento)'], ...time.map((n) => [n, n])], value: p.nome, full: true }];
    case 'etiqueta': return [{ name: 'tag', label: 'Etiqueta', value: p.tag || '', required: true, full: true }];
    case 'campo': return [{ name: 'campo', label: 'Campo', type: 'select', options: CAMPOS, value: p.campo || 'cursoInteresse' }, { name: 'valor', label: 'Valor', value: p.valor || '', required: true }];
    case 'tarefa': return [{ name: 'texto', label: 'O que fazer', value: p.texto, required: true, full: true, hint: VARS }, { name: 'dias', label: 'Para daqui a quantos dias (0 = hoje)', type: 'number', step: 1, value: p.dias ?? 0 }];
    case 'notificar': return [{ name: 'texto', label: 'Aviso no chat do time (#geral)', type: 'textarea', value: p.texto, required: true, full: true, hint: VARS }];
    case 'http': return [{ name: 'url', label: 'URL (https)', value: p.url, required: true, full: true, placeholder: 'https://seu-n8n.com/webhook/...' },
      { name: 'metodo', label: 'Método', type: 'select', options: ['POST', 'PUT', 'PATCH', 'GET'], value: p.metodo || 'POST' }, { name: 'salvarEm', label: 'Guardar a resposta em (opcional)', type: 'select', options: [['', 'Não guardar'], ['observacao', 'Observação']], value: p.salvarEm || '' },
      { name: 'corpo', label: 'Corpo JSON', type: 'textarea', rows: 5, value: p.corpo || '', full: true, hint: VARS + ' {etapa} {email}. Só https público; 10 s de limite.' }];
    case 'humano': return [{ name: 'texto', label: 'Mensagem ao passar (opcional)', type: 'textarea', value: p.texto || '', full: true, hint: 'Vazio usa a mensagem das Regras (dentro/fora do horário). O time é avisado e o robô se cala neste contato.' }];
    default: return [];
  }
}
function aplicar(p, d) {
  const n = { ...p, ...d };
  ['maxTurnos', 'quanto', 'dias'].forEach((k) => { if (k in d) n[k] = Number(d[k]) || 0; });
  if (p.tipo === 'menu') {
    const rot = String(d.opcoes || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 9);
    n.opcoes = rot.map((r) => ({ rotulo: r })); n.ramos = Object.fromEntries(rot.map((_, i) => ['o' + i, (p.ramos || {})['o' + i] || []]));
  }
  if (p.tipo === 'condicao') n.ramos = { sim: p.ramos?.sim || [], nao: p.ramos?.nao || [] };
  if (p.tipo === 'http' && d.corpo) { try { JSON.parse(d.corpo.replace(/\{[a-zA-Z_]+\}/g, 'x')); } catch { toast('O corpo não é um JSON válido. Confira aspas e chaves.', 'bad'); return null; } }
  return n;
}

// ---------- simulador ----------
let sim = null;
function horaSimulada(sel) {
  const d = new Date();
  if (sel === 'dentro') { const x = new Date(d); x.setUTCHours(13, 0, 0, 0); while ([0].includes(x.getUTCDay())) x.setUTCDate(x.getUTCDate() + 1); return x; }
  if (sel === 'fora') { const x = new Date(d); x.setUTCHours(2, 30, 0, 0); return x; }
  return d;
}
function simNovo(root) {
  sim = { st: {}, lead: { id: 'teste', nome: 'Maria Teste', telefone: '62999990000', etapa: 'novo', etiquetas: [] }, n: 0, ocupado: false };
  const box = root.querySelector('#au-chat'); box.innerHTML = '';
  bolha(root, 'sis', GATILHOS[ed.gatilho?.tipo]?.msg ? 'Mande uma mensagem como se fosse um cliente novo.' : 'Este gatilho dispara sozinho no servidor. Simulando o disparo agora…');
  simLead(root);
  if (!GATILHOS[ed.gatilho?.tipo]?.msg) simEvento(root, { tipo: 'gatilho', autId: ed.id || 'rascunho' });
}
function bolha(root, tipo, texto) {
  const box = root.querySelector('#au-chat'); if (!box) return;
  const el = document.createElement('div'); el.className = 'au-b ' + tipo; el.textContent = texto; box.append(el); box.scrollTop = box.scrollHeight;
}
function simLead(root) {
  const l = sim.lead; const el = root.querySelector('#au-lead'); if (!el) return;
  const f = sim.st.fluxo;
  el.innerHTML = `<b>Ficha do lead no teste</b><dl>
    <dt>Etapa</dt><dd>${esc(etapaNome(l.etapa))}</dd>${l.cursoInteresse ? `<dt>Curso</dt><dd>${esc(l.cursoInteresse)}</dd>` : ''}${l.responsavel ? `<dt>Responsável</dt><dd>${esc(l.responsavel)}</dd>` : ''}
    ${l.melhorHorario ? `<dt>Horário</dt><dd>${esc(l.melhorHorario)}</dd>` : ''}${l.email ? `<dt>E-mail</dt><dd>${esc(l.email)}</dd>` : ''}${(l.etiquetas || []).length ? `<dt>Etiquetas</dt><dd>${l.etiquetas.map(esc).join(', ')}</dd>` : ''}
    ${l.proximaAcao ? `<dt>Tarefa</dt><dd>${esc(l.proximaAcao)}</dd>` : ''}${l.optOut ? '<dt>Status</dt><dd>Pediu para sair</dd>' : l.roboPausadoAte ? '<dt>Robô</dt><dd>Pausado: com humano</dd>' : ''}
    <dt>Fluxo</dt><dd>${f ? (f.aguardando === 'tempo' ? 'Esperando o tempo' : f.aguardando ? 'Esperando resposta' : 'Rodando') : 'Encerrado'}</dd></dl>`;
}
async function simEvento(root, ev) {
  if (sim.ocupado) return; sim.ocupado = true;
  const sel = root.querySelector('[data-sim-hora]')?.value || 'agora';
  const a = { ...clone(ed), id: ed.id || 'rascunho', ativo: true };
  const sb = auth.client; const orgId = auth.org?.id;
  const io = {
    enviar: async (t) => { bolha(root, 'bot', t); return { ok: true }; },
    lead: async (p) => { Object.assign(sim.lead, p); },
    notificar: async (t) => bolha(root, 'sis', 'Aviso ao time: ' + t),
    rodizio: async () => store.all('team').find((m) => m.ativo !== false)?.nome || 'Vendedor(a)',
    sistema: (t) => bolha(root, 'sis', t),
    http: async () => null,
    ia: async ({ objetivo, hist, lead }) => {
      if (!sb || !orgId) { bolha(root, 'sis', 'IA simulada (entre com login para testar a IA real).'); return { resposta: 'Oi! Temos turmas de manhã e à noite. Qual horário fica melhor para você?', transferir: hist.length > 3, campos: {} }; }
      bolha(root, 'sis', 'IA pensando…');
      const { data, error } = await sb.functions.invoke('automacao-ia', { body: { orgId, objetivo, hist, lead, base: regras().base } });
      root.querySelector('#au-chat .au-b.sis:last-child')?.remove();
      if (error || data?.error) { let m = data?.error; try { m = m || (await error.context?.json?.())?.error; } catch { /* */ } bolha(root, 'sis', m || 'IA indisponível: no robô de verdade, o contato vai para um humano.'); return null; }
      return data;
    },
  };
  try {
    const r = await processar({ auts: [a], regras: regras(), st: sim.st, lead: sim.lead, ev, io, agora: horaSimulada(sel), simular: true });
    sim.st = r.st; Object.assign(sim.lead, r.lead);
    if (ev.tipo === 'msg' && !r.disparou && !sim.st.fluxo && !sim.lead.roboPausadoAte && !sim.lead.optOut && sim.n === 1) bolha(root, 'sis', 'O gatilho não disparou com essa mensagem. Confira o tipo de gatilho e as palavras-chave.');
  } catch (e) { bolha(root, 'sis', 'Erro no fluxo: ' + e.message); }
  sim.ocupado = false; simLead(root);
}

// ---------- montagem ----------
function salvar(root, ctx) {
  if (!pode()) return;
  if (!(ed.nome || '').trim()) { toast('Dê um nome para a automação.', 'bad'); root.querySelector('[data-au-nome]')?.focus(); return; }
  const novo = !ed.id; if (novo) ed.id = uid('au_');
  if (ed.gatilho?.tipo === 'webhook' && !ed.gatilho.token) ed.gatilho.token = token();
  store.put('automacoes', clone(ed)); sujo = false; toast('Automação salva.' + (ed.ativo ? '' : ' Ela está desligada: ligue quando estiver pronta.'));
  if (novo) ctx.go('#automacoes?ed=' + encodeURIComponent(ed.id)); else redesenhar(root);
}
function redesenhar(root) {
  const flow = root.querySelector('.au-flow'); if (!flow) return;
  const y = flow.scrollTop; const tmp = document.createElement('div'); tmp.innerHTML = telaEditor();
  root.querySelector('.au-top').replaceWith(tmp.querySelector('.au-top'));
  flow.replaceWith(tmp.querySelector('.au-flow')); root.querySelector('.au-flow').scrollTop = y;
}
function marcar(root) { sujo = true; redesenhar(root); }

function novaAutomacao(ctx) {
  const ms = modelos();
  openDialog({ title: 'Nova automação', wide: true,
    html: `<p class="muted">Escolha um modelo para começar. Tudo é editável: gatilho, textos, caminhos e limites.</p><div class="au-modelos">
      ${ms.map((m) => `<button type="button" class="au-mod" data-mod="${m.chave}"><b>${esc(m.nome)}</b><small>${esc(m.desc)}</small><span class="au-tag">${esc(GATILHOS[m.gatilho.tipo].nome)}</span></button>`).join('')}
      <button type="button" class="au-mod vazio" data-mod=""><b>Em branco</b><small>Monte do zero: escolha o gatilho e adicione os passos.</small></button></div>`,
    onOpen: (form, dlg) => form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mod]'); if (!b) return;
      const m = ms.find((x) => x.chave === b.dataset.mod);
      ed = m ? { id: '', nome: m.nome, ativo: false, gatilho: clone(m.gatilho), passos: clone(m.passos) } : { id: '', nome: '', ativo: false, gatilho: { tipo: 'primeira_mensagem' }, passos: [] };
      ed.id = uid('au_'); if (ed.gatilho.tipo === 'webhook') ed.gatilho.token = token();
      sujo = true; dlg.close(); ctx.go('#automacoes?ed=' + encodeURIComponent(ed.id) + '&novo=1');
    }) });
}
function regrasDialog(root, ctx) {
  const r = regras(); const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  openDialog({ title: 'Regras e limites do robô', wide: true, saveLabel: 'Salvar regras',
    fields: [
      { type: 'section', label: 'Identidade' },
      { name: 'escola', label: 'Nome da escola (como o robô fala)', value: r.escola, required: true },
      { name: 'apresentacao', label: 'Apresentação (obrigatória, vai na 1ª mensagem)', value: r.apresentacao, required: true, full: true, hint: 'Precisa deixar claro que é um assistente virtual. Variáveis: {nome_virgula} {escola}' },
      { type: 'section', label: 'Horário de atendimento humano' },
      { name: 'inicio', label: 'Abre', type: 'time', value: r.horario.inicio }, { name: 'fim', label: 'Fecha', type: 'time', value: r.horario.fim },
      ...DIAS.map((n, i) => ({ name: 'd' + i, label: n, type: 'checkbox', value: (r.horario.dias || []).map(Number).includes(i) })),
      { type: 'section', label: 'Limites' },
      { name: 'maxPorLeadDia', label: 'Máximo de mensagens do robô por contato/dia', type: 'number', step: 1, value: r.maxPorLeadDia, hint: 'No QR Code o teto é 4, sempre.' },
      { name: 'pausaHumanoH', label: 'Robô se cala por quantas horas quando o time assume', type: 'number', step: 1, value: r.pausaHumanoH },
      { name: 'palavrasHumano', label: 'Palavras que chamam um humano', value: lista(r.palavrasHumano).join(', '), full: true },
      { name: 'palavrasSair', label: 'Palavras de saída (opt-out, mensagem exata)', value: lista(r.palavrasSair).join(', '), full: true },
      { name: 'msgHumanoDentro', label: 'Ao passar para humano (no horário)', value: r.msgHumanoDentro, full: true },
      { name: 'msgHumanoFora', label: 'Ao passar para humano (fora do horário)', value: r.msgHumanoFora, full: true, hint: 'Variáveis: {inicio} {fim}' },
      { name: 'msgSair', label: 'Confirmação de saída', value: r.msgSair, full: true },
      { type: 'section', label: 'Base de conhecimento da IA' },
      { name: 'base', label: 'O que a IA pode dizer', type: 'textarea', rows: 10, value: r.base, full: true, placeholder: 'Endereço, horários das turmas, formas de pagamento, documentos para matrícula, diferenciais, certificação…', hint: 'A IA usa SÓ isto e os cursos cadastrados (nome e preço entram sozinhos). O que não estiver aqui, ela passa para o time.' },
    ],
    onSave: (d) => {
      if (!/assistente virtual|robô|robo|automátic/i.test(d.apresentacao)) { toast('A apresentação precisa dizer que é um assistente virtual.', 'bad'); return false; }
      const dias = DIAS.map((_, i) => (d['d' + i] ? i : null)).filter((x) => x !== null);
      const out = { id: '_regras', escola: d.escola, apresentacao: d.apresentacao, horario: { inicio: d.inicio || '08:00', fim: d.fim || '18:00', dias },
        maxPorLeadDia: Math.max(1, Math.min(30, Number(d.maxPorLeadDia) || 8)), pausaHumanoH: Math.max(1, Math.min(168, Number(d.pausaHumanoH) || 24)),
        palavrasHumano: lista(d.palavrasHumano), palavrasSair: lista(d.palavrasSair), msgHumanoDentro: d.msgHumanoDentro, msgHumanoFora: d.msgHumanoFora, msgSair: d.msgSair, base: d.base.slice(0, 8000) };
      if (!out.palavrasSair.length) { toast('Mantenha ao menos uma palavra de saída (ex.: sair).', 'bad'); return false; }
      store.put('automacoes', out); toast('Regras salvas.'); setTimeout(() => ctx.go('#automacoes'), 0);
    } });
}

export function mount(root, ctx) {
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-au]')?.dataset.au;
    if (a === 'nova') return novaAutomacao(ctx);
    if (a === 'regras') return regrasDialog(root, ctx);
    if (a === 'salvar') return salvar(root, ctx);
    if (a === 'excluir') { const b = e.target.closest('button'); if (!confirmButton(b, 'Confirmar exclusão')) return; store.remove?.('automacoes', ed.id); ed = null; toast('Automação excluída.'); return ctx.go('#automacoes'); }
    if (a === 'copiar-url') { const u = root.querySelector('.au-url')?.textContent || ''; try { await navigator.clipboard.writeText(u); toast('URL copiada. Trate como senha.'); } catch { toast('Selecione e copie a URL.', 'bad'); } return; }
    if (a === 'novo-token') { ed.gatilho.token = token(); return marcar(root); }
    const dup = e.target.closest('[data-dup]'); if (dup) { const o = store.get('automacoes', dup.dataset.dup); const n = { ...clone(o), id: uid('au_'), nome: (o.nome || '') + ' (cópia)', ativo: false }; if (n.gatilho?.tipo === 'webhook') n.gatilho.token = token(); store.put('automacoes', n); toast('Duplicada (desligada).'); return ctx.go('#automacoes'); }
    if (!ed) return;
    const sv = e.target.closest('[data-sim]'); if (sv) return simNovo(root);
    const add = e.target.closest('[data-add]'); if (add) {
      const path = JSON.parse(add.dataset.add), i = Number(add.dataset.i);
      const grupos = {}; Object.entries(PASSOS).forEach(([k, v]) => (grupos[v.grupo] = grupos[v.grupo] || []).push([k, v.nome]));
      return openDialog({ title: 'Adicionar passo', html: `<div class="au-pick">${Object.entries(grupos).map(([g, ps]) => `<div><p class="au-rl">${esc(g)}</p>${ps.map(([k, n]) => `<button type="button" class="au-pk t-${k}" data-pk="${k}">${esc(n)}</button>`).join('')}</div>`).join('')}</div>`,
        onOpen: (form, dlg) => form.addEventListener('click', (ev) => {
          const k = ev.target.closest('[data-pk]')?.dataset.pk; if (!k) return;
          const p = novoPasso(k); arr(path).splice(i, 0, p); dlg.close(); marcar(root);
          if (camposDoPasso(p).length) setTimeout(() => editarPasso(root, path, i), 0);
        }) });
    }
    const edt = e.target.closest('[data-edit]'); if (edt) return editarPasso(root, JSON.parse(edt.dataset.edit), Number(edt.dataset.i));
    const mv = e.target.closest('[data-mv]'); if (mv && pode()) { const ls = arr(JSON.parse(mv.dataset.mv)); const i = Number(mv.dataset.i), j = i + Number(mv.dataset.d); if (j < 0 || j >= ls.length) return; [ls[i], ls[j]] = [ls[j], ls[i]]; return marcar(root); }
    const rm = e.target.closest('[data-rm]'); if (rm && pode()) { if (!confirmButton(rm, '✓')) return; arr(JSON.parse(rm.dataset.rm)).splice(Number(rm.dataset.i), 1); return marcar(root); }
  });
  root.addEventListener('change', (e) => {
    const sw = e.target.closest('[data-sw]'); if (sw) { const o = store.get('automacoes', sw.dataset.sw); store.put('automacoes', { ...o, ativo: sw.checked }); toast(sw.checked ? 'Automação ligada.' : 'Automação desligada.'); return; }
    if (!ed) return;
    if (e.target.matches('[data-au-ativo]')) { ed.ativo = e.target.checked; return marcar(root); }
    const g = e.target.closest('[data-g]'); if (g) {
      ed.gatilho = { ...(ed.gatilho || {}), [g.dataset.g]: g.type === 'number' ? Number(g.value) : g.value };
      if (g.dataset.g === 'tipo' && ed.gatilho.tipo === 'webhook' && !ed.gatilho.token) ed.gatilho.token = token();
      marcar(root); if (g.dataset.g === 'tipo') simNovo(root);
    }
  });
  root.addEventListener('input', (e) => { if (ed && e.target.matches('[data-au-nome]')) { ed.nome = e.target.value; sujo = true; const b = root.querySelector('[data-au="salvar"]'); if (b) b.textContent = 'Salvar •'; } });
  root.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-sim-form]')) return; e.preventDefault();
    const inp = root.querySelector('#au-msg'); const t = inp.value.trim(); if (!t || sim?.ocupado) return;
    bolha(root, 'eu', t); inp.value = ''; sim.n++;
    simEvento(root, { tipo: 'msg', texto: t, novo: sim.n === 1 });
  });
  if (ed && root.querySelector('#au-chat')) simNovo(root);
  addEventListener('beforeunload', (ev) => { if (sujo && ed) { ev.preventDefault(); } }, { once: true });
}

function editarPasso(root, path, i) {
  const p = arr(path)[i]; const fields = camposDoPasso(p);
  if (!fields.length) return;
  if (!pode()) return openDialog({ title: PASSOS[p.tipo]?.nome || p.tipo, fields: fields.map((f) => ({ ...f, required: false })) });
  openDialog({ title: PASSOS[p.tipo]?.nome || 'Passo', fields, wide: p.tipo === 'http' || p.tipo === 'ia', saveLabel: 'Aplicar',
    onSave: (d) => { const n = aplicar(p, d); if (!n) return false; arr(path)[i] = n; setTimeout(() => marcar(root), 0); } });
}
