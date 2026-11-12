// Administração SaaS dentro de Configurações: plano e consumo, marca (white-label), domínios,
// WhatsApp oficial por empresa (Embedded Signup) e clientes da agência.
// Tudo passa pelas regras do banco (migração 002); a tela só mostra o que a pessoa pode fazer.

import { esc, $, $$ } from '../util.js';
import { toast, openDialog, ICON, confirmButton } from '../ui.js';
import { auth } from '../auth.js';
import { applyBranding } from '../brand.js';
import { isAdminRole } from '../access.js';
import { META_APP_ID, WA_CONFIG_ID } from '../config.js';

const sb = () => auth.client;
const org = () => auth.org || {};
const admin = () => isAdminRole(auth.member?.role);

export function render() {
  if (!admin()) return '';
  const o = org();
  return `
  <section class="card saas" id="saas-plano"><header class="card-head"><div><h2>Plano e consumo</h2><p class="muted">${esc(o.nome || '')} · ${o.tipo === 'agencia' ? 'Agência' : 'Empresa'}${o.parent_id ? ' · cliente de agência' : ''}</p></div></header>
    <div id="saas-uso"><p class="empty-sm">Carregando…</p></div></section>

  <section class="card saas"><header class="card-head"><div><h2>Marca (white-label)</h2><p class="muted">Nome, logotipo e cores que a sua equipe e seus clientes veem</p></div><button class="btn sm" data-saas="marca">Editar marca</button></header>
    <div class="wl-prev" style="--p:${esc(o.branding?.primaria || '#a3ff12')};--s:${esc(o.branding?.secundaria || '#7a9e00')}">
      ${o.branding?.logo ? `<img src="${esc(o.branding.logo)}" alt="" class="wl-logo">` : '<span class="wl-dot"></span>'}
      <div><b>${esc(o.branding?.nome || 'FLOWCLASS Intelligence')}</b><small>${o.branding?.primaria ? 'Cores próprias aplicadas' : 'Usando a marca padrão'}</small></div>
    </div></section>

  <section class="card saas"><header class="card-head"><div><h2>Domínio próprio</h2><p class="muted">Ex.: painel.suaescola.com.br. Disponível nos planos Rede e Agência</p></div><button class="btn sm" data-saas="dominio">${ICON.plus} Adicionar domínio</button></header>
    <div id="saas-dom"><p class="empty-sm">Carregando…</p></div></section>

  <section class="card saas"><header class="card-head"><div><h2>WhatsApp oficial</h2><p class="muted">Cada empresa conecta o próprio número pela Meta. As conversas caem no Funil desta empresa</p></div><button class="btn sm primary" data-saas="wa">Conectar WhatsApp</button></header>
    <div id="saas-wa"><p class="empty-sm">Carregando…</p></div></section>

  ${o.tipo === 'agencia' ? `<section class="card saas"><header class="card-head"><div><h2>Clientes da agência</h2><p class="muted">Cada cliente tem dados, equipe e WhatsApp separados. Você entra em qualquer um</p></div><button class="btn sm" data-saas="cliente">${ICON.plus} Novo cliente</button></header>
    <div id="saas-cli"><p class="empty-sm">Carregando…</p></div></section>` : ''}`;
}

async function uso(root) {
  const box = $('#saas-uso', root); if (!box) return;
  const [{ data: plans }, { data: u }, { data: wa }, { count: membros }] = await Promise.all([
    sb().from('plans').select('*'), sb().from('usage_records').select('*').eq('org_id', org().id),
    sb().from('wa_connections').select('id').eq('org_id', org().id), sb().from('members').select('user_id', { count: 'exact', head: true }).eq('org_id', org().id),
  ]);
  const p = (plans || []).find((x) => x.id === org().plano) || { nome: org().plano || 'local', limites: {} };
  const mes = new Date().toISOString().slice(0, 7);
  const ia = (u || []).find((r) => r.metrica === 'ia' && r.periodo === mes)?.qtd || 0;
  const linhas = [['Usuários', membros || 0, p.limites.usuarios], ['Números de WhatsApp', (wa || []).length, p.limites.whatsapp], ['Gerações de IA no mês', ia, p.limites.ia_mes], ['Domínios próprios', null, p.limites.dominios]];
  if (org().tipo === 'agencia') linhas.push(['Clientes', null, p.limites.clientes]);
  box.innerHTML = `<p class="plan-name">Plano <b>${esc(p.nome)}</b></p><div class="uso">${linhas.map(([l, v, max]) => `<div><span>${l}</span><b>${v == null ? '' : v + ' / '}${max ?? '—'}</b>${v != null && max ? `<div class="tm-bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div>` : ''}</div>`).join('')}</div>
    <p class="hint">Cobrança ainda não está ligada: o plano é definido pela plataforma. Os limites já valem no banco.</p>`;
}

