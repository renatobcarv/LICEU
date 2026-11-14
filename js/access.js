// Perfis e o que cada um enxerga no menu. A trava de verdade está no banco (supabase/migrations/002_saas.sql,
// role_grants + can_coll): aqui é só para não mostrar telas que voltariam vazias.

export const ROLES = {
  owner: { nome: 'Dono', faz: 'Tudo, inclusive plano, marca e quem é dono.' },
  admin: { nome: 'Administrador', faz: 'Tudo da operação, equipe, marca e integrações.' },
  manager: { nome: 'Coordenador', faz: 'Vê e edita tudo da operação, sem mexer em plano e equipe.' },
  editor: { nome: 'Edita tudo', faz: 'Perfil antigo: edita todos os módulos.' },
  social: { nome: 'Social Media', faz: 'Edita Pauta Viral, Calendário e ideias. Vê o resto.' },
  sales: { nome: 'Vendas', faz: 'Edita Funil, Matrículas e WhatsApp. Vê o resto.' },
  support: { nome: 'Atendimento', faz: 'Edita Funil e WhatsApp. Vê o resto.' },
  analyst: { nome: 'Analista', faz: 'Lê tudo e monta relatórios.' },
  leitura: { nome: 'Só leitura', faz: 'Vê tudo, não altera nada.' },
  client: { nome: 'Cliente', faz: 'Vê relatórios, metas e calendário dele.' },
};
export const FULL = ['owner', 'admin', 'manager', 'editor'];
export const ADMIN = ['owner', 'admin'];

// Todo o time vê todas as telas. Cada perfil edita só a própria área (o banco confere: role_grants + can_coll).
const VIEWS = { client: ['relatorios', 'metas', 'calendario', 'chat', 'config'] };
export const canView = (role, view) => !role || !VIEWS[role] || VIEWS[role].includes(view);
const ESCREVE = {
  social: ['pautas', 'calendar', 'stories', 'weekly', 'ideas', 'boards', 'chat', 'jogo'],
  sales: ['team', 'leads', 'imports', 'wamsg', 'chat', 'jogo'],
  support: ['leads', 'wamsg', 'chat', 'jogo'],
  analyst: ['reports', 'chat', 'jogo'],
  leitura: ['jogo'],
  client: ['chat'],
};
export const podeEscrever = (role, coll) => !role || !ESCREVE[role] || ESCREVE[role].includes(coll);
export const AREA = {
  social: { nome: 'Conteúdo', telas: ['hoje', 'pauta', 'calendario', 'chat', 'arsenal', 'config'] },
  sales: { nome: 'Vendas', telas: ['hoje', 'funil', 'matriculas', 'time', 'chat', 'arsenal', 'config'] },
  support: { nome: 'Atendimento', telas: ['hoje', 'funil', 'matriculas', 'chat', 'arsenal', 'config'] },
  analyst: { nome: 'Análise', telas: ['hoje', 'relatorios', 'chat', 'arsenal', 'config'] },
  leitura: { nome: 'Leitura', telas: ['hoje', 'arsenal', 'config'] },
};
/** Tela fora da área do perfil: abre em modo só visualização. */
export const soVer = (role, view) => !!(role && AREA[role] && !AREA[role].telas.includes(view));
export const isFull = (role) => !role || FULL.includes(role);
export const isAdminRole = (role) => !role || ADMIN.includes(role);
