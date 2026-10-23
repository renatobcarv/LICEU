# LICEU

**Inteligência comercial e de marketing para instituições de ensino.**

O LICEU conecta investimento em mídia, leads, contratos e pagamentos em uma única leitura. Assim, a gestão sabe quais campanhas geram matrículas pagas, quanto cada uma custa e em que ponto do funil os interessados se perdem.

![Status](https://img.shields.io/badge/status-MVP%20em%20desenvolvimento-E85002)
![Licença](https://img.shields.io/badge/licença-proprietária-333333)

---

## Visão geral

Em instituições de ensino, os dados comerciais costumam ficar espalhados entre plataformas de anúncio, CRM de atendimento e meio de pagamento. O resultado é conhecido: muitos números e pouca resposta.

O LICEU parte de uma pergunta central:

> **Qual campanha gera matrícula paga, e quanto ela custa?**

Para responder com confiança, o sistema concilia cada pagamento com o lead que o originou e com a campanha que trouxe esse lead.

## Funcionalidades

- **Visão executiva:** investimento, leads, matrículas pagas, receita, CPL, CAC de mídia e progresso da meta, sempre comparados a um período equivalente.
- **Atribuição por campanha:** custo por lead e por matrícula paga em cada campanha, com regra de atribuição explícita.
- **Funil comercial:** conversão entre etapas, do primeiro contato ao pagamento confirmado.
- **Alertas de investigação:** quedas de conversão, pagamentos pendentes e oportunidades, apresentados como hipóteses e não como conclusões.
- **Memória de estratégias:** registro de experimentos com hipótese, resultado e aprendizado.
- **Transparência de dados:** cada indicador mostra a origem, a regra de cálculo e o horário da última atualização.

## Como funciona

```
Plataformas de anúncio ─┐
                        ├─► Importação ─► Conciliação ─► Indicadores ─► Painel
CRM de atendimento ─────┤                (lead → contrato → pagamento)
                        │
Meio de pagamento ──────┘
```

1. **Importação:** os dados de cada fonte são lidos e normalizados.
2. **Conciliação:** leads, contratos e pagamentos são vinculados por um identificador comum.
3. **Cálculo:** os indicadores seguem definições fixas e versionadas.
4. **Leitura:** o painel apresenta resultados, comparações e pontos de atenção.

## Princípios de dados

O LICEU é construído para ser confiável antes de ser sofisticado.

- **Indisponível não é zero.** A falta de dado é sinalizada, nunca mascarada.
- **Contrato não é pagamento.** Uma matrícula só conta como paga com pagamento confirmado.
- **Previsto e recebido ficam separados.**
- **CAC de mídia não é CAC total**, e é rotulado como tal.
- **Comparações justas:** sempre entre períodos equivalentes.
- **Atribuição explícita:** nenhuma venda é creditada a uma campanha sem uma regra definida.

## Indicadores

| Indicador | Definição |
|---|---|
| Investimento | Gasto em mídia paga no período |
| Leads válidos | Contatos únicos no período, sem duplicidades |
| CPL | Investimento atribuível ÷ leads atribuídos |
| Matrículas pagas | Contratos com pagamento confirmado |
| CAC de mídia | Investimento atribuível ÷ matrículas pagas atribuídas |
| Conversão | Avançaram ÷ elegíveis na etapa anterior |
| Receita recebida | Valores recebidos, líquidos de estornos |
| Atingimento da meta | Matrículas pagas ÷ meta do período |

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Backend | Python · FastAPI |
| Banco de dados | PostgreSQL |
| Frontend | Next.js · React |
| Testes | Pytest |
| Infraestrutura | Docker |

## Roadmap

- [x] Direção estratégica e de produto
- [x] Protótipo da visão geral
- [ ] Modelo de dados e importação das fontes
- [ ] Conciliação lead → contrato → pagamento
- [ ] Cálculo e validação dos indicadores
- [ ] Painel funcional
- [ ] Piloto com a primeira instituição parceira

## Licença

Este é um software proprietário. O código está público apenas para visualização. Cópia, modificação, distribuição e uso comercial dependem de autorização por escrito. Consulte o arquivo [LICENSE](LICENSE).

## Autor

**Renato B. Carvalho**
Desenvolvedor backend · Estratégia e tecnologia para negócios de educação

[renatobdev.pro](https://renatobdev.pro)

---

© 2026 Renato B. Carvalho. Todos os direitos reservados.
