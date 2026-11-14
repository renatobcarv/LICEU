// Peças de interface compartilhadas: janela de edição, aviso, campos, gráficos e download.

import { esc, $, $$, num } from './util.js';

// ---------- aviso rápido ----------
let toastTimer;
export function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

// ---------- janela de edição ----------
// fields: [{name, label, type, options, value, required, full, hint, placeholder, step}]
export function field(f) {
  if (f.type === 'section') return `<h3 class="form-sec">${esc(f.label)}</h3>`;
  const id = 'f_' + f.name;
  const req = f.required ? ' required' : '';
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
  const v = f.value ?? '';
  let input;
  if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}"${req}>${(f.options || []).map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}"${req}${ph}>${esc(v)}</textarea>`;
  } else if (f.type === 'checkbox') {
    return `<label class="check-field${f.full ? ' full' : ''}"><input type="checkbox" id="${id}" name="${f.name}"${v ? ' checked' : ''}> ${esc(f.label)}</label>`;
  } else {
    const t = f.type || 'text';
    const extra = t === 'number' ? ` step="${f.step || 'any'}" inputmode="decimal"${f.allowNegative ? '' : ' min="0"'}` : '';
    input = `<input type="${t}" id="${id}" name="${f.name}" value="${esc(v)}"${req}${ph}${extra}${f.list ? ` list="${f.list}"` : ''}>`;
  }
  return `<div class="field${f.full ? ' full' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${input}${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}</div>`;
}

export function readForm(form) {
  const out = {};
  $$('input,select,textarea', form).forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value.trim();
  });
  return out;
}

// Abre a janela. onSave(data, form) devolve false para manter aberta. extra = HTML adicional.
export function openDialog({ title, fields = [], html = '', saveLabel = 'Salvar', onSave, onDelete, deleteLabel = 'Excluir', wide = false, onOpen }) {
  const dlg = $('#dlg');
  dlg.className = wide ? 'wide' : '';
  dlg.innerHTML = `
    <form method="dialog" class="dlg-form" novalidate>
      <header class="dlg-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${ICON.x}</button></header>
      <div class="dlg-body"><div class="form-grid">${fields.map(field).join('')}</div>${html}</div>
      <p class="form-error" role="alert" hidden></p>
      <footer class="dlg-foot">
        ${onDelete ? `<button type="button" class="btn danger" data-del>${esc(deleteLabel)}</button>` : ''}
        <span class="grow"></span>
        <button type="button" class="btn" data-close>Cancelar</button>
        ${onSave ? `<button type="submit" class="btn primary">${esc(saveLabel)}</button>` : ''}
      </footer>
    </form>`;
  const form = $('form', dlg);
  const err = $('.form-error', dlg);
  let armed = false;
  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const missing = $$('[required]', form).filter((el) => !el.value.trim());
    if (missing.length) { err.textContent = 'Preencha: ' + missing.map((el) => $(`label[for="${el.id}"]`, form)?.textContent.replace('*', '').trim()).join(', ') + '.'; err.hidden = false; missing[0].focus(); return; }
    const res = onSave(readForm(form), form);
    if (res !== false) dlg.close();
  });
  const del = $('[data-del]', dlg);
  if (del) del.addEventListener('click', () => {
    if (!armed) { armed = true; del.textContent = 'Confirmar exclusão'; return; }
    onDelete(); dlg.close();
  });
  dlg.showModal();
  if (onOpen) onOpen(form, dlg);
  const first = $('input:not([type=hidden]),select,textarea', form);
  if (first && !onOpen) first.focus();
  return { dlg, form, err };
}

// Botão de confirmação em dois toques (o navegador do Artifact bloqueia confirm()).
export function confirmButton(btn, label = 'Confirmar') {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1';
  const old = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 4000);
  return false;
}

