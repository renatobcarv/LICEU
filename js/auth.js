// Cadastro, login e escolha da unidade (Supabase Auth).
// Sem Supabase configurado, o app roda sem login e salva no navegador.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, $ } from './util.js';
import { LOGO_MARK, TERMS_VERSION, applyBranding } from './brand.js';

import { ROLES } from './access.js';
import { store } from './store.js';
import { WHITELABEL } from './config.js';
import { montarQuiz } from './perfil.js';
const ORG_KEY = 'liceu.intelligence.org';
const OLD_ORG_KEY = 'tecmais.intelligence.org'; // nome antigo, lido só para não perder a unidade escolhida
export const auth = { client: null, user: null, org: null, member: null, configured: false };

export function supabaseConfigured() {
  // Dentro do claude.ai (prévia) o navegador não pode falar com o Supabase; lá o app usa o banco do Artifact.
  if (window.claude?.use) return false;
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient);
}

const LOGO = `<div class="auth-logo">${LOGO_MARK}</div>`;
const PLANOS = { local: 'Escola', pro: 'Rede', agencia: 'Agência' };
const qs = new URLSearchParams(location.search);
const LAST = 'flowclass.ultimo.email';
const CONV = 'flowclass.convite';
const conviteAtual = () => { try { return localStorage.getItem(CONV) || ''; } catch (e) { return ''; } };
const guardarConvite = (c) => { try { c ? localStorage.setItem(CONV, c) : localStorage.removeItem(CONV); } catch (e) { /* opcional */ } };
if (qs.get('convite')) guardarConvite(qs.get('convite').trim().toLowerCase());
const lastEmail = () => { try { return localStorage.getItem(LAST) || ''; } catch (e) { return ''; } };

// Tela dividida: marca e prova à esquerda (some no celular), formulário à direita.
function screen(inner) {
  const root = $('#auth');
  root.hidden = false;
  $('#app').hidden = true;
  root.className = 'auth-split';
  root.innerHTML = `
    <aside class="auth-brand" aria-hidden="true">
      ${LOGO}
      <div class="ab-copy"><p class="ab-eyebrow">Klasso para escolas</p>
        <h2>Saiba quanto custou <span>cada matrícula.</span></h2>
        <ul><li>Meta Ads com custo por matrícula</li><li>WhatsApp oficial dentro do funil</li><li>Time com missões, patentes e ranking</li></ul></div>
      <div class="ab-case"><div><b>R$ 800</b><span>em anúncio</span></div><div><b>26</b><span>matrículas</span></div><div><b>R$ 30,80</b><span>por matrícula</span></div></div>
      <p class="ab-foot">Campanha real da TEC Mais Valparaíso</p>
    </aside>
    <section class="auth-pane"><div class="auth-card">${LOGO}${inner}</div>
      <p class="auth-foot"><a href="/vendas">Conhecer o Klasso</a> · <a href="/planos">Planos</a> · <a href="termos.html" target="_blank" rel="noopener">Termos</a> · <a href="privacidade.html" target="_blank" rel="noopener">Privacidade</a></p></section>`;
  return root;
}
function msg(root, text, kind = 'bad') { const el = $('.auth-msg', root); el.textContent = text; el.className = 'auth-msg ' + kind; el.hidden = !text; }
function busy(btn, on, label) { btn.disabled = on; btn.classList.toggle('loading', on); if (label) btn.textContent = label; }

const ERRORS = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Já existe uma conta com esse e-mail. Use Entrar ou Esqueci a senha.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 8 caracteres.',
  'Email rate limit exceeded': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'Signups not allowed for otp': 'Não encontramos conta com esse e-mail. Crie uma conta primeiro.',
  'Unable to validate email address: invalid format': 'Confira o e-mail: o formato parece errado.',
};
const tr = (e) => ERRORS[e?.message] || (/fetch|network/i.test(e?.message || '') ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : /rate limit|too many/i.test(e?.message || '') ? ERRORS['Email rate limit exceeded'] : e?.message) || 'Não foi possível concluir. Tente de novo.';

