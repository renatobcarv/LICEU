// Supabase Edge Function: wa-qr-webhook
// Recebe eventos da Evolution API (conexão por QR Code) e faz o mesmo que o webhook oficial:
// cria o lead no Funil quando o número é novo e grava cada mensagem em `wamsg`.
// A Evolution não assina o envio: a autenticação é o token na URL (?k=EVO_WEBHOOK_TOKEN), comparado em tempo constante.
// A empresa sai do nome da instância (tabela wa_connections), nunca do corpo sem conferência.
// Publicar SEM verificação de JWT: npx supabase functions deploy wa-qr-webhook --no-verify-jwt
// Limite honesto: aqui não chega o ctwa_clid do anúncio; leads entram com origem "WhatsApp".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

function igual(a: string, b: string) { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const chave = (t: string) => String(t || '').replace(/\D/g, '').replace(/^55/, '').slice(-11);
const texto = (m: any = {}) => m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.buttonsResponseMessage?.selectedDisplayText
  || (m.imageMessage ? '📷 Imagem' : m.audioMessage ? '🎤 Áudio' : m.documentMessage ? '📄 Documento' : m.videoMessage ? '🎬 Vídeo' : m.locationMessage ? '📍 Localização' : m.stickerMessage ? 'Figurinha' : '[mensagem]');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const tok = Deno.env.get('EVO_WEBHOOK_TOKEN') || '';
  if (!igual(new URL(req.url).searchParams.get('k') || '', tok)) return new Response('forbidden', { status: 403 });
  const b = await req.json().catch(() => ({}));
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cx } = await admin.from('wa_connections').select('id, org_id, status').eq('instancia', String(b.instance || '')).eq('tipo', 'qr').maybeSingle();
  if (!cx) return new Response('ok'); // instância desconhecida: ignora sem revelar nada
  const orgId = cx.org_id as string; const ev = String(b.event || '').toLowerCase().replace('_', '.');
  const now = new Date().toISOString();

  if (ev === 'connection.update') {
    const st = b.data?.state;
    const status = st === 'open' ? 'conectado' : st === 'close' ? 'desconectado' : null;
    if (status && status !== cx.status) await admin.from('wa_connections').update({ status, ...(status === 'conectado' ? { conectado_em: now, erro: null } : { erro: 'Sessão encerrada no celular. Gere um novo QR Code.' }) }).eq('id', cx.id);
    return new Response('ok');
  }
  if (ev !== 'messages.upsert') return new Response('ok');

  const lista = Array.isArray(b.data) ? b.data : [b.data];
  const out: any[] = [];
  let ls: any[] | null = null;
  for (const d of lista) {
    const jid = String(d?.key?.remoteJid || '');
    if (!jid.endsWith('@s.whatsapp.net') || !d?.key?.id) continue; // ignora grupos, status e listas
    const { error: dup } = await admin.from('wa_events').insert({ id: 'evo_' + d.key.id, org_id: orgId });
    if (dup) continue;
    const num = jid.split('@')[0]; const k = chave(num);
    if (!ls) ls = (await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'leads' })).data || [];
    let lead = ls.find((r: any) => chave(r.data?.telefone) === k);
    const fromMe = !!d.key.fromMe;
    if (!lead) {
      if (fromMe) continue; // mensagem enviada pelo celular para quem não é lead: não cria lead
      const hoje = now.slice(0, 10), id = 'wa_' + k;
      const data = { id, nome: d.pushName || num, telefone: num, entrada: hoje, etapa: 'novo', etapaFunil: 'novo', funilId: 'principal', etapaMax: 0,
        origem: 'WhatsApp', historico: [{ data: hoje, etapa: 'novo', col: 'novo' }], viaApi: true, viaQr: true, createdAt: now, updatedAt: now };
      lead = { id, data }; ls.push(lead); out.push({ org_id: orgId, collection: 'leads', id, data, updated_at: now });
    }
    const mid = 'wm_' + String(d.key.id).replace(/[^a-zA-Z0-9]/g, '').slice(-40);
    const em = d.messageTimestamp ? new Date(Number(d.messageTimestamp) * 1000).toISOString() : now;
    out.push({ org_id: orgId, collection: 'wamsg', id: mid, data: { id: mid, leadId: lead.id, dir: fromMe ? 'out' : 'in', texto: texto(d.message), em, waId: d.key.id, ...(fromMe ? { por: 'Celular', status: 'sent' } : {}), createdAt: now, updatedAt: now }, updated_at: now });
  }
  if (out.length) { const { error } = await admin.from('records').upsert(out); if (error) return new Response(error.message, { status: 500 }); }
  return new Response('ok');
});
