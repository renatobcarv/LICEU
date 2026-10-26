// Identidade LICEU: coluna jônica cujo fuste forma um "L". Desenhada em SVG para herdar a cor do tema.

export const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 120 136" fill="currentColor" role="img" aria-label="LICEU">
  <path d="M23 8h74l-3 6H26z"/>
  <rect x="15" y="19" width="90" height="6" rx="1"/>
  <path d="M30 25H19C10 25 7 35 11 40c4 5 13 5 15-1 2-5-2-9-6-8-3 1-4 4-2 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <path d="M90 25h11c9 0 12 10 8 15-4 5-13 5-15-1-2-5 2-9 6-8 3 1 4 4 2 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <path d="M40 30h7v76l-7-7z"/>
  <path d="M52 30h7v84l22-14h9l-34 26-4-4z"/>
  <path d="M64 30h7v62h18l-5 7H64z"/>
</svg>`;

export const PRODUCT = 'LICEU Intelligence';

// Mude a versão quando o texto dos termos ou da política mudar. Ela fica gravada no aceite de cada pessoa.
export const TERMS_VERSION = '2026-10-26';

// Tema único: Noir. Remove preferências antigas de tema salvas no navegador.
export function applyTheme() {
  document.documentElement.removeAttribute('data-skin');
  try { localStorage.removeItem('liceu.theme'); } catch (e) { /* opcional */ }
}
