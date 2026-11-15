// Supabase Edge Function: automacao-ia
// Usada pelo simulador "Testar" das automações: a mesma IA e os mesmos limites do robô de verdade,
// sem enviar nada para o WhatsApp. Só quem pode editar automações na empresa.
import { cors, json, adminClient, userClient } from '../_shared/wa.ts';
import { contexto } from '../_shared/automacao.ts';
import { respostaBot } from '../_shared/ia-bot.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const b = await req.json().catch(() => ({}));
  const orgId = String(b.orgId || '');
  const { data: pode } = await userClient(req).rpc('can_coll', { o: orgId, coll: 'automacoes', p: 'w' });
  if (!pode) return json({ error: 'Sem permissão para testar automações.' }, 403);
  const admin = adminClient();
  const ctx = await contexto(admin, orgId);
  const hist = (Array.isArray(b.hist) ? b.hist : []).slice(-16).map((m: any) => ({ de: m.de === 'robo' ? 'robo' : 'cliente', t: String(m.t || '').slice(0, 1000) }));
  try {
    const r = await respostaBot({ escola: ctx.regras.escola, base: String(b.base ?? ctx.regras.base ?? ''), cursos: ctx.cursos, objetivo: String(b.objetivo || ''), hist, lead: b.lead || {} });
    await admin.rpc('add_usage', { o: orgId, m: 'ia', n: 1 });
    return r ? json({ ok: true, ...r }) : json({ error: 'A IA não respondeu. No robô de verdade, o contato iria para um humano.' }, 502);
  } catch {
    return json({ error: 'Falha na IA. No robô de verdade, o contato iria para um humano.' }, 502);
  }
});
