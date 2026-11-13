-- FLOWCLASS · migração 004: convites com perfil (link ou e-mail), validade e uso único.
-- Só acrescenta; pode rodar de novo. O código antigo (orgs.invite_code + join_org) continua funcionando.

create table if not exists public.invites (
  code text primary key default substr(encode(gen_random_bytes(9), 'hex'), 1, 14),
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null default 'sales',
  email text,                       -- opcional: só essa pessoa usa (conferido no aceite)
  nome text,                        -- opcional: como a pessoa vai aparecer
  usos_max int not null default 1 check (usos_max between 1 and 100),
  usos int not null default 0,
  expira_em timestamptz not null default now() + interval '7 days',
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists invites_org_idx on public.invites(org_id, created_at desc);
alter table public.invites enable row level security;
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all using (public.is_admin(org_id)) with check (public.is_admin(org_id));
grant select, insert, delete on public.invites to authenticated;

-- Admin cria o convite. Ninguém convida para 'owner'.
create or replace function public.create_invite(p_org uuid, p_role text, p_email text default null, p_nome text default null, p_usos int default 1, p_dias int default 7)
returns public.invites language plpgsql security definer set search_path = public as $$
declare i invites; n int;
begin
  if not public.is_admin(p_org) then raise exception 'only admins'; end if;
  if p_role not in ('admin', 'manager', 'editor', 'social', 'sales', 'support', 'analyst', 'leitura', 'client') then raise exception 'invalid role'; end if;
  select count(*) into n from members where org_id = p_org;
  if n >= public.org_limit(p_org, 'usuarios') then raise exception 'plan limit: usuarios'; end if;
  insert into invites(org_id, role, email, nome, usos_max, expira_em)
  values (p_org, p_role, nullif(lower(trim(p_email)), ''), nullif(trim(p_nome), ''), greatest(1, least(coalesce(p_usos, 1), 100)), now() + make_interval(days => greatest(1, least(coalesce(p_dias, 7), 30))))
  returning * into i;
  return i;
end $$;

-- Tela de boas-vindas (sem login): mostra só escola, função e se ainda vale. Nunca dados da escola.
create or replace function public.invite_info(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('escola', o.nome, 'role', i.role, 'nome', i.nome, 'email', i.email,
    'valido', i.usos < i.usos_max and i.expira_em > now() and o.status = 'ativa')
  from invites i join orgs o on o.id = i.org_id where i.code = lower(trim(p_code));
$$;

-- Aceite: depois de criar a conta/login. Confere validade e e-mail, entra com o perfil do convite.
create or replace function public.accept_invite(p_code text, p_user_nome text default null)
returns public.orgs language plpgsql security definer set search_path = public as $$
declare i invites; o orgs; mail text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into i from invites where code = lower(trim(p_code)) for update;
  if i.code is null then raise exception 'invite not found'; end if;
  if i.expira_em <= now() or i.usos >= i.usos_max then raise exception 'invite expired'; end if;
  if i.email is not null and i.email <> mail then raise exception 'invite for another email'; end if;
  select * into o from orgs where id = i.org_id;
  insert into members(org_id, user_id, role, nome, email, terms_version, terms_accepted_at)
  values (i.org_id, auth.uid(), i.role, coalesce(nullif(p_user_nome, ''), i.nome, auth.jwt() -> 'user_metadata' ->> 'nome'), mail,
          auth.jwt() -> 'user_metadata' ->> 'terms_version', (auth.jwt() -> 'user_metadata' ->> 'terms_accepted_at')::timestamptz)
  on conflict (org_id, user_id) do nothing;
  update invites set usos = usos + 1 where code = i.code;
  return o;
end $$;

revoke all on function public.create_invite(uuid, text, text, text, int, int) from public, anon;
revoke all on function public.accept_invite(text, text) from public, anon;
grant execute on function public.create_invite(uuid, text, text, text, int, int) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;