// Campo de senha com mostrar/ocultar e aviso de Caps Lock.
const passField = (id, label, auto, extra = '') => `<div class="field"><label for="${id}">${label}</label>
  <div class="pass-wrap"><input id="${id}" type="password" autocomplete="${auto}" required ${extra}><button type="button" class="pass-eye" data-eye="${id}" aria-label="Mostrar senha" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
  <p class="caps" id="${id}-caps" hidden>Caps Lock ligado</p></div>`;
function bindPass(root) {
  root.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.eye, root); const show = i.type === 'password'; i.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); i.focus();
  }));
  root.querySelectorAll('.pass-wrap input').forEach((i) => ['keydown', 'keyup'].forEach((ev) => i.addEventListener(ev, (e) => { const c = $('#' + i.id + '-caps', root); if (c && e.getModifierState) c.hidden = !e.getModifierState('CapsLock'); })));
}
// Sugere o domínio certo quando o e-mail tem erro comum de digitação.
const DOMS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'icloud.com', 'live.com', 'uol.com.br', 'bol.com.br'];
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
export function emailHint(v) {
  const m = String(v || '').trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/); if (!m) return '';
  if (DOMS.includes(m[2])) return '';
  const best = DOMS.map((d) => [d, lev(m[2], d)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] > 0 && best[1] <= 2 ? m[1] + '@' + best[0] : '';
}
function bindEmail(root) {
  const i = $('#a-email', root), h = $('#a-email-hint', root); if (!i || !h) return;
  const check = () => { const s = emailHint(i.value); h.hidden = !s; if (s) h.innerHTML = `Você quis dizer <button type="button" class="link" data-fix="${esc(s)}">${esc(s)}</button>?`; };
  i.addEventListener('blur', check);
  h.addEventListener('click', (e) => { const f = e.target.closest('[data-fix]'); if (f) { i.value = f.dataset.fix; h.hidden = true; } });
}
// Força da senha: comprimento e variedade. Não bloqueia além do mínimo de 8; orienta.
export function forca(p) {
  let n = 0; if (p.length >= 8) n++; if (p.length >= 12) n++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++; if (/\d/.test(p)) n++; if (/[^\w\s]/.test(p)) n++;
  if (/^(.)\1+$/.test(p) || /^(12345678|password|senha123|qwerty)/i.test(p)) n = 0;
  return p.length < 8 ? 0 : Math.min(4, Math.max(1, n - 1));
}
const FORCA = ['Muito curta', 'Fraca', 'Razoável', 'Boa', 'Forte'];

function loginView(resolve, notice = '') {
  const root = screen(`
    <div class="auth-glyph" aria-hidden="true"><img src="assets/klasso-mark.png" alt=""></div><h1>Entrar</h1><p class="auth-sub">Bom te ver de novo.</p>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" inputmode="email" required value="${esc(lastEmail())}"><p class="hint" id="a-email-hint" hidden></p></div>
      ${passField('a-pass', 'Senha', 'current-password')}
      <div class="auth-row"><span></span><button type="button" class="link" id="to-reset">Esqueci a senha</button></div>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Entrar</button>
    </form>
    <div class="auth-sep"><span>ou</span></div>
    <button class="btn block" id="to-magic" type="button">Receber link de acesso no e-mail</button>
    <p class="auth-switch">Ainda não tem conta? <button class="link" id="to-signup">Testar 7 dias grátis</button></p>`);
  if (notice) msg(root, notice, 'good');
  bindPass(root); bindEmail(root);
  $('#to-signup', root).onclick = () => signupView(resolve);
  $('#to-reset', root).onclick = () => resetView(resolve);
  $('#to-magic', root).onclick = async (e) => {
    const email = $('#a-email', root).value.trim();
    if (!email) { msg(root, 'Digite seu e-mail acima para receber o link.'); return $('#a-email', root).focus(); }
    busy(e.target, true, 'Enviando…');
    const { error } = await auth.client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    busy(e.target, false, 'Receber link de acesso no e-mail');
    if (error) return msg(root, tr(error));
    try { localStorage.setItem(LAST, email); } catch (er) { /* opcional */ }
    msg(root, 'Link enviado para ' + email + '. Abra no mesmo aparelho para entrar.', 'good');
  };
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#a-email', root).value.trim(), password = $('#a-pass', root).value;
    if (!email || !password) return msg(root, 'Preencha e-mail e senha.');
    const btn = $('button[type=submit]', root); busy(btn, true, 'Entrando…');
    const { data, error } = await auth.client.auth.signInWithPassword({ email, password });
    busy(btn, false, 'Entrar');
    if (error) return msg(root, tr(error));
    try { localStorage.setItem(LAST, email); } catch (er) { /* opcional */ }
    auth.user = data.user;
    chooseOrg(resolve);
  };
  $(lastEmail() ? '#a-pass' : '#a-email', root).focus();
}

