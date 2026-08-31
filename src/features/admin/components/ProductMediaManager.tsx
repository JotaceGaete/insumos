'use client';

import { useCallback, useEffect, useState } from 'react';
import { createInsumosSupabaseBrowser } from '@/features/shared/client/supabase';
import { getProductMediaPublicUrl, PRODUCT_MEDIA_BUCKET } from '@/features/catalog/productMedia';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type PendingProductMedia = {
  id: string;
  file: File;
  previewUrl: string;
  status: 'ready' | 'uploading' | 'uploaded' | 'error';
  error?: string;
};

type ExistingMedia = { id: string; storage_path: string; alt_text: string | null; sort_order: number; is_primary: boolean };

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadPendingProductMedia(
  productId: string,
  pending: PendingProductMedia[],
  setPending: React.Dispatch<React.SetStateAction<PendingProductMedia[]>>,
  altText: string,
) {
  const browser = createInsumosSupabaseBrowser();
  const failures: string[] = [];
  let successful = 0;
  const existingResponse = await fetch(`/api/insumos/admin/products/${productId}/media`);
  const existingData = await existingResponse.json().catch(() => ({ media: [] }));
  const existingMediaCount = existingResponse.ok ? (existingData.media || []).length : 0;

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    if (item.status === 'uploaded') continue;
    setPending((items) => items.map((current) => current.id === item.id ? { ...current, status: 'uploading', error: undefined } : current));
    const path = `products/${productId}/${crypto.randomUUID()}.${extensionFor(item.file)}`;
    const { error: uploadError } = await browser.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, item.file, { contentType: item.file.type, upsert: false });
    if (uploadError) {
      failures.push(item.file.name);
      setPending((items) => items.map((current) => current.id === item.id ? { ...current, status: 'error', error: uploadError.message } : current));
      continue;
    }

    const response = await fetch(`/api/insumos/admin/products/${productId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_path: path, alt_text: altText, sort_order: existingMediaCount + successful, is_primary: existingMediaCount === 0 && successful === 0 }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await browser.storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
      failures.push(item.file.name);
      setPending((items) => items.map((current) => current.id === item.id ? { ...current, status: 'error', error: data.message || 'No fue posible guardar la imagen.' } : current));
      continue;
    }
    successful += 1;
    setPending((items) => items.map((current) => current.id === item.id ? { ...current, status: 'uploaded' } : current));
  }
  return { successful, failures };
}

export function ProductMediaManager({ productId, pending, setPending }: { productId?: string; pending: PendingProductMedia[]; setPending: React.Dispatch<React.SetStateAction<PendingProductMedia[]>> }) {
  const [existing, setExisting] = useState<ExistingMedia[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    if (!productId) { setExisting([]); return; }
    const response = await fetch(`/api/insumos/admin/products/${productId}/media`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No fue posible cargar imágenes.');
    setExisting(data.media || []);
  }, [productId]);

  useEffect(() => { loadExisting().catch((caught) => setMessage(caught instanceof Error ? caught.message : 'No fue posible cargar imágenes.')); }, [loadExisting]);

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    setMessage(null);
    const selected = Array.from(event.target.files || []);
    const rejected = selected.filter((file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE);
    const valid = selected.filter((file) => ACCEPTED_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE)
      .map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: 'ready' as const }));
    if (rejected.length) setMessage('Solo se permiten JPG, PNG o WebP de hasta 8 MB.');
    setPending((items) => [...items, ...valid]);
    event.target.value = '';
  }

  async function patch(mediaId: string, body: Record<string, unknown>) {
    if (!productId) return;
    setBusyId(mediaId); setMessage(null);
    try {
      const response = await fetch(`/api/insumos/admin/products/${productId}/media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId, ...body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No fue posible actualizar la imagen.');
      await loadExisting();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'No fue posible actualizar la imagen.'); } finally { setBusyId(null); }
  }

  async function remove(mediaId: string) {
    if (!productId || !confirm('¿Eliminar esta imagen?')) return;
    setBusyId(mediaId); setMessage(null);
    try {
      const response = await fetch(`/api/insumos/admin/products/${productId}/media`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.message || 'No fue posible eliminar la imagen.'); }
      await loadExisting();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'No fue posible eliminar la imagen.'); } finally { setBusyId(null); }
  }

  async function move(media: ExistingMedia, direction: -1 | 1) {
    const index = existing.findIndex((current) => current.id === media.id);
    const target = existing[index + direction];
    if (!target) return;
    await Promise.all([
      patch(media.id, { sort_order: target.sort_order }),
      patch(target.id, { sort_order: media.sort_order }),
    ]);
  }

  return <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5"><div><h2 className="text-lg font-semibold">Imágenes</h2><p className="text-sm text-stone-600">JPG, PNG o WebP de hasta 8 MB. La primera imagen queda como principal si todavía no existe una.</p></div>
    <label className="inline-flex cursor-pointer rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectFiles} className="sr-only" />Seleccionar imágenes</label>
    {message && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    {pending.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pending.map((item) => <div key={item.id} className="overflow-hidden rounded border border-stone-200"><div className="aspect-square bg-stone-100">
      {/* Preview URLs are local browser blobs and cannot use Next image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
    </div><div className="space-y-1 p-3 text-xs"><p className="truncate font-medium">{item.file.name}</p><p className={item.status === 'error' ? 'text-red-700' : 'text-stone-600'}>{item.status === 'ready' ? 'Lista para subir al guardar' : item.status === 'uploading' ? 'Subiendo...' : item.status === 'uploaded' ? 'Subida' : item.error}</p><button type="button" onClick={() => setPending((items) => items.filter((current) => current.id !== item.id))} className="text-red-700 hover:underline">Quitar</button></div></div>)}</div>}
    {existing.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{existing.map((media) => <div key={media.id} className="overflow-hidden rounded border border-stone-200"><div className="aspect-square bg-stone-100">
      {/* Supabase Storage URLs are not part of the static Next image allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getProductMediaPublicUrl(media.storage_path) || ''} alt={media.alt_text || 'Imagen de producto'} className="h-full w-full object-cover" />
    </div><div className="flex flex-wrap gap-2 p-3 text-xs">{media.is_primary ? <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-800">Principal</span> : <button type="button" disabled={busyId === media.id} onClick={() => patch(media.id, { is_primary: true, sort_order: 0 })} className="rounded border px-2 py-1">Hacer principal</button>}<button type="button" disabled={busyId === media.id} onClick={() => move(media, -1)} className="rounded border px-2 py-1">Subir</button><button type="button" disabled={busyId === media.id} onClick={() => move(media, 1)} className="rounded border px-2 py-1">Bajar</button><button type="button" disabled={busyId === media.id} onClick={() => remove(media.id)} className="rounded border border-red-200 px-2 py-1 text-red-700">Eliminar</button></div></div>)}</div>}
  </section>;
}
