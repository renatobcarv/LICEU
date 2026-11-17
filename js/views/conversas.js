// Conversas: o WhatsApp da escola dentro do Klasso (estilo WhatsApp Web).
// Lista de contatos à esquerda, conversa à direita; texto, anexos (imagem, vídeo, áudio, documento),
// respostas rápidas, janela de 24h da API oficial e controle do robô (assumir / devolver).
// Mensagens: coleção 'wamsg' (entram pelos webhooks, saem pela função whatsapp-send). Anexos: Storage 'wa-media'.

import { store } from '../store.js';
import { esc, uid } from '../util.js';
import { toast, ICON } from '../ui.js';
import { auth } from '../auth.js';
import { podeEscrever } from '../access.js';
import { STAGES } from '../metrics.js';
import { editLead } from '../leads.js';

export const autoRefresh = false; // atualiza sozinha sem perder o que está sendo digitado

const LIDAS = 'flowclass.conversas.lidas';
const lidas = () => { try { return JSON.parse(localStorage.getItem(LIDAS) || '{}'); } catch { return {}; } };
const marcarLida = (id) => { try { const l = lidas(); l[id] = new Date().toISOString(); localStorage.setItem(LIDAS, JSON.stringify(l)); } catch { /* sem armazenamento */ } };
const pode = () => podeEscrever(auth.member?.role, 'wamsg');
const etapaNome = (id) => STAGES.find((s) => s.id === id)?.label || (id === 'perdido' ? 'Perdido' : id || '');
const hora = (iso) => { const d = new Date(iso); const hoje = new Date().toDateString() === d.toDateString(); return hoje ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
const ini = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const MAX = 16 * 1024 * 1024;

let atual = null; let filtro = 'todas'; let busca = '';
let conexao = null; // { tipo, status } da conexão da empresa
let anexo = null;   // File escolhido
const urls = new Map(); // cache de links assinados

function conversas() {
  const por = new Map();
  for (const m of store.all('wamsg')) { const c = por.get(m.leadId); if (!c || c.ultima.em < m.em) por.set(m.leadId, { ultima: m, n: 0 }); }
  const ld = lidas();
  for (const m of store.all('wamsg')) if (m.dir === 'in' && (!ld[m.leadId] || m.em > ld[m.leadId])) { const c = por.get(m.leadId); if (c) c.n++; }
  return [...por.entries()].map(([id, c]) => ({ id, lead: store.get('leads', id) || { id, nome: 'Contato removido' }, ...c }))
    .sort((a, b) => b.ultima.em.localeCompare(a.ultima.em));
}
const thread = (id) => store.all('wamsg').filter((m) => m.leadId === id).sort((a, b) => a.em.localeCompare(b.em));
const ultimaEntrada = (id) => thread(id).filter((m) => m.dir === 'in').pop();
const janelaAberta = (id) => { if (conexao?.tipo === 'qr') return true; const u = ultimaEntrada(id); return !!u && Date.now() - new Date(u.em) < 24 * 3600e3; };
const pausado = (l) => l.roboPausadoAte && new Date(l.roboPausadoAte) > new Date();
const resumo = (m) => (m.midia ? ({ image: '📷 ', video: '🎬 ', audio: '🎤 ', document: '📄 ' }[m.midia.tipo] || '📎 ') + (m.texto || m.midia.nome || ({ image: 'Foto', video: 'Vídeo', audio: 'Áudio', document: 'Documento' }[m.midia.tipo])) : m.texto || '');

function lista() {
  const q = busca.trim().toLowerCase();
  const cs = conversas().filter((c) => (filtro === 'naolidas' ? c.n : filtro === 'humano' ? !!c.lead.precisaHumano : true)
    && (!q || `${c.lead.nome} ${c.lead.telefone}`.toLowerCase().includes(q)));
  if (!cs.length) return `<p class="cv-vazio">${q || filtro !== 'todas' ? 'Nada encontrado.' : 'As conversas aparecem aqui assim que o WhatsApp estiver conectado e alguém mandar mensagem.'}</p>`;
  return cs.map((c) => `<button class="cv-it${c.id === atual ? ' on' : ''}" data-cv="${esc(c.id)}">
    <span class="cv-av">${esc(ini(c.lead.nome))}</span>
    <span class="cv-tx"><b>${esc(c.lead.nome || c.lead.telefone || 'Sem nome')}</b><small>${c.ultima.dir === 'out' ? (c.ultima.robo ? 'Robô: ' : 'Você: ') : ''}${esc(resumo(c.ultima)).slice(0, 80)}</small></span>
    <span class="cv-meta"><small>${hora(c.ultima.em)}</small>${c.n ? `<i class="cv-n">${c.n}</i>` : ''}${c.lead.precisaHumano ? '<i class="cv-h" title="Pediu atendente">!</i>' : ''}</span></button>`).join('');
}

function midiaHTML(m) {
  const md = m.midia; const u = urls.get(md.path);
  const src = u ? ` src="${esc(u)}"` : '';
  if (md.tipo === 'image') return `<a class="cv-img" data-path="${esc(md.path)}"${u ? ` href="${esc(u)}" target="_blank" rel="noopener"` : ''}><img alt="Imagem enviada" loading="lazy" data-path="${esc(md.path)}"${src}></a>`;
  if (md.tipo === 'video') return `<video controls preload="metadata" data-path="${esc(md.path)}"${src}></video>`;
  if (md.tipo === 'audio') return `<audio controls preload="none" data-path="${esc(md.path)}"${src}></audio>`;
  return `<a class="cv-doc" data-path="${esc(md.path)}"${u ? ` href="${esc(u)}" target="_blank" rel="noopener"` : ''}>📄 <span>${esc(md.nome || 'Documento')}</span><small>${md.tamanho ? Math.ceil(md.tamanho / 1024) + ' KB' : ''}</small></a>`;
}
const fmt = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
const tick = { sent: '✓', delivered: '✓✓', read: '✓✓', failed: '⚠' };
function bolhas(id) {
  let dia = '';
  return thread(id).map((m) => {
    const d = new Date(m.em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    const sep = d !== dia ? `<p class="cv-dia"><span>${(dia = d)}</span></p>` : '';
    return `${sep}<div class="cv-b ${m.dir}${m.robo ? ' robo' : ''}">${m.robo ? '<span class="cv-por">Robô</span>' : m.dir === 'out' && m.por ? `<span class="cv-por">${esc(m.por)}</span>` : ''}
      ${m.midia ? midiaHTML(m) : ''}${m.texto ? `<p>${fmt(m.texto)}</p>` : ''}
      <small>${new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${m.dir === 'out' ? ` <i class="${m.status === 'read' ? 'read' : m.status === 'failed' ? 'bad' : ''}" title="${esc(m.erro || m.status || '')}">${tick[m.status] || ''}</i>` : ''}</small></div>`;
  }).join('');
}

function cabecalho(l) {
  const jan = janelaAberta(l.id); const oficial = conexao?.tipo !== 'qr';
  return `<header class="cv-head"><button class="icon-btn cv-voltar" data-cvb="voltar" aria-label="Voltar para a lista">${ICON.left}</button>
    <span class="cv-av">${esc(ini(l.nome))}</span><div class="cv-who"><b>${esc(l.nome || 'Sem nome')}</b><small>${esc(l.telefone || '')}${l.etapa ? ' · ' + esc(etapaNome(l.etapa)) : ''}${l.cursoInteresse ? ' · ' + esc(l.cursoInteresse) : ''}</small></div>
    <span class="grow"></span>
    ${oficial ? `<span class="badge ${jan ? 'good' : 'warn'}" title="Regra da Meta">${jan ? 'Janela 24h aberta' : 'Fora das 24h'}</span>` : ''}
    ${pode() ? (pausado(l) ? `<button class="btn sm ghost" data-cvb="robo" title="O robô volta a responder este contato">Devolver ao robô</button>` : `<button class="btn sm ghost" data-cvb="assumir" title="O robô para de responder este contato por 24h">Assumir conversa</button>`) : ''}
    ${store.get('leads', l.id) ? '<button class="btn sm ghost" data-cvb="ficha">Ficha do lead</button>' : ''}</header>`;
}
function compositor(l) {
  if (!pode()) return '<p class="cv-so">Seu perfil só visualiza as conversas.</p>';
  if (l.optOut) return '<p class="cv-so">Este contato pediu para não receber mensagens.</p>';
  const jan = janelaAberta(l.id); const resp = store.settings().respostas || [];
  return `<form class="cv-send" data-cv-form>
    ${anexo ? `<div class="cv-anexo"><span>📎 ${esc(anexo.name)} <small>${Math.ceil(anexo.size / 1024)} KB</small></span><button type="button" class="icon-btn sm" data-cvb="sem-anexo" aria-label="Remover anexo">${ICON.x}</button></div>` : ''}
    ${resp.length && jan ? `<div class="cv-quick">${resp.slice(0, 8).map((r, i) => `<button type="button" class="btn sm" data-q="${i}">${esc(r.titulo)}</button>`).join('')}</div>` : ''}
    <div class="cv-row">
      ${jan ? `<label class="icon-btn cv-clip" title="Anexar foto, vídeo, áudio ou documento" aria-label="Anexar arquivo"><input type="file" data-cv-file accept="image/*,video/mp4,video/3gpp,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></label>` : ''}
      <textarea id="cv-in" rows="1" placeholder="${jan ? (anexo ? 'Legenda (opcional)' : 'Mensagem') : 'Fora da janela de 24h: nome do modelo aprovado (ex.: retomada_contato)'}" aria-label="Mensagem"></textarea>
      <button class="btn primary cv-go" aria-label="Enviar">${ICON.arrow}</button></div>
  </form>`;
}
function painel() {
  const l = atual && (store.get('leads', atual) || { id: atual, nome: 'Contato removido' });
  if (!l) return `<div class="cv-nada"><span class="cv-ico">${ICON.conversas || ICON.chat}</span><b>Escolha uma conversa</b><p class="muted">As mensagens do WhatsApp da escola aparecem aqui em tempo real.</p></div>`;
  return `${cabecalho(l)}<div class="cv-thread" id="cv-thread">${bolhas(l.id)}</div>${compositor(l)}`;
}

export function render(ctx = {}) {
  if (ctx.params?.lead) atual = ctx.params.lead;
  if (store.mode !== 'supabase') return `<section class="card hj-vazio"><h2>Conversas do WhatsApp</h2><p class="muted">Entre com a sua conta e conecte o WhatsApp da escola em Configurações › Integrações para ver e responder as mensagens aqui.</p><a class="btn primary" href="#config?aba=integracoes">Conectar WhatsApp ${ICON.arrow}</a></section>`;
  return `<div class="cv${atual ? ' aberta' : ''}">
    <aside class="cv-lista"><div class="cv-busca"><input type="search" id="cv-q" placeholder="Buscar nome ou telefone" value="${esc(busca)}" aria-label="Buscar conversa"></div>
      <div class="cv-filtros" role="tablist">${[['todas', 'Todas'], ['naolidas', 'Não lidas'], ['humano', 'Pediram atendente']].map(([k, n]) => `<button role="tab" aria-selected="${filtro === k}" data-cvf="${k}">${n}</button>`).join('')}</div>
      <div class="cv-its" id="cv-its">${lista()}</div><p class="cv-con" id="cv-con"></p></aside>
    <section class="cv-painel" id="cv-painel">${painel()}</section></div>`;
}

// ---------- links assinados dos anexos ----------
async function carregarMidias(root) {
  const els = [...root.querySelectorAll('#cv-thread [data-path]')].filter((el) => !el.getAttribute('src') && !el.getAttribute('href'));
  const paths = [...new Set(els.map((el) => el.dataset.path))].filter((p) => !urls.has(p));
  if (paths.length && auth.client) {
    const { data } = await auth.client.storage.from('wa-media').createSignedUrls(paths, 3600);
    (data || []).forEach((d) => d.signedUrl && urls.set(d.path, d.signedUrl));
    setTimeout(() => paths.forEach((p) => urls.delete(p)), 50 * 60e3);
  }
  els.forEach((el) => { const u = urls.get(el.dataset.path); if (!u) return; if (el.tagName === 'A') { el.href = u; el.target = '_blank'; el.rel = 'noopener'; } else el.src = u; });
}

export function mount(root, ctx) {
  if (store.mode !== 'supabase') return;
  const desce = () => { const t = root.querySelector('#cv-thread'); if (t) t.scrollTop = t.scrollHeight; };
  const redesenharPainel = () => { const p = root.querySelector('#cv-painel'); const txt = root.querySelector('#cv-in')?.value || ''; p.innerHTML = painel(); const i = root.querySelector('#cv-in'); if (i) i.value = txt; desce(); carregarMidias(root); };
  const redesenharLista = () => { const b = root.querySelector('#cv-its'); if (b) b.innerHTML = lista(); };
  const abrir = (id) => { atual = id; anexo = null; marcarLida(id); root.querySelector('.cv').classList.add('aberta'); redesenharLista(); redesenharPainel(); history.replaceState(null, '', '#conversas?lead=' + encodeURIComponent(id)); root.querySelector('#cv-in')?.focus(); };
  if (atual) { marcarLida(atual); desce(); carregarMidias(root); }

  // conexão (oficial x QR) para saber das 24h
  auth.client?.from('wa_connections').select('tipo,status').eq('org_id', auth.org?.id).eq('status', 'conectado').limit(1).maybeSingle().then(({ data }) => {
    conexao = data || null; const c = root.querySelector('#cv-con');
    if (c) c.innerHTML = data ? `WhatsApp conectado${data.tipo === 'qr' ? ' por QR Code' : ' (API oficial)'}` : 'WhatsApp não conectado. <a href="#config?aba=integracoes">Conectar</a>';
    if (atual) redesenharPainel();
  });

  async function enviar() {
    const inp = root.querySelector('#cv-in'); const v = inp.value.trim(); const go = root.querySelector('.cv-go');
    if (!atual || (!v && !anexo)) return;
    const jan = janelaAberta(atual);
    const body = { orgId: auth.org?.id, leadId: atual };
    go.disabled = true;
    try {
      if (anexo) {
        if (anexo.size > MAX) throw new Error('Arquivo maior que 16 MB.');
        const ext = (anexo.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase();
        const path = `${auth.org.id}/${new Date().toISOString().slice(0, 7)}/${uid('up_')}.${ext}`;
        toast('Enviando anexo…');
        const { error } = await auth.client.storage.from('wa-media').upload(path, anexo, { contentType: anexo.type || 'application/octet-stream' });
        if (error) throw new Error(/row-level|policy|bucket/i.test(error.message) ? 'Sem permissão para anexos (rode a migração 009).' : error.message);
        body.midia = { path, mime: anexo.type || 'application/octet-stream', nome: anexo.name };
        if (v) body.texto = v;
      } else if (jan) body.texto = v; else body.template = v;
      const { data, error } = await auth.client.functions.invoke('whatsapp-send', { body });
      let msg = data?.error; if (!msg && error) { try { msg = (await error.context?.json?.())?.error; } catch { /* sem corpo */ } }
      if (msg || error) throw new Error(msg || 'Não foi possível enviar.');
      inp.value = ''; inp.style.height = ''; anexo = null; marcarLida(atual); redesenharPainel();
    } catch (e) { toast(e.message, 'bad'); }
    go.disabled = false;
  }

  root.addEventListener('click', (e) => {
    const it = e.target.closest('[data-cv]'); if (it) return abrir(it.dataset.cv);
    const f = e.target.closest('[data-cvf]'); if (f) { filtro = f.dataset.cvf; root.querySelectorAll('[data-cvf]').forEach((x) => x.setAttribute('aria-selected', String(x === f))); return redesenharLista(); }
    const q = e.target.closest('[data-q]'); if (q) { const r = (store.settings().respostas || [])[q.dataset.q]; const l = store.get('leads', atual); const i = root.querySelector('#cv-in'); i.value = String(r?.texto || '').replace(/\{nome\}/gi, String(l?.nome || '').split(' ')[0]); i.focus(); return; }
    const b = e.target.closest('[data-cvb]')?.dataset.cvb;
    if (b === 'voltar') { atual = null; root.querySelector('.cv').classList.remove('aberta'); history.replaceState(null, '', '#conversas'); return redesenharLista(); }
    if (b === 'ficha') { const l = store.get('leads', atual); if (l) editLead(l, ctx); return; }
    if (b === 'sem-anexo') { anexo = null; return redesenharPainel(); }
    if (b === 'assumir' || b === 'robo') {
      const l = store.get('leads', atual); if (!l) return;
      store.put('leads', { ...l, roboPausadoAte: b === 'assumir' ? new Date(Date.now() + 24 * 3600e3).toISOString() : null, precisaHumano: false });
      toast(b === 'assumir' ? 'Você assumiu: o robô fica em silêncio com este contato por 24h.' : 'O robô voltou a atender este contato.');
      return redesenharPainel();
    }
  });
  root.addEventListener('change', (e) => {
    if (!e.target.matches('[data-cv-file]')) return;
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX) { toast('Arquivo maior que 16 MB.', 'bad'); return; }
    anexo = f; redesenharPainel(); root.querySelector('#cv-in')?.focus();
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'cv-q') { busca = e.target.value; return redesenharLista(); }
    if (e.target.id === 'cv-in') { e.target.style.height = ''; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; }
  });
  root.addEventListener('keydown', (e) => { if (e.target.id === 'cv-in' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
  root.addEventListener('submit', (e) => { if (e.target.matches('[data-cv-form]')) { e.preventDefault(); enviar(); } });
  // colar imagem direto (Ctrl+V)
  root.addEventListener('paste', (e) => { if (e.target.id !== 'cv-in') return; const f = [...(e.clipboardData?.files || [])][0]; if (f && janelaAberta(atual)) { anexo = f; redesenharPainel(); } });

  // mensagens novas chegam em tempo real sem perder o que está sendo digitado
  let n0 = store.all('wamsg').length;
  const off = store.on(() => {
    if (!root.isConnected) { off(); return; }
    redesenharLista();
    const n = store.all('wamsg').length;
    if (atual && n !== n0) { const t = root.querySelector('#cv-thread'); const fim = !t || t.scrollHeight - t.scrollTop - t.clientHeight < 120; t && (t.innerHTML = bolhas(atual)); if (fim) desce(); marcarLida(atual); carregarMidias(root); }
    n0 = n;
  });
}
