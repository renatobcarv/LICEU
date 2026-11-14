-- Klasso · migração 007: conexão de WhatsApp por QR Code (Evolution API, não oficial) ao lado da API oficial.
-- Só acrescenta; pode rodar de novo. Conexões existentes viram tipo 'oficial'.
alter table public.wa_connections add column if not exists tipo text not null default 'oficial';
alter table public.wa_connections add column if not exists instancia text;           -- nome da instância na Evolution API (QR)
alter table public.wa_connections add column if not exists aceite_risco_em timestamptz; -- quando o admin aceitou o risco do modo QR
do $$ begin
  alter table public.wa_connections add constraint wa_conn_tipo_chk check (tipo in ('oficial', 'qr'));
exception when duplicate_object then null; end $$;
create unique index if not exists wa_conn_instancia_idx on public.wa_connections(instancia) where instancia is not null;
