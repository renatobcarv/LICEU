// Supabase Edge Function: ia-criar
// Assistente de criação da Pauta Viral com o Claude. Três pedidos:
//   ideias  -> lista de ideias de post para um curso/tema
//   roteiro -> gancho, cenas com fala e texto na tela, legenda, hashtags e CTA para uma ideia
//   ganchos -> 5 ganchos alternativos para uma ideia
// A chave fica só no servidor (segredo ANTHROPIC_API_KEY). Quem chama precisa poder gravar pautas na escola,
// e cada pedido consome 1 do limite mensal de IA do plano (usage_records, métrica "ia").

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/beta/zod';
import { z } from 'npm:zod@4.6.7';
import { cors, json, adminClient, userClient } from '../_shared/wa.ts';

const FORMATOS = ['Reels', 'Carrossel', 'Stories', 'Post estático', 'Vídeo motion'] as const;

const Ideias = z.object({
  ideias: z.array(z.object({
    titulo: z.string().describe('Tema do post em até 90 caracteres, escrito como o aluno falaria'),
    formato: z.enum(FORMATOS),
    gancho: z.string().describe('Primeira frase do vídeo ou do slide 1'),
    porque: z.string().describe('Por que essa ideia tende a gerar conversa no WhatsApp, em uma frase'),
  })),
});
const Roteiro = z.object({
  gancho: z.string(),
  cenas: z.array(z.object({ fala: z.string(), tela: z.string().describe('Texto curto que aparece na tela'), cena: z.string().describe('O que a câmera mostra') })),
  legenda: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
});
const Ganchos = z.object({ ganchos: z.array(z.string()) });

const SYSTEM = `Você é roteirista de conteúdo para escolas de cursos técnicos e livres no Brasil.
Escreve em português do Brasil, frases curtas, tom de quem dá aula, sem jargão de marketing.
O objetivo do conteúdo é gerar conversa no WhatsApp com quem pode se matricular.
Use apenas os fatos da escola que vierem no pedido. Nunca invente preço, desconto, depoimento, número de alunos,
taxa de aprovação, salário garantido ou qualquer resultado. Se precisar de um dado que não veio, escreva [inserir dado].
Nada de promessa de emprego garantido nem de conteúdo de saúde que substitua orientação profissional.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'A IA ainda não foi ativada nesta plataforma.' }, 503);
  const body = await req.json().catch(() => ({}));
  const { orgId, modo } = body;
  if (!orgId || !['ideias', 'roteiro', 'ganchos'].includes(modo)) return json({ error: 'Pedido inválido.' }, 400);

  // Permissão avaliada pelo banco, com o login de quem chamou.
  const { data: pode } = await userClient(req).rpc('can_coll', { o: orgId, coll: 'pautas', p: 'w' });
  if (!pode) return json({ error: 'Sem permissão para criar conteúdo nesta escola.' }, 403);

  // Limite mensal do plano.
  const admin = adminClient();
  const { data: lim } = await admin.rpc('org_limit', { o: orgId, k: 'ia_mes' });
  const mes = new Date().toISOString().slice(0, 7);
  const { data: uso } = await admin.from('usage_records').select('qtd').match({ org_id: orgId, metrica: 'ia', periodo: mes }).maybeSingle();
  if ((uso?.qtd || 0) >= (lim || 0)) return json({ error: 'Limite de gerações de IA do mês atingido. Mude de plano para continuar.' }, 402);

  const escola = String(body.escola || '').slice(0, 1500);
  // O que já funcionou na escola: a IA segue esse estilo e evita repetir os mesmos temas.
  const historico = String(body.historico || '').slice(0, 2000);
  const curso = String(body.curso || '').slice(0, 200);
  const ideia = String(body.ideia || '').slice(0, 600);
  const formato = FORMATOS.includes(body.formato) ? body.formato : 'Reels';
  const pedido = modo === 'ideias'
    ? `Sugira ${Math.min(10, Math.max(3, Number(body.quantidade) || 6))} ideias de post${curso ? ` para o curso "${curso}"` : ''}${body.tema ? ` sobre "${String(body.tema).slice(0, 200)}"` : ''}. Varie formatos e ângulos (erro comum, bastidor, dúvida do aluno, mito, rotina da profissão).`
    : modo === 'roteiro'
      ? `Escreva o roteiro de um ${formato} de até ${formato === 'Carrossel' ? '6 slides' : '45 segundos'} para a ideia: "${ideia}"${curso ? ` (curso: ${curso})` : ''}. Em carrossel, cada cena é um slide.`
      : `Escreva 5 ganchos diferentes (curiosidade, alerta, opinião contrária, pergunta, número) para a ideia: "${ideia}".`;
  const schema = modo === 'ideias' ? Ideias : modo === 'roteiro' ? Roteiro : Ganchos;

  const client = new Anthropic();
  try {
    // Se o modelo recusar por política, a própria API refaz o pedido num modelo de reserva (fallbacks).
    const res = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `${escola ? `Sobre a escola:\n${escola}\n\n` : ''}${historico ? `O que já funcionou aqui (siga o tom e os ângulos que deram mais conversa; não repita os mesmos temas):\n${historico}\n\n` : ''}${pedido}` }],
    });
    if (res.stop_reason === 'refusal') return json({ error: 'A IA não pôde atender esse pedido. Reformule a ideia.' }, 422);
    if (!res.parsed_output) return json({ error: 'A IA respondeu fora do formato. Tente de novo.' }, 502);
    await admin.rpc('add_usage', { o: orgId, m: 'ia', n: 1 });
    return json({ ok: true, modo, resultado: res.parsed_output });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Muitos pedidos agora. Tente em alguns segundos.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: 'Falha na IA (' + e.status + '). Tente de novo.' }, 502);
    return json({ error: 'Falha ao gerar. Tente de novo.' }, 500);
  }
});
