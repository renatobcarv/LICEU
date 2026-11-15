// Anexos do WhatsApp no Storage (bucket privado 'wa-media', caminho <org>/<AAAA-MM>/<arquivo>).
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const tipoDe = (mime: string) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/^data:[^,]+,/, '')), (c) => c.charCodeAt(0));

export async function guardarMidia(admin: SupabaseClient, orgId: string, dados: Uint8Array | string, mime: string, nome = '') {
  const bytes = typeof dados === 'string' ? unb64(dados) : dados;
  if (bytes.length > 16 * 1024 * 1024) throw new Error('arquivo maior que 16 MB');
  const m = (mime || 'application/octet-stream').split(';')[0].trim();
  const ext = ((nome.includes('.') ? nome.split('.').pop() : m.split('/')[1]) || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase() || 'bin';
  const path = `${orgId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('wa-media').upload(path, bytes, { contentType: m, upsert: false });
  if (error) throw new Error(error.message);
  return { path, mime: m, tipo: tipoDe(m), nome: String(nome || '').slice(0, 120), tamanho: bytes.length };
}

export async function urlAssinada(admin: SupabaseClient, path: string, segundos = 900) {
  const { data, error } = await admin.storage.from('wa-media').createSignedUrl(path, segundos);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
