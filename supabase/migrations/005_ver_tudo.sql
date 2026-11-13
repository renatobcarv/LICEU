-- FLOWCLASS · migração 005: todo mundo do time VÊ tudo; cada perfil só EDITA a própria área.
-- Coordenador (manager) continua editando tudo. Cliente continua restrito. Pode rodar de novo.
insert into public.role_grants(org_id, role, collection, perms)
select null, g.role, g.coll, g.perms from (values
  ('social', '*', 'r'), ('sales', '*', 'r'), ('support', '*', 'r'),
  -- jogo pessoal (missões, sequência, título): cada um grava o seu
  ('social', 'jogo', 'rw'), ('sales', 'jogo', 'rw'), ('support', 'jogo', 'rw'),
  ('analyst', 'jogo', 'rw'), ('leitura', 'jogo', 'rw')
) as g(role, coll, perms)
where not exists (select 1 from public.role_grants x where x.org_id is null and x.role = g.role and x.collection = g.coll);
