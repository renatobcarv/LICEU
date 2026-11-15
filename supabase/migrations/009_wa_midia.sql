-- Klasso · migração 009: anexos do WhatsApp (imagem, áudio, vídeo, documento) no Storage, privados.
-- Caminho: <org_id>/<AAAA-MM>/<arquivo>. Lê quem vê as mensagens (wamsg 'r'); envia quem pode responder (wamsg 'w').
-- O navegador só recebe links assinados de curta duração. Pode rodar de novo.
insert into storage.buckets (id, name, public, file_size_limit)
values ('wa-media', 'wa-media', false, 16777216)
on conflict (id) do update set public = false, file_size_limit = 16777216;

create or replace function public.wa_midia_org(nome text) returns uuid
language plpgsql immutable as $$
begin return split_part(nome, '/', 1)::uuid; exception when others then return null; end $$;

drop policy if exists wa_media_select on storage.objects;
create policy wa_media_select on storage.objects for select
  using (bucket_id = 'wa-media' and public.can_coll(public.wa_midia_org(name), 'wamsg', 'r'));
drop policy if exists wa_media_insert on storage.objects;
create policy wa_media_insert on storage.objects for insert
  with check (bucket_id = 'wa-media' and public.can_coll(public.wa_midia_org(name), 'wamsg', 'w'));
