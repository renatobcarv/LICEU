// Casca do app: navegação, filtro global de período e curso, e troca de módulos.

import { store, initStore, seedIfEmpty } from './store.js';
import { $, $$, esc, today, monthStart, monthEnd, addMonths, addDays, fmtRange } from './util.js';
import { ICON, toast } from './ui.js';
import { settings } from './metrics.js';
import { initAuth, auth, roleLabel, signOut } from './auth.js';
import { LOGO_MARK, PRODUCT, THEMES, getTheme, applyTheme } from './brand.js';
import * as painel from './views/painel.js';
import * as meta from './views/meta.js';
import * as vendas from './views/vendas.js';
import * as pauta from './views/pauta.js';
import * as calendario from './views/calendario.js';
import * as metas from './views/metas.js';
import * as relatorios from './views/relatorios.js';
import * as config from './views/config.js';

const VIEWS = [
  { id: 'painel', label: 'Painel', mod: painel, group: 'Acompanhar' },
  { id: 'meta', label: 'Meta Ads', mod: meta, group: 'Acompanhar' },
  { id: 'vendas', label: 'WhatsApp e vendas', mod: vendas, group: 'Acompanhar' },
  { id: 'pauta', label: 'Pauta Viral', mod: pauta, group: 'Produzir', noPeriod: true },
  { id: 'calendario', label: 'Calendário', mod: calendario, group: 'Produzir', noPeriod: true },
  { id: 'metas', label: 'Metas e estratégias', mod: metas, group: 'Decidir', noPeriod: true },
  { id: 'relatorios', label: 'Relatórios', mod: relatorios, group: 'Decidir' },
  { id: 'config', label: 'Configurações', mod: config, group: 'Sistema', noPeriod: true },
];

const PREF_KEY = 'liceu.intelligence.prefs';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } }
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* opcional */ } }
const prefs = { preset: 'mes', from: '', to: '', cursoId: '', ...loadPrefs() };

function periodOf(p) {
  const t = today();
  switch (p.preset) {
    case 'mesAnt': { const s = addMonths(t, -1); return { from: s, to: monthEnd(s) }; }
    case '7d': return { from: addDays(t, -6), to: t };
    case '30d': return { from: addDays(t, -29), to: t };
    case '90d': return { from: addDays(t, -89), to: t };
    case 'custom': if (p.from && p.to && p.from <= p.to) return { from: p.from, to: p.to }; // senão cai no mês
    // falls through
    default: return { from: monthStart(t), to: monthEnd(t) };
  }
}

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [id, q = ''] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(q));
  const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
  return { view, params };
}

let current = null;
let renderPending = false;
let lastView = null;

function ctx(params) {
  const { from, to } = periodOf(prefs);
  return {
    from, to, cursoId: prefs.cursoId, params,
    f: { cursoId: prefs.cursoId },
    go: (hash) => { if (location.hash === hash) render(); else location.hash = hash; },
    refresh: () => render(),
  };
}

function render() {
  const { view, params } = parseHash();
  current = view;
  $$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.view === view.id ? 'page' : 'false'));
  $('#view-title').textContent = view.label;
  document.title = view.label + ' · ' + PRODUCT;
  $('#filters').hidden = !!view.noPeriod;
  renderFilters();
  const c = ctx(params);
  // Troca o <main> por um novo a cada desenho: os módulos registram eventos nele, e assim
  // os eventos da tela anterior não se acumulam (senão um clique dispararia duas vezes).
  const old = $('#main');
  const main = old.cloneNode(false);
  old.replaceWith(main);
  if (lastView !== view.id) { window.scrollTo(0, 0); lastView = view.id; }
  try {
    main.innerHTML = view.mod.render(c);
    view.mod.mount?.(main, c);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty"><h3>Algo deu errado neste módulo</h3><p>${esc(e.message)}</p><p>Seus dados estão salvos. Recarregue a página ou exporte um backup em Configurações.</p></div>`;
  }
  $('#app').classList.remove('nav-open');
  renderStatus();
}

