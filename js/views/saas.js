// Administração SaaS dentro de Configurações: plano e consumo, marca (white-label), domínios,
// WhatsApp oficial por empresa (Embedded Signup) e clientes da agência.
// Tudo passa pelas regras do banco (migração 002); a tela só mostra o que a pessoa pode fazer.

import { esc, $, $$ } from '../util.js';
import { toast, openDialog, ICON, confirmButton } from '../ui.js';
import { auth } from '../auth.js';
import { applyBranding } from '../brand.js';
import { isAdminRole } from '../access.js';
import { META_APP_ID, WA_CONFIG_ID, WHITELABEL } from '../config.js';
import { store } from '../store.js';

const sb = () => auth.client;
const org = () => auth.org || {};
const admin = () => isAdminRole(auth.member?.role);

const PLANO_NOME = { start: 'Start', local: 'Essencial', pro: 'Escola', agencia: 'Rede' };

export function renderPlano() {
  if (!admin()) return '';
  return `<section class="card saas" id="saas-plano"><header class="card-head"><div><h2>Seu plano</h2><p class="muted">${esc(org().nome || '')}</p></div><a class="btn sm primary" href="/planos" target="_blank" rel="noopener">Ver planos</a></header>
    <div id="saas-trial"></div>
    <div id="saas-uso"><p class="empty-sm">Carregando…</p></div></section>
  ${WHITELABEL ? render() : ''}`;
}

export function renderWhatsApp() {
  if (!admin()) return '';
  return `<section class="card saas"><header class="card-head"><div><h2>WhatsApp</h2><p class="muted">As conversas caem direto no Funil. Escolha como conectar o número da escola</p></div></header>
    <div class="wa-opcoes">
      <div class="wa-op rec"><span class="badge good">Recomendado</span><b>API oficial da Meta</b><small>Sem risco de bloqueio e com o anúncio de origem de cada lead (custo por matrícula exato).</small>
        <div class="row-actions"><button class="btn sm primary" data-saas="wa">Conectar oficial</button><button class="btn sm ghost" data-saas="wa-assistida">Conexão assistida</button></div></div>
      <div class="wa-op"><span class="badge warn">Rápido · não oficial</span><b>QR Code</b><small>Conecta em 1 minuto pelo celular. Pode ser bloqueado pela Meta e não traz o anúncio de origem.</small>
        <div class="row-actions"><button class="btn sm" data-saas="wa-qr">Conectar por QR Code</button></div></div>
    </div>
    <div id="saas-wa"><p class="empty-sm">Carregando…</p></div></section>`;
}

// Cartões de white-label (marca, domínio, clientes). Só aparecem com WHITELABEL ligado.
export function render() {
  if (!admin() || !WHITELABEL) return '';
  const o = org();
  return `
  <section class="card saas"><header class="card-head"><div><h2>Marca (white-label)</h2><p class="muted">Nome, logotipo e cores que a sua equipe e seus clientes veem</p></div><button class="btn sm" data-saas="marca">Editar marca</button></header>
    <div class="wl-prev" style="--p:${esc(o.branding?.primaria || '#c6ff00')};--s:${esc(o.branding?.secundaria || '#8b00ff')}">
      ${o.branding?.logo ? `<img src="${esc(o.branding.logo)}" alt="" class="wl-logo">` : '<span class="wl-dot"></span>'}
      <div><b>${esc(o.branding?.nome || 'Klasso')}</b><small>${o.branding?.primaria ? 'Cores próprias aplicadas' : 'Usando a marca padrão'}</small></div>
    </div></section>
  <section class="card saas"><header class="card-head"><div><h2>Domínio próprio</h2><p class="muted">Ex.: painel.suaescola.com.br</p></div><button class="btn sm" data-saas="dominio">${ICON.plus} Adicionar domínio</button></header>
    <div id="saas-dom"><p class="empty-sm">Carregando…</p></div></section>
  ${o.tipo === 'agencia' ? `<section class="card saas"><header class="card-head"><div><h2>Clientes da agência</h2><p class="muted">Cada cliente tem dados, equipe e WhatsApp separados</p></div><button class="btn sm" data-saas="cliente">${ICON.plus} Novo cliente</button></header>
    <div id="saas-cli"><p class="empty-sm">Carregando…</p></div></section>` : ''}`;
}

