// IA do atendente das automações: responde com base SÓ no que a escola cadastrou, dentro de limites fixos.
// Modelo rápido (conversa de WhatsApp precisa de resposta em segundos). Saída estruturada: resposta + transferir + campos.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/beta/zod';
import { z } from 'npm:zod@4.6.7';

const Saida = z.object({
  resposta: z.string().describe('Mensagem para o cliente no WhatsApp: até 3 frases curtas, tom humano e caloroso, no máximo 1 pergunta.'),
  transferir: z.boolean().describe('true quando o cliente está pronto para falar com o vendedor, pediu algo fora da base, quer negociar valores, ou o objetivo foi cumprido.'),
  motivo: z.string().describe('Por que transferiu ou não, em poucas palavras (uso interno).'),
  campos: z.object({ nome: z.string(), cursoInteresse: z.string(), email: z.string(), melhorHorario: z.string() }).describe('Dados que o cliente informou na conversa; string vazia quando não informou.'),
});

const LIMITES = `Regras que você NUNCA quebra:
- Você é a assistente virtual da escola. Se perguntarem, diga que é uma assistente virtual e que uma pessoa do time pode assumir.
- Use SOMENTE as informações da base abaixo. Se a informação não estiver lá (preço, data, vaga, documento), não invente: diga que vai confirmar com o time e marque transferir=true.
- Nunca ofereça desconto, bolsa, parcelamento ou condição que não esteja escrita na base. Nunca confirme matrícula, reserva ou pagamento.
- Nunca prometa emprego, renda ou aprovação. Não dê orientação médica, jurídica ou financeira.
- Não peça CPF, senha, cartão ou dado sensível.
- Se o cliente demonstrar irritação, pedir uma pessoa ou falar de reclamação, transferir=true.
- Português do Brasil, frases curtas, sem listas longas, no máximo 1 emoji.`;

export async function respostaBot(a: { escola: string; base: string; cursos: string; objetivo: string; hist: { de: string; t: string }[]; lead: any }) {
  const client = new Anthropic();
  const messages = a.hist.map((m) => ({ role: (m.de === 'robo' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.t }));
  // a API exige começar pelo usuário e alternar papéis
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const fundidas: typeof messages = [];
  for (const m of messages) { const u = fundidas.at(-1); if (u && u.role === m.role) u.content += '\n' + m.content; else fundidas.push({ ...m }); }
  if (!fundidas.length || fundidas.at(-1)!.role !== 'user') return null;
  const system = `Você atende no WhatsApp da escola "${a.escola}".
Objetivo desta etapa: ${a.objetivo || 'tirar dúvidas e descobrir o curso de interesse.'}
${LIMITES}

Base de conhecimento da escola:
${(a.base || '(vazia)').slice(0, 8000)}

Cursos cadastrados:
${(a.cursos || '(nenhum)').slice(0, 3000)}

Contato: ${a.lead?.nome || 'sem nome'}${a.lead?.cursoInteresse ? `, interessado em ${a.lead.cursoInteresse}` : ''}.`;
  const res = await client.beta.messages.parse({
    model: 'claude-haiku-5-5', max_tokens: 1200,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { format: betaZodOutputFormat(Saida) },
    system, messages: fundidas,
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
  return res.parsed_output;
}
