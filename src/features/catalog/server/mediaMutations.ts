import 'server-only';

import { requireCatalogManager } from '@/features/auth/server/authorization';
import { createInsumosSupabaseAdmin, createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import { PRODUCT_MEDIA_BUCKET } from '@/features/catalog/productMedia';

type ProductMediaInput = { productId: string; storagePath: string; altText?: string | null; sortOrder?: number; isPrimary?: boolean };

function assertStoragePath(productId: string, storagePath: string) {
  if (!storagePath.startsWith(`products/${productId}/`)) throw new Error('La imagen no pertenece a este producto.');
  if (!/\.(?:jpe?g|png|webp)$/i.test(storagePath)) throw new Error('El archivo de imagen no es válido.');
}

export async function listAdminProductMedia(productId: string) {
  await requireCatalogManager();
  const { data, error } = await (await createInsumosSupabaseServer()).from('product_media').select('*').eq('product_id', productId).order('is_primary', { ascending: false }).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createProductMedia(input: ProductMediaInput) {
  await requireCatalogManager();
  assertStoragePath(input.productId, input.storagePath);
  const admin = createInsumosSupabaseAdmin();
  const { count, error: countError } = await admin.from('product_media').select('*', { count: 'exact', head: true }).eq('product_id', input.productId);
  if (countError) throw countError;
  const isPrimary = input.isPrimary === true || count === 0;
  if (isPrimary) {
    const { error } = await admin.from('product_media').update({ is_primary: false }).eq('product_id', input.productId);
    if (error) throw error;
  }
  const { data, error } = await admin.from('product_media').insert({
    product_id: input.productId,
    storage_path: input.storagePath,
    alt_text: input.altText || null,
    sort_order: input.sortOrder || 0,
    is_primary: isPrimary,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateProductMedia(productId: string, mediaId: string, input: { isPrimary?: boolean; sortOrder?: number; altText?: string | null }) {
  await requireCatalogManager();
  const admin = createInsumosSupabaseAdmin();
  if (input.isPrimary) {
    const { error } = await admin.from('product_media').update({ is_primary: false }).eq('product_id', productId);
    if (error) throw error;
  }
  const patch: Record<string, unknown> = {};
  if (input.isPrimary !== undefined) patch.is_primary = input.isPrimary;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.altText !== undefined) patch.alt_text = input.altText;
  const { data, error } = await admin.from('product_media').update(patch).eq('id', mediaId).eq('product_id', productId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProductMedia(productId: string, mediaId: string) {
  await requireCatalogManager();
  const admin = createInsumosSupabaseAdmin();
  const { data: media, error: findError } = await admin.from('product_media').select('id, storage_path').eq('id', mediaId).eq('product_id', productId).maybeSingle();
  if (findError) throw findError;
  if (!media) throw new Error('Imagen no encontrada.');
  const { error: storageError } = await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove([media.storage_path]);
  if (storageError) throw storageError;
  const { error: rowError } = await admin.from('product_media').delete().eq('id', media.id);
  if (rowError) throw rowError;
}