async function trial(root) {
  const box = $('#saas-trial', root); if (!box) return;
  const { data } = await sb().rpc('trial_status', { o: org().id });
  if (!data) return;
  const st = { teste: 'Teste grátis', ativa: 'Assinatura ativa', atrasada: 'Pagamento pendente', cancelada: 'Cancelada', cortesia: 'Cortesia' }[data.status] || data.status;
  box.innerHTML = `<div class="plan-now"><div><small>Situação</small><b>${esc(st)}</b></div><div><small>Plano</small><b>${esc(PLANO_NOME[data.plano] || data.plano)}</b></div>${data.status === 'teste' ? `<div><small>Teste termina em</small><b>${data.dias} ${data.dias === 1 ? 'dia' : 'dias'}</b></div>` : ''}</div>`;
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
  const linhas = [['Usuários', membros || 0, p.limites.usuarios], ['Números de WhatsApp', (wa || []).length, p.limites.whatsapp], ['Gerações de IA no mês', ia, p.limites.ia_mes]];
  if (WHITELABEL) { linhas.push(['Domínios próprios', null, p.limites.dominios]); if (org().tipo === 'agencia') linhas.push(['Clientes', null, p.limites.clientes]); }
  box.innerHTML = `<div class="uso">${linhas.map(([l, v, max]) => `<div><span>${l}</span><b>${v == null ? '' : v + ' / '}${max ?? '—'}</b>${v != null && max ? `<div class="tm-bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div>` : ''}</div>`).join('')}</div>
    <p class="hint">Precisa de mais usuários ou números? Mude de plano a qualquer momento; seus dados continuam iguais.</p>`;
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
  box.innerHTML = (data.length ? data.map((c) => `<div class="member-row"><div class="who"><b>${esc(c.telefone || c.phone_number_id)}</b><small>${esc(c.nome_verificado || '')}${c.qualidade ? ' · qualidade ' + esc(c.qualidade) : ''}${c.erro ? ' · ' + esc(c.erro) : ''}</small></div>${c.tipo === 'qr' ? '<span class="badge warn">QR</span>' : ''}<span class="badge ${st[c.status] || ''}">${esc(c.status)}</span>${c.tipo === 'qr' && c.status !== 'conectado' ? '<button class="btn sm" data-saas="wa-qr-novo">Ler QR</button>' : ''}${c.tipo === 'qr' && c.status === 'conectado' ? `<button class="btn sm ghost" data-saas="wa-qr-sync" title="${c.ultima_sync ? 'Última busca: ' + esc(new Date(c.ultima_sync).toLocaleString('pt-BR')) : ''}">Buscar conversas perdidas</button>` : ''}<button class="btn sm ghost" ${c.tipo === 'qr' ? 'data-waqrrm="1"' : `data-warm="${esc(c.id)}"`}>Desconectar</button></div>`).join('') : '<p class="empty-sm">Nenhum número conectado.</p>')
    + (!META_APP_ID ? '<p class="hint">A conexão pelo painel está sendo liberada pela Meta. Enquanto isso, nosso time conecta o seu número com você pela conexão assistida.</p>' : '');
  // Com número conectado, o funil passa a usar o WhatsApp oficial (conversa dentro do app).
  const ligado = data.some((c) => c.status === 'conectado');
  // QR: ao abrir, confere sozinho se ficou mensagem para trás (servidor desligado, internet caiu).
  if (data.some((c) => c.tipo === 'qr' && c.status === 'conectado') && !whatsapp.sincronizado) { whatsapp.sincronizado = true; sincronizarQr(root, true); }
  const st0 = store.settings();
  if (ligado !== !!st0.whatsappApi && isAdminRole(auth.member?.role)) store.put('settings', { ...st0, id: 'main', whatsappApi: ligado });
}

