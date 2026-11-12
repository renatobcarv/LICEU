// Supabase Edge Function: whatsapp-send
// Envia uma mensagem de texto pela API oficial do WhatsApp em nome da escola e grava na conversa do lead.
// Regra da Meta: texto livre só dentro de 24h desde a última mensagem do cliente. Fora disso, só modelo
// aprovado (template), enviado com { template: 'nome_do_modelo' }.
// Segredos: WA_TOKEN (token permanente do usuário do sistema), WA_PHONE_ID, ORG_ID.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = Deno.env.get('WA_TOKEN'), phoneId = Deno.env.get('WA_PHONE_ID'), orgId = Deno.env.get('ORG_ID');
  if (!token || !phoneId || !orgId) return json({ error: 'Configure WA_TOKEN, WA_PHONE_ID e ORG_ID nos segredos da função.' }, 400);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: u } = await admin.auth.getUser((req.headers.get('Authorization') || '').replace('Bearer ', ''));
  if (!u?.user) return json({ error: 'Faça login.' }, 401);
  const { data: mem } = await admin.from('members').select('role,nome').match({ org_id: orgId, user_id: u.user.id }).maybeSingle();
  if (!mem || mem.role === 'leitura') return json({ error: 'Seu acesso é só de leitura.' }, 403);

  const { leadId, texto, template } = await req.json().catch(() => ({}));
  const { data: lr } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'leads', id: leadId }).maybeSingle();
  const tel = String(lr?.data?.telefone || '').replace(/\D/g, '');
  if (!tel) return json({ error: 'Lead sem telefone.' }, 400);
  const to = tel.length <= 11 ? '55' + tel : tel;

  if (!template) {
    const { data: ult } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'wamsg' }).eq('data->>leadId', leadId).eq('data->>dir', 'in').order('updated_at', { ascending: false }).limit(1);
    const em = ult?.[0]?.data?.em;
    if (!em || Date.now() - new Date(em).getTime() > 24 * 3600e3) return json({ error: 'Passou de 24h desde a última mensagem do cliente. A Meta só permite enviar um modelo aprovado agora.', janela: false }, 409);
    if (!String(texto || '').trim()) return json({ error: 'Mensagem vazia.' }, 400);
  }
  const payload = template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: 'pt_BR' } } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: String(texto).slice(0, 4096) } };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (j.error) return json({ error: 'WhatsApp: ' + j.error.message }, 502);
  const waId = j.messages?.[0]?.id || crypto.randomUUID();
  const id = 'wm_' + String(waId).replace(/[^a-zA-Z0-9]/g, '').slice(-40); const now = new Date().toISOString();
  const data = { id, leadId, dir: 'out', texto: template ? `[modelo] ${template}` : texto, em: now, por: mem.nome || u.user.email, status: 'sent', waId, createdAt: now, updatedAt: now };
  await admin.from('records').upsert({ org_id: orgId, collection: 'wamsg', id, data, updated_at: now });
  return json({ ok: true, id });
});