function signupView(resolve, pre = {}) {
  const plano = PLANOS[qs.get('plano')] ? qs.get('plano') : '';
  const root = screen(`
    <h1>${pre.convite ? 'Criar sua conta' : 'Teste grátis por 7 dias'}</h1><p class="auth-sub">${pre.convite ? 'Depois você entra direto no time.' : 'Sem cartão. Leva menos de um minuto.'}${plano ? ` <span class="plan-chip">Plano ${PLANOS[plano]}</span>` : ''}</p>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-nome">Seu nome</label><input id="a-nome" autocomplete="name" required value="${esc(pre.nome || '')}"></div>
      <div class="field"><label for="a-email">E-mail de trabalho</label><input id="a-email" type="email" autocomplete="email" inputmode="email" required value="${esc(pre.email || qs.get('email') || '')}"><p class="hint" id="a-email-hint" hidden></p></div>
      ${passField('a-pass', 'Crie uma senha', 'new-password', 'minlength="8" aria-describedby="a-meter-t"')}
      <div class="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="hint" id="a-meter-t">Pelo menos 8 caracteres. Misture letras, números e símbolos.</p>
      <label class="check-field" for="a-terms"><input type="checkbox" id="a-terms" required> <span>Li e aceito os <a href="termos.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Começar teste grátis</button>
    </form>
    <p class="auth-switch">Já tem conta? <button class="link" id="to-login">Entrar</button></p>`);
  bindPass(root); bindEmail(root);
  const pass = $('#a-pass', root), meter = $('.meter', root), mt = $('#a-meter-t', root);
  pass.addEventListener('input', () => { const f = forca(pass.value); meter.dataset.f = pass.value ? f : ''; mt.textContent = pass.value ? 'Força da senha: ' + FORCA[f] : 'Pelo menos 8 caracteres. Misture letras, números e símbolos.'; });
  $('#to-login', root).onclick = () => loginView(resolve);
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const nome = $('#a-nome', root).value.trim(), email = $('#a-email', root).value.trim(), password = pass.value;
    if (!nome) { msg(root, 'Como você se chama?'); return $('#a-nome', root).focus(); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg(root, 'Confira o e-mail.'); return $('#a-email', root).focus(); }
    if (password.length < 8) { msg(root, 'A senha precisa ter pelo menos 8 caracteres.'); return pass.focus(); }
    if (!$('#a-terms', root).checked) return msg(root, 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.');
    const btn = $('button[type=submit]', root); busy(btn, true, 'Criando…');
    const meta = { nome, terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString(), ...(plano ? { plano_interesse: plano } : {}) };
    const { data, error } = await auth.client.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin + location.pathname } });
    busy(btn, false, 'Começar teste grátis');
    if (error) return msg(root, tr(error));
    try { localStorage.setItem(LAST, email); } catch (er) { /* opcional */ }
    if (!data.session) return checkEmailView(resolve, email);
    auth.user = data.user;
    chooseOrg(resolve);
  };
  $('#a-nome', root).focus();
}

