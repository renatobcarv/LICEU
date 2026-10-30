// Identidade FLOWCLASS Intelligence: logotipo, nome do produto e versão dos termos.

// Logotipo FLOWCLASS (recortado da arte oficial, fundo transparente).
export const LOGO_MARK = '<img class="logo-full" src="assets/flowclass-logo.png" alt="FLOWCLASS" width="180" height="17">';
export const LOGO_SYMBOL = '<img class="logo-mark" src="assets/flowclass-mark.png" alt="" width="28" height="21">';

export const PRODUCT = 'FLOWCLASS Intelligence';

// Mude a versão quando o texto dos termos ou da política mudar. Ela fica gravada no aceite de cada pessoa.
export const TERMS_VERSION = '2026-10-26';

// Tema único: Noir. Remove preferências antigas de tema salvas no navegador.
export function applyTheme() {
  document.documentElement.removeAttribute('data-skin');
  try { localStorage.removeItem('liceu.theme'); } catch (e) { /* opcional */ }
}
