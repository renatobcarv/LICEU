// Camada de dados. Todos os módulos leem e gravam aqui, então um lead cadastrado
// no WhatsApp aparece na hora no Painel, no Meta Ads, nas Metas e no Relatório.
//
// Três modos de armazenamento, mesma interface:
//  - "supabase": produção (Vercel). Cada unidade tem seus registros, protegidos por login e RLS.
//  - "nuvem": quando a página roda como Artifact no claude.ai com o banco compartilhado (db).
//  - "local": navegador (localStorage). Para testar sem configurar nada.
// Em qualquer modo, Configurações > Backup exporta e importa tudo em JSON.

import { uid } from './util.js';

export const COLLECTIONS = [
  'settings',  // configuração geral (doc único "main")
  'courses',   // cursos e preço
  'campaigns', // campanhas de mídia (Meta, Google)
  'adStats',   // métricas importadas ou digitadas por campanha/anúncio e período
  'leads',     // contatos do WhatsApp e o funil comercial
  'turmas',    // turmas com vagas e meta
  'calendar',  // publicações, gravações, campanhas, tarefas
  'stories',   // controle diário de stories (id = data)
  'weekly',    // resultados semanais (id = segunda-feira da semana)
  'pautas',    // pautas e briefings da Pauta Viral
  'goals',     // metas
  'funnels',   // funis planejados
  'ideas',     // ideias, testes e melhorias
  'reports',   // relatórios salvos
  'imports',   // histórico de importações
];

const LS_KEY = 'liceu.intelligence.v1';
const mem = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const listeners = new Set();
let mode = 'local';
let db = null;
let sb = null;      // cliente Supabase
let orgId = null;   // unidade ativa
let saveTimer = null;
let notifyTimer = null;

function notify() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }), 30);
}

function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
function lsSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(dump())); }
    catch (e) { console.warn('Não foi possível salvar no navegador', e); store.lastError = 'Não foi possível salvar no navegador. Exporte um backup em Configurações.'; notify(); }
  }, 150);
}

function loadInto(data) {
  COLLECTIONS.forEach((c) => {
    mem[c].clear();
    (data?.[c] || []).forEach((r) => r && r.id && mem[c].set(r.id, r));
  });
}

export function dump() {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, Array.from(mem[c].values())]));
}

function sbError(e) {
  console.error(e);
  store.lastError = /row-level security|permission|42501/i.test(e?.message || e?.code || '')
    ? 'Seu acesso é só de leitura. Peça ao administrador para mudar seu papel.'
    : 'Uma alteração não foi salva (' + (e?.message || 'erro de conexão') + '). Confira a internet e tente de novo.';
  notify();
}

function writeRemote(coll, rec, del) {
  if (mode === 'supabase') {
    const q = del
      ? sb.from('records').delete().match({ org_id: orgId, collection: coll, id: rec.id })
      : sb.from('records').upsert({ org_id: orgId, collection: coll, id: rec.id, data: rec, updated_at: new Date().toISOString() });
    q.then(({ error }) => error && sbError(error));
    return;
  }
  if (mode !== 'cloud' || !db) return;
  const ref = db.doc(coll + '/' + rec.id);
  (del ? ref.delete() : ref.set(rec)).catch((e) => {
    console.error(e);
    store.lastError = e?.code === 'not_granted' || e?.code === 'permission_denied'
      ? 'Você tem acesso só de leitura. Peça acesso de edição ao dono do painel.'
      : 'Uma alteração não foi salva na nuvem (' + (e?.code || 'erro') + '). Tente de novo.';
    notify();
  });
}