// Conexão assistida (MVP): o time Klasso conecta o número com o token de usuário do sistema.
// O token vai do navegador direto para a função (HTTPS), é validado na Meta e gravado cifrado. A função só aceita administradores da plataforma.
function conexaoAssistida(root) {
  openDialog({
    title: 'Conexão assistida do WhatsApp', saveLabel: 'Validar e conectar',
    fields: [
      { name: 'wabaId', label: 'ID da conta do WhatsApp Business (WABA)', required: true, placeholder: 'só números', full: true },
      { name: 'phoneNumberId', label: 'ID do número de telefone', required: true, placeholder: 'só números', full: true, hint: 'Meta › WhatsApp › Configuração da API' },
      { name: 'token', label: 'Token permanente do usuário do sistema', type: 'password', required: true, full: true, hint: 'Vai direto para o servidor e fica cifrado. Nunca cole em chat.' },
    ],
    onSave: (d) => {
      toast('Validando com a Meta…');
      sb().functions.invoke('whatsapp-connect', { body: { orgId: org().id, manual: true, wabaId: d.wabaId.replace(/\D/g, ''), phoneNumberId: d.phoneNumberId.replace(/\D/g, ''), token: d.token.trim() } })
        .then(async ({ data, error }) => {
          let msg = data?.error; if (!msg && error) { try { msg = (await error.context?.json?.())?.error; } catch { /* sem corpo */ } }
          if (msg || error) return toast(msg || 'Falha ao conectar.', 'bad');
          toast('WhatsApp conectado: ' + (data.telefone || '') + '.'); whatsapp(root);
        });
    },
  });
}