const ROLE_TXT = { admin: 'Administrador', manager: 'Gestor', editor: 'Edita tudo', social: 'Social Media', sales: 'Vendas', support: 'Atendimento', analyst: 'Analista', leitura: 'Só leitura', client: 'Cliente' };
async function conviteView(resolve) {
  const code = conviteAtual();
  const { data: info } = await auth.client.rpc('invite_info', { p_code: code });
  if (!info || !info.valido) {
    const root = screen(`<div class="auth-glyph" aria-hidden="true"><img src="assets/klasso-mark.png" alt=""></div><h1>Convite indisponível</h1><p class="auth-sub">${info ? 'Esse convite já foi usado ou venceu.' : 'Não encontramos esse convite.'} Peça um link novo para quem te convidou.</p><button class="btn block" id="cv-login">Entrar com minha conta</button>`);
    guardarConvite('');
    $('#cv-login', root).onclick = () => loginView(resolve);
    return;
  }
  const root = screen(`
    <div class="cv-card">
      <div class="auth-glyph" aria-hidden="true"><img src="assets/klasso-mark.png" alt=""></div>
      <p class="cv-k">Você foi convidado</p>
      <h1>${esc(info.escola)}</h1>
      <p class="auth-sub">Seu perfil no time: <span class="plan-chip">${esc(ROLE_TXT[info.role] || info.role)}</span></p>
      <ul class="cv-passos"><li><b>1</b>Crie sua conta</li><li><b>2</b>Responda 6 perguntas rápidas</li><li><b>3</b>Receba suas primeiras missões</li></ul>
      <button class="btn primary block" id="cv-novo">Criar minha conta</button>
      <button class="btn block" id="cv-tenho">Já tenho conta</button>
    </div>`);
  $('#cv-novo', root).onclick = () => signupView(resolve, { email: info.email || '', nome: info.nome || '', convite: true });
  $('#cv-tenho', root).onclick = () => loginView(resolve, 'Entre para aceitar o convite de ' + info.escola + '.');
}

// Depois do login: aceita o convite guardado e abre o quiz de perfil.
async function aceitarConvitePendente() {
  const code = conviteAtual(); if (!code) return null;
  const { data, error } = await auth.client.rpc('accept_invite', { p_code: code, p_user_nome: auth.user?.user_metadata?.nome || null });
  guardarConvite('');
  if (error) return { erro: /another email/.test(error.message) ? 'Esse convite foi feito para outro e-mail. Entre com o e-mail convidado ou peça um link novo.' : /expired/.test(error.message) ? 'O convite venceu ou já foi usado. Peça um link novo.' : 'Não foi possível aceitar o convite: ' + tr(error) };
  try { localStorage.setItem(ORG_KEY, data.id); } catch (e) { /* opcional */ }
  return { org: data };
}

function quizView(resolve, escola) {
  const root = screen('<div id="pq-root"></div>');
  root.classList.add('quiz-mode');
  montarQuiz($('#pq-root', root), { nome: auth.user?.user_metadata?.nome || '', escola, onFim: () => { root.classList.remove('quiz-mode'); chooseOrg(resolve, true); } });
}

function checkEmailView(resolve, email) {
  const root = screen(`
    <div class="auth-mail" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg></div>
    <h1>Confira seu e-mail</h1>
    <p class="auth-sub">Enviamos um link de confirmação para <b>${esc(email)}</b>. Abra e você já entra no painel.</p>
    <p class="hint">Não chegou em 2 minutos? Olhe a caixa de spam ou promoções.</p>
    <p class="auth-msg" role="alert" hidden></p>
    <button class="btn block" id="resend" type="button">Reenviar link</button>
    <p class="auth-switch"><button class="link" id="to-login">Voltar para Entrar</button></p>`);
  $('#to-login', root).onclick = () => loginView(resolve);
  $('#resend', root).onclick = async (e) => {
    busy(e.target, true, 'Reenviando…');
    const { error } = await auth.client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
    busy(e.target, false, 'Reenviar link');
    msg(root, error ? tr(error) : 'Link reenviado.', error ? 'bad' : 'good');
  };
}

function resetView(resolve) {
  const root = screen(`
    <h1>Recuperar senha</h1><p class="auth-sub">Enviamos um link para você criar uma senha nova.</p>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" inputmode="email" required value="${esc(lastEmail())}"><p class="hint" id="a-email-hint" hidden></p></div>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Enviar link</button>
    </form>
    <p class="auth-switch"><button class="link" id="to-login">Voltar para Entrar</button></p>`);
  bindEmail(root);
  $('#to-login', root).onclick = () => loginView(resolve);
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#a-email', root).value.trim();
    if (!email) return msg(root, 'Informe o e-mail.');
    const btn = $('button[type=submit]', root); busy(btn, true, 'Enviando…');
    const { error } = await auth.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    busy(btn, false, 'Enviar link');
    if (error) return msg(root, tr(error));
    msg(root, 'Se existir uma conta com esse e-mail, o link chega em alguns minutos.', 'good');
  };
  $('#a-email', root).focus();
}

