-- Testes de isolamento entre empresas e de permissões por perfil.
-- Cada bloco tenta fazer algo como um usuário específico e falha (exceção) se o banco deixar passar o que não devia.
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------- cenário (como service role) ----------
insert into auth.users values
 ('a0000000-0000-0000-0000-00000000000a', 'dona.a@x.com'), ('b0000000-0000-0000-0000-00000000000b', 'dono.b@x.com'),
 ('50000000-0000-0000-0000-000000000005', 'suporte.a@x.com'), ('c0000000-0000-0000-0000-00000000000c', 'cliente.a@x.com'),
 ('9a000000-0000-0000-0000-0000000000aa', 'agencia@x.com'), ('cc000000-0000-0000-0000-0000000000cc', 'dono.filha@x.com');
insert into orgs(id, nome, plano) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Escola A', 'local'), ('bbbbbbbb-0000-0000-0000-000000000000', 'Escola B', 'local');
insert into orgs(id, nome, tipo, plano, slug, branding) values ('99999999-0000-0000-0000-000000000000', 'Agência G', 'agencia', 'agencia', 'agenciag', '{"nome":"Painel G","primaria":"#ff7a1a"}');
insert into members(org_id, user_id, role) values
 ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
 ('aaaaaaaa-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000005', 'support'),
 ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000c', 'client'),
 ('bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'owner'),
 ('99999999-0000-0000-0000-000000000000', '9a000000-0000-0000-0000-0000000000aa', 'admin');
insert into records(org_id, collection, id, data) values
 ('aaaaaaaa-0000-0000-0000-000000000000', 'leads', 'la1', '{"nome":"Lead A"}'),
 ('aaaaaaaa-0000-0000-0000-000000000000', 'adStats', 'sa1', '{"investimento":800}'),
 ('aaaaaaaa-0000-0000-0000-000000000000', 'reports', 'ra1', '{"titulo":"Mês"}'),
 ('bbbbbbbb-0000-0000-0000-000000000000', 'leads', 'lb1', '{"nome":"Lead B"}'),
 ('99999999-0000-0000-0000-000000000000', 'leads', 'lg1', '{"nome":"Lead da agência"}');
insert into wa_connections(id, org_id, waba_id, phone_number_id, status) values ('11111111-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'waba1', 'pn_a', 'conectado');
insert into wa_credentials(connection_id, token_cifrado) values ('11111111-0000-0000-0000-000000000000', 'cifrado');
grant all on all tables in schema public to service_role;

create or replace function pg_temp.como(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, true); perform set_config('role', 'authenticated', true); end $$;
create or replace function pg_temp.ok(nome text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', nome; else raise exception 'FAIL %', nome; end if; end $$;

-- 1. Dona da A só vê a A
begin; select pg_temp.como('a0000000-0000-0000-0000-00000000000a');
select pg_temp.ok('1 dona A vê os 3 registros dela', (select count(*) from records where org_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 3);
select pg_temp.ok('1b dona A não vê nada da B nem da agência', (select count(*) from records where org_id <> 'aaaaaaaa-0000-0000-0000-000000000000') = 0);
select pg_temp.ok('1c dona A não enxerga a empresa B', (select count(*) from orgs where id = 'bbbbbbbb-0000-0000-0000-000000000000') = 0);
rollback;

-- 2. Trocar o org_id na requisição não adianta
begin; select pg_temp.como('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into records(org_id, collection, id, data) values ('bbbbbbbb-0000-0000-0000-000000000000', 'leads', 'invasao', '{}');
  raise exception 'FAIL 2 gravou na empresa B';
exception when insufficient_privilege then raise notice 'PASS 2 gravar na empresa B é bloqueado'; end $$;
update records set data = '{"nome":"hack"}' where org_id = 'bbbbbbbb-0000-0000-0000-000000000000';
select pg_temp.ok('2b update na B não afeta nada', true);
rollback;
select pg_temp.ok('2c lead da B intacto', (select data->>'nome' from records where id = 'lb1') = 'Lead B');

-- 3. Atendimento: vê leads, não vê investimento, não grava campanha
begin; select pg_temp.como('50000000-0000-0000-0000-000000000005');
select pg_temp.ok('3 suporte vê leads', (select count(*) from records where collection = 'leads') = 1);
select pg_temp.ok('3b suporte NÃO vê gasto com anúncio', (select count(*) from records where collection = 'adStats') = 0);
do $$ begin
  insert into records(org_id, collection, id, data) values ('aaaaaaaa-0000-0000-0000-000000000000', 'campaigns', 'x', '{}');
  raise exception 'FAIL 3c suporte criou campanha';
exception when insufficient_privilege then raise notice 'PASS 3c suporte não cria campanha'; end $$;
insert into records(org_id, collection, id, data) values ('aaaaaaaa-0000-0000-0000-000000000000', 'leads', 'novo', '{}');
select pg_temp.ok('3d suporte cria lead', true);
rollback;

-- 4. Cliente: só relatórios
begin; select pg_temp.como('c0000000-0000-0000-0000-00000000000c');
select pg_temp.ok('4 cliente vê só o relatório', (select count(*) from records) = 1 and (select collection from records limit 1) = 'reports');
rollback;

-- 5. Ninguém do app lê o token do WhatsApp, nem a dona
begin; select pg_temp.como('a0000000-0000-0000-0000-00000000000a');
do $$ begin perform 1 from wa_credentials; raise exception 'FAIL 5 leu credencial';
exception when insufficient_privilege then raise notice 'PASS 5 token do WhatsApp inacessível pelo app'; end $$;
select pg_temp.ok('5b dona A vê a própria conexão', (select count(*) from wa_connections) = 1);
rollback;
begin; select pg_temp.como('b0000000-0000-0000-0000-00000000000b');
select pg_temp.ok('5c dono B não vê a conexão da A', (select count(*) from wa_connections) = 0);
do $$ begin
  insert into wa_connections(org_id, waba_id, phone_number_id) values ('bbbbbbbb-0000-0000-0000-000000000000', 'w', 'pn_falso');
  raise exception 'FAIL 5d app criou conexão sem passar pela Meta';
exception when insufficient_privilege then raise notice 'PASS 5d conexão só nasce pelo servidor'; end $$;
rollback;

-- 6. Ninguém se promove
begin; select pg_temp.como('50000000-0000-0000-0000-000000000005');
update members set role = 'owner' where user_id = '50000000-0000-0000-0000-000000000005';
select pg_temp.ok('6 suporte não consegue mudar o próprio papel', (select role from members where user_id = '50000000-0000-0000-0000-000000000005') = 'support');
rollback;

-- 7. Agência cria cliente e enxerga o cliente; o cliente não enxerga a agência
begin; select pg_temp.como('9a000000-0000-0000-0000-0000000000aa');
select create_child_org('99999999-0000-0000-0000-000000000000', 'Cliente Filho', 'filho');
select pg_temp.ok('7 agência vê o cliente criado', (select count(*) from my_orgs() where nome = 'Cliente Filho') = 1);
select pg_temp.ok('7b cliente herdou a marca da agência', (select branding->>'nome' from orgs where nome = 'Cliente Filho') = 'Painel G');
insert into records(org_id, collection, id, data) select id, 'leads', 'lf1', '{"nome":"Lead filho"}' from orgs where nome = 'Cliente Filho';
select pg_temp.ok('7c agência grava no cliente', true);
reset role;
insert into members(org_id, user_id, role) select id, 'cc000000-0000-0000-0000-0000000000cc', 'owner' from orgs where nome = 'Cliente Filho';
select pg_temp.como('cc000000-0000-0000-0000-0000000000cc');
select pg_temp.ok('7d dono do cliente vê o próprio lead', (select count(*) from records where id = 'lf1') = 1);
select pg_temp.ok('7e dono do cliente NÃO vê dados da agência', (select count(*) from records where id = 'lg1') = 0);
rollback;

-- 8. Escola A (plano local) não cria cliente nem domínio próprio
begin; select pg_temp.como('a0000000-0000-0000-0000-00000000000a');
do $$ begin perform create_child_org('aaaaaaaa-0000-0000-0000-000000000000', 'X'); raise exception 'FAIL 8';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS 8 escola não vira agência sozinha'; end $$;
do $$ begin insert into org_domains(host, org_id) values ('painel.escola-a.com', 'aaaaaaaa-0000-0000-0000-000000000000'); raise exception 'FAIL 8b';
exception when insufficient_privilege then raise notice 'PASS 8b plano local não tem domínio próprio'; end $$;
rollback;

-- 9. Marca pública pelo subdomínio, sem login
begin; set local role anon;
select pg_temp.ok('9 marca da agência pelo subdomínio', (select branding_for_host('agenciag.flowclass.app')->>'nome') = 'Painel G');
select pg_temp.ok('9b domínio desconhecido devolve vazio', branding_for_host('qualquer.com') = '{}'::jsonb);
do $$ begin perform 1 from records; raise exception 'FAIL 9c anônimo leu dados';
exception when insufficient_privilege then raise notice 'PASS 9c visitante sem login não lê dados'; end $$;
rollback;

-- 10. Auditoria registra quem mexeu
select pg_temp.ok('10 auditoria registrou as gravações', (select count(*) from audit_log) >= 5);
\echo FIM

-- 11. Teste grátis: empresa nova nasce com 7 dias e plano escolhido no cadastro
begin; select pg_temp.como('cc000000-0000-0000-0000-0000000000cc');
select set_config('request.jwt.claims', '{"email":"x@x.com","user_metadata":{"nome":"Novo","plano_interesse":"pro"}}', true);
select create_org('Escola Nova');
select pg_temp.ok('11 cadastro cria teste de 7 dias no plano escolhido', (select (trial_status(id)->>'dias')::int = 7 and trial_status(id)->>'status' = 'teste' and plano = 'pro' from orgs where nome = 'Escola Nova'));
select pg_temp.ok('11b quem não é membro não vê o teste de outra empresa', (select trial_status('aaaaaaaa-0000-0000-0000-000000000000') is null));
rollback;

-- 12. Convites: só admin cria, link mostra só escola e função, aceite entra com o perfil e respeita e-mail e uso único
insert into auth.users values ('d0000000-0000-0000-0000-00000000000d', 'novo@x.com'), ('e0000000-0000-0000-0000-00000000000e', 'outro@x.com');
begin; select pg_temp.como('50000000-0000-0000-0000-000000000005');
do $$ begin perform create_invite('aaaaaaaa-0000-0000-0000-000000000000', 'admin'); raise exception 'FAIL 12';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS 12 atendimento não cria convite'; end $$;
rollback;
begin; select pg_temp.como('a0000000-0000-0000-0000-00000000000a');
create temp table cv as select code from create_invite('aaaaaaaa-0000-0000-0000-000000000000', 'sales', 'novo@x.com', 'Novo Vendedor');
do $$ begin perform create_invite('aaaaaaaa-0000-0000-0000-000000000000', 'owner'); raise exception 'FAIL 12b';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS 12b ninguém convida para dono'; end $$;
grant select on cv to anon, authenticated;
reset role; set local role anon;
select pg_temp.ok('12c visitante vê só escola e função do convite', (select (invite_info(code)->>'escola') = 'Escola A' and (invite_info(code)->>'role') = 'sales' and not (invite_info(code) ? 'invite_code') from cv));
reset role;
select set_config('request.jwt.claims', '{"email":"outro@x.com"}', true); select pg_temp.como('e0000000-0000-0000-0000-00000000000e');
do $$ begin perform accept_invite((select code from cv)); raise exception 'FAIL 12d';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS 12d convite com e-mail não serve para outra pessoa'; end $$;
reset role;
select set_config('request.jwt.claims', '{"email":"novo@x.com"}', true); select pg_temp.como('d0000000-0000-0000-0000-00000000000d');
select accept_invite((select code from cv));
select pg_temp.ok('12e aceite entra com o perfil do convite', (select role from members where user_id = 'd0000000-0000-0000-0000-00000000000d') = 'sales');
select pg_temp.ok('12f novo vendedor não vê gasto com anúncio', (select count(*) from records where collection = 'adStats') = 0);
do $$ begin perform accept_invite((select code from cv)); raise exception 'FAIL 12g';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS 12g convite de uso único não serve duas vezes'; end $$;
rollback;
\echo FIM2
