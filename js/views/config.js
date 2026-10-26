// Configurações: unidade, aparência, cursos, equipe, dados e privacidade.

import { store, dump, COLLECTIONS } from '../store.js';
import { esc, $, $$, today, addDays, brl, uid, weekStart, monthStart } from '../util.js';
import { settings, STAGES } from '../metrics.js';
import { openDialog, toast, downloadFile, readFileText, ICON, confirmButton, copyText } from '../ui.js';
import { auth, roleLabel, signOut, switchOrg } from '../auth.js';
import { TERMS_VERSION } from '../brand.js';
import { productDialog, pipeDialog, pipelines, leadPipeId } from '../leads.js';
import { courseName } from '../metrics.js';


export function render() {
  const s = settings();
  const courses = store.all('courses').sort((a, b) => a.nome.localeCompare(b.nome));
  const isSb = store.mode === 'supabase';
  const isAdmin = !isSb || auth.member?.role === 'admin';
  const hasDemo = COLLECTIONS.some((c) => store.all(c).some((r) => r.demo));
  return `
  <div>
    <section class="card">
      <header class="card-head"><div><h2>Unidade</h2><p class="muted">Aparece no topo do menu e nos relatórios</p></div><button class="btn sm" data-cfg="unit">Editar</button></header>
      <dl class="stats">
        <div><dt>Unidade</dt><dd>${esc(s.unidade)}</dd></div>
        <div><dt>Instagram</dt><dd>${esc(s.instagram)}</dd></div>
        <div><dt>Coordenação</dt><dd>${esc(s.coordenador)}</dd></div>
        <div><dt>Meta de stories por dia</dt><dd>${esc(s.metaStoriesDia)}</dd></div>
        <div><dt>Alerta de CTR abaixo de</dt><dd>${esc(String(s.ctrMin).replace('.', ','))}%</dd></div>
        <div><dt>Alerta de frequência acima de</dt><dd>${esc(String(s.freqMax).replace('.', ','))}</dd></div>
      </dl>
      <p class="hint">Pilares: ${esc(s.pilares.join(' · '))}</p>
    </section>

  </div>

  <section class="card">
    <header class="card-head"><div><h2>Cursos</h2><p class="muted">O preço é usado como valor padrão da matrícula</p></div><button class="btn sm" data-cfg="course">${ICON.plus} Novo curso</button></header>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Curso</th><th class="r">Preço</th><th>Situação</th><th></th></tr></thead><tbody>${courses.map((c) => `<tr><td>${esc(c.nome)}</td><td class="r">${c.preco ? brl(c.preco) : '—'}</td><td>${c.ativo === false ? 'Inativo' : 'Ativo'}</td><td class="r"><button class="btn sm" data-course="${esc(c.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>
  </section>

  <section class="card">
    <header class="card-head"><div><h2>Produtos</h2><p class="muted">O que você vende. No ganho, o produto preenche curso, valor e pagamento</p></div><button class="btn sm" data-cfg="product">${ICON.plus} Novo produto</button></header>
    ${store.all('products').length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th><th>Curso</th><th class="r">Valor</th><th>Condição</th><th>Situação</th><th></th></tr></thead><tbody>${store.all('products').sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.cursoId ? courseName(p.cursoId) : '—')}</td><td class="r">${p.valor ? brl(p.valor) : '—'}</td><td>${esc([p.formaPagamento, p.parcelas ? p.parcelas + 'x' : ''].filter(Boolean).join(' · ') || '—')}</td><td>${p.ativo === false ? 'Fora de venda' : 'À venda'}</td><td class="r"><button class="btn sm" data-product="${esc(p.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-sm">Nenhum produto. Crie um por curso, com valor e condição (ex.: "Injetáveis · 6x no cartão").</p>'}
  </section>

  <section class="card">
    <header class="card-head"><div><h2>Funis comerciais</h2><p class="muted">Nome, etapas e limite de cada funil. Excluir pede para onde vão os leads</p></div><button class="btn sm" data-cfg="pipe">${ICON.plus} Novo funil</button></header>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Funil</th><th>Etapas</th><th class="r">Leads</th><th></th></tr></thead><tbody>${pipelines().map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.etapas.map((e) => e.nome).join(' → '))}</td><td class="r">${store.all('leads').filter((l) => leadPipeId(l) === p.id).length}</td><td class="r"><button class="btn sm" data-pipe-edit="${esc(p.id)}">Editar ou excluir</button></td></tr>`).join('')}</tbody></table></div>
  </section>

  ${isSb ? team(isAdmin) : `<section class="card"><header class="card-head"><div><h2>Equipe e login</h2></div></header><p class="note">${store.mode === 'cloud' ? 'Este painel está rodando dentro do claude.ai: quem tem acesso ao link vê os mesmos dados.' : 'Modo de teste: os dados ficam só neste navegador. Para login, equipe e dados na nuvem, configure o Supabase (veja o README do projeto).'}</p></section>`}

  <section class="card">
    <header class="card-head"><div><h2>Backup e dados</h2><p class="muted">Exporte com frequência. O arquivo JSON tem todos os dados da unidade.</p></div></header>
    <div class="row-actions">
      <button class="btn" data-cfg="export">${ICON.download} Exportar backup (JSON)</button>
      ${isAdmin ? `<label class="btn" for="cfg-import">${ICON.upload} Restaurar backup</label><input type="file" id="cfg-import" accept=".json,application/json" class="sr">` : ''}
      ${hasDemo ? '<button class="btn" data-cfg="demo-off">Remover dados de exemplo</button>' : '<button class="btn ghost" data-cfg="demo-on">Carregar dados de exemplo</button>'}
    </div>
    <p class="hint">Dados de exemplo ficam marcados e saem todos de uma vez, sem tocar nos seus registros.</p>
  </section>

  <section class="card">
    <header class="card-head"><div><h2>Privacidade (LGPD)</h2><p class="muted">Os leads são dados pessoais. Guarde só o necessário e pelo tempo necessário.</p></div></header>
    <div class="row-actions">
      <button class="btn" data-cfg="anon">Anonimizar leads perdidos há mais de 12 meses</button>
      <button class="btn" data-cfg="find">Localizar dados de uma pessoa</button>
      <a class="btn ghost" href="privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>
      <a class="btn ghost" href="termos.html" target="_blank" rel="noopener">Termos de uso</a>
    </div>
    <p class="hint">"Localizar dados de uma pessoa" atende pedidos de acesso, correção ou exclusão feitos por um lead (LGPD, art. 18). Versão dos termos: ${TERMS_VERSION}.</p>
    ${isAdmin ? '<details class="more"><summary>Zona de perigo</summary><div class="inner"><p class="note">Apaga todos os dados da unidade (leads, campanhas, calendário, metas e relatórios). Exporte um backup antes.</p><button class="btn danger" data-cfg="wipe">Apagar todos os dados da unidade</button></div></details>' : ''}
  </section>

  ${isSb ? `<section class="card"><header class="card-head"><div><h2>Minha conta</h2><p class="muted">${esc(auth.user?.email || '')}</p></div></header>
    <div class="row-actions"><button class="btn" data-cfg="pass">Trocar senha</button><button class="btn" data-cfg="switch">Trocar de unidade</button><button class="btn" data-cfg="logout">Sair</button><button class="btn danger" data-cfg="delete-me">Excluir minha conta</button></div>
    <p class="hint">Excluir a conta remove seu acesso. Se você for a única pessoa da unidade, a unidade e todos os dados dela também são apagados.</p></section>` : ''}
  `;
}