async function dominios(root) {
  const box = $('#saas-dom', root); if (!box) return;
  const { data, error } = await sb().from('org_domains').select('*').eq('org_id', org().id);
  if (error) { box.innerHTML = `<p class="hint">Rode a migração 002 no Supabase para liberar domínios.</p>`; return; }
  box.innerHTML = data.length ? data.map((d) => `<div class="member-row"><div class="who"><b>${esc(d.host)}</b><small>${d.verificado ? 'Verificado' : `Falta verificar. No DNS do domínio crie: <code>CNAME ${esc(d.host)} → app.flowclass.com.br</code> e <code>TXT _flowclass.${esc(d.host)} = ${esc(d.token)}</code>`}</small></div><span class="badge ${d.verificado ? 'good' : 'warn'}">${d.verificado ? 'Ativo' : 'Pendente'}</span><button class="btn sm ghost" data-domrm="${esc(d.host)}">Remover</button></div>`).join('') : '<p class="empty-sm">Nenhum domínio. O app continua no endereço padrão.</p>';
}

async function whatsapp(root) {
  const box = $('#saas-wa', root); if (!box) return;
  const { data, error } = await sb().from('wa_connections').select('*').eq('org_id', org().id).order('created_at');
  if (error) { box.innerHTML = `<p class="hint">Rode a migração 002 no Supabase para conectar números.</p>`; return; }
  const st = { conectado: 'good', pendente: 'warn', erro: 'bad', desconectado: '' };
  box.innerHTML = (data.length ? data.map((c) => `<div class="member-row"><div class="who"><b>${esc(c.telefone || c.phone_number_id)}</b><small>${esc(c.nome_verificado || '')}${c.qualidade ? ' · qualidade ' + esc(c.qualidade) : ''}${c.erro ? ' · ' + esc(c.erro) : ''}</small></div><span class="badge ${st[c.status] || ''}">${esc(c.status)}</span><button class="btn sm ghost" data-warm="${esc(c.id)}">Desconectar</button></div>`).join('') : '<p class="empty-sm">Nenhum número conectado.</p>')
    + (!META_APP_ID ? '<p class="hint">Para o botão funcionar, a plataforma precisa do App da Meta aprovado (META_APP_ID e WA_CONFIG_ID em js/config.js). Veja docs/PENDENCIAS.md.</p>' : '');
}

async function clientes(root) {
  const box = $('#saas-cli', root); if (!box) return;
  const { data } = await sb().rpc('my_orgs');
  const filhos = (data || []).filter((o) => o.parent_id === org().id);
  box.innerHTML = filhos.length ? filhos.map((o) => `<div class="member-row"><div class="who"><b>${esc(o.nome)}</b><small>Plano ${esc(o.plano)}${o.invite_code ? ' · convite ' + esc(o.invite_code) : ''}</small></div><button class="btn sm" data-entrar="${esc(o.id)}">Entrar</button></div>`).join('') : '<p class="empty-sm">Nenhum cliente ainda.</p>';
}

// ---------- Embedded Signup (Meta): o cliente conecta o próprio número sem sair do painel ----------
function loadFb() {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((ok, fail) => {
    window.fbAsyncInit = () => { window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' }); ok(window.FB); };
    const s = document.createElement('script'); s.src = 'https://connect.facebook.net/pt_BR/sdk.js'; s.async = true; s.crossOrigin = 'anonymous'; s.onerror = () => fail(new Error('SDK da Meta não carregou'));
    document.head.appendChild(s);
  });
}
async function conectarWhatsApp(root) {
  if (!META_APP_ID || !WA_CONFIG_ID) return toast('A conexão pelo painel precisa do App da Meta da plataforma (pendência em docs/PENDENCIAS.md).', 'warn');
  let sessao = {};
  const ouvir = (ev) => {
    if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return;
    try { const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; if (d?.type === 'WA_EMBEDDED_SIGNUP') { if (d.event === 'FINISH' || d.event === 'FINISH_ONLY_WABA') sessao = d.data || {}; if (d.event === 'CANCEL') toast('Conexão cancelada na etapa ' + (d.data?.current_step || '?') + '.', 'warn'); } } catch { /* mensagem de outro tipo */ }
  };
  window.addEventListener('message', ouvir);
  try {
    const FB = await loadFb();
    FB.login(async (resp) => {
      window.removeEventListener('message', ouvir);
      const code = resp?.authResponse?.code;
      if (!code) return toast('A Meta não devolveu autorização.', 'warn');
      toast('Validando com a Meta…');
      const { data, error } = await sb().functions.invoke('whatsapp-connect', { body: { orgId: org().id, code, wabaId: sessao.waba_id, phoneNumberId: sessao.phone_number_id } });
      if (error || data?.error) return toast(data?.error || 'Falha ao conectar.', 'bad');
      toast('WhatsApp conectado: ' + (data.telefone || '') + '.');
      whatsapp(root); uso(root);
    }, { config_id: WA_CONFIG_ID, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: '', sessionInfoVersion: '3' } });
  } catch (e) { window.removeEventListener('message', ouvir); toast(e.message, 'bad'); }
}

