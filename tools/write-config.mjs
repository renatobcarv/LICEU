// Roda no build da Vercel. Se SUPABASE_URL e SUPABASE_ANON_KEY existirem no projeto, grava js/config.js
// com elas; se não, mantém o js/config.js do repositório.
// Aceita também os nomes da integração Supabase da Vercel (NEXT_PUBLIC_*).
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
if (/service_role|^sb_secret_/.test(key)) { console.error('[FLOWCLASS] Use a chave publishable/anon, nunca a secreta, no front-end.'); process.exit(1); }
if (!url || !key) { console.log('[FLOWCLASS] Variáveis do Supabase não definidas: usando o js/config.js do repositório.'); process.exit(0); }
writeFileSync(new URL('../js/config.js', import.meta.url), `// Gerado no build. Não edite.\nexport const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`);
console.log('[FLOWCLASS] js/config.js gerado para ' + new URL(url).host);
