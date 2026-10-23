# LICEU

> Da informação dispersa à decisão inteligente.

Central de inteligência comercial e de marketing para instituições de ensino. O sistema conecta campanhas, leads, contratos e pagamentos para responder uma pergunta central:

**Qual campanha gera matrícula paga, e quanto ela custa?**

**Autor e desenvolvedor principal:** [Renato B. Carvalho](https://renatobdev.pro)

**Primeira instituição usuária:** TEC Mais (unidade Valparaíso de Goiás)

> **Status:** MVP 01 em desenvolvimento. Repositório privado.

---

## Sumário

- [Problema](#problema)
- [Escopo do MVP](#escopo-do-mvp)
- [Stack](#stack)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Indicadores e fórmulas](#indicadores-e-fórmulas)
- [Regras de negócio](#regras-de-negócio)
- [Regra de atribuição](#regra-de-atribuição)
- [Fontes de dados](#fontes-de-dados)
- [Como rodar](#como-rodar)
- [Roadmap](#roadmap)
- [Princípios](#princípios)
- [Dados, privacidade e propriedade](#dados-privacidade-e-propriedade)

---

## Problema

Os dados comerciais da operação ficam espalhados entre plataformas de anúncio, CRM e meio de pagamento. Por isso, perguntas simples não têm resposta confiável:

- Quais campanhas geram matrículas **efetivamente pagas**?
- Quanto custa conquistar uma matrícula?
- Em qual etapa do funil os interessados se perdem?

## Escopo do MVP

**Incluído**

- Importação das fontes (CSV no início, APIs depois).
- Conciliação lead → contrato → pagamento pelo telefone.
- Cálculo dos indicadores com testes.
- Tela única de visão geral: indicadores, evolução semanal, funil, tabela de campanhas e alertas.
- Registro simples de estratégias (hipótese, resultado, conclusão).
- Exportação CSV.

**Fora do escopo inicial**

CRM completo, sistema financeiro, automações, IA tomando decisões, multi-organização e comercialização pública.

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python, FastAPI |
| Banco de dados | PostgreSQL |
| ORM e migrações | SQLAlchemy, Alembic |
| Testes | Pytest |
| Frontend | Next.js (React) |
| Infraestrutura | Docker Compose |

## Estrutura do repositório

```
.
├── backend/
│   ├── app/
│   │   ├── api/            # rotas FastAPI
│   │   ├── core/           # configurações e segurança
│   │   ├── models/         # entidades SQLAlchemy
│   │   ├── importers/      # leitura de Meta, Google, CRM e Asaas
│   │   ├── reconciliation/ # conciliação por telefone
│   │   └── metrics/        # cálculo dos indicadores
│   ├── migrations/
│   └── tests/
├── frontend/               # Next.js
├── design/                 # protótipo e direção visual (referência, não código)
├── docs/                   # documento de direção e decisões
├── docker-compose.yml
└── README.md
```

## Indicadores e fórmulas

Toda métrica exibida segue exatamente estas definições.

| Indicador | Fórmula | Fonte |
|---|---|---|
| Investimento | Soma do gasto em mídia no período | Meta Ads, Google Ads |
| Leads válidos | Contatos únicos por telefone no período, sem duplicados | CRM |
| CPL | Investimento atribuível ÷ leads atribuídos | Calculado |
| Contratos | Contratos gerados no período | CRM |
| Matrículas pagas | Contratos com pagamento confirmado | Asaas |
| CAC de mídia | Investimento atribuível ÷ matrículas pagas atribuídas | Calculado |
| Conversão de etapa | Avançaram ÷ elegíveis na etapa anterior | Calculado |
| Receita recebida | Valores recebidos, líquidos de estornos e reembolsos | Asaas |
| Receita prevista | Valores de contratos ainda não pagos | Asaas |
| Atingimento da meta | Matrículas pagas ÷ meta definida | Calculado |

## Regras de negócio

1. **Divisão por zero retorna `indisponível`**, nunca zero nem infinito.
2. **Falta de dado aparece como `indisponível`**, nunca como zero.
3. **Contrato, matrícula e pagamento não são sinônimos.** Uma matrícula só conta como paga com pagamento confirmado.
4. **Previsto e recebido ficam sempre separados.**
5. **CAC de mídia não é CAC total.** Ele inclui apenas investimento em mídia paga e deve vir rotulado assim.
6. **Comparações usam períodos equivalentes.** Por exemplo, 01–22 de outubro contra 01–22 de setembro.
7. **Fuso horário único:** `America/Sao_Paulo`.
8. **Duplicados são identificados e contados**, não descartados em silêncio.
9. **Todo dado carrega a data da última atualização.** Fontes com falha ou desatualizadas são sinalizadas na interface.

## Regra de atribuição

Versão 1, que precisa ser validada com a operação:

- **Chave de conciliação:** telefone normalizado no formato E.164 (`+5561999999999`).
- **Campanha atribuída:** a do **primeiro contato** registrado no WhatsApp.
- **Lead sem origem identificável:** entra nos totais, mas fica fora dos cálculos por campanha.
- **Campanha sem regra confiável** (por exemplo, alcance de marca): o investimento entra no total, e o CPL e o CAC dela aparecem como `indisponível`.

Toda mudança nesta regra deve ser registrada em `docs/decisoes.md`, porque altera os números históricos.

## Fontes de dados

| Fonte | Dados | Formato no MVP |
|---|---|---|
| Meta Ads | Campanhas, investimento | CSV exportado |
| Google Ads | Campanhas, investimento | CSV exportado |
| CRM (Convergefy) | Leads, etapas, origem, contratos | CSV exportado |
| Asaas | Cobranças, pagamentos, estornos | CSV ou API |

## Como rodar

**Pré-requisitos:** Docker e Docker Compose.

```bash
# 1. Clonar
git clone <url-do-repositorio>
cd liceu

# 2. Variáveis de ambiente
cp .env.example .env

# 3. Subir banco e API
docker compose up -d

# 4. Aplicar migrações
docker compose exec api alembic upgrade head

# 5. Rodar os testes
docker compose exec api pytest
```

A API fica disponível em `http://localhost:8000`, com a documentação em `http://localhost:8000/docs`.

### Variáveis de ambiente

```env
DATABASE_URL=postgresql://user:password@db:5432/liceu
TIMEZONE=America/Sao_Paulo
ASAAS_API_KEY=
```

Nunca versione o arquivo `.env`.

## Roadmap

- [ ] **Fase 1 — Descoberta:** mapear fontes, validar fórmulas e regra de atribuição.
- [ ] **Fase 2 — Protótipo:** visão geral validada com usuários (em andamento).
- [ ] **Fase 3 — Construção:** modelo de dados, importação, conciliação e indicadores.
- [ ] **Fase 4 — Validação:** conferir os números contra as fontes originais.
- [ ] **Fase 5 — Replicabilidade:** testar a configuração em outra instituição.

## Princípios

1. Clareza antes da complexidade.
2. Dados confiáveis antes de análises sofisticadas.
3. Decisões antes de decoração visual.
4. Contexto antes de comparações.
5. Evidências antes de recomendações.
6. Simplicidade antes de funcionalidades em excesso.

## Dados, privacidade e propriedade

- Os dados de leads e alunos são pessoais e protegidos pela **LGPD**. Nenhum dado real é versionado neste repositório.
- Use apenas dados fictícios ou anonimizados em testes e exemplos.
- O código e a arquitetura são de autoria de Renato B. Carvalho (Liceu). Os dados operacionais pertencem à TEC Mais.
- O uso do nome TEC Mais e os direitos de uso do sistema pela instituição devem ser formalizados **por escrito**.

## Autor

**Renato B. Carvalho**
Desenvolvedor backend · Liceu — Estúdio de Estratégia e Tecnologia
[renatobdev.pro](https://renatobdev.pro)

---

© 2026 Renato B. Carvalho — Liceu. Todos os direitos reservados.
