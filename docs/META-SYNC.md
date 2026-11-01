# Sincronização automática com o Meta Ads

A função `supabase/functions/meta-sync` busca todo dia, na API de Marketing do Meta, o gasto, o alcance, as impressões, os cliques e as conversas de cada anúncio. Ela grava esses dados no mesmo formato da importação de CSV. Depois de ligada, não é preciso exportar relatório.

## 1. No Meta (Gerenciador de Negócios)
1. Crie o app em developers.facebook.com com o produto **API de Marketing**.
2. Crie o **usuário do sistema** (função Funcionário). Atribua a ele a conta de anúncios com permissão **ver desempenho**.
3. Gere o token com as permissões **ads_read** e **read_insights**, sem expiração.

## 2. No Supabase
1. Instale a CLI e faça login: `npx supabase login`.
2. Na pasta do projeto, publique a função: `npx supabase functions deploy meta-sync --project-ref kqaqccjsoqdpbnnyyemw`.
3. Em **Project Settings › Edge Functions › Secrets**, crie:
   - `META_TOKEN`: o token do usuário do sistema;
   - `META_ACCOUNT_ID`: o ID da conta de anúncios, só os números;
   - `ORG_ID`: o id da unidade, da tabela `orgs`.
4. No app, abra **Configurações** e ligue **"Sincronização com o Meta ligada"**. Isso faz aparecer o botão em Meta Ads.

O token fica só no servidor. Nunca vai para o navegador nem para o repositório.

## 3. Rodar todo dia (opcional)
No **SQL Editor**, ative as extensões `pg_cron` e `pg_net` e agende a função:

```sql
select cron.schedule('meta-sync-diario', '15 6 * * *', $$
  select net.http_post(
    url := 'https://kqaqccjsoqdpbnnyyemw.supabase.co/functions/v1/meta-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'), 'Content-Type', 'application/json'),
    body := '{"dias": 3}'::jsonb);
$$);
```

Antes de agendar, guarde a service role em `app.service_role_key`, com `alter database postgres set app.service_role_key = '...'`. Esse comando é rodado só no SQL Editor; a chave nunca entra no código.

## Como os dados entram
- **Linhas:** uma por anúncio por dia, com id `meta_<anúncio>_<data>`. Sincronizar de novo atualiza a linha em vez de duplicar.
- **Campanhas:** são ligadas pelo ID do Meta. As que não existem no app são criadas. Para cruzar com o funil, use os mesmos nomes no Gerenciador.
- **Conversas:** vêm das ações de "conversa por mensagem iniciada".
- **CSV:** depois de ligar a sincronização, **não importe o CSV do mesmo período**, ou o gasto conta duas vezes. Apague as importações antigas desse período em Meta Ads › Importações.
