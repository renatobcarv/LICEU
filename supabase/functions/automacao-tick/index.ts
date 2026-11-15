// Supabase Edge Function: automacao-tick (o relógio das automações)
// Chamada a cada minuto pelo pg_cron (migração 008). Retoma fluxos em "Esperar" e dispara os gatilhos por tempo
// (lead parou de responder, parado numa etapa, agendado). Publicar SEM JWT; autentica pelo cabeçalho x-tick-token.
// Segredo: AUTOMACAO_TOKEN (o mesmo valor guardado no Vault como automacao_token).
import { adminClient } from '../_shared/wa.ts';
import { contexto, rodarLead } from '../_shared/automacao.ts';
import { disparosTempo } from '../_shared/motor.js';

function igual(a: string, b: string) { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

Deno.serve(async (req) => {
  if (!igual(req.headers.get('x-tick-token') || '', Deno.env.get('AUTOMACAO_TOKEN') || '')) return new Response('forbidden', { status: 403 });
  const admin = adminClient(); const agora = new Date(); const ctxs = new Map<string, any>();
  const ctxDe = async (o: string) => { if (!ctxs.has(o)) ctxs.set(o, await contexto(admin, o)); return ctxs.get(o); };
  let retomados = 0, disparados = 0;

  // 1. Fluxos esperando o tempo passar
  const { data: esperando } = await admin.from('records').select('org_id, id').eq('collection', 'autoexec').eq('data->fluxo->>aguardando', 'tempo').lte('data->fluxo->>retomarEm', agora.toISOString()).limit(200);
  for (const e of esperando || []) { try { await rodarLead(admin, e.org_id, await ctxDe(e.org_id), e.id, { tipo: 'tempo' }); retomados++; } catch (er) { console.warn('retomar', (er as Error).message); } }

  // 2. Gatilhos por tempo
  const { data: auts } = await admin.from('records').select('org_id').eq('collection', 'automacoes').in('data->gatilho->>tipo', ['sem_resposta', 'parado_etapa', 'agendado']).eq('data->>ativo', 'true');
  for (const orgId of [...new Set((auts || []).map((a: any) => a.org_id))]) {
    const ctx = await ctxDe(orgId as string);
    const { data: ls } = await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'leads' });
    const leads = (ls || []).map((r: any) => ({ ...r.data, id: r.id }));
    const desde = new Date(agora.getTime() - 5 * 864e5).toISOString();
    const { data: ms } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'wamsg' }).gte('updated_at', desde);
    const ultimas = new Map();
    for (const m of (ms || []).map((r: any) => r.data)) { const u = ultimas.get(m.leadId); if (!u || u.em < m.em) ultimas.set(m.leadId, { dir: m.dir, em: m.em }); }
    const { data: ss } = await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'autoexec' });
    const sts = new Map((ss || []).map((r: any) => [r.id, r.data]));
    for (const d of disparosTempo({ auts: ctx.auts, regras: ctx.regras, leads, ultimas, sts, agora }).slice(0, 100)) {
      try { await rodarLead(admin, orgId as string, ctx, d.lead.id, { tipo: 'gatilho', autId: d.aut.id }); disparados++; } catch (er) { console.warn('gatilho', (er as Error).message); }
    }
  }
  return new Response(JSON.stringify({ ok: true, retomados, disparados }), { headers: { 'Content-Type': 'application/json' } });
});