function newPasswordView(resolve) {
  const root = screen(`
    <h1>Nova <em>senha</em></h1>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-pass">Nova senha</label><input id="a-pass" type="password" autocomplete="new-password" minlength="8" required><p class="hint">Pelo menos 8 caracteres.</p></div>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Salvar senha</button>
    </form>`);
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const password = $('#a-pass', root).value;
    if (password.length < 8) return msg(root, 'A senha precisa ter pelo menos 8 caracteres.');
    const { data, error } = await auth.client.auth.updateUser({ password });
    if (error) return msg(root, tr(error));
    auth.user = data.user;
    history.replaceState(null, '', location.pathname);
    chooseOrg(resolve);
  };
}

async function loadOrgs() {
  // Migração 002: my_orgs() traz as empresas diretas e os clientes das agências que a pessoa administra.
  const r = await auth.client.rpc('my_orgs');
  if (!r.error) {
    const { data: mine } = await auth.client.from('members').select('org_id, nome, email').eq('user_id', auth.user.id);
    const me = new Map((mine || []).map((m) => [m.org_id, m]));
    return { data: (r.data || []).map((o) => ({ org_id: o.id, role: o.role, nome: me.get(o.id)?.nome || auth.user.user_metadata?.nome || '', email: me.get(o.id)?.email || auth.user.email, orgs: { id: o.id, nome: o.nome, invite_code: o.invite_code, tipo: o.tipo, plano: o.plano, branding: o.branding || {}, parent_id: o.parent_id } })) };
  }
  // Banco sem a migração 002: formato antigo.
  return auth.client.from('members').select('role, nome, email, org_id, orgs(id, nome, invite_code)').eq('user_id', auth.user.id);
}

async function chooseOrg(resolve, depoisDoQuiz = false) {
  if (!depoisDoQuiz && conviteAtual()) {
    const r = await aceitarConvitePendente();
    if (r?.erro) { const root = screen(`<h1>Convite</h1><p class="auth-msg bad">${esc(r.erro)}</p><button class="btn block" id="retry">Continuar</button>`); $('#retry', root).onclick = () => chooseOrg(resolve, true); return; }
    if (r?.org && !auth.user?.user_metadata?.perfil) return quizView(resolve, r.org.nome);
  }
  const { data, error } = await loadOrgs();
  if (error) { const root = screen(`<h1>Não foi possível abrir sua escola</h1><p class="auth-msg bad">${esc(tr(error))}</p><p class="muted">Tente de novo em instantes. Se continuar, fale com o suporte.</p><button class="btn block" id="retry">Tentar de novo</button>`); $('#retry', root).onclick = () => chooseOrg(resolve); return; }
  const list = (data || []).filter((m) => m.orgs);
  let saved = null; try { saved = localStorage.getItem(ORG_KEY) || localStorage.getItem(OLD_ORG_KEY); } catch (e) { /* opcional */ }
  const pick = list.find((m) => m.org_id === saved) || (list.length === 1 ? list[0] : null);
  if (pick) return finish(pick, resolve);
  if (list.length > 1) {
    const root = screen(`<h1>Escolha a escola</h1><div class="auth-list">${list.map((m) => `<button class="btn block" data-org="${esc(m.org_id)}">${m.orgs.parent_id ? '↳ ' : ''}${esc(m.orgs.nome)} <small>${esc(roleLabel(m.role))}${m.orgs.tipo === 'agencia' ? ' · agência' : ''}</small></button>`).join('')}</div>`);
    root.querySelectorAll('[data-org]').forEach((b) => (b.onclick = () => finish(list.find((m) => m.org_id === b.dataset.org), resolve)));
    return;
  }
  onboardingView(resolve);
}

