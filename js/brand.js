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
  applyPaleta();
  try { localStorage.removeItem('liceu.theme'); } catch (e) { /* opcional */ }
}

// ---------- White-label: marca de cada empresa (orgs.branding) aplicada no app inteiro ----------
// Campos: nome, logo, simbolo, favicon, primaria, secundaria, destaque, rodape. Tudo opcional: o que faltar fica FLOWCLASS.
let atual = {};
const COR = /^#[0-9a-f]{6}$/i;
const URL_OK = (u) => /^https:\/\/[^\s"'<>]+$/i.test(String(u || ''));
export const productName = () => atual.nome || PRODUCT;
export const brandFooter = () => atual.rodape || '';
export function applyBranding(b = {}) {
  atual = b || {};
  const r = document.documentElement.style;
  const set = (k, v) => (COR.test(v || '') ? r.setProperty(k, v) : r.removeProperty(k));
  set('--primary', atual.primaria); set('--c-lime', atual.primaria); set('--gold', atual.primaria);
  set('--c-emerald', atual.secundaria); set('--c-orange', atual.destaque);
  if (COR.test(atual.primaria || '')) {
    r.setProperty('--lime-card', `linear-gradient(140deg, ${atual.primaria}, ${COR.test(atual.secundaria || '') ? atual.secundaria : atual.primaria})`);
    r.setProperty('--glow', `0 0 0 1px ${atual.primaria}40, 0 10px 40px -12px ${atual.primaria}8c`);
  } else { r.removeProperty('--lime-card'); r.removeProperty('--glow'); }
  document.querySelectorAll('img.logo-full').forEach((img) => { if (URL_OK(atual.logo)) { img.src = atual.logo; img.alt = productName(); img.removeAttribute('width'); img.removeAttribute('height'); } });
  document.querySelectorAll('img.logo-mark').forEach((img) => { if (URL_OK(atual.simbolo)) img.src = atual.simbolo; });
  if (URL_OK(atual.favicon)) { const l = document.querySelector('link[rel~="icon"]'); if (l) l.href = atual.favicon; }
}

// ---------- Paleta (Toxic Luxury padrão, Acid Royal alternativa) ----------
export const PALETAS = {
  acid: { nome: 'Acid Royal', cores: ['#060706', '#C6FF00', '#8B00FF', '#142D16'] },
  toxic: { nome: 'Toxic Luxury', cores: ['#070908', '#A3FF12', '#7B2CBF', '#102B20'] },
};
const PK = 'flowclass.paleta';
export const paletaAtual = () => { try { return PALETAS[localStorage.getItem(PK)] ? localStorage.getItem(PK) : 'acid'; } catch (e) { return 'acid'; } };
export function applyPaleta(id = paletaAtual()) {
  document.documentElement.dataset.paleta = PALETAS[id] ? id : 'acid';
  try { localStorage.setItem(PK, document.documentElement.dataset.paleta); } catch (e) { /* opcional */ }
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = '#060706';
}
