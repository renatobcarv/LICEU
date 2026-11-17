// Peças comuns das funções de WhatsApp: cifra dos tokens, cliente admin e permissão do usuário.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { guardarMidia } from './midia.ts';

export const GRAPH = 'https://graph.facebook.com/v21.0';
export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
export const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
export const adminClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Cliente com o JWT de quem chamou: as regras do banco (RLS, can_coll, my_role) valem como no app. */
export const userClient = (req: Request) => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });

// AES-GCM com WA_ENC_KEY (32 bytes em base64). O banco só guarda "iv.cifra" em base64.
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function chave() {
  const k = Deno.env.get('WA_ENC_KEY'); if (!k) throw new Error('WA_ENC_KEY não configurada');
  return crypto.subtle.importKey('raw', unb64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function cifrar(txt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(), new TextEncoder().encode(txt)));
  return b64(iv) + '.' + b64(c);
}
export async function decifrar(s: string) {
  const [iv, c] = s.split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await chave(), unb64(c)));
}

/** Número e token da empresa. Sem conexão própria, usa o número único das variáveis (modo escola local). */
export async function credenciaisDaEmpresa(admin: SupabaseClient, orgId: string) {
  const { data: c } = await admin.from('wa_connections').select('id, phone_number_id, tipo, instancia').match({ org_id: orgId, status: 'conectado' }).order('created_at').limit(1).maybeSingle();
  if (c?.tipo === 'qr') return { tipo: 'qr' as const, instancia: c.instancia as string, connectionId: c.id as string, phoneId: '', token: '' };
  if (c) {
    const { data: cr } = await admin.from('wa_credentials').select('token_cifrado').eq('connection_id', c.id).maybeSingle();
    if (cr) return { phoneId: c.phone_number_id as string, token: await decifrar(cr.token_cifrado), connectionId: c.id as string };
  }
  const token = Deno.env.get('WA_TOKEN'), phoneId = Deno.env.get('WA_PHONE_ID');
  if (token && phoneId && orgId === Deno.env.get('ORG_ID')) return { phoneId, token, connectionId: null };
  return null;
}

