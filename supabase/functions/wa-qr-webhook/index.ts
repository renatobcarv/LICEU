// Supabase Edge Function: wa-qr-webhook
// Recebe eventos da Evolution API (conexão por QR Code) e faz o mesmo que o webhook oficial:
// cria o lead no Funil quando o número é novo e grava cada mensagem em `wamsg`.
// A Evolution não assina o envio: a autenticação é o token na URL (?k=EVO_WEBHOOK_TOKEN), comparado em tempo constante.
// A empresa sai do nome da instância (tabela wa_connections), nunca do corpo sem conferência.
// Publicar SEM verificação de JWT: npx supabase functions deploy wa-qr-webhook --no-verify-jwt
// Limite honesto: aqui não chega o ctwa_clid do anúncio; leads entram com origem "WhatsApp".

import { adminClient, ingerirEvo, recuperarEvo } from '../_shared/wa.ts';

function igual(a: string, b: string) { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const tok = Deno.env.get('EVO_WEBHOOK_TOKEN') || '';
  if (!igual(new URL(req.url).searchParams.get('k') || '', tok)) return new Response('forbidden', { status: 403 });
  const b = await req.json().catch(() => ({}));
  const admin = adminClient();
  const { data: cx } = await admin.from('wa_connections').select('id, org_id, status, instancia, ultima_sync, conectado_em').eq('instancia', String(b.instance || '')).eq('tipo', 'qr').maybeSingle();
  if (!cx) return new Response('ok'); // instância desconhecida: ignora sem revelar nada
  const orgId = cx.org_id as string; const ev = String(b.event || '').toLowerCase().replace('_', '.');
  const now = new Date().toISOString();

  if (ev === 'connection.update') {
    const st = b.data?.state;
    const status = st === 'open' ? 'conectado' : st === 'close' ? 'desconectado' : null;
    if (status && status !== cx.status) await admin.from('wa_connections').update({ status, ...(status === 'conectado' ? { erro: null, ...(cx.conectado_em ? {} : { conectado_em: now }) } : { erro: 'Sessão encerrada no celular. Gere um novo QR Code.' }) }).eq('id', cx.id);
    // Voltou: recupera o que chegou enquanto estava fora (sem segurar a resposta)
    if (status === 'conectado') { const t = recuperarEvo(admin, cx as any).catch((e) => console.warn('recuperação', e.message)); (globalThis as any).EdgeRuntime?.waitUntil?.(t); }
    return new Response('ok');
  }
  if (ev !== 'messages.upsert') return new Response('ok');

  const lista = Array.isArray(b.data) ? b.data : [b.data];
  try { await ingerirEvo(admin, orgId, lista, cx.id); } catch (e) { return new Response((e as Error).message, { status: 500 }); }
  return new Response('ok');
});
