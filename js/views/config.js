// Configurações do assinante: conta, escola, vendas, equipe, plano, integrações, dados e privacidade.

import { store, dump, COLLECTIONS } from '../store.js';
import { esc, $, $$, today, addDays, brl, uid, weekStart, monthStart } from '../util.js';
import { settings, STAGES } from '../metrics.js';
import { openDialog, toast, downloadFile, readFileText, ICON, confirmButton, copyText } from '../ui.js';
import { auth, roleLabel, signOut, switchOrg } from '../auth.js';
import { TERMS_VERSION } from '../brand.js';
import { productDialog, pipeDialog, pipelines, leadPipeId } from '../leads.js';
import { loadTestData } from '../demoData.js';
import { courseName } from '../metrics.js';
import * as saas from './saas.js';
import { ROLES, isAdminRole } from '../access.js';
import { FERRAMENTAS_IA, iaOnline } from '../ia.js';


// Abas das Configurações, do ponto de vista de quem assina o Klasso.
const ABAS = [['conta', 'Conta'], ['escola', 'Escola'], ['vendas', 'Vendas'], ['equipe', 'Equipe'], ['plano', 'Plano'], ['integracoes', 'Integrações'], ['dados', 'Dados e privacidade']];
let aba = 'conta';

export function render(ctx = {}) {
  if (ctx.params?.aba && ABAS.some(([id]) => id === ctx.params.aba)) aba = ctx.params.aba;
  const s = settings();
  const courses = store.all('courses').sort((a, b) => a.nome.localeCompare(b.nome));
  const isSb = store.mode === 'supabase';
  const isAdmin = !isSb || isAdminRole(auth.member?.role);
  const hasDemo = COLLECTIONS.some((c) => store.all(c).some((r) => r.demo));
  const P = {};

  P.conta = `
  ${isSb ? `<section class="card"><header class="card-head"><div><h2>Minha conta</h2><p class="muted">${esc(auth.member?.nome || '')} · ${esc(auth.user?.email || '')}</p></div></header>
    <dl class="stats"><div><dt>Escola</dt><dd>${esc(auth.org?.nome || '')}</dd></div><div><dt>Seu perfil</dt><dd>${esc(roleLabel(auth.member?.role))}</dd></div></dl>
    <div class="row-actions"><button class="btn" data-cfg="pass">Trocar senha</button><button class="btn" data-cfg="switch">Trocar de escola</button><button class="btn" data-cfg="logout">Sair</button></div></section>`
  : `<section class="card"><header class="card-head"><div><h2>Modo de demonstração</h2></div></header><p class="note">Você está usando o Klasso sem login: os dados ficam só neste navegador. <a href="/?cadastro=1">Crie sua conta</a> para salvar na nuvem e convidar o time.</p></section>`}
  ${isSb ? `<section class="card"><header class="card-head"><div><h2>Encerrar conta</h2><p class="muted">Remove seu acesso. Se você for a única pessoa da escola, a escola e todos os dados dela também são apagados</p></div><button class="btn danger" data-cfg="delete-me">Excluir minha conta</button></header></section>` : ''}`;

  P.escola = `
  <section class="card">
    <header class="card-head"><div><h2>Dados da escola</h2><p class="muted">Aparece no menu e nos relatórios</p></div>${isAdmin ? '<button class="btn sm" data-cfg="unit">Editar</button>' : ''}</header>
    <dl class="stats">
      <div><dt>Nome</dt><dd>${esc(s.unidade || '—')}</dd></div>
      <div><dt>Instagram</dt><dd>${esc(s.instagram || '—')}</dd></div>
      <div><dt>Responsável pelo marketing</dt><dd>${esc(s.coordenador || '—')}</dd></div>
      <div><dt>Meta de stories por dia</dt><dd>${esc(s.metaStoriesDia)}</dd></div>
      <div><dt>Alerta de CTR abaixo de</dt><dd>${esc(String(s.ctrMin).replace('.', ','))}%</dd></div>
      <div><dt>Alerta de frequência acima de</dt><dd>${esc(String(s.freqMax).replace('.', ','))}</dd></div>
    </dl>
    <p class="hint">Pilares de conteúdo: ${esc(s.pilares.join(' · '))}</p>
  </section>
  <section class="card">
    <header class="card-head"><div><h2>Cursos</h2><p class="muted">O preço é o valor padrão da matrícula</p></div><button class="btn sm" data-cfg="course">${ICON.plus} Novo curso</button></header>
    ${courses.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Curso</th><th class="r">Preço</th><th>Situação</th><th></th></tr></thead><tbody>${courses.map((c) => `<tr><td>${esc(c.nome)}</td><td class="r">${c.preco ? brl(c.preco) : '—'}</td><td>${c.ativo === false ? 'Inativo' : 'Ativo'}</td><td class="r"><button class="btn sm" data-course="${esc(c.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Cadastre os cursos que a escola vende. É o primeiro passo para medir custo por matrícula.</p>'}
  </section>
  <section class="card">
    <header class="card-head"><div><h2>Produtos</h2><p class="muted">O que você vende. No ganho, o produto preenche curso, valor e pagamento</p></div><button class="btn sm" data-cfg="product">${ICON.plus} Novo produto</button></header>
    ${store.all('products').length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th><th>Curso</th><th class="r">Valor</th><th>Condição</th><th>Situação</th><th></th></tr></thead><tbody>${store.all('products').sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.cursoId ? courseName(p.cursoId) : '—')}</td><td class="r">${p.valor ? brl(p.valor) : '—'}</td><td>${esc([p.formaPagamento, p.parcelas ? p.parcelas + 'x' : ''].filter(Boolean).join(' · ') || '—')}</td><td>${p.ativo === false ? 'Fora de venda' : 'À venda'}</td><td class="r"><button class="btn sm" data-product="${esc(p.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Nenhum produto. Crie um por curso, com valor e condição (ex.: "Injetáveis · 6x no cartão").</p>'}
  </section>`;

  P.vendas = `
  <section class="card">
    <header class="card-head"><div><h2>Funis comerciais</h2><p class="muted">Nome, etapas e limite de cada funil. Excluir pede para onde vão os leads</p></div><button class="btn sm" data-cfg="pipe">${ICON.plus} Novo funil</button></header>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Funil</th><th>Etapas</th><th class="r">Leads</th><th></th></tr></thead><tbody>${pipelines().map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.etapas.map((e) => e.nome).join(' → '))}</td><td class="r">${store.all('leads').filter((l) => leadPipeId(l) === p.id).length}</td><td class="r"><button class="btn sm" data-pipe-edit="${esc(p.id)}">Editar ou excluir</button></td></tr>`).join('')}</tbody></table></div>
  </section>
  <section class="card">
    <header class="card-head"><div><h2>Consultores</h2><p class="muted">Quem atende e fecha matrículas. Aparecem como responsável no Funil e no ranking</p></div><button class="btn sm" data-cfg="consultor">${ICON.plus} Novo consultor</button></header>
    ${(s.consultores || []).length ? `<ul class="todo">${s.consultores.map((c, i) => `<li><span><b>${esc(c.nome)}</b><small>${c.ativo === false ? 'inativo' : 'ativo'}</small></span><span class="row-actions"><button class="btn sm ghost" data-constog="${i}">${c.ativo === false ? 'Ativar' : 'Desativar'}</button><button class="icon-btn sm" data-consrm="${i}" aria-label="Remover">×</button></span></li>`).join('')}</ul>` : '<p class="empty-sm">Nenhum consultor cadastrado. O responsável do lead também pode ser digitado livre.</p>'}
  </section>`;

  P.equipe = isSb ? team(isAdmin) : `<section class="card"><header class="card-head"><div><h2>Equipe</h2></div></header><p class="note">Para convidar o time, <a href="/?cadastro=1">crie sua conta</a>. Cada pessoa entra com o próprio login e vê só o que o perfil dela permite.</p></section>`;

  P.plano = isSb ? saas.renderPlano() : `<section class="card"><header class="card-head"><div><h2>Plano</h2></div></header><p class="note">Teste grátis por 7 dias, sem cartão. <a href="/planos" target="_blank" rel="noopener">Ver planos</a></p></section>`;

  P.integracoes = `${isSb ? saas.renderWhatsApp() : ''}
  <section class="card"><header class="card-head"><div><h2>Ferramentas de IA</h2><p class="muted">O que a IA já faz no Klasso e o que vem por aí. Marque o que você quer usar: isso define a nossa fila de integrações</p></div></header>
    <div class="ia-cat">${FERRAMENTAS_IA.map((f) => { const quer = (s.iaInteresse || []).includes(f.id); return `<div class="ia-tool ${f.status}"><span class="ia-ic">${ICON[f.id === 'claude' ? 'ia' : f.id === 'higgsfield' ? 'f_motion' : f.id === 'imagem' ? 'f_post' : f.id === 'voz' ? 'f_live' : f.id === 'canva' ? 'f_arte' : 'raio']}</span><div><b>${esc(f.nome)}</b><small>${esc(f.faz)}</small></div>${f.status === 'ativo' ? `<span class="badge good">${iaOnline() ? 'Ativo' : 'Com conta'}</span>` : `<button type="button" class="btn sm ${quer ? 'primary' : ''}" data-ia-quero="${f.id}">${quer ? 'Na sua lista' : 'Quero usar'}</button>`}</div>`; }).join('')}</div>
  </section>
  <section class="card">
    <header class="card-head"><div><h2>Meta Ads</h2><p class="muted">Gasto, alcance e conversas por anúncio, todo dia, sem importar planilha</p></div></header>
    <label class="check-field"><input type="checkbox" data-cfg-toggle="metaSync"${s.metaSync ? ' checked' : ''}${isSb ? '' : ' disabled'}> Sincronização automática com o Meta Ads</label>
    <p class="hint">${isSb ? 'Ao ligar, o Klasso busca os números da sua conta de anúncios. Enquanto a conexão não é ativada pelo nosso time, você pode importar o relatório do Meta em Meta Ads › Importar.' : 'Disponível com conta criada.'}</p>
  </section>
  <section class="card">
    <header class="card-head"><div><h2>WhatsApp no Funil</h2><p class="muted">Abrir as conversas dentro do app em vez do WhatsApp do celular</p></div></header>
    <label class="check-field"><input type="checkbox" data-cfg-toggle="whatsappApi"${s.whatsappApi ? ' checked' : ''}${isSb ? '' : ' disabled'}> Usar a conversa do WhatsApp oficial dentro do Funil</label>
    <p class="hint">Desligado, o botão WhatsApp do cartão abre o seu WhatsApp com a mensagem pronta.</p>
  </section>`;

  P.dados = `
  <section class="card">
    <header class="card-head"><div><h2>Backup</h2><p class="muted">Exporte com frequência. O arquivo tem todos os dados da escola</p></div></header>
    <div class="row-actions">
      <button class="btn" data-cfg="export">${ICON.download} Exportar backup (JSON)</button>
      ${isAdmin ? `<label class="btn" for="cfg-import">${ICON.upload} Restaurar backup</label><input type="file" id="cfg-import" accept=".json,application/json" class="sr">` : ''}
      ${hasDemo ? '<button class="btn danger" data-cfg="demo-off">Remover dados de exemplo</button>' : (!isSb ? '<button class="btn" data-cfg="demo-test">Carregar dados de exemplo (3 meses)</button>' : '')}
    </div>
  </section>
  <section class="card">
    <header class="card-head"><div><h2>Privacidade (LGPD)</h2><p class="muted">Os leads são dados pessoais. Guarde só o necessário e pelo tempo necessário</p></div></header>
    <div class="row-actions">
      <button class="btn" data-cfg="anon">Anonimizar leads perdidos há mais de 12 meses</button>
      <button class="btn" data-cfg="find">Localizar dados de uma pessoa</button>
      <a class="btn ghost" href="privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>
      <a class="btn ghost" href="termos.html" target="_blank" rel="noopener">Termos de uso</a>
    </div>
    <p class="hint">"Localizar dados de uma pessoa" atende pedidos de acesso, correção ou exclusão feitos por um lead (LGPD, art. 18). Versão dos termos: ${TERMS_VERSION}.</p>
    ${isAdmin ? '<details class="more"><summary>Zona de perigo</summary><div class="inner"><p class="note">Apaga todos os dados da escola (leads, campanhas, calendário, metas e relatórios). Exporte um backup antes.</p><button class="btn danger" data-cfg="wipe">Apagar todos os dados da escola</button></div></details>' : ''}
  </section>`;

  const visiveis = ABAS.filter(([id]) => isAdmin || !['plano', 'integracoes'].includes(id));
  if (!visiveis.some(([id]) => id === aba)) aba = 'conta';
  return `<div class="cfg">
    <nav class="cfg-nav" role="tablist" aria-label="Configurações">${visiveis.map(([id, nome]) => `<button type="button" role="tab" data-aba="${id}" aria-selected="${id === aba}">${nome}</button>`).join('')}</nav>
    <div class="cfg-body">${visiveis.map(([id]) => `<div class="cfg-panel" data-panel="${id}"${id === aba ? '' : ' hidden'}>${P[id]}</div>`).join('')}</div>
  </div>`;
}