// ---------- Evolution API (conexão por QR Code, não oficial) ----------
// Servidor próprio (Docker numa VPS). Segredos: EVO_URL (https://...), EVO_KEY (apikey global), EVO_WEBHOOK_TOKEN.
export const instanciaDa = (orgId: string) => 'klasso_' + orgId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
export async function evo(path: string, method = 'GET', body?: unknown) {
  const base = (Deno.env.get('EVO_URL') || '').replace(/\/$/, ''), key = Deno.env.get('EVO_KEY');
  if (!base || !key) throw new Error('Servidor do QR Code não configurado (EVO_URL/EVO_KEY).');
  const r = await fetch(base + path, { method, headers: { apikey: key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.response?.message?.toString?.() || j?.message || `Evolution ${r.status}`);
  return j;
}

// Grava mensagens da Evolution (webhook ou recuperação): cria lead novo e a conversa. Idempotente por wa_events.
const chaveTel = (t: string) => String(t || '').replace(/\D/g, '').replace(/^55/, '').slice(-11);
const textoEvo = (m: any = {}) => m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption || m.buttonsResponseMessage?.selectedDisplayText
  || (m.imageMessage ? '📷 Imagem' : m.audioMessage ? '🎤 Áudio' : m.documentMessage ? '📄 Documento' : m.videoMessage ? '🎬 Vídeo' : m.locationMessage ? '📍 Localização' : m.stickerMessage ? 'Figurinha' : '[mensagem]');
const MIDIA = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'documentWithCaptionMessage'];
/** Baixa o anexo de uma mensagem da Evolution e guarda no Storage. Falha não impede gravar a mensagem. */
async function midiaEvo(admin: SupabaseClient, orgId: string, inst: string | null, d: any) {
  const msg = d.message || {}; const k = MIDIA.find((x) => msg[x]); if (!k || !inst) return undefined;
  const info = k === 'documentWithCaptionMessage' ? msg[k]?.message?.documentMessage || {} : msg[k];
  try {
    const j = await evo(`/chat/getBase64FromMediaMessage/${inst}`, 'POST', { message: { key: { id: d.key.id } }, convertToMp4: false });
    if (!j?.base64) return undefined;
    return await guardarMidia(admin, orgId, j.base64, j.mimetype || info.mimetype || 'application/octet-stream', j.fileName || info.fileName || '');
  } catch (e) { console.warn('mídia', (e as Error).message); return undefined; }
}
export async function ingerirEvo(admin: SupabaseClient, orgId: string, lista: any[], connId?: string) {
  let inst: string | null = null;
  if (connId) inst = (await admin.from('wa_connections').select('instancia').eq('id', connId).maybeSingle()).data?.instancia || null;
  const now = new Date().toISOString(); const out: any[] = []; let ls: any[] | null = null; let novos = 0, msgs = 0;
  const eventos: { leadId: string; texto: string; novo: boolean }[] = [];
  const ord = [...lista].sort((a, b) => Number(a?.messageTimestamp || 0) - Number(b?.messageTimestamp || 0));
  for (const d of ord) {
    const jid = String(d?.key?.remoteJid || '');
    if (!jid.endsWith('@s.whatsapp.net') || !d?.key?.id) continue; // ignora grupos, status e listas
    const { error: dup } = await admin.from('wa_events').insert({ id: 'evo_' + d.key.id, org_id: orgId });
    if (dup) continue;
    const num = jid.split('@')[0]; const k = chaveTel(num); const fromMe = !!d.key.fromMe;
    if (!ls) ls = (await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'leads' })).data || [];
    let lead = ls.find((r: any) => chaveTel(r.data?.telefone) === k); const eraNovo = !lead;
    const em = d.messageTimestamp ? new Date(Number(d.messageTimestamp) * 1000).toISOString() : now;
    if (!lead) {
      if (fromMe) continue; // mensagem que a escola mandou para quem não é lead: não cria lead
      const dia = em.slice(0, 10), id = 'wa_' + k;
      const data = { id, nome: d.pushName || num, telefone: num, entrada: dia, etapa: 'novo', etapaFunil: 'novo', funilId: 'principal', etapaMax: 0,
        origem: 'WhatsApp', historico: [{ data: dia, etapa: 'novo', col: 'novo' }], viaApi: true, viaQr: true, createdAt: now, updatedAt: now };
      lead = { id, data }; ls.push(lead); novos++; out.push({ org_id: orgId, collection: 'leads', id, data, updated_at: now });
    }
    const mid = 'wm_' + String(d.key.id).replace(/[^a-zA-Z0-9]/g, '').slice(-40);
    const midia = await midiaEvo(admin, orgId, inst, d);
    const txt = textoEvo(d.message?.documentWithCaptionMessage?.message || d.message);
    out.push({ org_id: orgId, collection: 'wamsg', id: mid, data: { id: mid, leadId: lead.id, dir: fromMe ? 'out' : 'in', texto: midia && /^(📷|🎤|📄|🎬) /.test(txt) ? '' : txt, ...(midia ? { midia } : {}), em, waId: d.key.id, ...(fromMe ? { por: 'Celular', status: 'sent' } : {}), createdAt: now, updatedAt: now }, updated_at: now });
    msgs++;
    if (!fromMe) eventos.push({ leadId: lead.id, texto: txt, novo: eraNovo });
    else { // alguém do time respondeu pelo celular: o robô se cala neste contato por 24h
      lead.data = { ...lead.data, roboPausadoAte: new Date(Date.now() + 24 * 3600e3).toISOString(), updatedAt: now };
      out.push({ org_id: orgId, collection: 'leads', id: lead.id, data: lead.data, updated_at: now });
    }
  }
  if (out.length) { const { error } = await admin.from('records').upsert(out); if (error) throw new Error(error.message); }
  if (connId) await admin.from('wa_connections').update({ ultima_sync: now }).eq('id', connId);
  return { novos, msgs, eventos };
}

/** Recuperação: busca no servidor do QR as mensagens desde a última sincronização (com folga de 10 min) e grava o que faltou.
 *  Cobre o tempo em que o servidor ou o webhook ficou fora do ar. Exige a Evolution com banco (DATABASE_ENABLED=true). */
export async function recuperarEvo(admin: SupabaseClient, cx: { id: string; org_id: string; instancia: string; ultima_sync?: string | null; conectado_em?: string | null }) {
  const desde = Math.floor(new Date(cx.ultima_sync || cx.conectado_em || Date.now() - 7 * 864e5).getTime() / 1000) - 600;
  const achadas: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const j = await evo(`/chat/findMessages/${cx.instancia}`, 'POST', { where: { messageTimestamp: { gte: desde } }, page, offset: 100 });
    const recs = j?.messages?.records || (Array.isArray(j) ? j : []);
    achadas.push(...recs.filter((m: any) => Number(m?.messageTimestamp || 0) >= desde));
    if (!recs.length || page >= Number(j?.messages?.pages || 1)) break;
  }
  return ingerirEvo(admin, cx.org_id, achadas, cx.id);
}
