#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica o banco (schema + migrações) e roda os testes de isolamento.
set -euo pipefail
cd "$(dirname "$0")/../.."
D=$(mktemp -d); PORT=${PORT:-55432}
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
AS=""; if [ "$(id -u)" = 0 ]; then AS="runuser -u postgres --"; chown postgres "$D"; fi
$AS "$BIN/initdb" -D "$D" -U postgres -A trust >/dev/null
$AS "$BIN/pg_ctl" -D "$D" -o "-p $PORT -k $D" -l "$D/log" start >/dev/null
trap '$AS "$BIN/pg_ctl" -D "$D" stop -m fast >/dev/null; rm -rf "$D"' EXIT
P="psql -h $D -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$P -f tests/db/supabase_stub.sql
$P -f supabase/schema.sql
for f in supabase/migrations/*.sql; do $P -f "$f"; $P -f "$f"; done   # duas vezes: prova que pode rodar de novo
$P -t -f tests/db/isolamento.sql 2>&1 | grep -E "PASS|FAIL|ERROR|FIM" | sed "s/^psql:[^ ]* NOTICE:  //"