function team(isAdmin) {
  return `<section class="card" id="team"><header class="card-head"><div><h2>Equipe</h2><p class="muted">${esc(auth.org?.nome || '')} · seu papel: ${esc(roleLabel(auth.member?.role))}</p></div></header>
    ${isAdmin ? `<div class="row-actions"><span class="muted">Código de convite:</span><span class="code" id="inv-code">${esc(auth.org?.invite_code || '')}</span><button class="btn sm" data-cfg="copy-code">${ICON.copy} Copiar</button><button class="btn sm ghost" data-cfg="new-code">Gerar outro código</button></div>
    <p class="hint">Quem criar a conta e usar esse código entra como "Edita". Mude o papel abaixo. Gere outro código quando alguém sair da equipe.</p>` : ''}
    ${isAdmin ? `<div class="inv-cta"><div><b>Convide alguém para o time</b><small>Link com o perfil já definido. Envie por WhatsApp, e-mail ou copie.</small></div><button class="btn primary" data-cfg="convidar">${ICON.plus || '+'} Convidar pessoa</button></div><div id="convites"></div>` : ''}
    <div id="members"><p class="empty-sm">Carregando equipe…</p></div>
    <details class="hint"><summary>O que cada perfil pode fazer</summary><ul>${Object.values(ROLES).map((r) => `<li><b>${esc(r.nome)}:</b> ${esc(r.faz)}</li>`).join('')}</ul><p>A regra vale no banco: quem não tem acesso não recebe o dado, mesmo mexendo no navegador.</p></details></section>`;
}

