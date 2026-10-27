// Casca do app: navegação, filtro global de período e curso, e troca de módulos.

import { store, initStore, seedIfEmpty } from './store.js';
import { $, $$, esc, today, monthStart, monthEnd, addMonths, addDays, fmtRange } from './util.js';
import { ICON, toast, countUp } from './ui.js';
import { settings } from './metrics.js';
import { initAuth, auth, roleLabel, signOut } from './auth.js';
import { LOGO_MARK, PRODUCT, applyTheme } from './brand.js';
import * as painel from './views/painel.js';
import * as meta from './views/meta.js';
import * as funil from './views/funil.js';
import * as matriculas from './views/matriculas.js';
import * as pauta from './views/pauta.js';
import * as calendario from './views/calendario.js';
import * as metas from './views/metas.js';
import * as quadro from './views/quadro.js';
import * as relatorios from './views/relatorios.js';
import * as config from './views/config.js';

const VIEWS = [
  { id: 'painel', label: 'Painel', title: ['Visão', '*geral'], kicker: 'Do anúncio à matrícula', mod: painel, group: 'Acompanhar' },
  { id: 'meta', label: 'Meta Ads', title: ['Meta', '*Ads'], kicker: 'Mídia paga', mod: meta, group: 'Acompanhar' },
  { id: 'funil', label: 'Funil', title: ['Funil', '*comercial'], kicker: 'Do WhatsApp à matrícula', mod: funil, group: 'Acompanhar' },
  { id: 'matriculas', label: 'Matrículas', title: ['*Matrículas'], kicker: 'Quem comprou', mod: matriculas, group: 'Acompanhar' },
  { id: 'pauta', label: 'Pauta Viral', title: ['Pauta', '*Viral'], kicker: 'Criação de conteúdo', mod: pauta, group: 'Produzir', noPeriod: true },
  { id: 'calendario', label: 'Calendário', title: ['*Calendário', 'editorial'], kicker: 'Planejamento', mod: calendario, group: 'Produzir', noPeriod: true },
  { id: 'metas', label: 'Metas e estratégias', title: ['Metas', 'e', '*estratégias'], kicker: 'Direção', mod: metas, group: 'Decidir', noPeriod: true },
  { id: 'quadro', label: 'Quadro', title: ['Quadro de', '*planejamento'], kicker: 'Pensar e organizar', mod: quadro, group: 'Decidir', noPeriod: true },
  { id: 'relatorios', label: 'Relatórios', title: ['*Relatórios', 'gerenciais'], kicker: 'Prestação de contas', mod: relatorios, group: 'Decidir' },
  { id: 'config', label: 'Configurações', title: ['*Configurações'], kicker: 'Sistema', mod: config, group: 'Sistema', noPeriod: true },
];

// Título com as palavras dentro de máscaras; a palavra com * vira serifada itálica em degradê.
function titleHTML(parts) {
  return parts.map((w, i) => {
    const serif = w.startsWith('*');
    const t = esc(serif ? w.slice(1) : w);
    return `<span class="w"><span class="wi" style="--i:${i}">${serif ? `<em>${t}</em>` : t}</span></span>`;
  }).join(' ');
}

// Liga a entrada em cascata: cada bloco e cada item ganha seu atraso.
function stagger(main) {
  Array.from(main.children).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 6)));
  main.querySelectorAll('.kpis').forEach((g) => Array.from(g.children).forEach((el, j) => el.style.setProperty('--j', j)));
  main.querySelectorAll('.bars-row, .funnel, .goal-mini, .hbars, .diag').forEach((g) => {
    g.querySelectorAll('.bar, .fn-bar, .meter span, .hb-track span').forEach((el, j) => el.style.setProperty('--j', j));
    Array.from(g.children).forEach((el, j) => el.style.setProperty('--j', j));
  });
}

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
  const h = location.hash.replace(/^#/, '');
  const i = h.indexOf('?');
  const id = decodeURIComponent(i < 0 ? h : h.slice(0, i));
  const q = i < 0 ? '' : h.slice(i + 1);
  const params = Object.fromEntries(new URLSearchParams(q));
  const view = VIEWS.find((v) => v.id === (id === 'vendas' ? 'funil' : id)) || VIEWS[0];
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
    setPeriod: (a, b) => { prefs.preset = 'custom'; prefs.from = a; prefs.to = b; savePrefs(); render(); },
    refresh: () => render(),
  };
}

