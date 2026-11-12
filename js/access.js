// Perfis e o que cada um enxerga no menu. A trava de verdade está no banco (supabase/migrations/002_saas.sql,
// role_grants + can_coll): aqui é só para não mostrar telas que voltariam vazias.

export const ROLES = {
  owner: { nome: 'Dono', faz: 'Tudo, inclusive plano, marca e quem é dono.' },
  admin: { nome: 'Administrador', faz: 'Tudo da operação, equipe, marca e integrações.' },
  manager: { nome: 'Gestor', faz: 'Toda a operação, sem mexer em plano e equipe.' },
  editor: { nome: 'Edita tudo', faz: 'Perfil antigo: edita todos os módulos.' },
  social: { nome: 'Social Media', faz: 'Pauta, calendário, ideias e chat.' },
  sales: { nome: 'Vendas', faz: 'Funil, matrículas, WhatsApp e time.' },
  support: { nome: 'Atendimento', faz: 'Funil e WhatsApp, sem ver investimento.' },
  analyst: { nome: 'Analista', faz: 'Lê tudo e monta relatórios.' },
  leitura: { nome: 'Só leitura', faz: 'Vê tudo, não altera nada.' },
  client: { nome: 'Cliente', faz: 'Vê relatórios, metas e calendário dele.' },
};
export const FULL = ['owner', 'admin', 'manager', 'editor'];
export const ADMIN = ['owner', 'admin'];

const VIEWS = {
  social: ['pauta', 'calendario', 'metas', 'time', 'chat', 'arsenal', 'config'],
  sales: ['painel', 'funil', 'matriculas', 'time', 'chat', 'arsenal', 'config'],
  support: ['funil', 'matriculas', 'time', 'chat', 'arsenal', 'config'],
  client: ['relatorios', 'metas', 'calendario', 'chat', 'config'],
};
/** Telas que o perfil vê no menu. Sem login (modo local) ou perfis completos: todas. */
export const canView = (role, view) => !role || !VIEWS[role] || VIEWS[role].includes(view);
export const isFull = (role) => !role || FULL.includes(role);
export const isAdminRole = (role) => !role || ADMIN.includes(role);
