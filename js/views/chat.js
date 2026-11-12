// Chat do time, no estilo Discord/Teams: canais à esquerda, mensagens no centro, menções e reações.
// Mensagens ficam na coleção "chat"; com Supabase elas chegam em tempo real para todo mundo da escola.

import { store } from '../store.js';
import { esc, today } from '../util.js';
import { openDialog, toast } from '../ui.js';
import { myName } from '../leads.js';
import { FUNCOES } from './time.js';

const PADRAO = [
  { id: 'geral', nome: 'geral', desc: 'Conversa do time inteiro' },
  { id: 'vendas', nome: 'vendas', desc: 'Leads, fechamentos e cobranças' },
  { id: 'marketing', nome: 'marketing', desc: 'Campanhas, criativos e pautas' },
  { id: 'vitorias', nome: 'vitórias', desc: 'Comemore cada matrícula' },
];
const REACOES = ['🔥', '👏', '🚀', '😂', '✅'];
const canais = () => [...PADRAO, ...(store.settings().chatCanais || [])];
const LSK = 'flowclass.chat.nome';
const eu = () => myName() || (() => { try { return localStorage.getItem(LSK) || ''; } catch { return ''; } })();
let atual = 'geral';

const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dia = (iso) => { const d = iso.slice(0, 10); return d === today() ? 'Hoje' : d.split('-').reverse().join('/'); };
const membro = (n) => store.all('team').find((m) => m.nome.trim().toLowerCase() === String(n).trim().toLowerCase());
const cor = (n) => { const f = FUNCOES[membro(n)?.funcao]; if (f) return [f.a, f.b]; let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return [`hsl(${h} 85% 62%)`, `hsl(${(h + 40) % 360} 85% 55%)`]; };
const ini = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
// Texto seguro: escapa tudo e só depois destaca @menções e links.
const fmt = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/(^|\s)@([\wÀ-ú]+)/g, (m, s, n) => `${s}<span class="mention${n.toLowerCase() === eu().split(' ')[0].toLowerCase() ? ' me' : ''}">@${n}</span>`);

function msgs() { return store.all('chat').filter((m) => (m.canal || 'geral') === atual).sort((a, b) => a.em.localeCompare(b.em)).slice(-200); }

function lista() {
  const ms = msgs(); let last = null, lastDia = null;
  if (!ms.length) return `<div class="ch-empty"><b>#${esc(canais().find((c) => c.id === atual)?.nome || atual)}</b><p>Nenhuma mensagem ainda. Comece a conversa.</p></div>`;
  return ms.map((m) => {
    const d = dia(m.em); const sep = d !== lastDia ? `<div class="ch-day"><span>${d}</span></div>` : ''; lastDia = d;
    const junto = last && last.autor === m.autor && (new Date(m.em) - new Date(last.em)) < 5 * 60e3 && !sep; last = m;
    const [a, b] = cor(m.autor); const f = FUNCOES[membro(m.autor)?.funcao];
    const rs = Object.entries(m.reacoes || {}).filter(([, v]) => v.length);
    return `${sep}<div class="ch-msg${junto ? ' cont' : ''}" data-id="${m.id}" tabindex="0">
      ${junto ? '<span class="ch-gutter"></span>' : `<div class="ch-av" style="--a:${a};--b:${b}">${esc(ini(m.autor))}</div>`}
      <div class="ch-body">${junto ? '' : `<p class="ch-meta"><b style="color:${a}">${esc(m.autor)}</b>${f ? `<span class="ch-tag" style="--a:${a}">${esc(f.nome)}</span>` : ''}<small>${hora(m.em)}</small></p>`}
        <p class="ch-txt">${fmt(m.texto)}</p>
        ${rs.length ? `<div class="ch-reacts">${rs.map(([e, v]) => `<button class="ch-r${v.includes(eu()) ? ' on' : ''}" data-react="${e}" title="${esc(v.join(', '))}">${e} ${v.length}</button>`).join('')}</div>` : ''}
      </div>
      <div class="ch-tools">${REACOES.map((e) => `<button data-react="${e}" aria-label="Reagir ${e}">${e}</button>`).join('')}${m.autor === eu() ? '<button data-apagar aria-label="Apagar">🗑</button>' : ''}</div>
    </div>`;
  }).join('');
}

export const autoRefresh = false; // o chat se atualiza sozinho sem perder o que você está digitando

