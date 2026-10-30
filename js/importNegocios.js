// Importar matriculados (negócios) de uma planilha de CRM: CSV, TXT colado ou Excel (.xlsx).
// Lê por posição da coluna (a planilha pode repetir nomes, como "Negócio" e "Anúncio"), reconhece
// os campos do negócio, do contato e da origem do clique (campanha, conjunto, anúncio, IDs e UTMs)
// e guarda toda coluna desconhecida como campo personalizado. Quem já existe (telefone, e-mail ou
// CPF) é atualizado, não duplicado. Cada importação vira um lote que pode ser desfeito no Funil › Lista.

import { store } from './store.js';
import { esc, $, norm, parseCSV, parseNum, parseDate, phoneKey, onlyDigits, today, readFileAsArrayBuffer } from './util.js';
import { ORIGENS, STAGES } from './metrics.js';
import { openDialog, toast, ICON, readFileText } from './ui.js';
import { courseOpts, PAG_STATUS, pipeline, leadPipeId } from './leads.js';

// campo → nomes de coluna aceitos (comparados sem acento e em minúsculas)
const CAMPOS = [
  ['negocio', 'Negócio', ['negocio', 'nome do negocio', 'titulo do negocio', 'oportunidade', 'deal']],
  ['etapa', 'Etapa', ['etapa', 'fase', 'stage', 'etapa do funil']],
  ['situacao', 'Situação', ['situacao', 'status', 'status do negocio']],
  ['produto', 'Produto', ['produto', 'produtos', 'curso']],
  ['valor', 'Valor', ['valor', 'valor do negocio', 'valor total', 'preco']],
  ['responsavel', 'Responsável', ['responsavel', 'vendedor', 'dono', 'usuario responsavel']],
  ['criado', 'Criado em', ['criado em', 'data de criacao', 'criado', 'data do cadastro']],
  ['finalizado', 'Finalizado em', ['finalizado em', 'fechado em', 'data de fechamento', 'ganho em', 'data da venda']],
  ['obs', 'Observações', ['observacoes', 'observacao', 'notas', 'anotacoes']],
  ['contato', 'Contato', ['contato', 'nome do contato', 'nome', 'cliente', 'aluno', 'lead']],
  ['telefone', 'Telefone', ['telefone', 'celular', 'whatsapp', 'fone', 'telefone do contato']],
  ['email', 'E-mail', ['e-mail', 'email', 'e mail']],
  ['cpf', 'CPF/CNPJ', ['cpf/cnpj', 'cpf', 'cnpj', 'documento']],
  ['tags', 'Tags', ['tags', 'etiquetas', 'tag']],
  ['conexao', 'Conexão', ['conexao']],
  ['plataforma', 'Plataforma', ['plataforma', 'origem', 'origem do contato', 'fonte', 'canal']],
  ['dataClique', 'Data do clique', ['data do clique']],
  ['conta', 'Conta', ['conta', 'conta de anuncio']],
  ['contaId', 'ID da conta', ['id da conta']],
  ['campanha', 'Campanha', ['campanha', 'nome da campanha']],
  ['campanhaExt', 'ID da campanha', ['id da campanha']],
  ['conjunto', 'Conjunto/grupo', ['conjunto/grupo', 'conjunto', 'grupo', 'conjunto de anuncios', 'grupo de anuncios']],
  ['conjuntoId', 'ID do conjunto/grupo', ['id do conjunto/grupo', 'id do conjunto', 'id do grupo']],
  ['anuncio', 'Anúncio', ['anuncio', 'nome do anuncio']],
  ['anuncioId', 'ID do anúncio', ['id do anuncio']],
  ['clickId', 'ID do clique', ['id do clique', 'fbclid', 'gclid', 'ctwa clid']],
  ['utm_source', 'UTM source', ['utm source', 'utm_source']],
  ['utm_medium', 'UTM medium', ['utm medium', 'utm_medium']],
  ['utm_campaign', 'UTM campaign', ['utm campaign', 'utm_campaign']],
  ['utm_content', 'UTM content', ['utm content', 'utm_content']],
  ['utm_term', 'UTM term', ['utm term', 'utm_term']],
];
const CAMPO_NOME = Object.fromEntries(CAMPOS.map(([k, l]) => [k, l]));

// Planilha com linha de grupos em cima ("Negócio | | Contato | | Conexão…"): usa a linha de baixo como cabeçalho.
function headerRow(raw) {
  const known = (r) => r.filter((c) => CAMPOS.some(([, , al]) => al.includes(norm(c)))).length;
  if (raw.length > 2 && known(raw[1]) > known(raw[0])) return 1;
  return 0;
}

