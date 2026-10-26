// Funções pequenas usadas por todos os módulos: formatação, datas, CSV e HTML.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const div = (a, b) => (b ? a / b : null);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- números ----------
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const NA = '—';
export const num = (v) => (v === null || v === undefined || Number.isNaN(v) ? NA : nf0.format(v));
export const num1 = (v) => (v === null || v === undefined || Number.isNaN(v) ? NA : nf1.format(v));
export const brl = (v) => (v === null || v === undefined || Number.isNaN(v) ? NA : 'R$ ' + nf0.format(v));
export const brl2 = (v) => (v === null || v === undefined || Number.isNaN(v) ? NA : 'R$ ' + nf2.format(v));
export const pct = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? NA : (v * 100).toFixed(d).replace('.', ',') + '%');

// Lê números no formato brasileiro ou americano: "1.234,56", "1,234.56", "R$ 12,30", "3,5%".
export function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/R\$|\s|%/g, '');
  if (!s || s === '-' || s === '—') return null;
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma >= 0) s = s.replace(/,/g, '');
  else if (lastComma >= 0 && lastDot < 0) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- datas (sempre 'AAAA-MM-DD', horário local) ----------
export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => iso(new Date());
export const toDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const inRange = (s, from, to) => !!s && s.slice(0, 10) >= from && s.slice(0, 10) <= to;
export const monthStart = (s) => s.slice(0, 8) + '01';
export const monthEnd = (s) => { const d = toDate(monthStart(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); };
export const addMonths = (s, n) => { const d = toDate(monthStart(s)); d.setMonth(d.getMonth() + n); return iso(d); };
export const weekStart = (s) => { const d = toDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const monthName = (s) => MESES[toDate(s).getMonth()];
export const fmtDate = (s) => { if (!s) return NA; const d = toDate(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); };
export const fmtDateLong = (s) => { if (!s) return NA; const d = toDate(s); return d.getDate() + ' ' + MES3[d.getMonth()] + ' ' + d.getFullYear(); };
export const fmtDow = (s) => DIAS[toDate(s).getDay()];
export const fmtRange = (a, b) => {
  const A = toDate(a), B = toDate(b);
  if (A.getFullYear() === B.getFullYear() && A.getMonth() === B.getMonth()) return A.getDate() + ' a ' + B.getDate() + ' de ' + MESES[A.getMonth()] + ' ' + A.getFullYear();
  return fmtDateLong(a) + ' a ' + fmtDateLong(b);
};
export const DOW_HEAD = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

// Lê datas vindas de planilhas: 2026-09-02, 02/09/2026, 2/9/26.
export function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + pad(m[2]) + '-' + pad(m[1]); }
  return null;
}

// ---------- CSV ----------
// Aceita vírgula, ponto e vírgula ou tab; respeita aspas. Devolve {headers, rows:[{}]}.
export function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const out = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) out.push(row);
  if (!out.length) return { headers: [], rows: [] };
  const headers = out[0].map((h) => h.trim());
  const rows = out.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { headers, rows };
}

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function toCSV(rows, cols) {
  const q = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.map((c) => q(c.label)).join(';'), ...rows.map((r) => cols.map((c) => q(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(';'))].join('\n');
}

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
export const phoneKey = (s) => { const d = onlyDigits(s); return d.length > 11 && d.startsWith('55') ? d.slice(2) : d; };