function render() {
  const { view, params } = parseHash();
  current = view;
  $$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.view === view.id ? 'page' : 'false'));
  const entering = lastView !== view.id;
  document.body.dataset.view = view.id;
  if (entering) {
    const h = $('#view-title');
    h.innerHTML = titleHTML(view.title || [view.label]);
    h.setAttribute('aria-label', view.label);
    h.classList.remove('enter-title'); void h.offsetWidth; h.classList.add('enter-title');
    $('#view-kicker').textContent = view.kicker || 'LICEU Intelligence';
  }
  document.title = view.label + ' · ' + PRODUCT;
  $('#filters').hidden = !!view.noPeriod;
  renderFilters();
  const c = ctx(params);
  // Troca o <main> por um novo a cada desenho: os módulos registram eventos nele, e assim
  // os eventos da tela anterior não se acumulam (senão um clique dispararia duas vezes).
  const old = $('#main');
  const main = old.cloneNode(false);
  old.replaceWith(main);
  if (entering) { window.scrollTo(0, 0); lastView = view.id; }
  try {
    main.innerHTML = view.mod.render(c);
    view.mod.mount?.(main, c);
    if (entering) { main.classList.add('enter'); stagger(main); countUp(main); }
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
  $('#nav').innerHTML = groups.map((g) => `<p class="nav-group">${esc(g)}</p>` + VIEWS.filter((v) => v.group === g).map((v) => `<a href="#${v.id}" data-view="${v.id}"><span class="ni">${ICON[v.id]}</span><span>${esc(v.label)}</span></a>`).join('')).join('');
  $('#brand').innerHTML = LOGO_MARK + '<span class="brand-text"><span class="wordmark">LICEU</span><span class="brand-sub">Intelligence</span></span>';
  $('#menu-btn').innerHTML = ICON.menu;
  $('#menu-btn').addEventListener('click', () => $('#app').classList.toggle('nav-open'));
  $('#scrim').addEventListener('click', () => $('#app').classList.remove('nav-open'));
  $('#logout').addEventListener('click', signOut);
  $('#f-preset').addEventListener('change', (e) => { prefs.preset = e.target.value; if (prefs.preset === 'custom') { const p = periodOf({ preset: 'mes' }); prefs.from = prefs.from || p.from; prefs.to = prefs.to || p.to; } savePrefs(); render(); });
  $('#f-curso').addEventListener('change', (e) => { prefs.cursoId = e.target.value; savePrefs(); render(); });
  ['#f-from', '#f-to'].forEach((s) => $(s).addEventListener('change', () => { prefs.from = $('#f-from').value; prefs.to = $('#f-to').value; savePrefs(); render(); }));
  window.addEventListener('hashchange', render);
  const prog = $('#progress');
  const onScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; prog.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0).toFixed(4) + ')'; };
  window.addEventListener('scroll', onScroll, { passive: true });
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
  applyTheme();
  shell();
  $('#main').innerHTML = '<div class="loading">Carregando dados…</div>';
  const session = await initAuth(); // null quando o Supabase não está configurado
  $('#main').innerHTML = '<div class="loading">Carregando dados da unidade…</div>';
  await initStore(session);
  const canWrite = !session || auth.member?.role !== 'leitura';
  // Remove as 3 ideias de exemplo que vinham no início, se ninguém mexeu nelas.
  if (canWrite) ['i_preco', 'i_bot', 'i_form'].forEach((id) => { const i = store.get('ideas', id); if (i && i.status === 'Ideia' && !i.resultado && !i.indicador) store.remove('ideas', id); });
  const seeded = canWrite ? await seedIfEmpty() : false;
  render();
  if (seeded) toast('Unidade pronta. Carregamos os cursos e o calendário de setembro da planilha.');
  if (session && auth.member?.role === 'leitura') toast('Você tem acesso só de leitura.', 'warn');
}

boot();
