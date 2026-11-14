# Klasso — Próximas implementações

## Feito nesta rodada
- [x] Fila offline: alterações sem internet ficam no aparelho e sobem sozinhas (status no topo)
- [x] Bloco "Hoje" no Painel: 4 números, 1 alerta, 1 próxima ação
- [x] Menu inferior no celular (Painel, Funil, Matrículas, Campanhas, Menu)
- [x] Presets "Esta semana" e "Este trimestre"
- [x] Edge Function `meta-sync` + botão "Sincronizar com o Meta" (ver `docs/META-SYNC.md`)
- [x] Dados da API têm prioridade sobre CSV no mesmo período

## Depende de você (bloqueado sem acesso)
- [ ] Gerar token do Meta (System User) e colocar nos secrets do Supabase → ativar em Configurações › Integrações
- [ ] Rodar o app em produção com Supabase e confirmar a fila offline de verdade
- [ ] Conferir `supabase/schema.sql` aplicado no projeto (RLS por organização)
- [ ] Preencher textos legais (termos, privacidade, LGPD) com dados da empresa

## Próximo ciclo (maior impacto)
1. [x] WhatsApp oficial: webhook cria o lead e conversa no Funil (falta publicar as funções e cadastrar o token)
2. [ ] Seguidores do Instagram atualizando a meta automaticamente (Graph API)
3. [ ] IA na Pauta Viral via Edge Function (roteiro gerado, não só modelo)
4. [ ] Diagnóstico semanal escrito (resumo do que subiu, caiu e o que fazer)
5. [ ] Agendamento automático do meta-sync (pg_cron diário)

## Arrumação
- [ ] Consolidar o menu lateral (menos itens, agrupar Conteúdo e Planejamento)
- [ ] Bloquear dados financeiros no banco por papel (não só na tela)
- [ ] Exportar relatórios em PDF
- [ ] Testes automáticos rodando no GitHub a cada PR

## Gamificação (feito)
- [x] 11 patentes (Novato do Digital → Lenda do Marketing), XP só de registro real, missões do dia, sequência com folga no domingo
- [x] Meu Arsenal: hierarquia, 15 conquistas comprovadas por dados, título escolhido
- [ ] Eventos (Semana do ROI, Caçada aos Leads, Copy War…) e temporadas semanais
- [ ] Hall da Fama (ranking por consultor)
- [ ] Registro de copies e identidade de marca (destrava Copy Killer real e Lenda do Branding)
- [ ] Placar de esforço e radar por consultor
- [x] Time gamificado (insígnia por função, board individual, kudos, pódio) e Chat do time (canais, menções, reações)
- [x] Funil para os dois tipos de closer: WhatsApp e ligação (registro de tentativas, Modo ligação com fila e roteiro)

## Fundação SaaS (feito)
- [x] Migração 002: 10 perfis com permissão por coleção no banco, agência › clientes, planos e consumo, domínios, WhatsApp por empresa (token cifrado), idempotência do webhook
- [x] Login multiempresa (my_orgs), menu por perfil, marca dinâmica (white-label), Configurações › Plano, Marca, Domínio, WhatsApp, Clientes
- [x] Embedded Signup (whatsapp-connect) e webhook/envio multiempresa
- [x] 27 testes de isolamento e permissão em Postgres (`tests/db/run.sh`)
- [ ] Pendências externas: `docs/PENDENCIAS.md`
- [x] Estúdio do criador: brainstorm com votos, prévia do post no celular, ideias arrastáveis para o calendário, publicar em um toque, XP de conteúdo, desafio semanal e conquistas de criador
