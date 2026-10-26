// Ações sobre leads e matrículas usadas pelo Funil, por Matrículas e pelo Painel.
// Um lead matriculado É a matrícula: mesmo registro, com os dados de pagamento.

import { store } from './store.js';
import { esc, $, today, fmtDate, phoneKey } from './util.js';
import { STAGES, STAGE_IDX, LOSS_REASONS, ORIGENS, reached } from './metrics.js';
import { openDialog, toast } from './ui.js';

export const FORMAS = ['Pix', 'Cartão de crédito', 'Boleto', 'Dinheiro', 'Transferência', 'Outro'];
export const PAG_STATUS = ['Pago', 'Parcial', 'Pendente'];

export const courseOpts = (blank = 'Selecione') => [['', blank], ...store.all('courses').filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])];
export const campOpts = () => [['', 'Nenhuma / não sei'], ...store.all('campaigns').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])];
export const turmaOpts = (cursoId) => [['', 'Sem turma definida'], ...store.all('turmas').filter((t) => !cursoId || t.cursoId === cursoId).map((t) => [t.id, t.nome])];
export const stageLabel = (id) => (id === 'perdido' ? 'Perdido' : STAGES[STAGE_IDX[id]]?.label || id);

// Valor já recebido de uma matrícula.
export const recebido = (l) => (l.statusPagamento === 'Pendente' ? Number(l.valorPago) || 0 : l.statusPagamento === 'Parcial' ? Number(l.valorPago) || 0 : Number(l.valor) || 0);

export function moveLead(l, etapa, extra = {}) {
  const t = today();
  const hist = [...(l.historico || []), { data: t, etapa }];
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
  if (l.etapa === 'matriculado' && etapa !== 'matriculado') { patch.dataMatricula = ''; }
  return store.put('leads', { ...l, ...patch });
}

// Registrar ou editar uma matrícula. l = lead existente (vira matrícula) ou null (matrícula direta).
export function matriculaDialog(l, ctx, { onDone } = {}) {
  const isNew = !l?.id;
  const jaMatriculado = l?.etapa === 'matriculado';
  l = l || { origem: 'Passante / balcão' };
  const c = store.get('courses', l.cursoId);
  const { dlg } = openDialog({
    title: jaMatriculado ? 'Matrícula de ' + l.nome : isNew ? 'Registrar matrícula' : 'Matricular ' + l.nome, wide: true,
    saveLabel: jaMatriculado ? 'Salvar alterações' : 'Confirmar matrícula',
    fields: [
      { name: 'nome', label: 'Nome do aluno', value: l.nome, required: true },
      { name: 'telefone', label: 'WhatsApp', value: l.telefone },
      { name: 'cursoId', label: 'Curso', type: 'select', options: courseOpts(), value: l.cursoId, required: true },
      { name: 'turmaId', label: 'Turma', type: 'select', options: turmaOpts(), value: l.turmaId },
      { name: 'dataMatricula', label: 'Data da matrícula', type: 'date', value: l.dataMatricula || today(), required: true },
      { name: 'valor', label: 'Valor da matrícula (R$)', type: 'number', value: l.valor ?? c?.preco ?? '' },
      { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['', ...FORMAS], value: l.formaPagamento || '' },
      { name: 'parcelas', label: 'Parcelas', type: 'number', value: l.parcelas ?? '' },
      { name: 'statusPagamento', label: 'Pagamento', type: 'select', options: PAG_STATUS, value: l.statusPagamento || 'Pago' },
      { name: 'valorPago', label: 'Valor já recebido (se parcial ou pendente)', type: 'number', value: l.valorPago ?? '' },
      { name: 'origem', label: 'Como chegou', type: 'select', options: ORIGENS, value: l.origem },
      { name: 'campanhaId', label: 'Campanha', type: 'select', options: campOpts(), value: l.campanhaId },
      { name: 'anuncio', label: 'Anúncio ou post que trouxe', value: l.anuncio },
      { name: 'notas', label: 'Observações', type: 'textarea', value: l.notas, full: true },
    ],
    html: jaMatriculado ? '<p class="hint">Para desfazer a matrícula (ex.: cancelamento), use o botão abaixo. O aluno volta para Negociação no funil.</p>' : '',
    onSave: (d) => {
      if (!d.cursoId) { toast('Escolha o curso.', 'bad'); return false; }
      if (isNew && d.telefone) {
        const dup = store.all('leads').find((x) => phoneKey(x.telefone) === phoneKey(d.telefone));
        if (dup) toast('Atenção: esse telefone já existe como ' + dup.nome + '. Confira se não é a mesma pessoa.', 'warn');
      }
      const base = { ...l, ...d, valor: d.valor ?? 0, entrada: l.entrada || d.dataMatricula };
      if (jaMatriculado) store.put('leads', base);
      else moveLead({ ...base, etapaMax: Math.max(base.etapaMax ?? 0, 3), historico: base.historico || [{ data: d.dataMatricula, etapa: 'novo' }] }, 'matriculado', { dataMatricula: d.dataMatricula, valor: d.valor ?? 0, statusPagamento: d.statusPagamento, cursoId: d.cursoId });
      toast(jaMatriculado ? 'Matrícula atualizada.' : 'Matrícula registrada.');
      onDone?.(); ctx.refresh();
    },
    onDelete: jaMatriculado ? () => { moveLead(l, 'negociacao'); toast('Matrícula desfeita. ' + l.nome + ' voltou para Negociação.'); ctx.refresh(); } : null,
    deleteLabel: 'Desfazer matrícula',
  });
  return dlg;
}

