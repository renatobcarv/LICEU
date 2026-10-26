// Roda no build da Vercel: grava js/config.js com as variáveis do projeto.
// Aceita os nomes simples e os que a integração Supabase da Vercel cria (NEXT_PUBLIC_*).
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
if (!url || !key) console.warn('[LICEU] SUPABASE_URL ou SUPABASE_ANON_KEY não definidas: o app vai rodar em modo de teste, sem login.');
if (/service_role/.test(key)) { console.error('[LICEU] Use a chave anon, nunca a service_role, no front-end.'); process.exit(1); }
writeFileSync(new URL('../js/config.js', import.meta.url), `// Gerado no build. Não edite.\nexport const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`);
console.log('[LICEU] js/config.js gerado' + (url ? ' para ' + new URL(url).host : ' em modo de teste'));
