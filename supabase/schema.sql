-- LICEU Intelligence · banco de dados no Supabase
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo sem perder dados (tudo é "if not exists" / "or replace").
--
-- Modelo:
--   orgs     = unidade (ex.: TEC Mais Valparaíso). Cada uma tem um código de convite.
--   members  = quem faz parte da unidade e com qual papel (admin, editor, leitura).
--   records  = todos os dados do painel (leads, campanhas, calendário, metas...),
--              um registro JSON por linha, separado por unidade e coleção.
-- Segurança: Row Level Security. Ninguém lê ou grava dados de uma unidade da qual não é membro.

create extension if not exists pgcrypto;

-- ---------- tabelas ----------
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  invite_code text not null unique default substr(encode(gen_random_bytes(6), 'hex'), 1, 10),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor', 'leitura')),
  nome text,
  email text,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);

create table if not exists public.records (
  org_id uuid not null references public.orgs(id) on delete cascade,
  collection text not null check (collection ~ '^[a-zA-Z]{2,32}$'),
  id text not null check (char_length(id) between 1 and 120),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (org_id, collection, id)
);
create index if not exists records_org_coll_idx on public.records(org_id, collection);

-- Registro de quem mudou o quê (exigência prática da LGPD: rastrear acesso e alteração de dados pessoais).
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid,
  action text not null,
  collection text,
  record_id text,
  at timestamptz not null default now()
);
create index if not exists audit_org_idx on public.audit_log(org_id, at desc);

-- ---------- funções de permissão (security definer evita recursão nas políticas) ----------
create or replace function public.is_member(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid());
$$;

create or replace function public.can_edit(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid() and role in ('admin', 'editor'));
$$;

create or replace function public.is_admin(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid() and role = 'admin');
$$;

-- ---------- RLS ----------
alter table public.orgs enable row level security;
alter table public.members enable row level security;
alter table public.records enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs for select using (public.is_member(id));
drop policy if exists orgs_update on public.orgs;
create policy orgs_update on public.orgs for update using (public.is_admin(id)) with check (public.is_admin(id));

drop policy if exists members_select on public.members;
create policy members_select on public.members for select using (public.is_member(org_id));
drop policy if exists members_update on public.members;
create policy members_update on public.members for update using (public.is_admin(org_id)) with check (public.is_admin(org_id));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete using (public.is_admin(org_id) or user_id = auth.uid());

drop policy if exists records_select on public.records;
create policy records_select on public.records for select using (public.is_member(org_id));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert with check (public.can_edit(org_id));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update using (public.can_edit(org_id)) with check (public.can_edit(org_id));
drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete using (public.can_edit(org_id));

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select using (public.is_admin(org_id));

-- ---------- auditoria automática ----------
create or replace function public.audit_records() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(org_id, user_id, action, collection, record_id)
  values (coalesce(new.org_id, old.org_id), auth.uid(), lower(tg_op), coalesce(new.collection, old.collection), coalesce(new.id, old.id));
  return coalesce(new, old);
end $$;
drop trigger if exists records_audit on public.records;
create trigger records_audit after insert or update or delete on public.records
for each row execute function public.audit_records();

-- ---------- ações (RPC) ----------
-- Cria a unidade e torna quem criou administrador.
create or replace function public.create_org(p_nome text, p_user_nome text default null)
returns public.orgs language plpgsql security definer set search_path = public as $$
declare o orgs;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into orgs(nome, created_by) values (trim(p_nome), auth.uid()) returning * into o;
  insert into members(org_id, user_id, role, nome, email, terms_version, terms_accepted_at)
  values (o.id, auth.uid(), 'admin', coalesce(nullif(p_user_nome, ''), auth.jwt() -> 'user_metadata' ->> 'nome'), auth.jwt() ->> 'email',
          auth.jwt() -> 'user_metadata' ->> 'terms_version', (auth.jwt() -> 'user_metadata' ->> 'terms_accepted_at')::timestamptz);
  return o;
end $$;

-- Entra numa unidade pelo código de convite, como editor.
create or replace function public.join_org(p_code text, p_user_nome text default null)
returns public.orgs language plpgsql security definer set search_path = public as $$
declare o orgs;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into o from orgs where invite_code = lower(trim(p_code));
  if o.id is null then raise exception 'invite code not found'; end if;
  insert into members(org_id, user_id, role, nome, email, terms_version, terms_accepted_at)
  values (o.id, auth.uid(), 'editor', coalesce(nullif(p_user_nome, ''), auth.jwt() -> 'user_metadata' ->> 'nome'), auth.jwt() ->> 'email',
          auth.jwt() -> 'user_metadata' ->> 'terms_version', (auth.jwt() -> 'user_metadata' ->> 'terms_accepted_at')::timestamptz)
  on conflict (org_id, user_id) do nothing;
  return o;
end $$;

-- Gera um código de convite novo (o antigo deixa de funcionar).
create or replace function public.regenerate_invite(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_admin(p_org) then raise exception 'only admins'; end if;
  update orgs set invite_code = substr(encode(gen_random_bytes(6), 'hex'), 1, 10) where id = p_org returning invite_code into c;
  return c;
end $$;

-- Exclui a própria conta (direito do titular, LGPD art. 18). Se for o último admin de uma unidade
-- com outros membros, bloqueia para a unidade não ficar sem dono.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  for r in select m.org_id from members m where m.user_id = auth.uid() and m.role = 'admin' loop
    if (select count(*) from members where org_id = r.org_id and role = 'admin') = 1
       and (select count(*) from members where org_id = r.org_id) > 1 then
      raise exception 'transfer admin before deleting';
    end if;
    -- Unidade só com essa pessoa: apaga a unidade e todos os dados dela.
    if (select count(*) from members where org_id = r.org_id) = 1 then
      delete from orgs where id = r.org_id;
    end if;
  end loop;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.create_org(text, text) from public, anon;
revoke all on function public.join_org(text, text) from public, anon;
revoke all on function public.regenerate_invite(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.create_org(text, text) to authenticated;
grant execute on function public.join_org(text, text) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- permissões de tabela (o RLS acima decide quais linhas) ----------
grant usage on schema public to authenticated;
revoke all on public.orgs, public.members, public.records, public.audit_log from anon;
grant select, update on public.orgs to authenticated;
grant select, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.records to authenticated;
grant select on public.audit_log to authenticated;

-- ---------- tempo real ----------
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;
