// Envio de texto pelo número da empresa (oficial ou QR), usado pelo robô das automações.
// Mesmas regras do whatsapp-send: opt-out, janela de 24h da API oficial, registro em wamsg e uso do plano.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { GRAPH, credenciaisDaEmpresa, evo } from './wa.ts';

export async function enviarTexto(admin: SupabaseClient, orgId: string, lead: any, texto: string, por = 'Robô') {
  if (lead?.optOut) return { ok: false, erro: 'opt-out' };
  const tel = String(lead?.telefone || '').replace(/\D/g, ''); if (!tel) return { ok: false, erro: 'lead sem telefone' };
  const to = tel.length <= 11 ? '55' + tel : tel;
  const cred = await credenciaisDaEmpresa(admin, orgId); if (!cred) return { ok: false, erro: 'WhatsApp não conectado' };
  const body = String(texto).slice(0, 4096);
  let waId: string;
  try {
    if (cred.tipo === 'qr') {
      const j = await evo(`/message/sendText/${cred.instancia}`, 'POST', { number: to, text: body });
      waId = j?.key?.id || crypto.randomUUID();
      await admin.from('wa_events').insert({ id: 'evo_' + waId, org_id: orgId }); // ignora o eco no webhook
    } else {
      const { data: ult } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'wamsg' }).eq('data->>leadId', lead.id).eq('data->>dir', 'in').order('updated_at', { ascending: false }).limit(1);
      const em = ult?.[0]?.data?.em;
      if (!em || Date.now() - new Date(em).getTime() > 24 * 3600e3) return { ok: false, erro: 'janela' };
      const r = await fetch(`${GRAPH}/${cred.phoneId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + cred.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }) });
      const j = await r.json(); if (j.error) return { ok: false, erro: j.error.message };
      waId = j.messages?.[0]?.id || crypto.randomUUID();
    }
  } catch (e) { return { ok: false, erro: (e as Error).message }; }
  const id = 'wm_' + String(waId).replace(/[^a-zA-Z0-9]/g, '').slice(-40); const now = new Date().toISOString();
  await admin.from('records').upsert({ org_id: orgId, collection: 'wamsg', id, data: { id, leadId: lead.id, dir: 'out', texto: body, em: now, por, robo: por === 'Robô', status: 'sent', waId, createdAt: now, updatedAt: now }, updated_at: now });
  await admin.rpc('add_usage', { o: orgId, m: 'wa_enviadas', n: 1 });
  return { ok: true, id };
}

/** Alguém do time respondeu: o robô se cala naquele contato pelo tempo definido nas regras. */
export async function pausarRobo(admin: SupabaseClient, orgId: string, leadId: string) {
  const { data: rg } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'automacoes', id: '_regras' }).maybeSingle();
  const h = Number(rg?.data?.pausaHumanoH || 24);
  const { data: l } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'leads', id: leadId }).maybeSingle();
  if (!l) return;
  const now = new Date();
  await admin.from('records').upsert({ org_id: orgId, collection: 'leads', id: leadId, data: { ...l.data, roboPausadoAte: new Date(now.getTime() + h * 3600e3).toISOString(), updatedAt: now.toISOString() }, updated_at: now.toISOString() });
}
