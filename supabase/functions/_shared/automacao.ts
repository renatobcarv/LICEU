// Adaptador do motor (motor.js) para o servidor: carrega automações e regras, guarda o estado por lead
// (coleção autoexec), aplica mudanças no lead, envia pelo WhatsApp, chama a IA e faz chamadas HTTP seguras.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { processar } from './motor.js';
import { enviarTexto } from './enviar.ts';
import { respostaBot } from './ia-bot.ts';

export async function contexto(admin: SupabaseClient, orgId: string) {
  const { data } = await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'automacoes' });
  const auts = (data || []).filter((r: any) => r.id !== '_regras').map((r: any) => ({ ...r.data, id: r.id })).filter((a: any) => a.ativo);
  const regras: any = { ...((data || []).find((r: any) => r.id === '_regras')?.data || {}) };
  const { data: org } = await admin.from('orgs').select('nome').eq('id', orgId).maybeSingle();
  regras.escola = regras.escola || org?.nome || 'nossa escola';
  const { data: cx } = await admin.from('wa_connections').select('tipo').match({ org_id: orgId, status: 'conectado' }).limit(1).maybeSingle();
  if (cx?.tipo === 'qr') regras.maxPorLeadDia = Math.min(Number(regras.maxPorLeadDia || 8), 4); // QR: teto menor, menos risco de bloqueio
  const { data: cs } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'courses' });
  const cursos = (cs || []).map((r: any) => r.data).filter((c: any) => c?.nome && c.ativo !== false)
    .map((c: any) => `- ${c.nome}${c.preco ? ` (R$ ${c.preco})` : ''}${c.duracao ? `, ${c.duracao}` : ''}${c.descricao ? `: ${String(c.descricao).slice(0, 200)}` : ''}`).join('\n');
  return { auts, regras, cursos, temAlgo: auts.length > 0 };
}

// Chamada HTTP de saída: só https, sem endereços internos, 10 s, resposta até 50 KB.
const PRIVADO = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1|\[?f[cd])/i;
async function httpSeguro(a: { url: string; metodo: string; corpo: string }) {
  const u = new URL(a.url);
  if (u.protocol !== 'https:' || PRIVADO.test(u.hostname) || u.hostname.endsWith('.supabase.co') || u.hostname.endsWith('.internal')) throw new Error('endereço não permitido (use https público)');
  const metodo = ['GET', 'POST', 'PUT', 'PATCH'].includes(a.metodo) ? a.metodo : 'POST';
  const r = await fetch(u, { method: metodo, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Klasso-Automacoes/1' }, body: metodo === 'GET' ? undefined : a.corpo, signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = (await r.text()).slice(0, 50000);
  try { return JSON.parse(t); } catch { return t; }
}

async function rodizio(admin: SupabaseClient, orgId: string) {
  const { data } = await admin.from('members').select('nome, role').eq('org_id', orgId).in('role', ['sales', 'support']);
  const nomes = (data || []).map((m: any) => m.nome).filter(Boolean).sort();
  if (!nomes.length) return '';
  const { data: rg } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'automacoes', id: '_rodizio' }).maybeSingle();
  const i = ((rg?.data?.i ?? -1) + 1) % nomes.length; const now = new Date().toISOString();
  await admin.from('records').upsert({ org_id: orgId, collection: 'automacoes', id: '_rodizio', data: { id: '_rodizio', i, updatedAt: now }, updated_at: now });
  return nomes[i];
}

/** Roda o motor para um lead e grava tudo. ev: {tipo:'msg', texto, novo} | {tipo:'tempo'} | {tipo:'gatilho', autId}. */
export async function rodarLead(admin: SupabaseClient, orgId: string, ctx: any, leadId: string, ev: any) {
  const { data: lr } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'leads', id: leadId }).maybeSingle();
  if (!lr) return;
  let lead = { ...lr.data, id: leadId };
  const { data: sr } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'autoexec', id: leadId }).maybeSingle();
  const salvarLead = async () => { const now = new Date().toISOString(); lead.updatedAt = now; await admin.from('records').upsert({ org_id: orgId, collection: 'leads', id: leadId, data: lead, updated_at: now }); };
  const io = {
    enviar: (t: string) => enviarTexto(admin, orgId, lead, t, 'Robô'),
    lead: async (p: any) => { lead = { ...lead, ...p }; await salvarLead(); },
    notificar: async (t: string) => { const now = new Date().toISOString(); const id = 'auto_' + crypto.randomUUID().slice(0, 12); await admin.from('records').upsert({ org_id: orgId, collection: 'chat', id, data: { id, canal: 'geral', autor: 'Robô Klasso', texto: t, em: now, reacoes: {}, robo: true, createdAt: now, updatedAt: now }, updated_at: now }); },
    rodizio: () => rodizio(admin, orgId),
    ia: async (a: any) => { const r = await respostaBot({ ...a, escola: ctx.regras.escola, cursos: ctx.cursos }); await admin.rpc('add_usage', { o: orgId, m: 'ia', n: 1 }); return r; },
    http: (a: any) => httpSeguro(a),
  };
  const r = await processar({ auts: ctx.auts, regras: ctx.regras, st: sr?.data || {}, lead, ev, io });
  const now = new Date().toISOString();
  await admin.from('records').upsert({ org_id: orgId, collection: 'autoexec', id: leadId, data: { ...r.st, id: leadId, leadId, updatedAt: now }, updated_at: now });
  if (r.disparou) await admin.rpc('add_usage', { o: orgId, m: 'automacoes', n: 1 });
}

/** Mensagens recebidas (webhook oficial ou QR): roda as automações de cada lead, em ordem. */
export async function aoReceber(admin: SupabaseClient, orgId: string, eventos: { leadId: string; texto: string; novo: boolean }[]) {
  if (!eventos.length) return;
  const ctx = await contexto(admin, orgId);
  const { data: rg } = await admin.from('records').select('id').match({ org_id: orgId, collection: 'automacoes', id: '_regras' }).maybeSingle();
  if (!ctx.temAlgo && !rg) return; // empresa sem automações: nada a fazer
  for (const e of eventos) { try { await rodarLead(admin, orgId, ctx, e.leadId, { tipo: 'msg', texto: e.texto, novo: e.novo }); } catch (er) { console.warn('automação', (er as Error).message); } }
}

/** Roda sem segurar a resposta do webhook (a Meta e a Evolution só esperam o 200). */
export function emSegundoPlano(p: Promise<unknown>) {
  const t = p.catch((e) => console.warn('segundo plano', e?.message));
  (globalThis as any).EdgeRuntime?.waitUntil?.(t);
  return t;
}
