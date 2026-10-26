// Ações sobre leads, funis, produtos e matrículas usadas pelo Funil, por Matrículas e pelo Painel.
// Um lead ganho É a matrícula: mesmo registro, com os dados de pagamento.

import { store } from './store.js';
import { esc, $, $$, today, fmtDate, phoneKey, brl, uid } from './util.js';
import { STAGES, STAGE_IDX, LOSS_REASONS, ORIGENS, reached, leadPipeId } from './metrics.js';
import { openDialog, toast, field } from './ui.js';
import { auth } from './auth.js';

export { leadPipeId };
export const FORMAS = ['Pix', 'Cartão de crédito', 'Boleto', 'Dinheiro', 'Transferência', 'Outro'];
export const PAG_STATUS = ['Pago', 'Parcial', 'Pendente'];
export const TEMPERATURAS = ['Quente', 'Morno', 'Frio'];
export const HORARIOS = ['Manhã', 'Tarde', 'Noite', 'Qualquer horário'];
export const OBJECOES = ['Preço', 'Horário', 'Distância', 'Insegurança', 'Precisa falar com a família', 'Pesquisando outras escolas', 'Nenhuma'];

// Etapas abertas que valem para as métricas. Cada etapa de qualquer funil equivale a uma delas.
export const NIVEIS = STAGES.slice(0, 4).map((s) => [s.id, s.label]);

export const courseOpts = (blank = 'Selecione') => [['', blank], ...store.all('courses').filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])];
export const campOpts = () => [['', 'Nenhuma / não sei'], ...store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])];
export const turmaOpts = (cursoId) => [['', 'Sem turma definida'], ...store.all('turmas').filter((t) => !cursoId || t.cursoId === cursoId).map((t) => [t.id, t.nome])];
export const stageLabel = (id) => (id === 'perdido' ? 'Perdido' : STAGES[STAGE_IDX[id]]?.label || id);

// Valor já recebido de uma matrícula.
export const recebido = (l) => (['Pendente', 'Parcial'].includes(l.statusPagamento) ? Number(l.valorPago) || 0 : Number(l.valor) || 0);

// ---------- Funis ----------
const sid = () => 'e' + Math.random().toString(36).slice(2, 9);
export const DEFAULT_PIPE = { id: 'principal', nome: 'Funil comercial', etapas: NIVEIS.map(([id, nome]) => ({ id, nome, nivel: id })) };

export function pipelines() {
  const list = store.all('pipelines').filter((p) => p.etapas?.length).sort((a, b) => (a.id === 'principal' ? -1 : b.id === 'principal' ? 1 : (a.createdAt || '').localeCompare(b.createdAt || '')));
  if (!list.some((p) => p.id === 'principal')) list.unshift(DEFAULT_PIPE);
  return list;
}
export const pipeline = (id) => pipelines().find((p) => p.id === id) || pipelines()[0];

// Coluna do lead dentro do funil: uma etapa do funil, "ganho" ou "perdido".
export function leadCol(l, p = pipeline(leadPipeId(l))) {
  if (l.etapa === 'matriculado') return 'ganho';
  if (l.etapa === 'perdido') return 'perdido';
  if (p.etapas.some((e) => e.id === l.etapaFunil)) return l.etapaFunil;
  const i = STAGE_IDX[l.etapa] ?? 0;
  return (p.etapas.find((e) => e.nivel === l.etapa) || p.etapas.filter((e) => (STAGE_IDX[e.nivel] ?? 0) <= i).pop() || p.etapas[0]).id;
}
export function leadStage(l) {
  const p = pipeline(leadPipeId(l));
  const c = leadCol(l, p);
  return c === 'ganho' ? 'Matriculado' : c === 'perdido' ? 'Perdido' : p.etapas.find((e) => e.id === c)?.nome || stageLabel(l.etapa);
}

// ---------- Produtos ----------
export const productOpts = (blank = 'Sem produto') => [['', blank], ...store.all('products').filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => [p.id, p.nome + (p.valor ? ' · ' + brl(p.valor) : '')])];

