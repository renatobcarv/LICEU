-- FLOWCLASS · migração 002: fundação SaaS (multiempresa, perfis, agências, white-label, planos, WhatsApp por empresa)
-- Rode DEPOIS do schema.sql (Supabase > SQL Editor). Só acrescenta: não apaga dado nenhum e pode rodar de novo.
--
-- Níveis (o mesmo banco serve a todos):
--   1. Escola local ........ perfis granulares, marca própria, WhatsApp conectado pelo painel
--   2. Várias escolas ...... cada empresa com seus números, limites de plano e consumo
--   3. Agências ............ agência > clientes (parent_id), white-label e domínio próprio
--   4. Escala .............. tabelas dedicadas de mensagens, filas e cobrança (já previstas aqui)

-- ===================== empresas: hierarquia, plano e marca =====================
alter table public.orgs add column if not exists parent_id uuid references public.orgs(id) on delete restrict;
alter table public.orgs add column if not exists tipo text not null default 'empresa';
alter table public.orgs add column if not exists plano text not null default 'local';
alter table public.orgs add column if not exists slug text;
alter table public.orgs add column if not exists branding jsonb not null default '{}'::jsonb;
alter table public.orgs add column if not exists status text not null default 'ativa';
do $$ begin
  alter table public.orgs add constraint orgs_tipo_chk check (tipo in ('plataforma', 'agencia', 'empresa'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orgs add constraint orgs_slug_chk check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,40}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orgs add constraint orgs_no_self_parent check (parent_id is null or parent_id <> id);
exception when duplicate_object then null; end $$;
create unique index if not exists orgs_slug_uq on public.orgs(slug) where slug is not null;
create index if not exists orgs_parent_idx on public.orgs(parent_id);

-- ===================== perfis =====================
-- owner/admin: tudo · manager: operação inteira · editor: legado (tudo menos administrar)
-- social: conteúdo · sales: funil e matrículas · support: atendimento WhatsApp
-- analyst: lê tudo, escreve relatórios · leitura: lê tudo · client: só o que é dele (relatórios, metas, calendário)
alter table public.members drop constraint if exists members_role_check;
do $$ begin
  alter table public.members add constraint members_role_check
    check (role in ('owner', 'admin', 'manager', 'editor', 'social', 'sales', 'support', 'analyst', 'leitura', 'client'));
exception when duplicate_object then null; end $$;

-- Permissão por perfil e coleção. org_id nulo = padrão da plataforma; com org_id = ajuste daquela empresa.
-- perms: 'r' lê, 'w' grava. collection '*' vale para todas.
create table if not exists public.role_grants (
  id bigint generated always as identity primary key,
  org_id uuid references public.orgs(id) on delete cascade,
  role text not null,
  collection text not null,
  perms text not null check (perms ~ '^r?w?$' and perms <> '')
);
create unique index if not exists role_grants_uq on public.role_grants(coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), role, collection);

insert into public.role_grants(org_id, role, collection, perms)
select null, g.role, g.coll, g.perms from (values
  ('owner', '*', 'rw'), ('admin', '*', 'rw'), ('manager', '*', 'rw'), ('editor', '*', 'rw'),
  ('analyst', '*', 'r'), ('analyst', 'reports', 'rw'), ('analyst', 'chat', 'rw'),
  ('leitura', '*', 'r'),
  ('social', 'settings', 'r'), ('social', 'courses', 'r'), ('social', 'turmas', 'r'), ('social', 'goals', 'r'), ('social', 'team', 'r'),
  ('social', 'campaigns', 'r'), ('social', 'plans', 'r'),
  ('social', 'pautas', 'rw'), ('social', 'calendar', 'rw'), ('social', 'stories', 'rw'), ('social', 'weekly', 'rw'),
  ('social', 'ideas', 'rw'), ('social', 'boards', 'rw'), ('social', 'chat', 'rw'),
  ('sales', 'settings', 'r'), ('sales', 'courses', 'r'), ('sales', 'turmas', 'r'), ('sales', 'products', 'r'), ('sales', 'pipelines', 'r'),
  ('sales', 'goals', 'r'), ('sales', 'team', 'rw'), ('sales', 'campaigns', 'r'),
  ('sales', 'leads', 'rw'), ('sales', 'imports', 'rw'), ('sales', 'wamsg', 'rw'), ('sales', 'chat', 'rw'),
  ('support', 'settings', 'r'), ('support', 'courses', 'r'), ('support', 'turmas', 'r'), ('support', 'products', 'r'), ('support', 'pipelines', 'r'),
  ('support', 'team', 'r'), ('support', 'leads', 'rw'), ('support', 'wamsg', 'rw'), ('support', 'chat', 'rw'),
  ('client', 'settings', 'r'), ('client', 'reports', 'r'), ('client', 'goals', 'r'), ('client', 'calendar', 'r'), ('client', 'pautas', 'r'), ('client', 'chat', 'rw')
) as g(role, coll, perms)
where not exists (select 1 from public.role_grants r where r.org_id is null and r.role = g.role and r.collection = g.coll);