export const store = {
  lastError: null,
  get mode() { return mode; },
  all(coll) { return Array.from(mem[coll].values()); },
  get(coll, id) { return mem[coll].get(id) || null; },
  settings() { return mem.settings.get('main') || { id: 'main' }; },
  isEmpty() { return COLLECTIONS.every((c) => mem[c].size === 0); },
  put(coll, rec) {
    const r = { ...rec, id: rec.id || uid(coll.slice(0, 2) + '_'), updatedAt: new Date().toISOString() };
    if (!r.createdAt) r.createdAt = r.updatedAt;
    mem[coll].set(r.id, r);
    if (mode === 'local') lsSave(); else writeRemote(coll, r);
    notify();
    return r;
  },
  putMany(coll, recs) {
    const out = recs.map((rec) => {
      const r = { ...rec, id: rec.id || uid(coll.slice(0, 2) + '_'), updatedAt: new Date().toISOString() };
      if (!r.createdAt) r.createdAt = r.updatedAt;
      mem[coll].set(r.id, r);
      if (mode === 'cloud') writeRemote(coll, r);
      return r;
    });
    if (mode === 'local') lsSave();
    if (mode === 'supabase') {
      for (let i = 0; i < out.length; i += 500) {
        sb.from('records').upsert(out.slice(i, i + 500).map((r) => ({ org_id: orgId, collection: coll, id: r.id, data: r, updated_at: r.updatedAt })))
          .then(({ error }) => error && sbError(error));
      }
    }
    notify();
    return out;
  },
  remove(coll, id) {
    const r = mem[coll].get(id);
    if (!r) return;
    mem[coll].delete(id);
    if (mode === 'local') lsSave(); else writeRemote(coll, r, true);
    notify();
  },
  removeWhere(coll, pred) {
    this.all(coll).filter(pred).forEach((r) => {
      mem[coll].delete(r.id);
      if (mode !== 'local') writeRemote(coll, r, true);
    });
    if (mode === 'local') lsSave();
    notify();
  },
  // Substitui tudo (restaurar backup). Na nuvem, apaga e regrava documento a documento.
  replaceAll(data) {
    const old = dump();
    loadInto(data);
    if (mode === 'local') { lsSave(); notify(); return; }
    // Apaga só o que não existe no backup, para não correr risco de apagar o que acabou de ser gravado.
    COLLECTIONS.forEach((c) => {
      const keep = new Set(this.all(c).map((r) => r.id));
      old[c].filter((r) => !keep.has(r.id)).forEach((r) => writeRemote(c, r, true));
      if (mode === 'supabase') this.putMany(c, this.all(c));
      else this.all(c).forEach((r) => writeRemote(c, r));
    });
    notify();
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

// Inicia o armazenamento. Com login Supabase, usa o banco da unidade; dentro do claude.ai,
// o banco compartilhado do Artifact; senão, o navegador.
export async function initStore(session) {
  if (session?.client && session?.org) {
    sb = session.client; orgId = session.org.id; mode = 'supabase';
    COLLECTIONS.forEach((c) => mem[c].clear());
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('records').select('collection,id,data').eq('org_id', orgId).range(from, from + 999);
      if (error) { sbError(error); break; }
      data.forEach((r) => mem[r.collection]?.set(r.id, { ...r.data, id: r.id }));
      if (data.length < 1000) break;
    }
    // Tempo real: o que outra pessoa da equipe salva aparece aqui sem recarregar.
    sb.channel('records-' + orgId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'org_id=eq.' + orgId }, (p) => {
        if (p.eventType === 'DELETE') { const o = p.old || {}; if (o.org_id && o.org_id !== orgId) return; mem[o.collection]?.delete(o.id); }
        else { const n = p.new; mem[n.collection]?.set(n.id, { ...n.data, id: n.id }); }
        notify();
      })
      .subscribe();
    return mode;
  }
  const hasClaude = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';
  if (hasClaude) {
    try { db = await window.claude.use('db'); } catch (e) { db = null; }
  }
  if (db) {
    mode = 'cloud';
    await Promise.all(COLLECTIONS.map((c) => new Promise((resolve) => {
      let first = true;
      const done = () => { if (first) { first = false; resolve(); } };
      try {
        db.collection(c).onSnapshot((snap) => {
          mem[c].clear();
          snap.docs.forEach((d) => { const v = d.data(); if (v) mem[c].set(d.id, { ...v, id: d.id }); });
          done();
          notify();
        }, (e) => { console.error(c, e); store.lastError = 'Falha ao ler ' + c + ' da nuvem.'; done(); notify(); });
      } catch (e) { console.error(e); done(); }
      setTimeout(done, 8000);
    })));
    return mode;
  }
  mode = 'local';
  loadInto(lsGet());
  return mode;
}

// Primeira abertura: carrega os dados reais da planilha de setembro e a configuração inicial.
export async function seedIfEmpty() {
  if (!store.isEmpty()) return false;
  let seed = null;
  try { const r = await fetch('data/seed.json', { cache: 'no-store' }); if (r.ok) seed = await r.json(); } catch (e) { seed = null; }
  if (!seed) return false;
  COLLECTIONS.forEach((c) => { if (seed[c]?.length) store.putMany(c, seed[c]); });
  return true;
}
