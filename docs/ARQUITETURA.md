# Como os projetos foram unidos

## O que existia

| Origem | O que fazia | O que tinha de melhor |
|---|---|---|
| **Pauta Viral** (artefato) | Formulário que monta um briefing para o Claude criar ganchos, roteiro e legenda | Banco de ~110 ganchos por mecanismo, nível de consciência, molde de vídeo motion, regras de escrita humana |
| **LICEU · Inteligência comercial** (canvas de design) | Protótipo de painel com campanhas, CAC, contratos, turmas, estratégias, fontes e relatórios | Princípios de dados ("indisponível não é zero", "CAC de mídia não é CAC total"), diagnóstico como hipótese, memória de estratégias. Rodava com dados fictícios fixos no código |
| **Calendário Editorial · Valparaíso** (planilha) | Calendário de posts, controle diário de stories, resultados semanais | Rotina da equipe (segunda planeja, sexta registra), pilares, metas de seguidores, reels, depoimentos e avaliações |

## Decisão principal

Uma base de dados única, onde todo módulo lê e grava. O dado nasce uma vez e aparece em todo lugar:

```
Meta Ads (CSV) ──► campanhas + métricas ─┐
                                         ├──► Painel · Diagnóstico · Metas · Relatório
WhatsApp ───────► leads com campanha ────┤
                                         │
Pauta Viral ────► pautas ──► Calendário ─┘──► conteúdo publicado + resultado do post
```

O elo que faltava era o **lead com campanha de origem**. Sem ele, o Meta mostra custo por conversa e nunca o custo por matrícula.

## Duplicações eliminadas

| Antes | Agora |
|---|---|
| "Campanhas" do LICEU e a ideia de "analisar métricas do Facebook" | Um módulo **Meta Ads**, com dados reais importados |
| "Comercial / contratos" do LICEU e "mandar dados do WhatsApp" | Um módulo **WhatsApp e vendas**: o lead é o contrato em andamento |
| "Estratégias" do LICEU e "ideias, melhorias, testes" | Uma lista **Ideias e testes**, priorizada por nota |
| "Turmas" do LICEU e metas da planilha | Turmas em Vendas (vagas e ocupação); metas num lugar só, calculadas sozinhas |
| Aba RESULTADOS da planilha (reels, contatos, matrículas digitados à mão) | **Resultados semanais** preenchidos a partir do calendário e dos leads; só seguidores, depoimentos e avaliações são digitados |
| Rascunho da Pauta Viral salvo só no navegador | **Banco de pautas** compartilhado, com status e vínculo ao calendário |
| "Fontes de dados" do LICEU (simulação) | Importação real com histórico, desfazer e sem duplicar |
| Relatório do LICEU (prévia fixa) | Relatório gerado do período, editável e salvo com histórico |

## Modelo de dados

Cada coleção é uma lista de registros JSON. No Supabase, todos ficam na tabela `records` (`org_id`, `collection`, `id`, `data`), isolados por unidade via RLS.

| Coleção | Campos principais |
|---|---|
| `campaigns` | nome, canal, curso, objetivo, status |
| `adStats` | campanha, anúncio, início, fim, investimento, impressões, alcance, cliques, conversas |
| `leads` | nome, telefone, curso, turma, origem, campanha, anúncio, entrada, etapa, etapaMax, valor, dataMatricula, motivoPerda, próxima ação |
| `turmas` | curso, início, vagas, meta |
| `calendar` | data, tipo, título, curso, formato, pilar, objetivo, CTA, status, métricas do post, pauta |
| `stories` | id = data; 5 blocos (Feito, Pendente, Não se aplica) |
| `weekly` | id = segunda-feira; seguidores, depoimentos, avaliações, aprendizado |
| `pautas` | formulário da Pauta Viral, briefing, status, item do calendário |
| `goals` | indicador, alvo, período, curso |
| `funnels` | etapas com canal, peça, métrica e meta |
| `ideas` | hipótese, indicador, impacto, confiança, facilidade, status, resultado |
| `reports` | período, texto final, dados do momento |

Por que JSON por registro e não uma tabela por coleção: o MVP muda rápido, e a regra de acesso (quem é da unidade) é a mesma para tudo. Quando o volume crescer ou surgir integração com API, `leads` e `adStats` podem virar tabelas próprias sem mudar a interface (`js/store.js`).

## Cálculos

Todos em `js/metrics.js`, usados por todas as telas:

- **Custo por conversa** = investimento ÷ conversas iniciadas (Meta).
- **CPL** = investimento ÷ leads registrados com campanha.
- **CAC de mídia** = investimento ÷ matrículas de leads com campanha.
- **Conversão** = leads que chegaram à etapa ÷ leads que estavam na etapa anterior (coorte de quem entrou no período).
- **Métricas parciais de período**: uma linha do Meta que cobre 1 a 25/10, vista no período 20 a 31/10, entra proporcional aos dias. Exportar por dia elimina essa aproximação.

## Segurança

- Login por e-mail e senha (Supabase Auth), confirmação de e-mail e recuperação de senha.
- Unidade com código de convite; papéis administrador, edita e só leitura.
- RLS no banco: quem não é da unidade não lê nem grava nada dela; só leitura não grava; ninguém se promove sozinho.
- Auditoria de cada alteração (`audit_log`), visível para administradores.
- Aceite de termos com versão e data gravados por pessoa.

Testado em Postgres 16 com usuários simulados: isolamento entre unidades, papel de leitura, convite inválido, autopromoção e exclusão de conta.

## Próximos passos sugeridos

1. Integração com a API de Marketing do Meta (token de sistema guardado numa Edge Function do Supabase, nunca no navegador).
2. Webhook do WhatsApp Business para criar o lead sozinho com o parâmetro do anúncio (`ctwa_clid`).
3. Conciliação com o meio de pagamento para separar matrícula prometida de matrícula paga.
4. Relatório semanal enviado por e-mail toda sexta.