export function productDialog(p, ctx) {
  const isNew = !p;
  p = p || { ativo: true };
  openDialog({
    title: isNew ? 'Novo produto' : p.nome,
    fields: [
      { name: 'nome', label: 'Nome do produto', value: p.nome, required: true, placeholder: 'ex.: Injetáveis · à vista', full: true },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOpts('Nenhum'), value: p.cursoId },
      { name: 'valor', label: 'Valor (R$)', type: 'number', value: p.valor },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['', ...FORMAS], value: p.formaPagamento || '' },
      { name: 'parcelas', label: 'Parcelas', type: 'number', value: p.parcelas },
      { name: 'descricao', label: 'O que está incluso', type: 'textarea', value: p.descricao, full: true },
      { name: 'ativo', label: 'Disponível para venda', type: 'checkbox', value: p.ativo !== false, full: true },
    ],
    html: '<p class="hint">Ao marcar um lead como ganho, escolher o produto preenche curso, valor, forma de pagamento e parcelas.</p>',
    onSave: (d) => { store.put('products', { ...p, ...d }); toast('Produto salvo.'); ctx.refresh(); },
    onDelete: isNew ? null : () => { store.remove('products', p.id); toast('Produto excluído. As matrículas já feitas não mudam.'); ctx.refresh(); },
  });
}

// ---------- Movimento ----------
export function moveLead(l, etapa, extra = {}) {
  const t = today();
  const hist = [...(l.historico || []), { data: t, etapa, ...(extra.etapaFunil ? { col: extra.etapaFunil } : {}) }];
  const patch = { etapa, historico: hist, ...extra };
  if (etapa !== 'perdido') patch.etapaMax = Math.max(l.etapaMax ?? 0, STAGE_IDX[etapa] ?? 0);
  else patch.etapaMax = reached(l);
  if (etapa === 'matriculado') {
    patch.dataMatricula = extra.dataMatricula || l.dataMatricula || t;
    if (!l.valor && !extra.valor) patch.valor = store.get('courses', extra.cursoId || l.cursoId)?.preco || 0;
    if (!extra.statusPagamento && !l.statusPagamento) patch.statusPagamento = 'Pago';
    patch.proximaData = ''; patch.proximaAcao = '';
  }
  if (etapa === 'perdido') { patch.dataPerda = t; patch.proximaData = ''; }
  if (l.etapa === 'matriculado' && etapa !== 'matriculado') patch.dataMatricula = '';
  if (l.etapa === 'perdido' && etapa !== 'perdido') { patch.dataPerda = ''; patch.motivoPerda = ''; }
  return store.put('leads', { ...l, ...patch });
}

// Move para uma coluna do funil (etapa, "ganho" ou "perdido"). Ganho e perda pedem os dados antes.
export function moveToCol(l, colId, ctx, p = pipeline(leadPipeId(l))) {
  if (!l || leadCol(l, p) === colId) return;
  if (colId === 'ganho') return matriculaDialog(l, ctx);
  if (colId === 'perdido') return loseDialog(l, ctx);
  const st = p.etapas.find((e) => e.id === colId);
  if (!st) return;
  moveLead(l, st.nivel, { etapaFunil: st.id, funilId: p.id });
  toast(l.nome + ' → ' + st.nome);
  ctx.refresh();
}

const sec = (label) => ({ type: 'section', label, name: '_' });