// ---------- gráficos ----------
// Barras verticais com rótulo do valor no topo de cada barra, eixo na base e dica ao passar o mouse.
export function barChart(data, { valueKey, fmt = num, label = '', height = 140 } = {}) {
  if (!data.length) return '<p class="empty-sm">Sem dados no período.</p>';
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  return `<figure class="bars" style="--h:${height}px" role="img" aria-label="${esc(label)}: ${data.map((d) => d.label + ' ' + fmt(d[valueKey])).join(', ')}">
    <div class="bars-grid" aria-hidden="true">${ticks.slice().reverse().map((t) => `<span><i>${fmt(t)}</i></span>`).join('')}</div>
    <div class="bars-row">${data.map((d) => { const v = d[valueKey] || 0; return `<div class="bar-col" tabindex="0"><div class="bar-tip">${esc(d.label)} · ${esc(fmt(v))}</div><div class="bar" style="height:${(v / top) * 100}%"></div><span class="bar-x">${esc(d.label)}</span></div>`; }).join('')}</div>
  </figure>`;
}

function niceTicks(max) {
  const raw = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [0];
  while (out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}

// Funil horizontal: uma barra por etapa, largura proporcional à primeira, com a taxa da etapa anterior.
export function funnel(stages, { highlight = -1 } = {}) {
  const base = stages[0]?.count || 0;
  return `<ol class="funnel">${stages.map((s, i) => {
    const prev = i ? stages[i - 1].count : null;
    const rate = i && prev ? Math.round((s.count / prev) * 100) + '%' : i ? '—' : 'base';
    const w = base ? Math.max(2, (s.count / base) * 100) : 0;
    return `<li class="${i === highlight ? 'hl' : ''}"><div class="fn-top"><span class="fn-name">${esc(s.label)}</span><span class="fn-val"><b>${num(s.count)}</b> <small>${i ? 'da etapa anterior: ' : ''}${rate}</small></span></div><div class="fn-track"><div class="fn-bar" style="width:${w}%"></div></div>${s.source ? `<span class="fn-src">${esc(s.source)}</span>` : ''}</li>`;
  }).join('')}</ol>`;
}

export function meter(p, cls = '') {
  const w = Math.max(0, Math.min(1, p || 0)) * 100;
  return `<div class="meter ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(w)}"><span style="width:${w}%"></span></div>`;
}

export const badge = (txt, cls = '') => `<span class="badge ${cls}">${esc(txt)}</span>`;

export function empty(title, text, actions = '') {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${actions ? `<div class="row-actions">${actions}</div>` : ''}</div>`;
}

// ---------- escolha de dia (mini calendário) ----------
// Mostra o mês com a quantidade de itens já agendados em cada dia. onPick(data) ao tocar num dia.
export function dayPicker(el, { value, markers = () => 0, onPick }) {
  const DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const p2 = (n) => String(n).padStart(2, '0');
  const isoD = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const todayIso = isoD(new Date());
  let sel = value;
  let m = new Date((value || todayIso) + 'T12:00:00'); m.setDate(1);
  const draw = () => {
    const first = new Date(m), wd = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - wd);
    const cells = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); if (i >= 34 && d.getMonth() !== m.getMonth()) break; }
    el.innerHTML = `<div class="dp-head"><button type="button" class="icon-btn" data-dpn="-1" aria-label="Mês anterior">${ICON.left}</button><b>${MES[m.getMonth()]} ${m.getFullYear()}</b><button type="button" class="icon-btn" data-dpn="1" aria-label="Próximo mês">${ICON.right}</button></div>
      <div class="dp-grid">${DOW.map((d) => `<span class="dp-dow">${d}</span>`).join('')}${cells.map((d) => { const iso = isoD(d); const n = markers(iso); return `<button type="button" class="dp-day${d.getMonth() !== m.getMonth() ? ' out' : ''}${iso === todayIso ? ' today' : ''}${iso === sel ? ' sel' : ''}${iso < todayIso ? ' past' : ''}" data-dpd="${iso}" aria-pressed="${iso === sel}" aria-label="${d.getDate()} de ${MES[d.getMonth()]}${n ? ', ' + n + (n > 1 ? ' itens' : ' item') : ''}">${d.getDate()}${n ? `<i>${'•'.repeat(Math.min(n, 3))}</i>` : ''}</button>`; }).join('')}</div>`;
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.dpn) { m.setMonth(m.getMonth() + Number(b.dataset.dpn)); draw(); return; }
    if (b.dataset.dpd) { sel = b.dataset.dpd; draw(); onPick?.(sel); }
  });
  draw();
}

// ---------- contadores ----------
// Os números dos cartões contam de zero até o valor quando a tela abre.
export function countUp(root) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('.kpi-v, .big, .stats dd, .mh-num').forEach((el, k) => {
    const node = Array.from(el.childNodes).find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!node || /\d\/\d/.test(node.nodeValue)) return;
    const m = node.nodeValue.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
    if (!m) return;
    const raw = m[0];
    const dec = raw.includes(',') ? raw.split(',')[1].length : 0;
    const val = Number(raw.replace(/\./g, '').replace(',', '.'));
    if (!val) return;
    const pre = node.nodeValue.slice(0, m.index), post = node.nodeValue.slice(m.index + raw.length);
    const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const t0 = performance.now() + k * 40, dur = 1100;
    const step = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      node.nodeValue = pre + fmt.format(val * e) + post;
      if (p < 1 && node.isConnected) requestAnimationFrame(step);
    };
    node.nodeValue = pre + fmt.format(0) + post;
    requestAnimationFrame(step);
  });
}

// ---------- arquivos ----------
// Dentro do claude.ai o download passa pela confirmação do próprio claude.ai; fora dele, link comum.
export async function downloadFile(filename, data, type = 'text/plain') {
  try {
    if (window.claude?.use) {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename, data }); return true; }
    }
  } catch (e) {
    if (e?.code === 'cancelled' || e?.code === 'declined') return false;
  }
  try {
    const blob = new Blob([data], { type: type + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return true;
  } catch (e) {
    toast('Não foi possível baixar. Use o botão Copiar.', 'bad');
    return false;
  }
}

export async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); toast('Copiado.'); return true; }
  catch (e) {
    if (fallbackEl) { const r = document.createRange(); r.selectNodeContents(fallbackEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('Texto selecionado. Copie com Ctrl+C.', 'warn');
    return false;
  }
}

export function readFileText(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(file); });
}

// ---------- ícones (traço, herdam a cor do texto) ----------
const svg = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICON = {
  hoje: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  painel: svg('<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>'),
  meta: svg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'),
  funil: svg('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
  matriculas: svg('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
  pauta: svg('<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
  calendario: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  metas: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  relatorios: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  config: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  arsenal: svg('<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'),
  time: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>'),
  chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>'),
  f_reels: svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>'),
  f_carrossel: svg('<rect x="5" y="5" width="11" height="14" rx="2"/><path d="M19 7v10M22 9v6"/>'),
  f_stories: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.2"/><circle cx="12" cy="12" r="4.5"/>'),
  f_post: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 15l4.5-4 4 3.5 3-2.5L20 15"/><circle cx="15.5" cy="8.5" r="1.5"/>'),
  f_motion: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15c2-5 4-5 5 0s3 5 5 0"/>'),
  f_live: svg('<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9M4.5 4.5a10.5 10.5 0 0 0 0 15M19.5 4.5a10.5 10.5 0 0 1 0 15"/>'),
  f_arte: svg('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'),
  ideia: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>'),
  fogo: svg('<path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.2 2.2-5.2 3.6-7 .4 1.8 1.4 2.8 2.3 3.1-.4-3.4 1.2-6 3.1-7.9.3 3 1.9 4.6 3 6.2 1 1.4 1.5 2.9 1.5 4.6C19 18.3 16.1 21 12 21Z"/>'),
  olho: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
  agenda: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  raio: svg('<path d="M13 2.5 4.5 13.5H11l-1 8L18.5 10.5H12z"/>'),
  medalha: svg('<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 9.8 6 3h4l2 4.5L14 3h4l-2.5 6.8M12 12.3l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>'),
  lixo: svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
  ia: svg('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  left: svg('<path d="m15 18-6-6 6-6"/>'),
  right: svg('<path d="m9 18 6-6-6-6"/>'),
  campanhas: svg('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>'),
  quadro: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6.5" y="6.5" width="5" height="5" rx="1"/><path d="M14 8h4M14 12h4M7 15.5h11"/>'),
  menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};

// Linha (SVG): pontos com rótulo do valor no topo, eixo com poucas datas, dica ao passar.
export function lineChart(data, { fmt = num, height = 180, label = '' } = {}) {
  if (!data.length) return '<p class="empty-sm">Sem dados no período.</p>';
  const W = 480, H = height, pl = 28, pr = 10, pt = 18, pb = 24;
  const max = Math.max(1, ...data.map((d) => d.v || 0));
  const x = (i) => pl + (data.length === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (data.length - 1));
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const real = data.filter((d) => !d.futuro);
  const path = real.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.v || 0).toFixed(1)).join(' ');
  const area = real.length ? path + ` L${x(real.length - 1).toFixed(1)} ${H - pb} L${x(0).toFixed(1)} ${H - pb} Z` : '';
  const step = Math.max(1, Math.ceil(data.length / 7));
  const grid = [0, 0.5, 1].map((r) => `<line x1="${pl}" x2="${W - pr}" y1="${y(max * r)}" y2="${y(max * r)}" class="lc-grid"/><text x="${pl - 6}" y="${y(max * r) + 4}" class="lc-ax" text-anchor="end">${esc(fmt(Math.round(max * r)))}</text>`).join('');
  return `<figure class="lc" role="img" aria-label="${esc(label)}: ${data.map((d) => d.label + ' ' + fmt(d.v)).join(', ')}"><svg viewBox="0 0 ${W} ${H}">${grid}
    ${area ? `<path d="${area}" class="lc-area"/><path d="${path}" class="lc-line"/>` : ''}
    ${real.map((d, i) => `<g class="lc-pt"><circle cx="${x(i)}" cy="${y(d.v || 0)}" r="${d.v ? 3.5 : 2}"/>${d.v ? `<text x="${x(i)}" y="${y(d.v) - 8}" text-anchor="middle" class="lc-v">${esc(fmt(d.v))}</text>` : ''}<title>${esc(d.label)}: ${esc(fmt(d.v))}</title></g>`).join('')}
    ${data.map((d, i) => (i % step === 0 || i === data.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="lc-ax">${esc(d.label)}</text>` : '')).join('')}
  </svg></figure>`;
}

// Rosca (SVG) com legenda em lista: cores na ordem das séries do sistema.
export function donut(items, { fmt = num, label = '' } = {}) {
  const total = items.reduce((a, it) => a + (it.v || 0), 0);
  if (!total) return '<p class="empty-sm">Sem dados no período.</p>';
  const cores = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--warning)', 'var(--chart-4)'];
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  const arcs = items.map((it, i) => { const frac = (it.v || 0) / total; const a = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${cores[i % cores.length]}" stroke-width="18" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 70 70)"><title>${esc(it.label)}: ${esc(fmt(it.v))}</title></circle>`; acc += frac; return a; }).join('');
  return `<div class="donut" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 140 140" width="140" height="140"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--muted)" stroke-width="18"/>${arcs}<text x="70" y="68" text-anchor="middle" class="dn-n">${esc(fmt(total))}</text><text x="70" y="86" text-anchor="middle" class="dn-l">total</text></svg>
    <ul class="dn-leg">${items.map((it, i) => `<li><span class="dn-sw" style="background:${cores[i % cores.length]}"></span><span>${esc(it.label)}</span><b>${esc(fmt(it.v))}</b><small>${Math.round(((it.v || 0) / total) * 100)}%</small></li>`).join('')}</ul></div>`;
}
