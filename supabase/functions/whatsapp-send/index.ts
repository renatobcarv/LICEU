// Supabase Edge Function: whatsapp-send
// Envia em nome da EMPRESA do lead: texto, modelo aprovado (só API oficial) ou anexo (imagem, vídeo, áudio, documento).
// Funciona com a conexão oficial (Cloud API) e com a de QR Code (Evolution). Regras no servidor:
//  - API oficial: texto livre e anexo só até 24h após a última mensagem do cliente; fora disso, só modelo aprovado.
//  - Opt-out respeitado. Quem chama precisa de escrita em "wamsg" na empresa.
//  - Anexo: o app sobe o arquivo no Storage (bucket wa-media, pasta da empresa) e manda só o caminho; aqui vira link assinado curto.
// Uma pessoa do time respondeu: o robô das automações se cala neste contato.
import { GRAPH, cors, json, adminClient, userClient, credenciaisDaEmpresa, evo } from '../_shared/wa.ts';
import { pausarRobo } from '../_shared/enviar.ts';
import { urlAssinada, tipoDe } from '../_shared/midia.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { orgId: pedido, leadId, texto, template, midia } = await req.json().catch(() => ({}));
  const orgId = pedido || Deno.env.get('ORG_ID');
  if (!orgId || !leadId) return json({ error: 'Informe a empresa e o lead.' }, 400);

  const uc = userClient(req);
  const { data: pode } = await uc.rpc('can_coll', { o: orgId, coll: 'wamsg', p: 'w' });
  if (!pode) return json({ error: 'Sem permissão para enviar mensagens nesta empresa.' }, 403);
  const { data: u } = await uc.auth.getUser();

  const admin = adminClient();
  const cred = await credenciaisDaEmpresa(admin, orgId);
  if (!cred) return json({ error: 'Esta empresa ainda não conectou um número de WhatsApp.' }, 409);
  const { data: lr } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'leads', id: leadId }).maybeSingle();
  if (lr?.data?.optOut) return json({ error: 'Este contato pediu para não receber mensagens.' }, 409);
  const tel = String(lr?.data?.telefone || '').replace(/\D/g, '');
  if (!tel) return json({ error: 'Lead sem telefone.' }, 400);
  const to = tel.length <= 11 ? '55' + tel : tel;
  const qr = cred.tipo === 'qr';
  const corpo = String(texto || '').trim().slice(0, 4096);

  // Anexo: só da pasta desta empresa
  let anexo: { path: string; mime: string; tipo: string; nome: string } | null = null;
  if (midia) {
    const path = String(midia.path || '');
    if (!path.startsWith(orgId + '/') || path.includes('..')) return json({ error: 'Anexo inválido.' }, 400);
    const mime = String(midia.mime || 'application/octet-stream').split(';')[0];
    anexo = { path, mime, tipo: tipoDe(mime), nome: String(midia.nome || '').slice(0, 120) };
  }
  if (template && qr) return json({ error: 'Modelos aprovados só existem na API oficial. No QR Code, envie texto.' }, 400);
  if (!template && !anexo && !corpo) return json({ error: 'Mensagem vazia.' }, 400);
  if (!template && !qr) {
    const { data: ult } = await admin.from('records').select('data').match({ org_id: orgId, collection: 'wamsg' }).eq('data->>leadId', leadId).eq('data->>dir', 'in').order('updated_at', { ascending: false }).limit(1);
    const em = ult?.[0]?.data?.em;
    if (!em || Date.now() - new Date(em).getTime() > 24 * 3600e3) return json({ error: 'Passou de 24h desde a última mensagem do cliente. A Meta só permite enviar um modelo aprovado agora.', janela: false }, 409);
  }

  let waId: string;
  try {
    const link = anexo ? await urlAssinada(admin, anexo.path, 900) : '';
    if (qr) {
      let j: any;
      if (!anexo) j = await evo(`/message/sendText/${cred.instancia}`, 'POST', { number: to, text: corpo });
      else if (anexo.tipo === 'audio') j = await evo(`/message/sendWhatsAppAudio/${cred.instancia}`, 'POST', { number: to, audio: link });
      else j = await evo(`/message/sendMedia/${cred.instancia}`, 'POST', { number: to, mediatype: anexo.tipo, mimetype: anexo.mime, media: link, fileName: anexo.nome || undefined, caption: corpo || undefined });
      waId = j?.key?.id || crypto.randomUUID();
      await admin.from('wa_events').insert({ id: 'evo_' + waId, org_id: orgId }); // ignora o eco no webhook
    } else {
      const payload = template
        ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: 'pt_BR' } } }
        : anexo
          ? { messaging_product: 'whatsapp', to, type: anexo.tipo, [anexo.tipo]: { link, ...(corpo && anexo.tipo !== 'audio' ? { caption: corpo } : {}), ...(anexo.tipo === 'document' && anexo.nome ? { filename: anexo.nome } : {}) } }
          : { messaging_product: 'whatsapp', to, type: 'text', text: { body: corpo } };
      const r = await fetch(`${GRAPH}/${cred.phoneId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + cred.token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.error) return json({ error: 'WhatsApp: ' + j.error.message }, 502);
      waId = j.messages?.[0]?.id || crypto.randomUUID();
    }
  } catch (e) { return json({ error: 'WhatsApp: ' + (e as Error).message }, 502); }

  const id = 'wm_' + String(waId).replace(/[^a-zA-Z0-9]/g, '').slice(-40); const now = new Date().toISOString();
  const { data: mem } = await admin.from('members').select('nome').match({ org_id: orgId, user_id: u.user?.id }).maybeSingle();
  const data = { id, leadId, dir: 'out', texto: template ? `[modelo] ${template}` : corpo, ...(anexo ? { midia: anexo } : {}), em: now, por: mem?.nome || u.user?.email, status: 'sent', waId, createdAt: now, updatedAt: now };
  await admin.from('records').upsert({ org_id: orgId, collection: 'wamsg', id, data, updated_at: now });
  await admin.rpc('add_usage', { o: orgId, m: 'wa_enviadas', n: 1 });
  await pausarRobo(admin, orgId, leadId);
  return json({ ok: true, id });
});