function renderFilters() {
  const { from, to } = periodOf(prefs);
  const courses = store.all('courses').filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
  $('#f-preset').value = prefs.preset;
  $('#f-curso').innerHTML = '<option value="">Todos os cursos</option>' + courses.map((c) => `<option value="${esc(c.id)}"${c.id === prefs.cursoId ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
  $('#f-custom').hidden = prefs.preset !== 'custom';
  $('#f-from').value = from; $('#f-to').value = to;
  $('#f-range').textContent = fmtRange(from, to);
}

function renderStatus() {
  const s = settings();
  $('#unit-name').textContent = store.mode === 'supabase' ? auth.org?.nome || s.unidade : s.unidade;
  const el = $('#store-status');
  const MSG = {
    supabase: ['Dados na nuvem da unidade', 'Salvos no Supabase. Toda a equipe vê as mesmas informações em tempo real.'],
    cloud: ['Dados salvos na nuvem do claude.ai', 'Todos que abrirem este painel veem os mesmos dados.'],
    local: ['Modo de teste: dados só neste navegador', 'Configure o Supabase para login e dados na nuvem. Exporte um backup em Configurações.'],
  }[store.mode];
  el.textContent = MSG[0];
  el.title = MSG[1];
  if (store.mode === 'supabase') {
    $('#user-line').hidden = false;
    $('#user-line').textContent = (auth.member?.nome || auth.user?.email || '') + ' · ' + roleLabel(auth.member?.role);
    $('#logout').hidden = false;
  }
  if (store.lastError) { toast(store.lastError, 'bad'); store.lastError = null; }
}

function shell() {
  const groups = [...new Set(VIEWS.map((v) => v.group))];
  $('#nav').innerHTML = groups.map((g) => `<p class="nav-group">${esc(g)}</p>` + VIEWS.filter((v) => v.group === g).map((v) => `<a href="#${v.id}" data-view="${v.id}">${ICON[v.id]}<span>${esc(v.label)}</span></a>`).join('')).join('');
  $('#brand').innerHTML = LOGO_MARK + '<span class="brand-text"><span class="wordmark">LICEU</span><span class="brand-sub">Intelligence</span></span>';
  $('#menu-btn').innerHTML = ICON.menu;
  $('#menu-btn').addEventListener('click', () => $('#app').classList.toggle('nav-open'));
  $('#scrim').addEventListener('click', () => $('#app').classList.remove('nav-open'));
  const ts = $('#theme-select');
  ts.innerHTML = THEMES.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
  ts.value = getTheme();
  ts.addEventListener('change', () => { applyTheme(ts.value); if (current?.id === 'config') render(); });
  $('#logout').addEventListener('click', signOut);
  $('#f-preset').addEventListener('change', (e) => { prefs.preset = e.target.value; if (prefs.preset === 'custom') { const p = periodOf({ preset: 'mes' }); prefs.from = prefs.from || p.from; prefs.to = prefs.to || p.to; } savePrefs(); render(); });
  $('#f-curso').addEventListener('change', (e) => { prefs.cursoId = e.target.value; savePrefs(); render(); });
  ['#f-from', '#f-to'].forEach((s) => $(s).addEventListener('change', () => { prefs.from = $('#f-from').value; prefs.to = $('#f-to').value; savePrefs(); render(); }));
  window.addEventListener('hashchange', render);
  // Mudanças vindas de outra pessoa (nuvem) ou de outra tela redesenham, mas nunca no meio de uma digitação.
  store.on(() => {
    if (current?.mod.autoRefresh === false) { renderStatus(); return; }
    const busy = $('#dlg').open || (document.activeElement && $('#main').contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    if (busy) { renderPending = true; return; }
    render();
  });
  $('#dlg').addEventListener('close', () => { if (renderPending) { renderPending = false; render(); } });
}

async function boot() {
  applyTheme(getTheme());
  shell();
  $('#main').innerHTML = '<div class="loading">Carregando dados…</div>';
  const session = await initAuth(); // null quando o Supabase não está configurado
  $('#main').innerHTML = '<div class="loading">Carregando dados da unidade…</div>';
  await initStore(session);
  const canWrite = !session || auth.member?.role !== 'leitura';
  const seeded = canWrite ? await seedIfEmpty() : false;
  render();
  if (seeded) toast('Unidade pronta. Carregamos os cursos e o calendário de setembro da planilha.');
  if (session && auth.member?.role === 'leitura') toast('Você tem acesso só de leitura.', 'warn');
}

boot();