-- Ancestrais de uma empresa (ela mesma, a agência, a plataforma). Limite de 5 níveis.
create or replace function public.org_chain(o uuid) returns table(id uuid, depth int)
language sql stable security definer set search_path = public as $$
  with recursive c(id, parent_id, depth) as (
    select id, parent_id, 0 from orgs where id = o
    union all
    select p.id, p.parent_id, c.depth + 1 from orgs p join c on p.id = c.parent_id where c.depth < 5
  ) select id, depth from c;
$$;

-- Papel efetivo do usuário logado numa empresa: o direto, ou o da agência acima (só owner/admin/manager descem).
create or replace function public.my_role(o uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from members where org_id = o and user_id = auth.uid()),
    (select m.role from org_chain(o) c join members m on m.org_id = c.id
      where c.depth > 0 and m.user_id = auth.uid() and m.role in ('owner', 'admin', 'manager')
      order by c.depth limit 1)
  );
$$;

create or replace function public.is_member(o uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.my_role(o) is not null; $$;

create or replace function public.can_edit(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role(o) in ('owner', 'admin', 'manager', 'editor', 'social', 'sales', 'support', 'analyst');
$$;

create or replace function public.is_admin(o uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.my_role(o) in ('owner', 'admin'); $$;

create or replace function public.can_coll(o uuid, coll text, p text) returns boolean
language sql stable security definer set search_path = public as $$
  with r as (select public.my_role(o) as role)
  select exists (
    select 1 from role_grants g, r
    where g.role = r.role and (g.collection = coll or g.collection = '*') and position(p in g.perms) > 0
      and (g.org_id is null or g.org_id = o)
  ) and not exists (
    -- ajuste da empresa que remove o acesso: perms sem a letra, na mesma coleção
    select 1 from role_grants g, r where g.org_id = o and g.role = r.role and g.collection = coll and position(p in g.perms) = 0
  );
$$;

-- Dados: agora a regra é por perfil E coleção (financeiro some do atendimento no banco, não só na tela).
drop policy if exists records_select on public.records;
create policy records_select on public.records for select using (public.can_coll(org_id, collection, 'r'));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert with check (public.can_coll(org_id, collection, 'w'));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update using (public.can_coll(org_id, collection, 'w')) with check (public.can_coll(org_id, collection, 'w'));
drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete using (public.can_coll(org_id, collection, 'w'));

alter table public.role_grants enable row level security;
drop policy if exists role_grants_select on public.role_grants;
create policy role_grants_select on public.role_grants for select using (org_id is null or public.is_member(org_id));
drop policy if exists role_grants_write on public.role_grants;
create policy role_grants_write on public.role_grants for all using (org_id is not null and public.is_admin(org_id)) with check (org_id is not null and public.is_admin(org_id));

-- Membros: admin muda papel, mas ninguém se promove nem cria owner sem ser owner.
create or replace function public.guard_member_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'owner' and public.my_role(new.org_id) <> 'owner' and auth.uid() is not null then
    raise exception 'only owner can grant owner';
  end if;
  if tg_op = 'UPDATE' and old.user_id = auth.uid() and new.role <> old.role then
    raise exception 'cannot change own role';
  end if;
  return new;
end $$;
drop trigger if exists members_role_guard on public.members;
create trigger members_role_guard before update on public.members for each row execute function public.guard_member_role();

-- ===================== planos e consumo =====================
create table if not exists public.plans (
  id text primary key,
  nome text not null,
  limites jsonb not null default '{}'::jsonb,
  recursos jsonb not null default '{}'::jsonb,
  ativo boolean not null default true
);
insert into public.plans(id, nome, limites, recursos) values
  ('local', 'Escola', '{"usuarios": 10, "whatsapp": 1, "clientes": 0, "ia_mes": 500, "dominios": 0}', '{"whitelabel": "marca"}'),
  ('pro', 'Rede', '{"usuarios": 40, "whatsapp": 5, "clientes": 0, "ia_mes": 5000, "dominios": 1}', '{"whitelabel": "dominio"}'),
  ('agencia', 'Agência', '{"usuarios": 100, "whatsapp": 30, "clientes": 50, "ia_mes": 30000, "dominios": 5}', '{"whitelabel": "completo"}')
on conflict (id) do nothing;
do $$ begin
  alter table public.orgs add constraint orgs_plano_fk foreign key (plano) references public.plans(id);
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  plano text not null references public.plans(id),
  status text not null default 'cortesia' check (status in ('cortesia', 'teste', 'ativa', 'atrasada', 'cancelada')),
  gateway text, gateway_ref text,
  inicio date not null default current_date, fim date,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_records (
  org_id uuid not null references public.orgs(id) on delete cascade,
  metrica text not null,
  periodo text not null, -- AAAA-MM
  qtd bigint not null default 0,
  primary key (org_id, metrica, periodo)
);

create or replace function public.org_limit(o uuid, k text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((p.limites ->> k)::int, 0) from orgs g join plans p on p.id = g.plano where g.id = o;
$$;

-- Soma consumo (chamado pelas funções do servidor, ex.: a cada geração de IA ou mensagem enviada).
create or replace function public.add_usage(o uuid, m text, n int default 1) returns bigint
language sql security definer set search_path = public as $$
  insert into usage_records(org_id, metrica, periodo, qtd) values (o, m, to_char(now(), 'YYYY-MM'), n)
  on conflict (org_id, metrica, periodo) do update set qtd = usage_records.qtd + excluded.qtd
  returning qtd;
$$;
revoke all on function public.add_usage(uuid, text, int) from public, anon, authenticated;
grant execute on function public.add_usage(uuid, text, int) to service_role;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select using (true);
drop policy if exists subs_select on public.subscriptions;
create policy subs_select on public.subscriptions for select using (public.is_admin(org_id));
drop policy if exists usage_select on public.usage_records;
create policy usage_select on public.usage_records for select using (public.is_admin(org_id));

-- ===================== agências: criar cliente =====================
create or replace function public.create_child_org(p_parent uuid, p_nome text, p_slug text default null)
returns public.orgs language plpgsql security definer set search_path = public as $$
declare o orgs; pai orgs; n int;
begin
  select * into pai from orgs where id = p_parent;
  if pai.id is null or pai.tipo not in ('agencia', 'plataforma') then raise exception 'parent is not an agency'; end if;
  if public.my_role(p_parent) not in ('owner', 'admin') then raise exception 'only agency admins'; end if;
  select count(*) into n from orgs where parent_id = p_parent;
  if n >= public.org_limit(p_parent, 'clientes') then raise exception 'plan limit: clientes'; end if;
  insert into orgs(nome, parent_id, tipo, plano, slug, created_by, branding)
  values (trim(p_nome), p_parent, 'empresa', pai.plano, nullif(lower(trim(p_slug)), ''), auth.uid(), pai.branding)
  returning * into o;
  return o;
end $$;
revoke all on function public.create_child_org(uuid, text, text) from public, anon;
grant execute on function public.create_child_org(uuid, text, text) to authenticated;

-- Empresas que o usuário enxerga (diretas + clientes das agências que administra).
create or replace function public.my_orgs() returns table(id uuid, nome text, tipo text, parent_id uuid, role text, plano text, branding jsonb, invite_code text)
language sql stable security definer set search_path = public as $$
  select o.id, o.nome, o.tipo, o.parent_id, public.my_role(o.id), o.plano, o.branding,
         case when public.is_admin(o.id) then o.invite_code end
  from orgs o where public.is_member(o.id) and o.status = 'ativa' order by o.parent_id nulls first, o.nome;
$$;
grant execute on function public.my_orgs() to authenticated;

-- ===================== white-label: domínios =====================
create table if not exists public.org_domains (
  host text primary key check (host ~ '^[a-z0-9.-]{4,253}$'),
  org_id uuid not null references public.orgs(id) on delete cascade,
  token text not null default encode(gen_random_bytes(16), 'hex'), -- vai no TXT _flowclass.<host>
  verificado boolean not null default false,
  verificado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists org_domains_org_idx on public.org_domains(org_id);
alter table public.org_domains enable row level security;
drop policy if exists domains_select on public.org_domains;
create policy domains_select on public.org_domains for select using (public.is_admin(org_id));
drop policy if exists domains_insert on public.org_domains;
create policy domains_insert on public.org_domains for insert with check (public.is_admin(org_id) and not verificado
  and (select count(*) from org_domains d where d.org_id = org_domains.org_id) < public.org_limit(org_id, 'dominios'));
drop policy if exists domains_delete on public.org_domains;
create policy domains_delete on public.org_domains for delete using (public.is_admin(org_id));

-- Marca pública por domínio (tela de login antes de entrar). Só devolve o visual, nunca dados.
create or replace function public.branding_for_host(h text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.branding || jsonb_build_object('org', o.slug) from org_domains d join orgs o on o.id = d.org_id where d.host = lower(h) and d.verificado),
    (select o.branding || jsonb_build_object('org', o.slug) from orgs o where o.slug is not null and lower(h) like o.slug || '.%' and o.status = 'ativa' limit 1),
    '{}'::jsonb);
$$;
grant execute on function public.branding_for_host(text) to anon, authenticated;

-- ===================== WhatsApp oficial por empresa =====================
create table if not exists public.wa_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null unique, -- é por ele que o webhook descobre a empresa
  telefone text,
  nome_verificado text,
  status text not null default 'pendente' check (status in ('pendente', 'conectado', 'erro', 'desconectado')),
  qualidade text,
  webhook_ok boolean not null default false,
  erro text,
  conectado_em timestamptz,
  ultima_sync timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists wa_conn_org_idx on public.wa_connections(org_id);
alter table public.wa_connections enable row level security;
drop policy if exists wa_conn_select on public.wa_connections;
create policy wa_conn_select on public.wa_connections for select using (public.is_member(org_id));
drop policy if exists wa_conn_delete on public.wa_connections;
create policy wa_conn_delete on public.wa_connections for delete using (public.is_admin(org_id));
-- Inclusão e atualização só pelas funções do servidor (service role), depois de validar com a Meta.

-- Credenciais cifradas (AES-GCM no servidor com WA_ENC_KEY). Sem política: ninguém do app lê, só a service role.
create table if not exists public.wa_credentials (
  connection_id uuid primary key references public.wa_connections(id) on delete cascade,
  token_cifrado text not null,
  expira_em timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.wa_credentials enable row level security;

-- Idempotência do webhook: cada evento da Meta entra uma vez só.
create table if not exists public.wa_events (
  id text primary key,
  org_id uuid references public.orgs(id) on delete cascade,
  recebido_em timestamptz not null default now()
);
alter table public.wa_events enable row level security;

-- Nível 4 (prontas, ainda não usadas pelo app): conversas e mensagens em tabelas próprias para volume alto.
create table if not exists public.wa_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  connection_id uuid references public.wa_connections(id) on delete set null,
  contato text not null,
  lead_id text,
  atendente uuid references auth.users(id) on delete set null,
  fila text, status text not null default 'aberta' check (status in ('aberta', 'pendente', 'resolvida')),
  nao_lidas int not null default 0,
  ultima_msg_em timestamptz,
  unique (org_id, connection_id, contato)
);
create index if not exists wa_conv_org_idx on public.wa_conversations(org_id, status, ultima_msg_em desc);
create table if not exists public.wa_messages (
  id text primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  dir text not null check (dir in ('in', 'out', 'nota')),
  tipo text not null default 'text', texto text, midia_url text,
  status text, autor uuid, em timestamptz not null default now()
);
create index if not exists wa_msg_conv_idx on public.wa_messages(conversation_id, em);
alter table public.wa_conversations enable row level security;
alter table public.wa_messages enable row level security;
drop policy if exists wa_conv_rw on public.wa_conversations;
create policy wa_conv_rw on public.wa_conversations for all using (public.can_coll(org_id, 'wamsg', 'r')) with check (public.can_coll(org_id, 'wamsg', 'w'));
drop policy if exists wa_msg_rw on public.wa_messages;
create policy wa_msg_rw on public.wa_messages for all using (public.can_coll(org_id, 'wamsg', 'r')) with check (public.can_coll(org_id, 'wamsg', 'w'));

-- ===================== permissões de tabela =====================
grant select on public.plans, public.role_grants, public.wa_connections to authenticated;
grant insert, update, delete on public.role_grants to authenticated;
grant select, insert, delete on public.org_domains to authenticated;
grant delete on public.wa_connections to authenticated;
grant select on public.subscriptions, public.usage_records to authenticated;
grant select, insert, update, delete on public.wa_conversations, public.wa_messages to authenticated;
revoke all on public.wa_credentials, public.wa_events from anon, authenticated;

-- Quem criou a primeira empresa vira owner (antes era admin).
update public.members m set role = 'owner'
where role = 'admin' and exists (select 1 from public.orgs o where o.id = m.org_id and o.created_by = m.user_id)
  and not exists (select 1 from public.members x where x.org_id = m.org_id and x.role = 'owner');

create or replace function public.create_org(p_nome text, p_user_nome text default null)
returns public.orgs language plpgsql security definer set search_path = public as $$
declare o orgs;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into orgs(nome, created_by) values (trim(p_nome), auth.uid()) returning * into o;
  insert into members(org_id, user_id, role, nome, email, terms_version, terms_accepted_at)
  values (o.id, auth.uid(), 'owner', coalesce(nullif(p_user_nome, ''), auth.jwt() -> 'user_metadata' ->> 'nome'), auth.jwt() ->> 'email',
          auth.jwt() -> 'user_metadata' ->> 'terms_version', (auth.jwt() -> 'user_metadata' ->> 'terms_accepted_at')::timestamptz);
  insert into subscriptions(org_id, plano) values (o.id, o.plano) on conflict do nothing;
  return o;
end $$;

-- Excluir a própria conta: owner também conta como dono da empresa.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  for r in select m.org_id from members m where m.user_id = auth.uid() and m.role in ('owner', 'admin') loop
    if (select count(*) from members where org_id = r.org_id and role in ('owner', 'admin')) = 1
       and (select count(*) from members where org_id = r.org_id) > 1 then
      raise exception 'transfer admin before deleting';
    end if;
    if (select count(*) from members where org_id = r.org_id) = 1 and not exists (select 1 from orgs where parent_id = r.org_id) then
      delete from orgs where id = r.org_id;
    end if;
  end loop;
  delete from auth.users where id = auth.uid();
end $$;

do $$ begin
  alter publication supabase_realtime add table public.wa_connections;
exception when duplicate_object then null; when undefined_object then null; end $$;