// Liga cada coluna a um campo. A 1ª ocorrência de um nome vai para o campo; repetições viram personalizadas.
export function mapColumns(header) {
  const used = new Set();
  return header.map((h, i) => {
    const n = norm(h).replace(/\s+/g, ' ');
    const hit = CAMPOS.find(([k, , al]) => !used.has(k) && al.includes(n));
    if (hit) { used.add(hit[0]); return { i, h, campo: hit[0] }; }
    return { i, h, campo: h ? 'custom' : 'ignorar' };
  });
}

const situacaoDe = (s) => { const n = norm(s); if (/ganh|vend|won|matricul|fechad|conclu|pago|aprovad/.test(n)) return 'ganho'; if (/perd|lost|cancel|desist|descart/.test(n)) return 'perdido'; return n ? 'aberto' : ''; };
function origemDe(r) {
  const p = norm(r.plataforma + ' ' + (r.utm_source || ''));
  if (/google|gclid|adwords/.test(p) || (r.clickId || '').startsWith('Cj')) return 'Google';
  if (/facebook|instagram|meta|fb|ig|ctwa/.test(p) || r.campanha || r.campanhaExt) return r.campanha || r.campanhaExt || r.anuncio ? 'Meta Ads' : 'Instagram orgânico';
  if (/indica/.test(p)) return 'Indicação';
  if (/site|organic|seo/.test(p)) return 'Site';
  return ORIGENS.find((o) => norm(o) === norm(r.plataforma)) || (r.plataforma ? 'Outro' : '');
}

// Lê arquivo: .xlsx com SheetJS (carregado só quando precisa), o resto como texto.
let xlsxLib = null;
async function loadXlsx() {
  if (xlsxLib) return xlsxLib;
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Não consegui carregar o leitor de Excel. Exporte a planilha como CSV.')); document.head.appendChild(s); });
  xlsxLib = window.XLSX; return xlsxLib;
}
async function fileToText(file) {
  if (/\.xlsx?$/i.test(file.name)) {
    const X = await loadXlsx();
    const wb = X.read(await readFileAsArrayBuffer(file), { type: 'array', cellDates: true });
    return X.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';', dateNF: 'dd/mm/yyyy' });
  }
  return readFileText(file);
}

// Transforma a planilha em registros com os campos reconhecidos.
export function parseNegocios(text) {
  const { raw } = parseCSV(text);
  if (!raw || raw.length < 2) return { cols: [], rows: [] };
  const hi = headerRow(raw);
  const cols = mapColumns(raw[hi]);
  const rows = raw.slice(hi + 1).map((cells) => {
    const r = { custom: {} };
    cols.forEach(({ i, h, campo }) => {
      const v = (cells[i] ?? '').trim();
      if (!v || campo === 'ignorar') return;
      if (campo === 'custom') r.custom[r.custom[h] !== undefined ? h + ' (2)' : h] = v; else r[campo] = v;
    });
    return r;
  }).filter((r) => r.contato || r.negocio || r.telefone || r.email);
  return { cols, rows };
}

const findProduct = (name) => { const n = norm(name); if (!n) return null; return store.all('products').find((p) => norm(p.nome) === n) || store.all('products').find((p) => norm(p.nome).includes(n) || n.includes(norm(p.nome))); };
const findCourse = (name) => { const n = norm(name); if (!n) return null; return store.all('courses').find((c) => norm(c.nome) === n) || store.all('courses').find((c) => { const cn = norm(c.nome); return cn.includes(n) || n.includes(cn) || cn.split(/\s+/).filter((w) => w.length > 4).some((w) => n.includes(w)); }); };
function findOrCreateCampaign(r) {
  if (!r.campanha && !r.campanhaExt) return null;
  const camps = store.all('campaigns');
  const hit = (r.campanhaExt && camps.find((c) => c.metaId === r.campanhaExt)) || (r.campanha && camps.find((c) => norm(c.nome) === norm(r.campanha)));
  if (hit) { if (r.campanhaExt && !hit.metaId) store.put('campaigns', { ...hit, metaId: r.campanhaExt }); return hit.id; }
  const canal = /google/.test(norm(r.plataforma)) ? 'Google' : 'Meta';
  return store.put('campaigns', { nome: r.campanha || 'Campanha ' + r.campanhaExt, metaId: r.campanhaExt || '', canal, status: 'Ativa', objetivo: 'Mensagens no WhatsApp', cursoId: findCourse(r.produto)?.id || '' }).id;
}