const linkConvite = (c) => `${location.origin}${location.pathname}?convite=${c}`;
async function loadConvites(root) {
  const box = $('#convites', root); if (!box || !auth.client) return;
  const { data } = await auth.client.from('invites').select('code, role, email, nome, usos, usos_max, expira_em').eq('org_id', auth.org.id).order('created_at', { ascending: false });
  const vivos = (data || []).filter((i) => i.usos < i.usos_max && new Date(i.expira_em) > new Date());
  box.innerHTML = vivos.length ? `<p class="inv-k">Convites ativos</p>${vivos.map((i) => `<div class="inv-row"><div><b>${esc(i.nome || i.email || 'Link aberto')}</b><small>${esc(ROLES[i.role]?.nome || i.role)} · ${i.usos}/${i.usos_max} uso${i.usos_max > 1 ? 's' : ''} · vence ${esc(new Date(i.expira_em).toLocaleDateString('pt-BR'))}</small></div><button class="btn sm" data-inv-copy="${esc(i.code)}">${ICON.copy} Link</button><button class="btn sm ghost" data-inv-rm="${esc(i.code)}">Cancelar</button></div>`).join('')}` : '';
  $$('[data-inv-copy]', box).forEach((b) => b.addEventListener('click', () => copyText(linkConvite(b.dataset.invCopy), b)));
  $$('[data-inv-rm]', box).forEach((b) => b.addEventListener('click', async () => {
    if (!confirmButton(b, 'Confirmar')) return;
    const { error } = await auth.client.from('invites').delete().eq('code', b.dataset.invRm);
    toast(error ? error.message : 'Convite cancelado.', error ? 'bad' : ''); loadConvites(root);
  }));
}