// ---------- QR Code (Evolution API, não oficial): aceite do risco, QR na tela e espera pela leitura ----------
async function qrCall(acao, extra = {}) {
  const { data, error } = await sb().functions.invoke('wa-qr', { body: { orgId: org().id, acao, ...extra } });
  let msg = data?.error; if (!msg && error) { try { msg = (await error.context?.json?.())?.error; } catch { /* sem corpo */ } }
  if (msg || error) throw new Error(msg || 'Falha no QR Code.');
  return data;
}
async function sincronizarQr(root, silencioso = false) {
  try {
    const r = await qrCall('sincronizar');
    if (r.msgs || !silencioso) toast(r.msgs ? `Recuperadas ${r.msgs} mensagem(ns)${r.novos ? `, ${r.novos} lead(s) novo(s) no Funil` : ''}.` : 'Nada perdido: tudo já estava no Funil.');
  } catch (e) { if (!silencioso) toast(e.message, 'bad'); }
}
function conectarQr(root, jaAceito = false) {
  if (jaAceito) return mostrarQr(root, 'qr');
  openDialog({
    title: 'Conectar por QR Code', saveLabel: 'Entendo o risco, gerar QR',
    fields: [{ name: 'aceite', label: 'Entendo que esta conexão não é oficial: a Meta pode bloquear o número, e os leads chegam sem o anúncio de origem. Vou usar, de preferência, um número secundário.', type: 'checkbox', required: true, full: true }],
    onSave: (d) => { if (!d.aceite) return toast('Marque o aceite para continuar.', 'bad'); mostrarQr(root, 'conectar'); },
  });
}
async function mostrarQr(root, acao) {
  const dlg = document.createElement('dialog'); dlg.className = 'dialog wa-qr-dlg';
  dlg.innerHTML = `<h3>Leia com o WhatsApp da escola</h3><p class="muted">No celular: <b>Configurações › Aparelhos conectados › Conectar aparelho</b>.</p>
    <div class="wa-qr-box"><p class="empty-sm">Gerando QR Code…</p></div><p class="wa-qr-st muted" role="status">Aguardando leitura…</p>
    <div class="row-actions"><button class="btn sm ghost" data-q="novo">Gerar outro</button><button class="btn sm" data-q="fechar">Fechar</button></div>`;
  document.body.append(dlg); dlg.showModal();
  const box = dlg.querySelector('.wa-qr-box'), st = dlg.querySelector('.wa-qr-st');
  let vivo = true, timer;
  const fim = () => { vivo = false; clearTimeout(timer); dlg.close(); dlg.remove(); whatsapp(root); };
  const pinta = (qr) => { box.innerHTML = qr ? `<img alt="QR Code para conectar o WhatsApp" src="${esc(qr.startsWith('data:') ? qr : 'data:image/png;base64,' + qr)}">` : '<p class="empty-sm">QR indisponível. Clique em "Gerar outro".</p>'; };
  const gerar = async (a) => { try { pinta((await qrCall(a, a === 'conectar' ? { aceiteRisco: true } : {})).qr); } catch (e) { box.innerHTML = `<p class="hint">${esc(/dns|lookup|connect|EVO_URL|Evolution/i.test(e.message) ? 'Não foi possível falar com o servidor do QR Code. Confira se o servidor e o túnel estão ligados e se o endereço (EVO_URL) está atualizado.' : e.message)}</p>`; } };
  const checa = async () => {
    if (!vivo) return;
    try { const r = await qrCall('status'); if (r.conectado) { st.textContent = 'Conectado! Buscando conversas recentes…'; toast('WhatsApp conectado por QR Code.'); whatsapp.sincronizado = true; sincronizarQr(root, true); return setTimeout(fim, 900); } } catch { /* tenta de novo */ }
    timer = setTimeout(checa, 3000);
  };
  dlg.addEventListener('click', (e) => { const q = e.target.closest('[data-q]')?.dataset.q; if (q === 'fechar') fim(); if (q === 'novo') gerar('qr'); });
  dlg.addEventListener('cancel', fim);
  await gerar(acao); timer = setTimeout(checa, 3000);
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
  if (!META_APP_ID || !WA_CONFIG_ID) return toast('A conexão pelo painel ainda está sendo liberada pela Meta. Fale com o suporte para conectar seu número.', 'warn');
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
      { name: 'nome', label: 'Nome do produto', value: b.nome || '', placeholder: 'Klasso', full: true },
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
  uso(root); trial(root); whatsapp(root); if (WHITELABEL) { dominios(root); clientes(root); }
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-saas]')?.dataset.saas;
    if (a === 'marca') return marcaDialog();
    if (a === 'wa') return conectarWhatsApp(root);
    if (a === 'wa-assistida') return conexaoAssistida(root);
    if (a === 'wa-qr') return conectarQr(root);
    if (a === 'wa-qr-novo') return conectarQr(root, true);
    if (a === 'wa-qr-sync') return sincronizarQr(root);
    const rmQ = e.target.closest('[data-waqrrm]'); if (rmQ) { if (!confirmButton(rmQ, 'Confirmar')) return; try { await qrCall('desconectar'); toast('WhatsApp (QR) desconectado.'); } catch (er) { toast(er.message, 'bad'); } return whatsapp(root); }
    if (a === 'dominio') return openDialog({ title: 'Domínio próprio', saveLabel: 'Adicionar', fields: [{ name: 'host', label: 'Endereço (sem https)', placeholder: 'painel.suaescola.com.br', required: true, full: true }],
      onSave: async (d) => { const { error } = await sb().from('org_domains').insert({ host: d.host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), org_id: org().id }); if (error) return toast(/row-level|policy/i.test(error.message) ? 'Seu plano não inclui mais domínios.' : error.message, 'bad'); dominios(root); } });
    if (a === 'cliente') return openDialog({ title: 'Novo cliente', saveLabel: 'Criar cliente', fields: [{ name: 'nome', label: 'Nome do cliente', required: true, full: true }, { name: 'slug', label: 'Subdomínio (opcional)', placeholder: 'escola-centro' }],
      onSave: async (d) => { const { error } = await sb().rpc('create_child_org', { p_parent: org().id, p_nome: d.nome, p_slug: d.slug || null }); if (error) return toast(/limit/.test(error.message) ? 'Limite de clientes do plano atingido.' : error.message, 'bad'); toast('Cliente criado.'); clientes(root); } });
    const rmD = e.target.closest('[data-domrm]'); if (rmD) { if (!confirmButton(rmD, 'Confirmar')) return; await sb().from('org_domains').delete().eq('host', rmD.dataset.domrm); return dominios(root); }
    const rmW = e.target.closest('[data-warm]'); if (rmW) { if (!confirmButton(rmW, 'Confirmar')) return; const { error } = await sb().from('wa_connections').delete().eq('id', rmW.dataset.warm); toast(error ? error.message : 'Número desconectado deste painel.'); return whatsapp(root); }
    const ent = e.target.closest('[data-entrar]'); if (ent) { try { localStorage.setItem('liceu.intelligence.org', ent.dataset.entrar); } catch { /* */ } location.reload(); }
  });
}
