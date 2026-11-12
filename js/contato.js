// Contato com o lead pelos dois jeitos de vender: a nova geração (WhatsApp) e a clássica (ligação).
// Cada toque fica registrado em lead.contatos: tentativas, resultado e próximo retorno, sem digitar nada.

import { store } from './store.js';
import { esc, today, addDays, fmtDate } from './util.js';
import { courseName, settings } from './metrics.js';
import { myName } from './leads.js';
import { openDialog, toast } from './ui.js';
import { auth } from './auth.js';

export const RESULTADOS = [
  { id: 'avancou', t: 'Atendeu e avançou', cls: 'win', retorno: null },
  { id: 'retornar', t: 'Atendeu, retornar depois', cls: '', retorno: 2 },
  { id: 'nao', t: 'Não atendeu', cls: '', retorno: 1 },
  { id: 'caixa', t: 'Caixa postal', cls: '', retorno: 1 },
  { id: 'errado', t: 'Número errado', cls: 'danger', retorno: null },
];
const LABEL = Object.fromEntries(RESULTADOS.map((r) => [r.id, r.t]));

export const digitos = (t) => String(t || '').replace(/\D/g, '');
export const telHref = (t) => { const d = digitos(t); return d ? 'tel:+' + (d.length <= 11 ? '55' + d : d) : ''; };
export function waHref(l, texto = '') {
  const d = digitos(l.telefone); if (!d) return '';
  const msg = texto || `Oi, ${String(l.nome || '').replace(/^\[.*?\]\s*/, '').split(' ')[0]}! Tudo bem? Aqui é ${myName() || 'da escola'}, sobre o curso de ${courseName(l.cursoId) || 'interesse'}.`;
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}?text=${encodeURIComponent(msg)}`;
}

/** Registra um toque. Canal: tel | wa. Resultado só para ligação. */
export function registrar(id, canal, resultado = '', retorno = null) {
  const l = store.get('leads', id); if (!l) return;
  const c = { data: today(), hora: new Date().toTimeString().slice(0, 5), canal, resultado, por: myName() || '' };
  const patch = { contatos: [...(l.contatos || []), c] };
  if (!l.primeiraResposta) patch.primeiraResposta = today();
  const r = RESULTADOS.find((x) => x.id === resultado);
  const dias = retorno ?? r?.retorno;
  if (dias != null) { patch.proximaData = addDays(today(), dias); patch.proximaAcao = resultado === 'retornar' ? 'Retornar a ligação combinada' : 'Tentar ligar de novo'; }
  if (resultado === 'avancou' && l.proximaData && l.proximaData <= today()) { patch.proximaData = ''; patch.proximaAcao = ''; }
  if (resultado === 'errado') patch.etiquetas = [...new Set([...(Array.isArray(l.etiquetas) ? l.etiquetas : String(l.etiquetas || '').split(',').map((x) => x.trim()).filter(Boolean)), 'Número errado'])];
  store.put('leads', { ...l, ...patch });
}

export const tentativas = (l) => (l.contatos || []).filter((c) => c.canal === 'tel').length;
export const ligacoesHoje = () => store.all('leads').reduce((a, l) => a + (l.contatos || []).filter((c) => c.canal === 'tel' && c.data === today()).length, 0);

/** Botões de contato no cartão do lead. */
export function botoes(l) {
  if (!digitos(l.telefone)) return '';
  const n = tentativas(l); const ult = (l.contatos || []).slice(-1)[0];
  return `<div class="lead-contact">
    <a class="ct ct-wa" href="${esc(waHref(l))}" target="_blank" rel="noopener" data-wa="${esc(l.id)}" title="Chamar no WhatsApp">WhatsApp</a>
    <a class="ct ct-tel" href="${esc(telHref(l.telefone))}" data-tel="${esc(l.id)}" title="Ligar">Ligar${n ? ` <small>${n}×</small>` : ''}</a>
    ${ult ? `<span class="ct-last" title="Último contato">${ult.canal === 'tel' ? '☎' : '💬'} ${esc(LABEL[ult.resultado] || (ult.canal === 'wa' ? 'mensagem' : 'ligação'))} · ${fmtDate(ult.data)}</span>` : ''}
  </div>`;
}

/** Fila do modo ligação: retornos vencidos, de hoje, quem nunca foi contatado e depois os mais quentes. */
export function fila(leads) {
  const t = today(); const peso = { Quente: 0, Morno: 1, Frio: 2 };
  const pr = (l) => (l.proximaData && l.proximaData < t ? 0 : l.proximaData === t ? 1 : !(l.contatos || []).length ? 2 : 3);
  return leads.filter((l) => digitos(l.telefone) && !(l.proximaData > t) && tentativas(l) < 6 && !(l.contatos || []).some((c) => c.canal === 'tel' && c.data === t))
    .filter((l) => !(Array.isArray(l.etiquetas) ? l.etiquetas : []).includes('Número errado'))
    .sort((a, b) => pr(a) - pr(b) || (peso[a.temperatura] ?? 1) - (peso[b.temperatura] ?? 1) || String(a.entrada).localeCompare(String(b.entrada)));
}

const ROTEIRO = [
  ['Abertura (10s)', 'Oi, {nome}? Aqui é {eu}, da escola. Você pediu informação sobre {curso}, lembra? Tem 2 minutinhos?'],
  ['Descobrir', 'O que te fez procurar esse curso agora? É pra trabalhar na área ou já trabalha?'],
  ['Conectar', 'Faz sentido. A turma é presencial, com prática desde a primeira aula e certificado.'],
  ['Fechar', 'Tenho vaga na turma que começa em breve. Quer que eu reserve a sua com o sinal no Pix?'],
  ['Objeção de preço', 'Entendo. Dá pra parcelar e a reserva segura o valor de hoje. Fica melhor no cartão ou no Pix?'],
];

/** Tela do modo ligação: um lead por vez, roteiro na tela e um toque para o resultado. */
export function discador(leads, pos = 0) {
  const fl = fila(leads); const hoje = ligacoesHoje();
  const meta = Number(settings().metaLigacoes) || 30;
  if (!fl.length) return `<div class="empty"><h3>Fila zerada</h3><p>Nenhum lead com telefone pendente agora. ${hoje} ligações hoje.</p></div>`;
  const i = Math.min(pos, fl.length - 1); const l = fl[i];
  const sub = (s) => s.replace('{nome}', String(l.nome || '').replace(/^\[.*?\]\s*/, '').split(' ')[0]).replace('{eu}', myName() || 'eu').replace('{curso}', courseName(l.cursoId) || 'o curso');
  const hist = (l.contatos || []).slice(-4).reverse();
  return `<div class="dial">
    <div class="dial-top">
      <div class="dial-meter"><b>${hoje}</b><span>de ${meta} ligações hoje</span><div class="tm-bar"><i style="width:${Math.min(100, (hoje / meta) * 100)}%"></i></div></div>
      <span class="muted">Lead ${i + 1} de ${fl.length} na fila</span>
    </div>
    <section class="dial-card">
      <p class="dial-why">${l.proximaData && l.proximaData < today() ? 'Retorno atrasado' : l.proximaData === today() ? 'Retorno de hoje' : !(l.contatos || []).length ? 'Nunca contatado' : 'Na fila'}${l.temperatura ? ' · ' + esc(l.temperatura) : ''}</p>
      <h2>${esc(l.nome)}</h2>
      <p class="dial-phone">${esc(l.telefone)}</p>
      <p class="muted">${esc(courseName(l.cursoId) || 'Curso não informado')}${l.origem ? ' · ' + esc(l.origem) : ''} · ${tentativas(l)} tentativa${tentativas(l) === 1 ? '' : 's'}</p>
      <div class="dial-go">
        <a class="btn primary dial-call" href="${esc(telHref(l.telefone))}" data-tel="${esc(l.id)}" data-nopop="1">☎ Ligar agora</a>
        <a class="btn" href="${esc(waHref(l))}" target="_blank" rel="noopener" data-wa="${esc(l.id)}">💬 WhatsApp</a>
        <button type="button" class="btn ghost" data-edit="${esc(l.id)}">Abrir ficha</button>
      </div>
      <p class="dial-q">Como foi?</p>
      <div class="dial-res">${RESULTADOS.map((r) => `<button type="button" class="btn sm ${r.cls}" data-res="${r.id}" data-lead="${esc(l.id)}">${r.t}</button>`).join('')}
        <button type="button" class="btn sm ghost" data-pular="${i + 1}">Pular →</button></div>
      ${hist.length ? `<ul class="dial-hist">${hist.map((c) => `<li>${fmtDate(c.data)} ${esc(c.hora || '')} · ${c.canal === 'tel' ? 'Ligação' : 'WhatsApp'}${c.resultado ? ': ' + esc(LABEL[c.resultado]) : ''}${c.por ? ' · ' + esc(c.por) : ''}</li>`).join('')}</ul>` : ''}
    </section>
    <details class="dial-script" open><summary>Roteiro de ligação</summary><ol>${ROTEIRO.map(([t, s]) => `<li><b>${t}</b><p>${esc(sub(s))}</p></li>`).join('')}</ol></details>
  </div>`;
}

// ---------- WhatsApp oficial (Cloud API): conversa dentro do app ----------
export const waApi = () => store.mode === 'supabase' && !!settings().whatsappApi;
const thread = (id) => store.all('wamsg').filter((m) => m.leadId === id).sort((a, b) => a.em.localeCompare(b.em));
const janelaAberta = (id) => { const u = thread(id).filter((m) => m.dir === 'in').pop(); return u && Date.now() - new Date(u.em).getTime() < 24 * 3600e3 ? u : null; };
const tick = { sent: '✓', delivered: '✓✓', read: '✓✓', failed: '!' };
function bolhas(id) {
  const ms = thread(id);
  return ms.length ? ms.map((m) => `<div class="wa-b ${m.dir}"><p>${esc(m.texto)}</p><small>${new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${m.dir === 'out' ? ` <i class="${m.status === 'read' ? 'read' : ''}">${tick[m.status] || ''}</i>` : ''}</small></div>`).join('') : '<p class="muted">Nenhuma mensagem pelo WhatsApp oficial ainda.</p>';
}
export function conversaDialog(id) {
  const l = store.get('leads', id); if (!l) return;
  const jan = janelaAberta(id);
  const resp = settings().respostas || [];
  const { dlg } = openDialog({ title: l.nome, wide: true,
    html: `<div class="wa">
      <p class="wa-top"><span>${esc(l.telefone || '')}</span><span class="badge ${jan ? 'good' : 'warn'}">${jan ? 'Janela de 24h aberta' : 'Fora da janela de 24h: só modelo aprovado'}</span></p>
      <div class="wa-thread" id="wa-thread">${bolhas(id)}</div>
      ${resp.length ? `<div class="wa-quick">${resp.slice(0, 6).map((r, i) => `<button type="button" class="btn sm" data-q="${i}">${esc(r.titulo)}</button>`).join('')}</div>` : ''}
      <div class="wa-send"><textarea id="wa-in" rows="2" placeholder="${jan ? 'Escreva a mensagem' : 'Nome do modelo aprovado (ex.: retomada_contato)'}"></textarea><button type="button" class="btn primary" id="wa-go">Enviar</button></div>
    </div>` });
  const th = dlg.querySelector('#wa-thread'); th.scrollTop = th.scrollHeight;
  const inp = dlg.querySelector('#wa-in');
  dlg.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { inp.value = resp[b.dataset.q].texto.replace(/\{nome\}/gi, String(l.nome).split(' ')[0]); inp.focus(); }));
  const off = store.on(() => { if (!dlg.open) return off(); th.innerHTML = bolhas(id); th.scrollTop = th.scrollHeight; });
  dlg.querySelector('#wa-go').addEventListener('click', async (e) => {
    const v = inp.value.trim(); if (!v) return;
    e.target.disabled = true;
    const body = { orgId: auth.org?.id, leadId: id, ...(janelaAberta(id) ? { texto: v } : { template: v }) };
    const { data, error } = await auth.client.functions.invoke('whatsapp-send', { body });
    e.target.disabled = false;
    if (error || data?.error) return toast(data?.error || 'Não foi possível enviar.', 'bad');
    inp.value = ''; registrar(id, 'wa');
  });
}
