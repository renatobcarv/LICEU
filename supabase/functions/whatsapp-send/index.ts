// Supabase Edge Function: whatsapp-send
// Envia mensagem pela API oficial em nome da EMPRESA do lead, com o número e o token dela (cifrado no banco).
// Regras da Meta aplicadas aqui, no servidor: texto livre só até 24h após a última mensagem do cliente;
// fora disso, só modelo aprovado. Quem chama precisa ter permissão de escrita em "wamsg" naquela empresa.
// Segredos: WA_ENC_KEY. Modo número único (escola local, sem Embedded Signup): WA_TOKEN, WA_PHONE_ID, ORG_ID.

import { GRAPH, cors, json, adminClient, userClient, credenciaisDaEmpresa } from '../_shared/wa.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { orgId: pedido, leadId, texto, template } = await req.json().catch(() => ({}));
  const orgId = pedido || Deno.env.get('ORG_ID');
  if (!orgId || !leadId) return json({ error: 'Informe a empresa e o lead.' }, 400);

  // Permissão avaliada pelo próprio banco, com o login de quem chamou.
  const uc = userClient(req);
  const { data: pode } = await uc.rpc('can_coll', { o: orgId, coll: 'wamsg', p: 'w' });
  if (!pode) return json({ error: 'Sem permissão para enviar mensagens nesta empresa.' }, 403);
  const { data: u } = await uc.auth.getUser();

  const admin = adminClient();
  const cred = await credenciaisDaEmpresa(admin, orgId);
  if (!cred) return json({ error: 'Esta empresa ainda não conectou um número de WhatsApp.' }, 409);
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
  if (lr?.data?.optOut) return json({ error: 'Este contato pediu para não receber mensagens.' }, 409);

  const payload = template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: 'pt_BR' } } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: String(texto).slice(0, 4096) } };
  const r = await fetch(`${GRAPH}/${cred.phoneId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + cred.token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (j.error) return json({ error: 'WhatsApp: ' + j.error.message }, 502);
  const waId = j.messages?.[0]?.id || crypto.randomUUID();
  const id = 'wm_' + String(waId).replace(/[^a-zA-Z0-9]/g, '').slice(-40); const now = new Date().toISOString();
  const { data: mem } = await admin.from('members').select('nome').match({ org_id: orgId, user_id: u.user?.id }).maybeSingle();
  const data = { id, leadId, dir: 'out', texto: template ? `[modelo] ${template}` : texto, em: now, por: mem?.nome || u.user?.email, status: 'sent', waId, createdAt: now, updatedAt: now };
  await admin.from('records').upsert({ org_id: orgId, collection: 'wamsg', id, data, updated_at: now });
  await admin.rpc('add_usage', { o: orgId, m: 'wa_enviadas', n: 1 });
  return json({ ok: true, id });
});