export function convidarDialog(root) {
  const roles = Object.keys(ROLES).filter((r) => r !== 'owner').map((r) => [r, ROLES[r].nome]);
  const { dlg, err } = openDialog({
    title: 'Convidar pessoa', saveLabel: 'Gerar convite',
    fields: [
      { name: 'role', label: 'Perfil no time', type: 'select', options: roles, value: 'sales', required: true },
      { name: 'nome', label: 'Nome (opcional)', placeholder: 'Como vai aparecer no time' },
      { name: 'email', label: 'E-mail (opcional)', type: 'email', placeholder: 'Só esse e-mail poderá usar', hint: 'Com e-mail, o convite vale só para essa pessoa.' },
      { name: 'usos', label: 'Quantas pessoas podem usar', type: 'select', options: [['1', '1 pessoa'], ['5', 'Até 5'], ['20', 'Até 20']], value: '1' },
      { name: 'dias', label: 'Validade', type: 'select', options: [['1', '1 dia'], ['7', '7 dias'], ['30', '30 dias']], value: '7' },
    ],
    onSave: (d) => {
      auth.client.rpc('create_invite', { p_org: auth.org.id, p_role: d.role, p_email: d.email || null, p_nome: d.nome || null, p_usos: Number(d.usos), p_dias: Number(d.dias) }).then(({ data, error }) => {
        if (error) { toast(/plan limit/.test(error.message) ? 'Seu plano chegou ao limite de usuários. Mude de plano para convidar mais.' : error.message, 'bad'); return; }
        conviteGerado(data, d); if (root) loadConvites(root);
      });
    },
  });
  void dlg; void err;
}