export function render(ctx = {}) {
  if (ctx.params?.canal) atual = ctx.params.canal;
  const c = canais().find((x) => x.id === atual) || canais()[0]; atual = c.id;
  const time = store.all('team').filter((m) => m.ativo !== false);
  return `<div class="chat">
    <aside class="ch-side">
      <p class="ch-sec">Canais <button class="icon-btn sm" data-novo-canal aria-label="Novo canal">+</button></p>
      <nav>${canais().map((x) => `<button class="ch-chan${x.id === atual ? ' on' : ''}" data-canal="${x.id}"><span>#</span>${esc(x.nome)}</button>`).join('')}</nav>
      <p class="ch-sec">Time · ${time.length}</p>
      <ul class="ch-people">${time.map((m) => { const f = FUNCOES[m.funcao] || {}; return `<li><span class="ch-av sm" style="--a:${f.a};--b:${f.b}">${esc(ini(m.nome))}</span><span>${esc(m.nome)}<small>${esc(f.nome || '')}</small></span></li>`; }).join('') || '<li class="muted">Cadastre o time na tela Time.</li>'}</ul>
    </aside>
    <section class="ch-main">
      <header class="ch-head"><b># ${esc(c.nome)}</b><span class="muted">${esc(c.desc || '')}</span></header>
      <div class="ch-list" id="ch-list" aria-live="polite">${lista()}</div>
      <form class="ch-form" id="ch-form" autocomplete="off">
        <textarea id="ch-in" rows="1" placeholder="Mensagem em #${esc(c.nome)} · use @nome para chamar alguém" maxlength="2000"></textarea>
        <button class="ch-send" type="submit" aria-label="Enviar">➤</button>
      </form>
    </section>
  </div>`;
}

function pedirNome(depois) {
  openDialog({ title: 'Como você aparece no chat?', saveLabel: 'Entrar no chat', fields: [{ name: 'nome', label: 'Seu nome', required: true, full: true, list: 'dl-tm' }],
    html: `<datalist id="dl-tm">${store.all('team').map((m) => `<option value="${esc(m.nome)}">`).join('')}</datalist>`,
    onSave: (d) => { try { localStorage.setItem(LSK, d.nome.trim()); } catch { /* sem armazenamento */ } setTimeout(depois, 50); } });
}

export function mount(root, ctx) {
  const ir = (id) => ctx.go('#chat?canal=' + encodeURIComponent(id));
  const scroll = () => { const l = root.querySelector('#ch-list'); if (l) l.scrollTop = l.scrollHeight; };
  scroll();
  const input = root.querySelector('#ch-in');
  const enviar = () => {
    const t = input.value.trim(); if (!t) return;
    if (!eu()) return pedirNome(enviar);
    store.put('chat', { canal: atual, autor: eu(), texto: t, em: new Date().toISOString(), reacoes: {} });
    input.value = ''; input.style.height = '';
  };
  root.querySelector('#ch-form').addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(160, input.scrollHeight) + 'px'; });
  root.addEventListener('click', (e) => {
    const ch = e.target.closest('[data-canal]'); if (ch) return ir(ch.dataset.canal);
    if (e.target.closest('[data-novo-canal]')) return openDialog({ title: 'Novo canal', saveLabel: 'Criar', fields: [{ name: 'nome', label: 'Nome do canal', required: true }, { name: 'desc', label: 'Sobre o quê?' }],
      onSave: (d) => { const id = d.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'); const st = store.settings(); store.put('settings', { ...st, id: 'main', chatCanais: [...(st.chatCanais || []), { id, nome: d.nome.toLowerCase(), desc: d.desc }] }); setTimeout(() => ir(id), 60); } });
    const msg = e.target.closest('[data-id]'); if (!msg) return;
    const m = store.get('chat', msg.dataset.id); if (!m) return;
    const r = e.target.closest('[data-react]');
    if (r) { if (!eu()) return pedirNome(() => {}); const rs = { ...(m.reacoes || {}) }; const v = rs[r.dataset.react] || []; rs[r.dataset.react] = v.includes(eu()) ? v.filter((x) => x !== eu()) : [...v, eu()]; store.put('chat', { ...m, reacoes: rs }); }
    if (e.target.closest('[data-apagar]')) { store.remove('chat', m.id); toast('Mensagem apagada.'); }
  });
  // Mensagens novas (suas ou do time, via nuvem) entram sem redesenhar a tela inteira.
  const off = store.on(() => {
    if (!root.isConnected) { off(); return; }
    const l = root.querySelector('#ch-list'); if (!l) return;
    const fim = l.scrollHeight - l.scrollTop - l.clientHeight < 80;
    l.innerHTML = lista(); if (fim) scroll();
  });
}
