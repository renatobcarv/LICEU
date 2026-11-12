-- FLOWCLASS · migração 003: teste grátis de 7 dias.
-- Toda empresa criada pelo cadastro começa em "teste" com fim em 7 dias. Só acrescenta; pode rodar de novo.

create or replace function public.create_org(p_nome text, p_user_nome text default null)
returns public.orgs language plpgsql security definer set search_path = public as $$
declare o orgs; p text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- Plano escolhido na página de planos (gravado no cadastro); sem escolha, Escola.
  p := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'plano_interesse', ''), 'local');
  if not exists (select 1 from plans where id = p) then p := 'local'; end if;
  insert into orgs(nome, created_by, plano, tipo) values (trim(p_nome), auth.uid(), p, case when p = 'agencia' then 'agencia' else 'empresa' end) returning * into o;
  insert into members(org_id, user_id, role, nome, email, terms_version, terms_accepted_at)
  values (o.id, auth.uid(), 'owner', coalesce(nullif(p_user_nome, ''), auth.jwt() -> 'user_metadata' ->> 'nome'), auth.jwt() ->> 'email',
          auth.jwt() -> 'user_metadata' ->> 'terms_version', (auth.jwt() -> 'user_metadata' ->> 'terms_accepted_at')::timestamptz);
  insert into subscriptions(org_id, plano, status, inicio, fim) values (o.id, o.plano, 'teste', current_date, current_date + 7)
  on conflict (org_id) do nothing;
  return o;
end $$;

-- Situação do teste para a tela (qualquer membro vê quantos dias faltam; detalhes de cobrança só o admin).
create or replace function public.trial_status(o uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_member(o) then
    (select jsonb_build_object('status', s.status, 'plano', s.plano, 'fim', s.fim, 'dias', greatest(0, s.fim - current_date))
       from subscriptions s where s.org_id = o)
  end;
$$;
grant execute on function public.trial_status(uuid) to authenticated;