// Grava: novos e atualizados. opts: { todosMatriculados, cursoId, statusPagamento }
export function importar(rows, opts, importId) {
  const leads = store.all('leads');
  const byPhone = new Map(), byEmail = new Map(), byCpf = new Map();
  leads.forEach((l) => { if (phoneKey(l.telefone)) byPhone.set(phoneKey(l.telefone), l); if (l.email) byEmail.set(norm(l.email), l); if (l.cpf) byCpf.set(onlyDigits(l.cpf), l); });
  const p0 = pipeline('principal');
  let novos = 0, atualizados = 0, matriculados = 0;
  const out = [];
  rows.forEach((r) => {
    const sit = opts.todosMatriculados ? (situacaoDe(r.situacao) === 'perdido' ? 'perdido' : 'ganho') : situacaoDe(r.situacao) || 'aberto';
    const old = (phoneKey(r.telefone) && byPhone.get(phoneKey(r.telefone))) || (r.email && byEmail.get(norm(r.email))) || (onlyDigits(r.cpf).length >= 11 && byCpf.get(onlyDigits(r.cpf))) || null;
    const prod = findProduct(r.produto);
    const curso = prod?.cursoId ? store.get('courses', prod.cursoId) : findCourse(r.produto);
    const criado = parseDate(r.criado) || parseDate(r.dataClique);
    const fim = parseDate(r.finalizado);
    const campanhaId = findOrCreateCampaign(r);
    const rastreio = Object.fromEntries(['plataforma', 'dataClique', 'conta', 'contaId', 'campanha', 'campanhaExt', 'conjunto', 'conjuntoId', 'anuncio', 'anuncioId', 'clickId', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'conexao'].filter((k) => r[k]).map((k) => [k, r[k]]));
    const tags = String(r.tags || '').split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
    const base = old ? { ...old } : { entrada: criado || fim || today(), historico: [], funilId: p0.id };
    const rec = {
      ...base,
      nome: r.contato || r.negocio || base.nome || r.telefone || r.email,
      telefone: r.telefone || base.telefone || '', email: r.email || base.email || '', cpf: r.cpf || base.cpf || '',
      etiquetas: [...new Set([...(base.etiquetas || []), ...tags])],
      responsavel: r.responsavel || base.responsavel || '',
      produtoId: prod?.id || base.produtoId || '', cursoId: curso?.id || base.cursoId || opts.cursoId || '',
      valor: parseNum(r.valor) ?? base.valor ?? prod?.valor ?? null,
      origem: origemDe(r) || base.origem || '', campanhaId: campanhaId || base.campanhaId || '',
      anuncio: r.anuncio || base.anuncio || '', conjunto: r.conjunto || base.conjunto || '',
      notas: [base.notas, r.obs].filter(Boolean).join('\n'),
      negocio: r.negocio || base.negocio || '', etapaCRM: r.etapa || '', situacaoCRM: r.situacao || '',
      rastreio: { ...(base.rastreio || {}), ...rastreio }, custom: { ...(base.custom || {}), ...r.custom },
      importId: base.importId || importId,
    };
    if (sit === 'ganho') {
      if (base.etapa !== 'matriculado') rec.historico = [...(base.historico || []), { data: fim || criado || today(), etapa: 'matriculado' }];
      Object.assign(rec, { etapa: 'matriculado', etapaMax: 4, dataMatricula: base.etapa === 'matriculado' ? base.dataMatricula : fim || criado || today(), statusPagamento: base.statusPagamento || opts.statusPagamento || 'Pago' });
      matriculados++;
    } else if (sit === 'perdido') {
      if (base.etapa !== 'matriculado') Object.assign(rec, { etapa: 'perdido', dataPerda: fim || today(), motivoPerda: base.motivoPerda || 'Sem motivo registrado', historico: [...(base.historico || []), { data: fim || today(), etapa: 'perdido' }] });
    } else if (!old || !['matriculado', 'perdido'].includes(base.etapa)) {
      const p = pipeline(leadPipeId(rec));
      const st = p.etapas.find((e) => norm(e.nome) === norm(r.etapa)) || p.etapas.find((e) => r.etapa && norm(r.etapa).includes(norm(e.nome))) || p.etapas.find((e) => e.id === base.etapaFunil) || p.etapas[0];
      Object.assign(rec, { etapa: st.nivel, etapaFunil: st.id, etapaMax: Math.max(base.etapaMax ?? 0, STAGES.findIndex((x) => x.id === st.nivel)) });
      if (!old) rec.historico = [{ data: rec.entrada, etapa: st.nivel, col: st.id }];
    }
    if (old) { atualizados++; byPhone.set(phoneKey(rec.telefone), rec); } else { novos++; if (phoneKey(rec.telefone)) byPhone.set(phoneKey(rec.telefone), rec); if (rec.email) byEmail.set(norm(rec.email), rec); }
    out.push(rec);
  });
  store.putMany('leads', out);
  return { novos, atualizados, matriculados };
}

