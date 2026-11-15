// Supabase Edge Function: automacao-entrada (webhook de entrada, como no n8n/Zapier)
// Um sistema de fora (formulário do site, planilha, n8n, Zapier) faz POST com JSON e dispara uma automação.
// URL: /functions/v1/automacao-entrada?o=<empresa>&a=<automação>&k=<token da automação>   (gerada na tela)
// Corpo aceito: { nome, telefone, email, curso, origem, ...extras }. Cria ou atualiza o lead pelo telefone e roda o fluxo.
// Publicar SEM JWT. O token é por automação (trocável na tela) e comparado em tempo constante.
import { adminClient } from '../_shared/wa.ts';
import { contexto, rodarLead } from '../_shared/automacao.ts';

function igual(a: string, b: string) { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const r = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const chave = (t: string) => String(t || '').replace(/\D/g, '').replace(/^55/, '').slice(-11);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return r({ error: 'use POST' }, 405);
  const u = new URL(req.url); const orgId = u.searchParams.get('o') || '', autId = u.searchParams.get('a') || '';
  if (!/^[0-9a-f-]{36}$/i.test(orgId) || !autId) return r({ error: 'url inválida' }, 400);
  const admin = adminClient();
  const { data: ar } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'automacoes', id: autId }).maybeSingle();
  const a = ar?.data;
  if (!a || a.gatilho?.tipo !== 'webhook' || !igual(u.searchParams.get('k') || '', String(a.gatilho.token || ''))) return r({ error: 'não autorizado' }, 403);
  if (!a.ativo) return r({ ok: false, motivo: 'automação desligada' }, 409);
  const raw = await req.text(); if (raw.length > 20000) return r({ error: 'corpo grande demais' }, 413);
  let b: any; try { b = JSON.parse(raw || '{}'); } catch { return r({ error: 'JSON inválido' }, 400); }
  const tel = String(b.telefone || b.phone || b.whatsapp || '').replace(/\D/g, '');
  if (tel.length < 10) return r({ error: 'informe telefone com DDD' }, 400);
  const k = chave(tel); const now = new Date().toISOString(); const hoje = now.slice(0, 10);
  const { data: ls } = await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'leads' });
  const achado = (ls || []).find((x: any) => chave(x.data?.telefone) === k);
  const txt = (v: unknown, n = 200) => (v == null ? undefined : String(v).slice(0, n));
  const extras = Object.fromEntries(Object.entries(b).filter(([c]) => !['telefone', 'phone', 'whatsapp'].includes(c)).slice(0, 20).map(([c, v]) => [c.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40), txt(typeof v === 'object' ? JSON.stringify(v) : v, 500)]));
  const id = achado?.id || 'wh_' + k;
  const base = achado?.data || { id, telefone: tel, entrada: hoje, etapa: 'novo', etapaFunil: 'novo', funilId: 'principal', etapaMax: 0, historico: [{ data: hoje, etapa: 'novo', col: 'novo' }], createdAt: now, origem: txt(b.origem, 60) || 'Webhook' };
  const data = { ...base, ...(b.nome ? { nome: txt(b.nome, 120) } : {}), ...(b.email ? { email: txt(b.email, 120) } : {}), ...(b.curso ? { cursoInteresse: txt(b.curso, 120) } : {}), entradaWebhook: { ...(base.entradaWebhook || {}), ...extras }, nome: txt(b.nome, 120) || base.nome || tel, updatedAt: now };
  await admin.from('records').upsert({ org_id: orgId, collection: 'leads', id, data, updated_at: now });
  await rodarLead(admin, orgId, await contexto(admin, orgId), id, { tipo: 'gatilho', autId });
  return r({ ok: true, leadId: id, novo: !achado });
});