// Ganho: registrar ou editar a matrícula. l = lead existente ou null (matrícula direta, ex.: balcão).
export function matriculaDialog(l, ctx, { onDone } = {}) {
  const isNew = !l?.id;
  const jaMatriculado = l?.etapa === 'matriculado';
  l = l || { origem: 'Passante / balcão' };
  const prod = store.get('products', l.produtoId);
  const c = store.get('courses', l.cursoId || prod?.cursoId);
  const hasProducts = store.all('products').some((p) => p.ativo !== false);
  const main = [
    ...(isNew ? [{ name: 'nome', label: 'Nome do aluno', value: l.nome, required: true }, { name: 'telefone', label: 'WhatsApp', value: l.telefone }] : []),
    { name: 'produtoId', label: 'Produto', type: 'select', options: productOpts(hasProducts ? 'Escolha o produto' : 'Nenhum produto cadastrado'), value: l.produtoId || '', hint: hasProducts ? 'Preenche curso, valor e pagamento.' : 'Cadastre em Funil › Produtos para preencher sozinho.' },
    { name: 'cursoId', label: 'Curso', type: 'select', options: courseOpts(), value: l.cursoId || prod?.cursoId, required: true },
    { name: 'valor', label: 'Valor (R$)', type: 'number', value: l.valor || prod?.valor || c?.preco || '' },
    { name: 'dataMatricula', label: 'Data da matrícula', type: 'date', value: l.dataMatricula || today(), required: true },
    { name: 'statusPagamento', label: 'Pagamento', type: 'select', options: PAG_STATUS, value: l.statusPagamento || 'Pago' },
    { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['', ...FORMAS], value: l.formaPagamento || prod?.formaPagamento || '' },
    { name: 'parcelas', label: 'Parcelas', type: 'number', value: l.parcelas ?? prod?.parcelas ?? '' },
    { name: 'valorPago', label: 'Valor já recebido (R$)', type: 'number', value: l.valorPago ?? '' },
  ];
  const extra = [
    ...(isNew ? [] : [{ name: 'nome', label: 'Nome do aluno', value: l.nome, required: true }, { name: 'telefone', label: 'WhatsApp', value: l.telefone }]),
    { name: 'email', label: 'E-mail', type: 'email', value: l.email },
    { name: 'turmaId', label: 'Turma', type: 'select', options: turmaOpts(), value: l.turmaId },
    { name: 'origem', label: 'Como chegou', type: 'select', options: ORIGENS, value: l.origem },
    { name: 'campanhaId', label: 'Campanha', type: 'select', options: campOpts(), value: l.campanhaId },
    { name: 'anuncio', label: 'Anúncio ou post que trouxe', value: l.anuncio },
    { name: 'responsavel', label: 'Quem vendeu', value: l.responsavel || myName(), list: 'dl-resp' },
    { name: 'notas', label: 'Observações', type: 'textarea', value: l.notas, full: true },
  ];
  const { dlg } = openDialog({
    title: jaMatriculado ? 'Matrícula de ' + l.nome : isNew ? 'Registrar matrícula' : 'Ganho: ' + l.nome, wide: true,
    saveLabel: jaMatriculado ? 'Salvar alterações' : 'Confirmar ganho',
    fields: main,
    html: `<details class="more dlg-more"${isNew ? ' open' : ''}><summary>Dados do aluno e origem</summary><div class="form-grid">${extra.map(field).join('')}</div></details>${respList()}
      ${jaMatriculado ? '<p class="hint">Cancelou? "Desfazer matrícula" devolve o aluno para a última etapa do funil.</p>' : ''}`,
    onOpen: (form) => {
      const g = (n) => $(`[name="${n}"]`, form);
      const syncPago = () => { g('valorPago').closest('.field').hidden = g('statusPagamento').value === 'Pago'; };
      g('statusPagamento').addEventListener('change', syncPago); syncPago();
      g('produtoId').addEventListener('change', () => {
        const p = store.get('products', g('produtoId').value);
        if (!p) return;
        if (p.cursoId) g('cursoId').value = p.cursoId;
        if (p.valor) g('valor').value = p.valor;
        if (p.formaPagamento) g('formaPagamento').value = p.formaPagamento;
        if (p.parcelas) g('parcelas').value = p.parcelas;
      });
      g('cursoId').addEventListener('change', () => { if (!g('valor').value) g('valor').value = store.get('courses', g('cursoId').value)?.preco || ''; });
      (isNew ? g('nome') : g('produtoId')).focus();
    },
    onSave: (d) => {
      if (!d.cursoId) { toast('Escolha o curso.', 'bad'); return false; }
      if (!d.nome) { $('details', dlg).open = true; toast('Falta o nome do aluno.', 'bad'); return false; }
      if (isNew && d.telefone) {
        const dup = store.all('leads').find((x) => phoneKey(x.telefone) === phoneKey(d.telefone));
        if (dup) toast('Atenção: esse telefone já existe como ' + dup.nome + '. Confira se não é a mesma pessoa.', 'warn');
      }
      if (d.statusPagamento === 'Pago') d.valorPago = null;
      const base = { ...l, ...d, valor: d.valor ?? 0, entrada: l.entrada || d.dataMatricula };
      delete base._;
      if (jaMatriculado) store.put('leads', base);
      else moveLead({ ...base, etapaMax: Math.max(base.etapaMax ?? 0, 3), historico: base.historico || [{ data: d.dataMatricula, etapa: 'novo' }] }, 'matriculado', { dataMatricula: d.dataMatricula, valor: d.valor ?? 0, statusPagamento: d.statusPagamento, cursoId: d.cursoId });
      toast(jaMatriculado ? 'Matrícula atualizada.' : 'Ganho registrado. ' + d.nome + ' está matriculado.');
      onDone?.(); ctx.refresh();
    },
    onDelete: jaMatriculado ? () => {
      const p = pipeline(leadPipeId(l));
      const last = p.etapas[p.etapas.length - 1];
      moveLead(l, last.nivel, { etapaFunil: last.id });
      toast('Matrícula desfeita. ' + l.nome + ' voltou para ' + last.nome + '.');
      ctx.refresh();
    } : null,
    deleteLabel: 'Desfazer matrícula',
  });
  return dlg;
}