function conviteGerado(inv, d) {
  const url = linkConvite(inv.code);
  const papel = ROLES[inv.role]?.nome || inv.role;
  const msg = `Oi${d.nome ? ' ' + d.nome.split(' ')[0] : ''}! Te convidei para o time da ${auth.org?.nome || 'escola'} no Klasso como ${papel}. Crie sua conta por este link: ${url}`;
  const { dlg } = openDialog({
    title: 'Convite pronto',
    html: `<div class="inv-ok"><div class="inv-selo">${ICON.check}</div><p>Envie para ${esc(d.nome || d.email || 'a pessoa')}. Perfil: <b>${esc(papel)}</b>.</p>
      <div class="inv-link"><input readonly value="${esc(url)}" aria-label="Link do convite"><button type="button" class="btn primary" data-x="copy">${ICON.copy} Copiar</button></div>
      <div class="inv-share"><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a><a class="btn" href="mailto:${encodeURIComponent(inv.email || '')}?subject=${encodeURIComponent('Convite para o time da ' + (auth.org?.nome || 'escola'))}&body=${encodeURIComponent(msg)}">E-mail</a></div></div>`,
  });
  dlg.querySelector('[data-x="copy"]').addEventListener('click', (e) => copyText(url, e.currentTarget));
}

async function loadMembers(root) {
  const box = $('#members', root);
  if (!box) return;
  const { data, error } = await auth.client.from('members').select('user_id, role, nome, email, created_at, terms_version').eq('org_id', auth.org.id).order('created_at');
  if (error) { box.innerHTML = `<p class="form-error">${esc(error.message)}</p>`; return; }
  const isAdmin = isAdminRole(auth.member?.role);
  box.innerHTML = data.map((m) => `<div class="member-row"><div class="who"><b>${esc(m.nome || m.email)}</b><small>${esc(m.email || '')}${m.user_id === auth.user.id ? ' · você' : ''}${m.terms_version ? ' · termos aceitos (' + esc(m.terms_version) + ')' : ''}</small></div>
    ${isAdmin && m.user_id !== auth.user.id ? `<label class="sr" for="role-${esc(m.user_id)}">Papel</label><select id="role-${esc(m.user_id)}" data-role="${esc(m.user_id)}" class="inline-select">${Object.keys(ROLES).filter((r) => r !== 'owner' || auth.member?.role === 'owner').map((r) => `<option value="${r}"${r === m.role ? ' selected' : ''} title="${esc(ROLES[r].faz)}">${esc(ROLES[r].nome)}</option>`).join('')}</select><button class="btn sm ghost" data-rm="${esc(m.user_id)}">Remover</button>` : `<span class="badge">${esc(roleLabel(m.role))}</span>`}</div>`).join('');
  $$('[data-role]', box).forEach((sel) => sel.addEventListener('change', async () => {
    const { error: e } = await auth.client.from('members').update({ role: sel.value }).match({ org_id: auth.org.id, user_id: sel.dataset.role });
    toast(e ? 'Não foi possível mudar o papel: ' + e.message : 'Papel atualizado.', e ? 'bad' : '');
  }));
  $$('[data-rm]', box).forEach((b) => b.addEventListener('click', async () => {
    if (!confirmButton(b, 'Confirmar remoção')) return;
    const { error: e } = await auth.client.from('members').delete().match({ org_id: auth.org.id, user_id: b.dataset.rm });
    if (e) toast(e.message, 'bad'); else { toast('Pessoa removida da equipe. Gere outro código de convite.'); loadMembers(root); }
  }));
}

