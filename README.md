# LICEU Intelligence

**Marketing e matrículas em um só lugar: do anúncio à matrícula.**

O LICEU Intelligence junta, numa única plataforma, o que antes vivia espalhado entre o Gerenciador de Anúncios, o WhatsApp, uma planilha de calendário e o gerador de pautas. A coordenação de marketing vê o que funciona, o que precisa melhorar e o que fazer primeiro, com base nos números reais da unidade.

![Status](https://img.shields.io/badge/status-MVP%20funcional-B07A2A)
![Licença](https://img.shields.io/badge/licença-proprietária-2B0706)

---

## A pergunta central

> **Qual campanha gera matrícula, quanto ela custa, e o que fazemos a seguir?**

Para responder, cada lead do WhatsApp é registrado com a campanha que o trouxe. O investimento vem do Meta Ads; a matrícula vem do funil comercial. O cruzamento dos dois dá o CAC real por campanha e por anúncio.

## Módulos

| Módulo | O que faz |
|---|---|
| **Painel** | Matrículas em destaque com a meta e o ritmo, metas e testes em andamento, indicadores comparados ao período anterior, funil do anúncio à matrícula, prioridades geradas pelos dados e agenda da semana. |
| **Meta Ads** | Importa o CSV do Gerenciador com todas as colunas (veiculação, valor gasto, resultados, custo por resultado, alcance, impressões, frequência, cliques, CPM, CTR, CPC, custos por clique único e por 1.000 alcançadas, compras), sem duplicar ao reimportar. Compara campanhas lado a lado, aponta CTR baixo, frequência alta e custo acima da média, detalha por anúncio e deixa corrigir qualquer linha à mão. Também aceita Google Ads e digitação manual. |
| **Funil** | Vários funis em Kanban, cada um com nome e etapas próprias (com limite de cartões por coluna). Botão de ganho, produtos que preenchem a matrícula sozinhos, adição de nomes direto na coluna, importação de listas, filtros (só ganhos, só perdidos, retornos de hoje, responsável, temperatura), cartões parados em destaque, análise por etapa, responsável e origem, e respostas prontas. |
| **Matrículas** | Quem comprou: registro direto ou vindo do funil, valor, data, forma e status de pagamento (pago, parcial, pendente), recebido e a receber, por curso e por turma. Tudo editável à mão. |
| **Pauta Viral** | O gerador de briefing original (formatos, ganchos, nível de consciência, vídeo motion). Ao salvar, a pauta vai direto para o calendário: você escolhe o dia num mini calendário. |
| **Calendário** | Mês e lista com publicações, gravações, campanhas, turmas, tarefas e eventos; resultado de cada post; controle diário de stories e resultados semanais (as três abas da planilha). |
| **Metas e estratégias** | Metas com ritmo calculado sozinho; funis planejados em Kanban ligados às etapas reais; ideias e testes em Kanban, medidos automaticamente contra a linha de base, com decisão e aprendizado registrados. |
| **Relatórios** | Rascunho automático do período (resultados, mídia, funil, conteúdo, perdas, metas, problemas, oportunidades e próximos passos), revisão pelo coordenador, histórico, cópia em texto e download em Markdown. |
| **Configurações** | Unidade, cursos e preços, equipe com convite e papéis, backup em JSON, dados de exemplo e ferramentas de LGPD. |

Detalhes de como os dois artefatos originais foram unidos e por quê: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Princípios de dados

- **Indisponível não é zero.** Sem dado, o painel mostra "—" e diz o que falta.
- **Matrícula é matrícula.** Só conta quando o lead é marcado como matriculado, com valor e data.
- **CAC de mídia não é CAC total**, e é rotulado assim.
- **Comparações justas:** sempre contra o período anterior de mesmo tamanho.
- **Diagnóstico é hipótese.** As prioridades vêm de regras explícitas (em `js/metrics.js`) e pedem confirmação antes de mudar verba.

## Tecnologia

| Camada | Escolha | Por quê |
|---|---|---|
| Interface | HTML, CSS e JavaScript puro (módulos ES), visual Noir | Sem etapa de build pesada; abre direto no navegador; fácil de manter |
| Banco e login | [Supabase](https://supabase.com) (Postgres + Auth + Realtime) | Login pronto, regras de acesso por unidade no próprio banco (RLS) e atualização em tempo real |
| Hospedagem | [Vercel](https://vercel.com) | Deploy a cada push no GitHub, HTTPS e cabeçalhos de segurança |

Com `js/config.js` vazio, o app roda em **modo de teste**: sem login, com os dados salvos só no navegador.

## Estrutura

```
index.html            casca do app
termos.html           Termos de Uso
privacidade.html      Política de Privacidade (LGPD)
css/app.css           visual Noir
js/app.js             navegação, filtros e inicialização
js/auth.js            cadastro, login, recuperação de senha e unidade
js/store.js           dados (Supabase, navegador ou claude.ai, mesma interface)
js/metrics.js         todos os cálculos e o diagnóstico
js/views/*.js         um arquivo por módulo
js/pauta-data.js      banco de ganchos e regras da Pauta Viral
data/seed.json        dados iniciais (cursos e o calendário de setembro da planilha)
supabase/schema.sql   tabelas, regras de acesso, convites e auditoria
tools/write-config.mjs  gera js/config.js no build da Vercel
```

## Como colocar no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com). Escolha a região **São Paulo (sa-east-1)**.
2. Abra **SQL Editor › New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Authentication › URL Configuration**, coloque o endereço da Vercel em **Site URL** (ex.: `https://liceu.vercel.app`) e o mesmo em **Redirect URLs**.
4. Em **Authentication › Providers › Email**, deixe "Confirm email" ligado.
5. Em **Project Settings › API Keys**, a chave **publishable** (`sb_publishable_...`) é a que vai no app. Nunca use a chave secreta (`sb_secret_...`) nem a `service_role` no front-end.

### 2. Vercel

1. Em [vercel.com](https://vercel.com), **Add New › Project** e importe este repositório do GitHub.
2. Framework: **Other**. O `vercel.json` já define o build.
3. O projeto Supabase já está em `js/config.js` (URL e chave publishable, que são públicas). Para apontar para outro projeto sem mexer no código, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY` em **Environment Variables**.
4. **Deploy**. Cada push na branch principal publica de novo.

### 3. Primeiro acesso

1. Abra o endereço, clique em **Criar conta**, aceite os termos e confirme o e-mail.
2. Crie a unidade (ex.: "TEC Mais · Valparaíso de Goiás"). Você vira administrador e os cursos e o calendário de setembro já entram.
3. Em **Configurações › Equipe**, copie o código de convite e mande para quem vai usar. Ajuste os papéis depois que entrarem.

### Rodar no computador

```bash
npm run dev        # abre em http://localhost:5173, já conectado ao Supabase
```

Para testar sem login (dados só no navegador), deixe `SUPABASE_URL` vazio em `js/config.js`. Em `http://localhost:5173`, lembre de incluir esse endereço em **Redirect URLs** do Supabase.

## Antes de usar com dados reais

- Preencha os campos entre colchetes em `termos.html` e `privacidade.html` (razão social, CNPJ, endereço, encarregado, foro, região do banco) e peça revisão a um advogado.
- Em Configurações, cadastre o preço de cada curso e as turmas abertas.
- Combine com a equipe: **todo contato novo no WhatsApp vira lead, com a campanha de origem**. É isso que faz o CAC por campanha existir.

## Roadmap

- [x] Painel, Meta Ads, WhatsApp e vendas, Pauta Viral, Calendário, Metas e Relatórios
- [x] Login, equipe por unidade, papéis e regras de acesso no banco
- [x] Termos de uso, política de privacidade e ferramentas de LGPD
- [ ] Integração direta com a API de Marketing do Meta (sem exportar CSV)
- [ ] Integração com WhatsApp Business (registro automático de leads)
- [ ] Conciliação com o meio de pagamento (matrícula paga confirmada)
- [ ] Envio automático do relatório semanal por e-mail

## Licença

Software proprietário. O código está público apenas para visualização. Cópia, modificação, distribuição e uso comercial dependem de autorização por escrito. Veja [LICENSE](LICENSE).

## Autor

**Renato B. Carvalho**
Estratégia e tecnologia para negócios de educação · [renatobdev.pro](https://renatobdev.pro)

---

© 2026 Renato B. Carvalho. Todos os direitos reservados.