export function loseDialog(l, ctx) {
  openDialog({
    title: 'Por que ' + l.nome + ' não fechou?', saveLabel: 'Registrar perda',
    fields: [
      { name: 'motivoPerda', label: 'Motivo principal', type: 'select', options: LOSS_REASONS, value: l.motivoPerda || LOSS_REASONS[0], required: true },
      { name: 'notas', label: 'O que a pessoa disse', type: 'textarea', value: l.notas, full: true },
    ],
    onSave: (d) => { moveLead(l, 'perdido', d); toast('Perda registrada com motivo.'); ctx.refresh(); },
  });
}

// Pessoas que atendem: quem já aparece nos leads, a lista das configurações e você.
export const myName = () => auth.member?.nome || '';
export function responsaveis() {
  const set = new Set([myName(), ...(store.settings().responsaveis || []), ...store.all('leads').map((l) => l.responsavel)].map((x) => (x || '').trim()).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}
const respList = () => `<datalist id="dl-resp">${responsaveis().map((r) => `<option value="${esc(r)}">`).join('')}</datalist>`;
export const tagList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => x.trim()).filter(Boolean);

// Ficha completa do lead.
export function editLead(l, ctx, preset = {}) {
  if (l?.etapa === 'matriculado') return matriculaDialog(l, ctx);
  const isNew = !l;
  l = l || { entrada: today(), etapa: 'novo', origem: 'Meta Ads', responsavel: myName(), ...preset };
  const pid = l.funilId ? leadPipeId(l) : pipeline(preset.funilId).id;
  const colOpts = (p) => [...p.etapas.map((e) => [e.id, e.nome]), ['ganho', 'Ganho (matricular)'], ['perdido', 'Perdido']];
  const p0 = pipeline(pid);
  const fields = [
    sec('Contato'),
    { name: 'nome', label: 'Nome', value: l.nome, required: true },
    { name: 'telefone', label: 'WhatsApp', value: l.telefone, placeholder: '(61) 9 0000-0000' },
    { name: 'email', label: 'E-mail', type: 'email', value: l.email },
    { name: 'cidade', label: 'Cidade ou bairro', value: l.cidade },
    { name: 'melhorHorario', label: 'Melhor horário para falar', type: 'select', options: ['', ...HORARIOS], value: l.melhorHorario || '' },
    { name: 'indicadoPor', label: 'Indicado por', value: l.indicadoPor },
    sec('Funil e interesse'),
    { name: 'funilId', label: 'Funil', type: 'select', options: pipelines().map((p) => [p.id, p.nome]), value: pid },
    { name: 'col', label: 'Etapa', type: 'select', options: colOpts(p0), value: leadCol(l, p0) },
    { name: 'temperatura', label: 'Temperatura', type: 'select', options: ['', ...TEMPERATURAS], value: l.temperatura || '' },
    { name: 'produtoId', label: 'Produto de interesse', type: 'select', options: productOpts('Nenhum'), value: l.produtoId || '' },
    { name: 'cursoId', label: 'Curso de interesse', type: 'select', options: courseOpts(), value: l.cursoId || p0.cursoId },
    { name: 'turmaId', label: 'Turma', type: 'select', options: turmaOpts(), value: l.turmaId },
    { name: 'valor', label: 'Valor em negociação (R$)', type: 'number', value: l.valor },
    { name: 'objecao', label: 'Principal objeção', type: 'select', options: ['', ...OBJECOES], value: l.objecao || '' },
    sec('Origem'),
    { name: 'origem', label: 'Como chegou', type: 'select', options: ORIGENS, value: l.origem },
    { name: 'campanhaId', label: 'Campanha', type: 'select', options: campOpts(), value: l.campanhaId },
    { name: 'anuncio', label: 'Anúncio ou post que trouxe', value: l.anuncio, hint: 'Use o mesmo nome do anúncio no Gerenciador para cruzar.' },
    { name: 'entrada', label: 'Primeiro contato', type: 'date', value: l.entrada, required: true },
    { name: 'primeiraResposta', label: 'Minutos até a 1ª resposta', type: 'number', value: l.primeiraResposta },
    sec('Atendimento'),
    { name: 'responsavel', label: 'Responsável', value: l.responsavel, list: 'dl-resp' },
    { name: 'etiquetas', label: 'Etiquetas', value: tagList(l.etiquetas).join(', '), placeholder: 'separe por vírgula: feira, retorno, bolsa' },
    { name: 'proximaData', label: 'Data do próximo retorno', type: 'date', value: l.proximaData },
    { name: 'proximaAcao', label: 'Próxima ação', value: l.proximaAcao, placeholder: 'ex.: mandar datas da turma' },
    { name: 'motivoPerda', label: 'Motivo da perda', type: 'select', options: ['', ...LOSS_REASONS], value: l.motivoPerda },
    { name: 'notas', label: 'Anotações da conversa', type: 'textarea', value: l.notas, full: true },
  ];
  const hist = (l.historico || []).map((h) => fmtDate(h.data) + ' ' + esc(h.col ? (p0.etapas.find((e) => e.id === h.col)?.nome || stageLabel(h.etapa)) : stageLabel(h.etapa)));
  openDialog({
    title: isNew ? 'Novo lead' : l.nome, wide: true,
    fields,
    html: respList() + (hist.length ? `<p class="hint">Histórico: ${hist.join(' → ')}</p>` : ''),
    onOpen: (form) => {
      const g = (n) => $(`[name="${n}"]`, form);
      g('funilId').addEventListener('change', () => {
        const p = pipeline(g('funilId').value);
        const cur = g('col').value;
        g('col').innerHTML = colOpts(p).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
        g('col').value = ['ganho', 'perdido'].includes(cur) ? cur : p.etapas[0].id;
        if (p.cursoId && !g('cursoId').value) g('cursoId').value = p.cursoId;
      });
      g('produtoId').addEventListener('change', () => {
        const pr = store.get('products', g('produtoId').value);
        if (pr?.cursoId) g('cursoId').value = pr.cursoId;
        if (pr?.valor && !g('valor').value) g('valor').value = pr.valor;
      });
      g('nome').focus();
    },
    onSave: (d) => {
      const dup = d.telefone && store.all('leads').find((x) => x.id !== l.id && phoneKey(x.telefone) === phoneKey(d.telefone));
      if (dup && isNew) toast('Atenção: já existe um lead com esse telefone (' + dup.nome + ').', 'warn');
      const { col, _, ...rest } = d;
      const p = pipeline(d.funilId);
      const base = { ...l, ...rest, etiquetas: tagList(d.etiquetas) };
      if (!base.id) base.id = uid('le_');
      if (col === 'ganho') { setTimeout(() => matriculaDialog(base, ctx), 0); return; }
      if (col === 'perdido') {
        if (l.etapa === 'perdido') store.put('leads', base);
        else if (!d.motivoPerda) { setTimeout(() => loseDialog(base, ctx), 0); return; }
        else moveLead(base, 'perdido');
      } else {
        const st = p.etapas.find((e) => e.id === col) || p.etapas[0];
        if (isNew || st.id !== leadCol(l, pipeline(leadPipeId(l))) || p.id !== leadPipeId(l)) moveLead(base, st.nivel, { etapaFunil: st.id, funilId: p.id });
        else store.put('leads', base);
      }
      toast('Lead salvo.');
      ctx.refresh();
    },
    onDelete: isNew ? null : () => { store.remove('leads', l.id); toast('Lead excluído.'); ctx.refresh(); },
  });
}