function unitDialog(ctx) {
  const s = settings();
  openDialog({
    title: 'Dados da escola', wide: true,
    fields: [
      { name: 'unidade', label: 'Nome da escola', value: s.unidade, required: true },
      { name: 'instagram', label: 'Instagram', value: s.instagram },
      { name: 'coordenador', label: 'Responsável pelo marketing', value: s.coordenador },
      { name: 'metaStoriesDia', label: 'Meta de stories por dia', type: 'number', value: s.metaStoriesDia },
      { name: 'ctrMin', label: 'Alerta quando CTR ficar abaixo de (%)', type: 'number', value: s.ctrMin },
      { name: 'freqMax', label: 'Alerta quando frequência passar de', type: 'number', value: s.freqMax },
      { name: 'pilares', label: 'Pilares de conteúdo (um por linha)', type: 'textarea', rows: 5, value: s.pilares.join('\n'), full: true },
      { name: 'responsaveis', label: 'Pessoas da equipe de mídia (um por linha)', type: 'textarea', rows: 3, value: (s.responsaveis || []).join('\n'), full: true },
    ],
    onSave: (d) => {
      const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
      store.put('settings', { ...store.settings(), id: 'main', ...d, pilares: lines(d.pilares), responsaveis: lines(d.responsaveis) });
      toast('Configurações salvas.'); ctx.refresh();
    },
  });
}