export function loseDialog(l, ctx) {
  openDialog({
    title: 'Por que ' + l.nome + ' não fechou?', saveLabel: 'Registrar perda',
    fields: [
      { name: 'motivoPerda', label: 'Motivo principal', type: 'select', options: LOSS_REASONS, value: LOSS_REASONS[0], required: true },
      { name: 'notas', label: 'O que a pessoa disse', type: 'textarea', value: l.notas, full: true },
    ],
    onSave: (d) => { moveLead(l, 'perdido', d); toast('Perda registrada com motivo.'); ctx.refresh(); },
  });
}

export function editLead(l, ctx, preset = {}) {
  if (l?.etapa === 'matriculado') return matriculaDialog(l, ctx);
  const isNew = !l;
  l = l || { entrada: today(), etapa: 'novo', origem: 'Meta Ads', ...preset };
  const stageOpts = [...STAGES.map((s) => [s.id, s.label]), ['perdido', 'Perdido']];
  openDialog({
    title: isNew ? 'Novo lead' : l.nome, wide: true,
    fields: [
      { name: 'nome', label: 'Nome', value: l.nome, required: true },
      { name: 'telefone', label: 'WhatsApp', value: l.telefone },
      { name: 'cursoId', label: 'Curso de interesse', type: 'select', options: courseOpts(), value: l.cursoId },
      { name: 'turmaId', label: 'Turma', type: 'select', options: turmaOpts(), value: l.turmaId },
      { name: 'origem', label: 'Como chegou', type: 'select', options: ORIGENS, value: l.origem },
      { name: 'campanhaId', label: 'Campanha', type: 'select', options: campOpts(), value: l.campanhaId },
      { name: 'anuncio', label: 'Anúncio ou post que trouxe', value: l.anuncio, hint: 'Use o mesmo nome do anúncio no Gerenciador para cruzar.' },
      { name: 'entrada', label: 'Primeiro contato', type: 'date', value: l.entrada, required: true },
      { name: 'primeiraResposta', label: 'Minutos até a 1ª resposta', type: 'number', value: l.primeiraResposta },
      { name: 'etapa', label: 'Etapa', type: 'select', options: stageOpts, value: l.etapa },
      { name: 'valor', label: 'Valor em negociação (R$)', type: 'number', value: l.valor },
      { name: 'motivoPerda', label: 'Motivo da perda', type: 'select', options: ['', ...LOSS_REASONS], value: l.motivoPerda },
      { name: 'proximaData', label: 'Data do próximo retorno', type: 'date', value: l.proximaData },
      { name: 'proximaAcao', label: 'Próxima ação', value: l.proximaAcao, placeholder: 'ex.: mandar datas da turma', full: true },
      { name: 'notas', label: 'Anotações da conversa', type: 'textarea', value: l.notas, full: true },
    ],
    html: l.historico?.length ? `<p class="hint">Histórico: ${l.historico.map((h) => fmtDate(h.data) + ' ' + esc(stageLabel(h.etapa))).join(' → ')}</p>` : '',
    onSave: (d) => {
      const dup = d.telefone && store.all('leads').find((x) => x.id !== l.id && phoneKey(x.telefone) === phoneKey(d.telefone));
      if (dup && isNew) toast('Atenção: já existe um lead com esse telefone (' + dup.nome + ').', 'warn');
      const base = { ...l, ...d };
      if (d.etapa === 'matriculado' && l.etapa !== 'matriculado') { setTimeout(() => matriculaDialog(base, ctx), 0); return; }
      if (d.etapa !== l.etapa || isNew) moveLead(base, d.etapa);
      else store.put('leads', base);
      toast('Lead salvo.');
      ctx.refresh();
    },
    onDelete: isNew ? null : () => { store.remove('leads', l.id); toast('Lead excluído.'); ctx.refresh(); },
  });
}

void $;
