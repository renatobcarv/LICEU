// Projeto Supabase do FLOWCLASS Intelligence.
// A chave "publishable" é pública por design (vai para o navegador de qualquer forma);
// quem protege os dados são as regras RLS de supabase/schema.sql.
// Nunca coloque aqui a chave secreta (sb_secret_...) nem a service_role.
// Na Vercel, SUPABASE_URL e SUPABASE_ANON_KEY (se definidas) substituem estes valores no build.
export const SUPABASE_URL = 'https://kqaqccjsoqdpbnnyyemw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Hj2ojo0Yo9SRp88S8eQYjg_um6dJZiS';

// App da Meta da PLATAFORMA (não do cliente) para o Embedded Signup do WhatsApp. São públicos por design.
// Preencha depois que o app for criado e aprovado (docs/PENDENCIAS.md). Vazios = botão mostra a pendência.
export const META_APP_ID = '';
export const WA_CONFIG_ID = '';

// White-label (marca própria, domínio, clientes de agência). Desligado: o produto é o FLOWCLASS.
// O banco e o código continuam prontos; mude para true quando for vender para agências.
export const WHITELABEL = false;
