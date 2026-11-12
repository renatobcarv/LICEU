// Cadastro, login e escolha da unidade (Supabase Auth).
// Sem Supabase configurado, o app roda sem login e salva no navegador.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, $ } from './util.js';
import { LOGO_MARK, TERMS_VERSION, applyBranding } from './brand.js';

import { ROLES } from './access.js';
const ORG_KEY = 'liceu.intelligence.org';
const OLD_ORG_KEY = 'tecmais.intelligence.org'; // nome antigo, lido só para não perder a unidade escolhida
export const auth = { client: null, user: null, org: null, member: null, configured: false };

export function supabaseConfigured() {
  // Dentro do claude.ai (prévia) o navegador não pode falar com o Supabase; lá o app usa o banco do Artifact.
  if (window.claude?.use) return false;
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient);
}

const LOGO = `<div class="auth-logo">${LOGO_MARK}<span class="brand-sub">Intelligence</span></div>`;

function screen(inner) {
  const root = $('#auth');
  root.hidden = false;
  $('#app').hidden = true;
  root.innerHTML = `<div class="auth-card">${LOGO}<p class="auth-eyebrow">Intelligence</p>${inner}</div><p class="auth-foot">Marketing e matrículas em um só lugar · <a href="termos.html" target="_blank" rel="noopener">Termos de uso</a> · <a href="privacidade.html" target="_blank" rel="noopener">Privacidade</a></p>`;
  return root;
}
function msg(root, text, kind = 'bad') { const el = $('.auth-msg', root); el.textContent = text; el.className = 'auth-msg ' + kind; el.hidden = !text; }
function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = label; }

const ERRORS = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Já existe uma conta com esse e-mail. Use Entrar ou Esqueci a senha.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 8 caracteres.',
  'Email rate limit exceeded': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
};
const tr = (e) => ERRORS[e?.message] || (/fetch|network/i.test(e?.message || '') ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : e?.message) || 'Não foi possível concluir. Tente de novo.';

function loginView(resolve, notice = '') {
  const root = screen(`
    <h1>Entrar no <em>painel</em></h1>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="a-pass">Senha</label><input id="a-pass" type="password" autocomplete="current-password" required></div>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Entrar</button>
    </form>
    <div class="auth-links"><button class="link" id="to-signup">Criar conta</button><button class="link" id="to-reset">Esqueci a senha</button></div>`);
  if (notice) msg(root, notice, 'good');
  $('#to-signup', root).onclick = () => signupView(resolve);
  $('#to-reset', root).onclick = () => resetView(resolve);
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#a-email', root).value.trim(), password = $('#a-pass', root).value;
    if (!email || !password) return msg(root, 'Preencha e-mail e senha.');
    const btn = $('button[type=submit]', root); busy(btn, true, 'Entrando…');
    const { data, error } = await auth.client.auth.signInWithPassword({ email, password });
    busy(btn, false, 'Entrar');
    if (error) return msg(root, tr(error));
    auth.user = data.user;
    chooseOrg(resolve);
  };
  $('#a-email', root).focus();
}

function signupView(resolve) {
  const root = screen(`
    <h1>Criar <em>conta</em></h1>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-nome">Seu nome</label><input id="a-nome" autocomplete="name" required></div>
      <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="a-pass">Senha</label><input id="a-pass" type="password" autocomplete="new-password" minlength="8" required><p class="hint">Pelo menos 8 caracteres.</p></div>
      <label class="check-field" for="a-terms"><input type="checkbox" id="a-terms" required> <span>Li e aceito os <a href="termos.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Criar conta</button>
    </form>
    <div class="auth-links"><button class="link" id="to-login">Já tenho conta</button></div>`);
  $('#to-login', root).onclick = () => loginView(resolve);
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const nome = $('#a-nome', root).value.trim(), email = $('#a-email', root).value.trim(), password = $('#a-pass', root).value;
    if (!nome || !email || password.length < 8) return msg(root, 'Preencha nome, e-mail e uma senha com 8 caracteres ou mais.');
    if (!$('#a-terms', root).checked) return msg(root, 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.');
    const btn = $('button[type=submit]', root); busy(btn, true, 'Criando…');
    const meta = { nome, terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() };
    const { data, error } = await auth.client.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin + location.pathname } });
    busy(btn, false, 'Criar conta');
    if (error) return msg(root, tr(error));
    if (!data.session) return loginView(resolve, 'Conta criada. Abra o link que enviamos para ' + email + ' e depois entre aqui.');
    auth.user = data.user;
    chooseOrg(resolve);
  };
  $('#a-nome', root).focus();
}