function team(isAdmin) {
  return `<section class="card" id="team"><header class="card-head"><div><h2>Equipe</h2><p class="muted">${esc(auth.org?.nome || '')} · seu papel: ${esc(roleLabel(auth.member?.role))}</p></div></header>
    ${isAdmin ? `<div class="row-actions"><span class="muted">Código de convite:</span><span class="code" id="inv-code">${esc(auth.org?.invite_code || '')}</span><button class="btn sm" data-cfg="copy-code">${ICON.copy} Copiar</button><button class="btn sm ghost" data-cfg="new-code">Gerar outro código</button></div>
    <p class="hint">Quem criar a conta e usar esse código entra como "Edita". Mude o papel abaixo. Gere outro código quando alguém sair da equipe.</p>` : ''}
    <div id="members"><p class="empty-sm">Carregando equipe…</p></div>
    <p class="hint">Administrador: tudo, inclusive equipe e backup. Edita: cadastra e altera dados. Só leitura: vê painéis e relatórios.</p></section>`;
}

async function loadMembers(root) {
  const box = $('#members', root);
  if (!box) return;
  const { data, error } = await auth.client.from('members').select('user_id, role, nome, email, created_at, terms_version').eq('org_id', auth.org.id).order('created_at');
  if (error) { box.innerHTML = `<p class="form-error">${esc(error.message)}</p>`; return; }
  const isAdmin = auth.member?.role === 'admin';
  box.innerHTML = data.map((m) => `<div class="member-row"><div class="who"><b>${esc(m.nome || m.email)}</b><small>${esc(m.email || '')}${m.user_id === auth.user.id ? ' · você' : ''}${m.terms_version ? ' · termos aceitos (' + esc(m.terms_version) + ')' : ''}</small></div>
    ${isAdmin && m.user_id !== auth.user.id ? `<label class="sr" for="role-${esc(m.user_id)}">Papel</label><select id="role-${esc(m.user_id)}" data-role="${esc(m.user_id)}" class="inline-select">${['admin', 'editor', 'leitura'].map((r) => `<option value="${r}"${r === m.role ? ' selected' : ''}>${roleLabel(r)}</option>`).join('')}</select><button class="btn sm ghost" data-rm="${esc(m.user_id)}">Remover</button>` : `<span class="badge">${esc(roleLabel(m.role))}</span>`}</div>`).join('');
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
    title: 'Unidade', wide: true,
    fields: [
      { name: 'unidade', label: 'Nome da unidade', value: s.unidade, required: true },
      { name: 'instagram', label: 'Instagram', value: s.instagram },
      { name: 'coordenador', label: 'Coordenação de marketing', value: s.coordenador },
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

// Dados de exemplo: 60 dias de campanhas e leads, todos marcados com demo:true.
function loadDemo() {
  const t = today();
  const courses = store.all('courses');
  const pickC = (n) => courses.find((c) => c.nome.toLowerCase().includes(n))?.id || courses[0]?.id || '';
  const camps = [
    { id: uid('dm_'), nome: '[Exemplo] Injetáveis · Mensagens', canal: 'Meta', objetivo: 'Mensagens no WhatsApp', cursoId: pickC('inje'), status: 'Ativa', demo: true, k: 1 },
    { id: uid('dm_'), nome: '[Exemplo] Enfermagem · Mensagens', canal: 'Meta', objetivo: 'Mensagens no WhatsApp', cursoId: pickC('enferm'), status: 'Ativa', demo: true, k: 1.3 },
    { id: uid('dm_'), nome: '[Exemplo] Primeiros Socorros · Cadastro', canal: 'Meta', objetivo: 'Cadastro (formulário)', cursoId: pickC('socorr'), status: 'Ativa', demo: true, k: .8 },
  ];
  store.putMany('campaigns', camps.map(({ k, ...c }) => c));
  const stats = []; const leads = [];
  const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Mariana', 'Nathan', 'Olívia', 'Paulo', 'Raquel', 'Sabrina', 'Thiago', 'Yasmin'];
  let n = 0;
  for (let w = 8; w >= 0; w--) {
    const ini = addDays(weekStart(t), -7 * w), fim = addDays(ini, 6) > t ? t : addDays(ini, 6);
    camps.forEach((c, ci) => {
      const inv = Math.round((180 + 40 * ((w + ci) % 3)) * c.k);
      const conv = Math.round(inv / (6 + ci * 2.5));
      stats.push({ campanhaId: c.id, anuncio: ci === 2 ? 'Formulário checklist' : (w % 2 ? 'Reels erro comum' : 'Foto real da aula'), inicio: ini, fim, investimento: inv, impressoes: inv * 95, alcance: inv * 52, cliques: Math.round(inv * (ci === 2 ? .6 : 1.4)), conversas: ci === 2 ? 0 : conv, leadsMeta: ci === 2 ? conv : 0, origem: 'demo', demo: true });
      const nl = Math.round(conv * .7);
      for (let i = 0; i < nl; i++) {
        n++;
        const ent = addDays(ini, i % 7) > t ? t : addDays(ini, i % 7);
        const r = (n * 37) % 100;
        const max = r < 30 ? 0 : r < 55 ? 1 : r < 72 ? 2 : r < 84 ? 3 : 4;
        const lost = max < 4 && w > 1 && r % 3 === 0;
        const etapa = lost ? 'perdido' : STAGES[max].id;
        leads.push({ nome: '[Exemplo] ' + nomes[n % nomes.length] + ' ' + n, telefone: '6199' + String(1000000 + n * 7919).slice(0, 7), cursoId: c.cursoId, origem: 'Meta Ads', campanhaId: c.id, anuncio: stats[stats.length - 1].anuncio, entrada: ent, primeiraResposta: 3 + (n % 40), etapa, etapaMax: max, motivoPerda: lost ? ['Preço', 'Sem retorno', 'Horário ou turno', 'Preço'][n % 4] : '', dataPerda: lost ? addDays(ent, 3) : '', dataMatricula: etapa === 'matriculado' ? addDays(ent, 2) > t ? t : addDays(ent, 2) : '', valor: etapa === 'matriculado' ? store.get('courses', c.cursoId)?.preco || 300 : null, proximaData: !lost && max < 4 && max > 0 ? addDays(t, (n % 5) - 2) : '', proximaAcao: !lost && max > 0 && max < 4 ? 'Enviar datas da próxima turma' : '', demo: true });
      }
    });
  }
  store.putMany('adStats', stats);
  store.putMany('leads', leads);
  store.putMany('turmas', [{ nome: '[Exemplo] Técnico em Enfermagem · próxima turma', cursoId: pickC('enferm'), inicio: addDays(t, 20), vagas: 30, meta: 15, demo: true }]);
  store.putMany('goals', [{ nome: '[Exemplo] 25 matrículas no mês', indicador: 'matriculas', alvo: 25, inicio: monthStart(t), fim: addDays(monthStart(addDays(monthStart(t), 32)), -1), demo: true }]);
}

export function mount(root, ctx) {
  if (store.mode === 'supabase') loadMembers(root);
  $('#cfg-import', root)?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await readFileText(f));
      if (!data || !COLLECTIONS.some((c) => Array.isArray(data[c]))) throw new Error('Arquivo não parece um backup do LICEU Intelligence.');
      openDialog({ title: 'Restaurar backup?', saveLabel: 'Substituir tudo', html: `<p>O backup tem ${COLLECTIONS.map((c) => (data[c]?.length || 0)).reduce((a, b) => a + b, 0)} registros. Os dados atuais da unidade serão substituídos por ele.</p>`, onSave: () => { store.replaceAll(data); toast('Backup restaurado.'); ctx.refresh(); } });
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
    if (ds.cfg === 'pipe') return pipeDialog(null, ctx);
    const a = ds.cfg;
    if (a === 'unit') unitDialog(ctx);
    if (a === 'course') courseDialog(null, ctx);
    if (a === 'export') downloadFile('liceu-backup-' + today() + '.json', JSON.stringify({ app: 'LICEU Intelligence', exportedAt: new Date().toISOString(), ...dump() }, null, 1), 'application/json');
    if (a === 'demo-on') { loadDemo(); toast('Dados de exemplo carregados. Remova antes de usar os números.'); ctx.refresh(); }
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
