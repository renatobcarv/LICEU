// Supabase Edge Function: meta-sync
// Busca na API de Marketing do Meta os números diários por anúncio (gasto, alcance, impressões,
// cliques, conversas) e grava na tabela `records` da unidade, no formato que o app já lê
// (coleções `campaigns` e `adStats`). Roda sob demanda (botão "Sincronizar com o Meta" em Meta Ads)
// ou todo dia pelo agendador (veja docs/META-SYNC.md).
//
// Segredos (Project Settings › Edge Functions › Secrets):
//   META_TOKEN       token do usuário do sistema (ads_read), nunca no navegador
//   META_ACCOUNT_ID  ID da conta de anúncios (só números)
//   ORG_ID           id da unidade (tabela orgs) que recebe os dados
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das Edge Functions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GRAPH = 'https://graph.facebook.com/v21.0';
const CONVERSA = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = Deno.env.get('META_TOKEN'), account = Deno.env.get('META_ACCOUNT_ID'), orgId = Deno.env.get('ORG_ID');
  if (!token || !account || !orgId) return json({ error: 'Configure META_TOKEN, META_ACCOUNT_ID e ORG_ID nos segredos da função.' }, 400);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Quem chama pelo app precisa ser admin ou editor da unidade. O agendador chama com a service role.
  const auth = req.headers.get('Authorization') || '';
  const isService = auth === 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isService) {
    const { data: u } = await admin.auth.getUser(auth.replace('Bearer ', ''));
    if (!u?.user) return json({ error: 'Faça login.' }, 401);
    const { data: m } = await admin.from('members').select('role').match({ org_id: orgId, user_id: u.user.id }).maybeSingle();
    if (!m || !['admin', 'editor'].includes(m.role)) return json({ error: 'Só administrador ou editor pode sincronizar.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const dias = Math.min(90, Math.max(1, Number(body.dias) || 7));
  const until = new Date(); const since = new Date(Date.now() - (dias - 1) * 864e5);
  const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,inline_link_clicks,actions';
  let url = `${GRAPH}/act_${account}/insights?level=ad&time_increment=1&limit=500&fields=${fields}&time_range=${encodeURIComponent(JSON.stringify({ since: iso(since), until: iso(until) }))}&access_token=${token}`;

  const rows: any[] = [];
  while (url) {
    const r = await fetch(url); const j = await r.json();
    if (j.error) return json({ error: 'Meta: ' + j.error.message }, 502);
    rows.push(...(j.data || [])); url = j.paging?.next || '';
  }

  // Campanhas: liga pelo ID do Meta (metaId) e cria as que não existem.
  const { data: camps } = await admin.from('records').select('id,data').match({ org_id: orgId, collection: 'campaigns' });
  const byMeta = new Map((camps || []).filter((c: any) => c.data?.metaId).map((c: any) => [c.data.metaId, c.id]));
  const byName = new Map((camps || []).map((c: any) => [String(c.data?.nome || '').trim().toLowerCase(), c.id]));
  const now = new Date().toISOString();
  const novas: any[] = [];
  const campId = (r: any) => {
    let id = byMeta.get(r.campaign_id) || byName.get(String(r.campaign_name).trim().toLowerCase());
    if (!id) { id = 'mc_' + r.campaign_id; byMeta.set(r.campaign_id, id); novas.push({ org_id: orgId, collection: 'campaigns', id, data: { id, nome: r.campaign_name, metaId: r.campaign_id, canal: 'Meta', status: 'Ativa', objetivo: 'Mensagens no WhatsApp', createdAt: now, updatedAt: now }, updated_at: now }); }
    return id;
  };

  const stats = rows.map((r) => {
    const conversas = (r.actions || []).filter((a: any) => CONVERSA.includes(a.action_type)).reduce((s: number, a: any) => s + Number(a.value || 0), 0);
    const id = `meta_${r.ad_id}_${r.date_start}`;
    const data = {
      id, campanhaId: campId(r), conjunto: r.adset_name, anuncio: r.ad_name, inicio: r.date_start, fim: r.date_stop,
      investimento: Number(r.spend || 0), impressoes: Number(r.impressions || 0), alcance: Number(r.reach || 0), cliquesTodos: Number(r.clicks || 0), cliques: Number(r.inline_link_clicks || 0),
      conversas, resultados: conversas, tipoResultado: conversas ? 'Conversas' : '', origem: 'api', createdAt: now, updatedAt: now,
    };
    return { org_id: orgId, collection: 'adStats', id, data, updated_at: now };
  });

  for (let i = 0; i < novas.length; i += 500) { const { error } = await admin.from('records').upsert(novas.slice(i, i + 500)); if (error) return json({ error: error.message }, 500); }
  for (let i = 0; i < stats.length; i += 500) { const { error } = await admin.from('records').upsert(stats.slice(i, i + 500)); if (error) return json({ error: error.message }, 500); }
  return json({ ok: true, dias, linhas: stats.length, campanhasNovas: novas.length, de: iso(since), ate: iso(until) });
});