// Criar ou editar um funil: nome, curso padrão e as etapas (com limite de cartões, como no Kanban ágil).
export function pipeDialog(p, ctx, { onSaved } = {}) {
  const isNew = !p;
  p = p ? JSON.parse(JSON.stringify(p)) : { nome: '', etapas: NIVEIS.map(([id, nome]) => ({ id: sid(), nome, nivel: id })) };
  const row = (e) => `<li class="st-row" data-id="${esc(e.id || '')}">
    <input data-k="nome" value="${esc(e.nome || '')}" placeholder="Nome da etapa" aria-label="Nome da etapa">
    <select data-k="nivel" aria-label="Equivale a">${NIVEIS.map(([v, t]) => `<option value="${v}"${v === e.nivel ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <input data-k="limite" type="number" min="0" inputmode="numeric" value="${e.limite || ''}" placeholder="Limite" aria-label="Limite de cartões">
    <span class="st-move"><button type="button" class="icon-btn sm" data-up aria-label="Subir">↑</button><button type="button" class="icon-btn sm" data-rm aria-label="Remover etapa">×</button></span>
  </li>`;
  const { dlg } = openDialog({
    title: isNew ? 'Novo funil' : 'Editar funil', wide: true, saveLabel: isNew ? 'Criar funil' : 'Salvar funil',
    fields: [
      { name: 'nome', label: 'Nome do funil', value: p.nome, required: true, placeholder: 'ex.: Injetáveis · Outubro, Rematrícula, Empresas' },
      { name: 'cursoId', label: 'Curso padrão (opcional)', type: 'select', options: courseOpts('Nenhum'), value: p.cursoId },
      { name: 'descricao', label: 'Objetivo do funil', value: p.descricao, full: true, placeholder: 'ex.: leads da campanha de injetáveis até fechar a turma de novembro' },
    ],
    html: `<h3 class="form-sec">Etapas</h3>
      <p class="hint">Ganho e Perdido entram sozinhos no fim. "Equivale a" diz como a etapa conta nos relatórios. O limite avisa quando a coluna acumula cartões demais.</p>
      <ol class="st-list" id="st-list">${p.etapas.map(row).join('')}</ol>
      <button type="button" class="btn sm" id="st-add">+ Adicionar etapa</button>`,
    onOpen: (form) => {
      const list = $('#st-list', form);
      $('#st-add', form).addEventListener('click', () => { list.insertAdjacentHTML('beforeend', row({ nivel: 'conversa' })); $('.st-row:last-child input', list).focus(); });
      list.addEventListener('click', (e) => {
        const li = e.target.closest('.st-row');
        if (!li) return;
        if (e.target.closest('[data-rm]')) { if ($$('.st-row', list).length > 1) li.remove(); else toast('O funil precisa de pelo menos uma etapa.', 'warn'); }
        if (e.target.closest('[data-up]') && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      });
      $('[name="nome"]', form).focus();
    },
    onSave: (d, form) => {
      const etapas = $$('.st-row', form).map((li) => ({ id: li.dataset.id || sid(), nome: $('[data-k="nome"]', li).value.trim(), nivel: $('[data-k="nivel"]', li).value, limite: Number($('[data-k="limite"]', li).value) || 0 })).filter((e) => e.nome);
      if (!etapas.length) { toast('Dê nome a pelo menos uma etapa.', 'bad'); return false; }
      const saved = store.put('pipelines', { ...p, nome: d.nome, cursoId: d.cursoId, descricao: d.descricao, etapas });
      toast(isNew ? 'Funil criado.' : 'Funil salvo.');
      onSaved?.(saved);
      ctx.refresh();
    },
    onDelete: isNew || p.id === 'principal' ? null : () => { store.remove('pipelines', p.id); toast('Funil excluído. Os leads dele voltaram para o funil principal.'); onSaved?.(null); ctx.refresh(); },
    deleteLabel: 'Excluir funil',
  });
  return dlg;
}