function marcaDialog() {
  const b = org().branding || {};
  openDialog({ title: 'Marca da plataforma', saveLabel: 'Aplicar marca',
    fields: [
      { name: 'nome', label: 'Nome do produto', value: b.nome || '', placeholder: 'FLOWCLASS Intelligence', full: true },
      { name: 'logo', label: 'Logotipo (link https, fundo transparente)', value: b.logo || '', full: true },
      { name: 'simbolo', label: 'Símbolo pequeno (link https)', value: b.simbolo || '' },
      { name: 'favicon', label: 'Ícone da aba (link https)', value: b.favicon || '' },
      { name: 'primaria', label: 'Cor principal', type: 'color', value: b.primaria || '#a3ff12' },
      { name: 'secundaria', label: 'Cor secundária', type: 'color', value: b.secundaria || '#7a9e00' },
      { name: 'destaque', label: 'Cor de destaque', type: 'color', value: b.destaque || '#ff7a1a' },
      { name: 'rodape', label: 'Rodapé', value: b.rodape || '', full: true },
    ],
    html: '<p class="hint">Links precisam começar com https. As cores valem para todo o app desta empresa (e dos clientes criados depois, se for agência).</p>',
    onSave: async (d) => {
      const nb = Object.fromEntries(Object.entries(d).filter(([, v]) => String(v || '').trim()));
      const { error } = await sb().from('orgs').update({ branding: nb }).eq('id', org().id);
      if (error) return toast('Não foi possível salvar: ' + error.message, 'bad');
      auth.org.branding = nb; applyBranding(nb); toast('Marca aplicada.');
    } });
}

export function mount(root, ctx) {
  if (!admin() || !sb()) return;
  uso(root); dominios(root); whatsapp(root); clientes(root);
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-saas]')?.dataset.saas;
    if (a === 'marca') return marcaDialog();
    if (a === 'wa') return conectarWhatsApp(root);
    if (a === 'dominio') return openDialog({ title: 'Domínio próprio', saveLabel: 'Adicionar', fields: [{ name: 'host', label: 'Endereço (sem https)', placeholder: 'painel.suaescola.com.br', required: true, full: true }],
      onSave: async (d) => { const { error } = await sb().from('org_domains').insert({ host: d.host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), org_id: org().id }); if (error) return toast(/row-level|policy/i.test(error.message) ? 'Seu plano não inclui mais domínios.' : error.message, 'bad'); dominios(root); } });
    if (a === 'cliente') return openDialog({ title: 'Novo cliente', saveLabel: 'Criar cliente', fields: [{ name: 'nome', label: 'Nome do cliente', required: true, full: true }, { name: 'slug', label: 'Subdomínio (opcional)', placeholder: 'escola-centro' }],
      onSave: async (d) => { const { error } = await sb().rpc('create_child_org', { p_parent: org().id, p_nome: d.nome, p_slug: d.slug || null }); if (error) return toast(/limit/.test(error.message) ? 'Limite de clientes do plano atingido.' : error.message, 'bad'); toast('Cliente criado.'); clientes(root); } });
    const rmD = e.target.closest('[data-domrm]'); if (rmD) { if (!confirmButton(rmD, 'Confirmar')) return; await sb().from('org_domains').delete().eq('host', rmD.dataset.domrm); return dominios(root); }
    const rmW = e.target.closest('[data-warm]'); if (rmW) { if (!confirmButton(rmW, 'Confirmar')) return; const { error } = await sb().from('wa_connections').delete().eq('id', rmW.dataset.warm); toast(error ? error.message : 'Número desconectado deste painel.'); return whatsapp(root); }
    const ent = e.target.closest('[data-entrar]'); if (ent) { try { localStorage.setItem('liceu.intelligence.org', ent.dataset.entrar); } catch { /* */ } location.reload(); }
  });
}
