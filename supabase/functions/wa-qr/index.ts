// Supabase Edge Function: wa-qr
// Conexão de WhatsApp por QR Code (Evolution API, NÃO oficial), ao lado da API oficial.
// Riscos (mostrados ao cliente e aceitos explicitamente): o número pode ser banido pela Meta e
// não chega a origem do anúncio (ctwa_clid). Recomendado usar um número secundário.
// Ações (body.acao): 'conectar' (cria a instância e devolve o QR), 'qr' (QR novo), 'status', 'desconectar'.
// Só dono/administrador da empresa. Segredos: EVO_URL, EVO_KEY, EVO_WEBHOOK_TOKEN.

import { cors, json, adminClient, userClient, evo, instanciaDa } from '../_shared/wa.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));
  const orgId = String(body.orgId || ''), acao = String(body.acao || '');
  if (!orgId) return json({ error: 'Informe a empresa.' }, 400);

  const uc = userClient(req);
  const { data: role, error: re } = await uc.rpc('my_role', { o: orgId });
  if (re || !['owner', 'admin'].includes(role)) return json({ error: 'Só o dono ou administrador da empresa conecta WhatsApp.' }, 403);

  const admin = adminClient();
  const inst = instanciaDa(orgId), pid = 'qr:' + orgId;
  const { data: cx } = await admin.from('wa_connections').select('*').eq('phone_number_id', pid).maybeSingle();
  const qrDe = (j: any) => j?.base64 || j?.qrcode?.base64 || null;

  try {
    if (acao === 'conectar') {
      if (body.aceiteRisco !== true) return json({ error: 'Confirme que entende o risco do modo QR Code.' }, 400);
      const { data: lim } = await admin.rpc('org_limit', { o: orgId, k: 'whatsapp' });
      const { count } = await admin.from('wa_connections').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'desconectado').neq('phone_number_id', pid);
      if ((count || 0) >= (lim || 0)) return json({ error: 'Limite de números de WhatsApp do plano atingido.' }, 402);
      const tok = Deno.env.get('EVO_WEBHOOK_TOKEN'); if (!tok) return json({ error: 'Plataforma sem EVO_WEBHOOK_TOKEN.' }, 400);
      const hook = `${Deno.env.get('SUPABASE_URL')}/functions/v1/wa-qr-webhook?k=${encodeURIComponent(tok)}`;
      let j: any;
      try {
        j = await evo('/instance/create', 'POST', { instanceName: inst, integration: 'WHATSAPP-BAILEYS', qrcode: true, groupsIgnore: true, alwaysOnline: false, readMessages: false,
          webhook: { url: hook, byEvents: false, base64: false, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] } });
      } catch { j = await evo(`/instance/connect/${inst}`); } // já existia: só pede QR novo
      const row = { org_id: orgId, tipo: 'qr', instancia: inst, waba_id: 'qr', phone_number_id: pid, status: 'pendente', erro: null, aceite_risco_em: new Date().toISOString() };
      const { error } = cx ? await admin.from('wa_connections').update(row).eq('id', cx.id) : await admin.from('wa_connections').insert(row);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, qr: qrDe(j) || qrDe(await evo(`/instance/connect/${inst}`)) });
    }
    if (!cx) return json({ error: 'Nenhuma conexão por QR Code nesta empresa.' }, 404);
    if (acao === 'qr') return json({ ok: true, qr: qrDe(await evo(`/instance/connect/${inst}`)) });
    if (acao === 'status') {
      const j = await evo(`/instance/connectionState/${inst}`);
      const st = j?.instance?.state || j?.state;
      if (st === 'open' && cx.status !== 'conectado') {
        let tel = cx.telefone;
        try { const f = await evo(`/instance/fetchInstances?instanceName=${inst}`); const o = Array.isArray(f) ? f[0] : f; tel = String(o?.ownerJid || o?.instance?.owner || '').split('@')[0] || tel; } catch { /* opcional */ }
        await admin.from('wa_connections').update({ status: 'conectado', telefone: tel, nome_verificado: 'QR Code (não oficial)', conectado_em: new Date().toISOString(), erro: null }).eq('id', cx.id);
      }
      return json({ ok: true, estado: st, conectado: st === 'open' });
    }
    if (acao === 'desconectar') {
      try { await evo(`/instance/logout/${inst}`, 'DELETE'); } catch { /* já estava fora */ }
      try { await evo(`/instance/delete/${inst}`, 'DELETE'); } catch { /* idem */ }
      await admin.from('wa_connections').delete().eq('id', cx.id);
      return json({ ok: true });
    }
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
