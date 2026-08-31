export const PRODUCT_MEDIA_BUCKET = 'product-media';

export function getProductMediaPublicUrl(storagePath: string) {
  const baseUrl = process.env.NEXT_PUBLIC_INSUMOS_SUPABASE_URL;
  if (!baseUrl || !storagePath) return null;
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${encodedPath}`;
}