export function importDialog(ctx) {
  let parsed = null;
  const { dlg } = openDialog({
    title: 'Importar matriculados por planilha', wide: true, saveLabel: 'Importar',
    fields: [
      { name: 'cursoId', label: 'Curso padrão (quando a planilha não disser)', type: 'select', options: courseOpts('Nenhum') },
      { name: 'statusPagamento', label: 'Pagamento dos matriculados', type: 'select', options: PAG_STATUS, value: 'Pago' },
      { name: 'todosMatriculados', label: 'Considerar todos como matriculados (exceto os marcados como perdidos)', type: 'checkbox', value: true, full: true },
    ],
    html: `<p class="hint">Exporte do seu CRM em CSV ou Excel. Reconheço: negócio, etapa, situação, produto, valor, responsável, criado/finalizado em, observações, contato, telefone, e-mail, CPF/CNPJ, tags, conexão, plataforma, data do clique, conta, campanha, conjunto, anúncio (e os IDs), ID do clique e UTMs. O resto vira campo personalizado. Quem já existe (telefone, e-mail ou CPF) é atualizado.</p>
      <div class="drop"><label class="btn" for="ng-file">${ICON.upload} Escolher arquivo (.csv ou .xlsx)</label><input type="file" id="ng-file" accept=".csv,.txt,.xlsx,.xls" class="sr"><span class="muted" id="ng-name"></span></div>
      <div class="field full"><label for="ng-text">Ou cole a planilha aqui</label><textarea id="ng-text" rows="5" placeholder="Negócio;Etapa;Situação;Produto;Valor;Contato;Telefone;…"></textarea></div>
      <div id="ng-prev"></div>`,
    onSave: (d) => {
      if (!parsed?.rows.length) { const e = $('.form-error', dlg); e.textContent = 'Nenhuma linha com contato para importar.'; e.hidden = false; return false; }
      const imp = store.put('imports', { tipo: 'leads', fonte: 'Planilha de matriculados', arquivo: $('#ng-name', dlg).textContent || 'Conteúdo colado', lidas: parsed.rows.length });
      const r = importar(parsed.rows, d, imp.id);
      store.put('imports', { ...imp, novas: r.novos, substituidas: r.atualizados, ignoradas: 0 });
      toast(`${r.novos} novos e ${r.atualizados} atualizados · ${r.matriculados} matriculados. Para desfazer: Funil › Lista › lista importada.`);
      ctx.refresh();
    },
  });
  const prev = () => {
    const txt = $('#ng-text', dlg).value.trim();
    const box = $('#ng-prev', dlg);
    if (!txt) { parsed = null; box.innerHTML = ''; return; }
    parsed = parseNegocios(txt);
    const sits = { ganho: 0, perdido: 0, aberto: 0 };
    parsed.rows.forEach((r) => { sits[situacaoDe(r.situacao) || 'aberto']++; });
    const reconhecidas = parsed.cols.filter((c) => c.campo !== 'custom' && c.campo !== 'ignorar');
    const custom = parsed.cols.filter((c) => c.campo === 'custom');
    box.innerHTML = `<p class="note"><b>${parsed.rows.length} linhas</b> · situação na planilha: ${sits.ganho} ganhos, ${sits.perdido} perdidos, ${sits.aberto} em aberto/sem situação.</p>
      <ul class="map-list">${reconhecidas.map((c) => `<li class="ok">✓ ${esc(c.h)} <small>→ ${esc(CAMPO_NOME[c.campo])}</small></li>`).join('')}${custom.map((c) => `<li class="miss">＋ ${esc(c.h)} <small>→ campo personalizado</small></li>`).join('')}</ul>
      ${parsed.rows[0] ? `<p class="hint">Primeira linha: ${esc(parsed.rows[0].contato || parsed.rows[0].negocio || '')} · ${esc(parsed.rows[0].telefone || parsed.rows[0].email || '')} · ${esc(parsed.rows[0].produto || '')} · ${esc(parsed.rows[0].campanha || '')}</p>` : ''}`;
  };
  $('#ng-text', dlg).addEventListener('input', prev);
  $('#ng-file', dlg).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#ng-name', dlg).textContent = f.name;
    try { $('#ng-text', dlg).value = await fileToText(f); prev(); } catch (er) { toast(er.message, 'bad'); }
  });
}