function courseDialog(c, ctx) {
  openDialog({
    title: c ? 'Editar curso' : 'Novo curso',
    fields: [
      { name: 'nome', label: 'Nome do curso', value: c?.nome, required: true, full: true },
      { name: 'preco', label: 'Valor da matrícula (R$)', type: 'number', value: c?.preco },
      { name: 'ativo', label: 'Curso ativo', type: 'checkbox', value: c ? c.ativo !== false : true },
    ],
    onSave: (d) => { store.put('courses', { ...(c || {}), ...d }); toast('Curso salvo.'); ctx.refresh(); },
    onDelete: c ? () => { store.remove('courses', c.id); ctx.refresh(); } : null,
  });
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-ia-quero]'); if (!b) return; const st = store.settings(); const l = new Set(st.iaInteresse || []); l.has(b.dataset.iaQuero) ? l.delete(b.dataset.iaQuero) : l.add(b.dataset.iaQuero); store.put('settings', { ...st, id: 'main', iaInteresse: [...l] }); toast(l.has(b.dataset.iaQuero) ? 'Anotado. Avisamos quando estiver disponível.' : 'Removido da sua lista.'); });
  root.addEventListener('click', (e) => { const t = e.target.closest('[data-aba]'); if (!t) return; aba = t.dataset.aba; root.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-selected', String(x === t))); root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== aba; }); history.replaceState(null, '', '#config?aba=' + aba); });
  if (store.mode === 'supabase') { loadMembers(root); loadConvites(root); saas.mount(root, ctx); }
  root.addEventListener('change', (e) => { const k = e.target.dataset?.cfgToggle; if (!k) return; store.put('settings', { ...store.settings(), id: 'main', [k]: e.target.checked }); toast(e.target.checked ? 'Ligado.' : 'Desligado.'); });
  $('#cfg-import', root)?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await readFileText(f));
      if (!data || !COLLECTIONS.some((c) => Array.isArray(data[c]))) throw new Error('Arquivo não parece um backup do Klasso.');
      openDialog({ title: 'Restaurar backup?', saveLabel: 'Substituir tudo', html: `<p>O backup tem ${COLLECTIONS.map((c) => (data[c]?.length || 0)).reduce((a, b) => a + b, 0)} registros. Os dados atuais da escola serão substituídos por ele.</p>`, onSave: () => { store.replaceAll(data); toast('Backup restaurado.'); ctx.refresh(); } });
    } catch (er) { toast(er.message, 'bad'); }
    e.target.value = '';
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.course) return courseDialog(store.get('courses', ds.course), ctx);
    if (ds.product) return productDialog(store.get('products', ds.product), ctx);
    if (ds.pipeEdit) return pipeDialog(pipelines().find((p) => p.id === ds.pipeEdit), ctx);
    if (ds.cfg === 'product') return productDialog(null, ctx);
    if (ds.cfg === 'consultor') return openDialog({ title: 'Novo consultor', saveLabel: 'Adicionar', fields: [{ name: 'nome', label: 'Nome', required: true, full: true }], onSave: (d) => { const st = store.settings(); store.put('settings', { ...st, id: 'main', consultores: [...(st.consultores || []), { nome: d.nome, ativo: true }] }); ctx.refresh(); } });
    if (ds.constog !== undefined || ds.consrm !== undefined) { const st = store.settings(); const list = [...(st.consultores || [])]; if (ds.consrm !== undefined) list.splice(+ds.consrm, 1); else list[+ds.constog] = { ...list[+ds.constog], ativo: list[+ds.constog].ativo === false }; store.put('settings', { ...st, id: 'main', consultores: list }); return ctx.refresh(); }
    if (ds.cfg === 'demo-test') { const r = loadTestData(); toast(`Dados de teste: ${r.leads} leads e ${r.matriculas} matrículas em 3 meses. Remova antes de usar de verdade.`); return ctx.refresh(); }
    if (ds.cfg === 'pipe') return pipeDialog(null, ctx);
    const a = ds.cfg;
    if (a === 'unit') unitDialog(ctx);
    if (a === 'course') courseDialog(null, ctx);
    if (a === 'export') downloadFile('flowclass-backup-' + today() + '.json', JSON.stringify({ app: 'Klasso', exportedAt: new Date().toISOString(), ...dump() }, null, 1), 'application/json');
    if (a === 'demo-off') { COLLECTIONS.forEach((c) => store.removeWhere(c, (r) => r.demo)); toast('Dados de exemplo removidos.'); ctx.refresh(); }
    if (a === 'anon') {
      if (!confirmButton(b, 'Confirmar anonimização')) return;
      const lim = addDays(today(), -365);
      const old = store.all('leads').filter((l) => l.etapa === 'perdido' && (l.dataPerda || l.entrada || '') < lim && !l.anonimizado);
      store.putMany('leads', old.map((l) => ({ ...l, nome: 'Lead anonimizado', telefone: '', notas: '', anuncio: l.anuncio, anonimizado: true })));
      toast(old.length + ' leads anonimizados. Os números do funil continuam.');
    }
    if (a === 'find') findPerson();
    if (a === 'wipe') { if (!confirmButton(b, 'Clique de novo para apagar tudo')) return; store.replaceAll({}); toast('Todos os dados foram apagados.'); ctx.refresh(); }
    if (a === 'convidar') convidarDialog(root);
    if (a === 'copy-code') copyText(auth.org.invite_code, $('#inv-code', root));
    if (a === 'new-code') {
      if (!confirmButton(b, 'Confirmar: o código atual para de funcionar')) return;
      const { data, error } = await auth.client.rpc('regenerate_invite', { p_org: auth.org.id });
      if (error) toast(error.message, 'bad'); else { auth.org.invite_code = data; $('#inv-code', root).textContent = data; toast('Código novo gerado.'); }
    }
    if (a === 'logout') signOut();
    if (a === 'switch') switchOrg();
    if (a === 'pass') openDialog({ title: 'Trocar senha', fields: [{ name: 'p', label: 'Nova senha (8 caracteres ou mais)', type: 'password', required: true }], onSave: (d) => { if (d.p.length < 8) { toast('Use pelo menos 8 caracteres.', 'bad'); return false; } auth.client.auth.updateUser({ password: d.p }).then(({ error }) => toast(error ? error.message : 'Senha alterada.', error ? 'bad' : '')); } });
    if (a === 'delete-me') {
      openDialog({
        title: 'Excluir minha conta', saveLabel: 'Excluir definitivamente',
        fields: [{ name: 'c', label: 'Digite EXCLUIR para confirmar', required: true }],
        html: '<p>Seu login deixa de existir. Exporte um backup antes se precisar dos dados. Se você for o único administrador de uma equipe com outras pessoas, passe o papel de administrador para alguém antes.</p>',
        onSave: (d) => {
          if (d.c.trim().toUpperCase() !== 'EXCLUIR') { toast('Digite EXCLUIR para confirmar.', 'bad'); return false; }
          auth.client.rpc('delete_my_account').then(({ error }) => {
            if (error) toast(/transfer admin/.test(error.message) ? 'Passe o papel de administrador para outra pessoa antes de excluir sua conta.' : error.message, 'bad');
            else signOut();
          });
        },
      });
    }
  });
}

