// Supabase Edge Function: whatsapp-connect
// Dois modos de ligar o número oficial (Cloud API) de uma empresa:
//  1. Embedded Signup (cliente conecta sozinho): recebe o código da Meta, troca por token.
//     Segredos: META_APP_ID, META_APP_SECRET. Exige o app aprovado como Tech Provider.
//  2. Conexão assistida (MVP, antes da aprovação): um administrador da PLATAFORMA (e-mail em PLATFORM_ADMINS)
//     informa WABA, ID do número e o token de usuário do sistema. O token vai do navegador direto para cá
//     por HTTPS, é validado na Meta e gravado cifrado (AES-GCM). Nunca passa por chat ou repositório.
// Nos dois: confere que o número pertence à conta, inscreve o app no webhook, registra o número e grava a conexão.
// Segredos comuns: WA_ENC_KEY, WA_PIN (6 dígitos, opcional).

import { GRAPH, cors, json, adminClient, userClient, cifrar } from '../_shared/wa.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));
  const orgId = String(body.orgId || ''), wabaId = String(body.wabaId || '').trim(), phoneNumberId = String(body.phoneNumberId || '').trim();
  const manual = body.manual === true;
  if (!Deno.env.get('WA_ENC_KEY')) return json({ error: 'Plataforma sem WA_ENC_KEY.' }, 400);
  if (!orgId || !wabaId || !phoneNumberId || !/^\d{6,25}$/.test(wabaId) || !/^\d{6,25}$/.test(phoneNumberId)) return json({ error: 'Informe a conta (WABA) e o ID do número, só dígitos.' }, 400);
  if (!manual && !body.code) return json({ error: 'Faltou o código da Meta. Refaça a conexão.' }, 400);

  // Só dono ou administrador da empresa (ou da agência acima) conecta número.
  const uc = userClient(req);
  const { data: role, error: re } = await uc.rpc('my_role', { o: orgId });
  if (re || !['owner', 'admin'].includes(role)) return json({ error: 'Só o dono ou administrador da empresa conecta WhatsApp.' }, 403);

  const admin = adminClient();
  const { data: lim } = await admin.rpc('org_limit', { o: orgId, k: 'whatsapp' });
  const { count } = await admin.from('wa_connections').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'desconectado');
  if ((count || 0) >= (lim || 0)) return json({ error: 'Limite de números de WhatsApp do plano atingido.' }, 402);
  const { data: outra } = await admin.from('wa_connections').select('org_id').eq('phone_number_id', phoneNumberId).maybeSingle();
  if (outra && outra.org_id !== orgId) return json({ error: 'Este número já está conectado a outra empresa da plataforma.' }, 409);

  // 1. Token: no modo assistido vem do administrador da plataforma; no Embedded Signup, troca do código.
  let token: string;
  if (manual) {
    const { data: u } = await uc.auth.getUser();
    const admins = (Deno.env.get('PLATFORM_ADMINS') || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
    if (!u.user?.email || !admins.includes(u.user.email.toLowerCase())) return json({ error: 'A conexão assistida é feita pelo time Klasso. Fale com o suporte.' }, 403);
    token = String(body.token || '').trim();
    if (token.length < 50) return json({ error: 'Token inválido. Use o token permanente do usuário do sistema.' }, 400);
  } else {
    const appId = Deno.env.get('META_APP_ID'), secret = Deno.env.get('META_APP_SECRET');
    if (!appId || !secret) return json({ error: 'Conexão pelo painel ainda não liberada (falta META_APP_ID/META_APP_SECRET).' }, 400);
    const t = await (await fetch(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${secret}&code=${encodeURIComponent(body.code)}`)).json();
    if (!t.access_token) return json({ error: 'Meta recusou o código: ' + (t.error?.message || 'sem token') }, 502);
    token = t.access_token as string;
  }
  const g = (path: string, init?: RequestInit) => fetch(`${GRAPH}/${path}`, { ...init, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init?.headers || {}) } }).then((r) => r.json());

  // 2. O número pertence mesmo à conta autorizada?
  const nums = await g(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`);
  if (nums.error) return json({ error: 'A Meta recusou o acesso à conta: ' + nums.error.message }, 400);
  const num = (nums.data || []).find((n: any) => n.id === phoneNumberId);
  if (!num) return json({ error: 'O número informado não pertence à conta do WhatsApp autorizada.' }, 400);

  const now = new Date().toISOString();
  const { data: conn, error: ce } = await admin.from('wa_connections').upsert({
    org_id: orgId, waba_id: wabaId, phone_number_id: phoneNumberId, telefone: num.display_phone_number, nome_verificado: num.verified_name,
    qualidade: num.quality_rating, status: 'pendente', erro: null, ultima_sync: now,
  }, { onConflict: 'phone_number_id' }).select().single();
  if (ce) return json({ error: ce.message }, 500);
  await admin.from('wa_credentials').upsert({ connection_id: conn.id, token_cifrado: await cifrar(token), updated_at: now });

  // 3. Webhook da conta → nosso app; 4. registrar o número na Cloud API
  const sub = await g(`${wabaId}/subscribed_apps`, { method: 'POST' });
  const reg = await g(`${phoneNumberId}/register`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', pin: Deno.env.get('WA_PIN') || '000000' }) });
  const regOk = reg.success || /already registered/i.test(reg.error?.message || '');
  const status = sub.success && regOk ? 'conectado' : 'erro';
  const erro = status === 'erro' ? [sub.error?.message, regOk ? '' : reg.error?.message].filter(Boolean).join(' · ') : null;
  await admin.from('wa_connections').update({ status, erro, webhook_ok: !!sub.success, conectado_em: status === 'conectado' ? now : null }).eq('id', conn.id);
  return json({ ok: status === 'conectado', status, erro, telefone: num.display_phone_number }, status === 'conectado' ? 200 : 502);
});
