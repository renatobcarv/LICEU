// Peças comuns das funções de WhatsApp: cifra dos tokens, cliente admin e permissão do usuário.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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
  const { data: c } = await admin.from('wa_connections').select('id, phone_number_id').match({ org_id: orgId, status: 'conectado' }).order('created_at').limit(1).maybeSingle();
  if (c) {
    const { data: cr } = await admin.from('wa_credentials').select('token_cifrado').eq('connection_id', c.id).maybeSingle();
    if (cr) return { phoneId: c.phone_number_id as string, token: await decifrar(cr.token_cifrado), connectionId: c.id as string };
  }
  const token = Deno.env.get('WA_TOKEN'), phoneId = Deno.env.get('WA_PHONE_ID');
  if (token && phoneId && orgId === Deno.env.get('ORG_ID')) return { phoneId, token, connectionId: null };
  return null;
}
