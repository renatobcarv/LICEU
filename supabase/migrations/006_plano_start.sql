-- Klasso · migração 006: plano Start (R$ 97) e nomes atuais dos planos. Só acrescenta/atualiza nome; pode rodar de novo.
insert into public.plans(id, nome, limites, recursos) values
  ('start', 'Start', '{"usuarios": 2, "whatsapp": 1, "clientes": 0, "ia_mes": 100, "dominios": 0}', '{"whitelabel": "marca"}')
on conflict (id) do nothing;
update public.plans set nome = 'Essencial' where id = 'local';
update public.plans set nome = 'Escola' where id = 'pro';
update public.plans set nome = 'Rede' where id = 'agencia';
