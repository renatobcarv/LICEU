// Supabase Edge Function: whatsapp-webhook
// Recebe as mensagens da API oficial do WhatsApp (Cloud API da Meta) e:
//  1. cria o lead no Funil quando o número ainda não existe (origem "Meta Ads" quando veio de anúncio
//     de clique para WhatsApp, com o nome do anúncio e o ctwa_clid);
//  2. grava cada mensagem na coleção `wamsg`, que o app mostra na conversa do lead.
// Publicar SEM verificação de JWT (a Meta não manda token do Supabase):
//   npx supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref <ref>
// Segredos: WA_VERIFY_TOKEN (você inventa), WA_APP_SECRET (do app da Meta). ORG_ID só no modo de número único.
// Multiempresa: a empresa sai do phone_number_id de cada mensagem (tabela wa_connections), nunca de variável fixa.
// Idempotência: cada mensagem da Meta é gravada em wa_events uma vez só (a Meta reenvia em caso de demora).
// A assinatura X-Hub-Signature-256 é conferida: sem ela, nada é gravado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const enc = new TextEncoder();
async function assinaturaOk(raw: string, sig: string | null, secret: string) {
  if (!sig?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(raw)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  const a = sig.slice(7); if (a.length !== hex.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ hex.charCodeAt(i);
  return d === 0;
}
const chave = (t: string) => String(t || '').replace(/\D/g, '').replace(/^55/, '').slice(-11);
const texto = (m: any) => m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title
  || (m.type === 'image' ? '📷 Imagem' : m.type === 'audio' ? '🎤 Áudio' : m.type === 'document' ? '📄 Documento' : m.type === 'video' ? '🎬 Vídeo' : m.type === 'location' ? '📍 Localização' : `[${m.type}]`);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Verificação do webhook (feita uma vez pela Meta ao salvar a URL).
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === Deno.env.get('WA_VERIFY_TOKEN');
    return ok ? new Response(url.searchParams.get('hub.challenge') || '', { status: 200 }) : new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('ok');
  const raw = await req.text();
  const secret = Deno.env.get('WA_APP_SECRET') || Deno.env.get('META_APP_SECRET');
  if (!secret) return new Response('config', { status: 500 });
  if (!(await assinaturaOk(raw, req.headers.get('x-hub-signature-256'), secret))) return new Response('assinatura', { status: 401 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = JSON.parse(raw || '{}');
  const now = new Date().toISOString(); const hoje = now.slice(0, 10);
  const out: any[] = [];
  const cacheOrg = new Map<string, string | null>();
  const cacheLeads = new Map<string, Map<string, any>>();
  const orgDoNumero = async (pid: string) => {
    if (!cacheOrg.has(pid)) {
      const { data } = await admin.from('wa_connections').select('org_id').eq('phone_number_id', pid).maybeSingle();
      cacheOrg.set(pid, data?.org_id || (pid === Deno.env.get('WA_PHONE_ID') ? Deno.env.get('ORG_ID') || null : null));
    }
    return cacheOrg.get(pid);
  };
  const leadsDa = async (orgId: string) => {
    if (!cacheLeads.has(orgId)) {
      const { data } = await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'leads' });
      cacheLeads.set(orgId, new Map((data || []).map((r: any) => [chave(r.data?.telefone), r])));
    }
    return cacheLeads.get(orgId)!;
  };

  for (const e of body.entry || []) for (const ch of e.changes || []) {
    const v = ch.value || {};
    const orgId = await orgDoNumero(v.metadata?.phone_number_id || '');
    if (!orgId) { console.warn('número sem empresa', v.metadata?.phone_number_id); continue; }
    const porTel = await leadsDa(orgId);
    const nomes = new Map((v.contacts || []).map((c: any) => [c.wa_id, c.profile?.name]));
    for (const m of v.messages || []) {
      // Já processada? (reenvio da Meta)
      const { error: dup } = await admin.from('wa_events').insert({ id: String(m.id), org_id: orgId });
      if (dup) continue;
      const k = chave(m.from); let lead = porTel.get(k);
      if (!lead) {
        const ref = m.referral || {};
        const id = 'wa_' + k;
        const data = { id, nome: nomes.get(m.from) || m.from, telefone: m.from, entrada: hoje, etapa: 'novo', etapaFunil: 'novo', funilId: 'principal', etapaMax: 0,
          origem: ref.source_type === 'ad' ? 'Meta Ads' : 'WhatsApp', anuncio: ref.headline || '', ctwaClid: ref.ctwa_clid || '', adId: ref.source_id || '',
          historico: [{ data: hoje, etapa: 'novo', col: 'novo' }], viaApi: true, createdAt: now, updatedAt: now };
        lead = { id, data }; porTel.set(k, lead);
        out.push({ org_id: orgId, collection: 'leads', id, data, updated_at: now });
      }
      const mid = 'wm_' + String(m.id).replace(/[^a-zA-Z0-9]/g, '').slice(-40);
      out.push({ org_id: orgId, collection: 'wamsg', id: mid, data: { id: mid, leadId: lead.id, dir: 'in', texto: texto(m), em: new Date(Number(m.timestamp) * 1000).toISOString(), waId: m.id, createdAt: now, updatedAt: now }, updated_at: now });
    }
    for (const s of v.statuses || []) {
      const mid = 'wm_' + String(s.id).replace(/[^a-zA-Z0-9]/g, '').slice(-40);
      const { data: r } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'wamsg', id: mid }).maybeSingle();
      if (r) out.push({ org_id: orgId, collection: 'wamsg', id: mid, data: { ...r.data, status: s.status, erro: s.errors?.[0]?.title || undefined, updatedAt: now }, updated_at: now });
    }
  }
  if (out.length) { const { error } = await admin.from('records').upsert(out); if (error) return new Response(error.message, { status: 500 }); }
  return new Response('ok'); // a Meta só precisa do 200
});