function onboardingView(resolve) {
  const nome = auth.user.user_metadata?.nome || '';
  const root = screen(`
    <h1>Configure sua escola</h1>
    <p class="auth-sub">Crie o espaço da sua escola (você vira o dono) ou entre no time com o código de convite que recebeu.</p>
    <form id="o-create" class="auth-form" novalidate>
      <div class="field"><label for="o-nome">Nome da escola</label><input id="o-nome" value="" placeholder="ex.: Escola Exemplo · Centro" required></div>
      <button class="btn primary block" type="submit">Criar minha escola</button>
    </form>
    <div class="auth-sep"><span>ou</span></div>
    <form id="o-join" class="auth-form" novalidate>
      <div class="field"><label for="o-code">Código de convite</label><input id="o-code" autocomplete="off" placeholder="ex.: 7f3a9c21" required></div>
      <button class="btn block" type="submit">Entrar no time</button>
    </form>
    <p class="auth-msg" role="alert" hidden></p>
    <div class="auth-links"><button class="link" id="o-out">Sair</button></div>`);
  $('#o-out', root).onclick = async () => { await auth.client.auth.signOut(); loginView(resolve); };
  $('#o-create', root).onsubmit = async (e) => {
    e.preventDefault();
    const n = $('#o-nome', root).value.trim();
    if (!n) return msg(root, 'Dê um nome para a escola.');
    const { error } = await auth.client.rpc('create_org', { p_nome: n, p_user_nome: nome });
    if (error) return msg(root, tr(error));
    chooseOrg(resolve);
  };
  $('#o-join', root).onsubmit = async (e) => {
    e.preventDefault();
    const code = $('#o-code', root).value.trim();
    if (!code) return msg(root, 'Informe o código.');
    const { data, error } = await auth.client.rpc('join_org', { p_code: code, p_user_nome: nome });
    if (error) return msg(root, /not found|nao encontrado|não encontrado/i.test(error.message) ? 'Código não encontrado. Confira com quem te convidou.' : tr(error));
    try { localStorage.setItem(ORG_KEY, data?.id || ''); } catch (er) { /* opcional */ }
    chooseOrg(resolve);
  };
}

function finish(m, resolve) {
  auth.org = m.orgs;
  if (WHITELABEL) applyBranding(m.orgs.branding || {});
  auth.member = m;
  store.eu = { id: auth.user?.id, nome: m.nome || auth.user?.user_metadata?.nome || '', dono: ['owner', 'admin'].includes(m.role) };
  try { localStorage.setItem(ORG_KEY, m.org_id); } catch (e) { /* opcional */ }
  $('#auth').hidden = true;
  $('#auth').innerHTML = '';
  $('#app').hidden = false;
  resolve(auth);
}

export const roleLabel = (r) => ROLES[r]?.nome || r;

// Resolve quando há usuário logado e unidade escolhida. Retorna null se o Supabase não estiver configurado.
export function initAuth() {
  auth.configured = supabaseConfigured();
  if (!auth.configured) return Promise.resolve(null);
  auth.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return new Promise(async (resolve) => {
    let recovering = /type=recovery/.test(location.hash);
    auth.client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; auth.user = session?.user; newPasswordView(resolve); }
      if (event === 'SIGNED_OUT' && auth.org) location.reload();
    });
    // Marca do domínio (white-label) já na tela de login.
    if (WHITELABEL) try { const b = await auth.client.rpc('branding_for_host', { h: location.hostname }); if (b.data && Object.keys(b.data).length) applyBranding(b.data); } catch (e) { /* banco sem migração 002 */ }
    const { data } = await auth.client.auth.getSession();
    if (recovering) return;
    if (data.session) { auth.user = data.session.user; chooseOrg(resolve); }
    else if (conviteAtual()) conviteView(resolve);
    else if (qs.get('cadastro')) signupView(resolve);
    else loginView(resolve);
  });
}

export async function signOut() {
  try { localStorage.removeItem(ORG_KEY); } catch (e) { /* opcional */ }
  await auth.client?.auth.signOut();
  location.reload();
}

export function switchOrg() {
  try { localStorage.removeItem(ORG_KEY); } catch (e) { /* opcional */ }
  location.reload();
}
