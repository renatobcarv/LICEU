-- Klasso · migração 008: relógio das automações (retoma "Esperar" e dispara gatilhos por tempo a cada minuto).
-- Os dados das automações ficam em records (coleções 'automacoes' e 'autoexec'); o RLS atual já cobre:
-- dono/admin/coordenador editam, o resto do time só vê; o estado por lead (autoexec) só o servidor grava.
--
-- ANTES de rodar, guarde o token no Vault (mesmo valor do segredo AUTOMACAO_TOKEN da função automacao-tick):
--   select vault.create_secret('<token gerado com: openssl rand -hex 24>', 'automacao_token');
-- Pode rodar de novo.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- índices para o relógio achar rápido quem está esperando
create index if not exists records_autoexec_espera_idx on public.records ((data->'fluxo'->>'retomarEm'))
  where collection = 'autoexec' and data->'fluxo'->>'aguardando' = 'tempo';
create index if not exists records_wamsg_lead_idx on public.records (org_id, (data->>'leadId')) where collection = 'wamsg';

do $$ begin perform cron.unschedule('klasso-automacoes'); exception when others then null; end $$;
select cron.schedule('klasso-automacoes', '* * * * *', $cron$
  select net.http_post(
    url := 'https://kqaqccjsoqdpbnnyyemw.supabase.co/functions/v1/automacao-tick',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-tick-token', (select decrypted_secret from vault.decrypted_secrets where name = 'automacao_token')),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
$cron$);