function resetView(resolve) {
  const root = screen(`
    <h1>Recuperar <em>senha</em></h1>
    <p class="muted">Enviamos um link para você criar uma senha nova.</p>
    <form id="a-form" class="auth-form" novalidate>
      <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" required></div>
      <p class="auth-msg" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Enviar link</button>
    </form>
    <div class="auth-links"><button class="link" id="to-login">Voltar para Entrar</button></div>`);
  $('#to-login', root).onclick = () => loginView(resolve);
  $('#a-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#a-email', root).value.trim();
    if (!email) return msg(root, 'Informe o e-mail.');
    const { error } = await auth.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) return msg(root, tr(error));
    msg(root, 'Se existir uma conta com esse e-mail, o link chega em alguns minutos.', 'good');
  };
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

async function chooseOrg(resolve) {
  const { data, error } = await loadOrgs();
  if (error) { const root = screen(`<h1>Não foi possível carregar sua unidade</h1><p class="auth-msg bad">${esc(tr(error))}</p><p class="muted">Confira se o banco foi criado com o arquivo supabase/schema.sql.</p><button class="btn block" id="retry">Tentar de novo</button>`); $('#retry', root).onclick = () => chooseOrg(resolve); return; }
  const list = (data || []).filter((m) => m.orgs);
  let saved = null; try { saved = localStorage.getItem(ORG_KEY) || localStorage.getItem(OLD_ORG_KEY); } catch (e) { /* opcional */ }
  const pick = list.find((m) => m.org_id === saved) || (list.length === 1 ? list[0] : null);
  if (pick) return finish(pick, resolve);
  if (list.length > 1) {
    const root = screen(`<h1>Escolha a <em>unidade</em></h1><div class="auth-list">${list.map((m) => `<button class="btn block" data-org="${esc(m.org_id)}">${m.orgs.parent_id ? '↳ ' : ''}${esc(m.orgs.nome)} <small>${esc(roleLabel(m.role))}${m.orgs.tipo === 'agencia' ? ' · agência' : ''}</small></button>`).join('')}</div>`);
    root.querySelectorAll('[data-org]').forEach((b) => (b.onclick = () => finish(list.find((m) => m.org_id === b.dataset.org), resolve)));
    return;
  }
  onboardingView(resolve);
}

function onboardingView(resolve) {
  const nome = auth.user.user_metadata?.nome || '';
  const root = screen(`
    <h1>Sua <em>unidade</em></h1>
    <p class="muted">Crie a unidade (você vira administrador) ou entre na equipe com o código que o coordenador passou.</p>
    <form id="o-create" class="auth-form" novalidate>
      <div class="field"><label for="o-nome">Nome da unidade</label><input id="o-nome" value="" placeholder="ex.: Escola Exemplo · Centro" required></div>
      <button class="btn primary block" type="submit">Criar unidade</button>
    </form>
    <div class="auth-sep"><span>ou</span></div>
    <form id="o-join" class="auth-form" novalidate>
      <div class="field"><label for="o-code">Código de convite</label><input id="o-code" autocomplete="off" placeholder="ex.: 7f3a9c21" required></div>
      <button class="btn block" type="submit">Entrar na equipe</button>
    </form>
    <p class="auth-msg" role="alert" hidden></p>
    <div class="auth-links"><button class="link" id="o-out">Sair</button></div>`);
  $('#o-out', root).onclick = async () => { await auth.client.auth.signOut(); loginView(resolve); };
  $('#o-create', root).onsubmit = async (e) => {
    e.preventDefault();
    const n = $('#o-nome', root).value.trim();
    if (!n) return msg(root, 'Dê um nome para a unidade.');
    const { error } = await auth.client.rpc('create_org', { p_nome: n, p_user_nome: nome });
    if (error) return msg(root, tr(error));
    chooseOrg(resolve);
  };
  $('#o-join', root).onsubmit = async (e) => {
    e.preventDefault();
    const code = $('#o-code', root).value.trim();
    if (!code) return msg(root, 'Informe o código.');
    const { data, error } = await auth.client.rpc('join_org', { p_code: code, p_user_nome: nome });
    if (error) return msg(root, /not found|nao encontrado|não encontrado/i.test(error.message) ? 'Código não encontrado. Confira com o coordenador.' : tr(error));
    try { localStorage.setItem(ORG_KEY, data?.id || ''); } catch (er) { /* opcional */ }
    chooseOrg(resolve);
  };
}

function finish(m, resolve) {
  auth.org = m.orgs;
  applyBranding(m.orgs.branding || {});
  auth.member = m;
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
    try { const b = await auth.client.rpc('branding_for_host', { h: location.hostname }); if (b.data && Object.keys(b.data).length) applyBranding(b.data); } catch (e) { /* banco sem migração 002 */ }
    const { data } = await auth.client.auth.getSession();
    if (recovering) return;
    if (data.session) { auth.user = data.session.user; chooseOrg(resolve); }
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