function findPerson() {
  const { dlg } = openDialog({
    title: 'Localizar dados de uma pessoa', wide: true,
    fields: [{ name: 'q', label: 'Nome ou telefone', full: true }],
    html: '<div id="fp-out"></div><p class="hint">Para atender um pedido de exclusão, abra o cartão no Funil (ou a matrícula em Matrículas) e use Excluir, ou anonimize.</p>',
  });
  const out = $('#fp-out', dlg);
  $('#f_q', dlg).addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 3) { out.innerHTML = ''; return; }
    const digits = q.replace(/\D/g, '');
    const hits = store.all('leads').filter((l) => (l.nome || '').toLowerCase().includes(q) || (digits.length >= 4 && (l.telefone || '').replace(/\D/g, '').includes(digits)));
    out.innerHTML = hits.length ? `<table class="tbl"><thead><tr><th>Nome</th><th>Telefone</th><th>Entrada</th><th>Etapa</th><th></th></tr></thead><tbody>${hits.map((l) => `<tr><td>${esc(l.nome)}</td><td>${esc(l.telefone || '')}</td><td>${esc(l.entrada || '')}</td><td>${esc(l.etapa)}</td><td class="r"><button type="button" class="btn sm" data-anon1="${esc(l.id)}">Anonimizar</button> <button type="button" class="btn sm danger" data-del1="${esc(l.id)}">Excluir</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty-sm">Nada encontrado.</p>';
    $$('[data-anon1]', out).forEach((b) => b.addEventListener('click', () => { const l = store.get('leads', b.dataset.anon1); store.put('leads', { ...l, nome: 'Lead anonimizado', telefone: '', notas: '', anonimizado: true }); b.closest('tr').remove(); toast('Anonimizado.'); }));
    $$('[data-del1]', out).forEach((b) => b.addEventListener('click', () => { if (!confirmButton(b, 'Confirmar')) return; store.remove('leads', b.dataset.del1); b.closest('tr').remove(); toast('Excluído.'); }));
  });
}
