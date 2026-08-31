'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductMediaManager, type PendingProductMedia, uploadPendingProductMedia } from '@/features/admin/components/ProductMediaManager';

type Category = { id: string; name: string; parent_id: string | null };
type VariantForm = { id?: string; sku: string; name: string; optionValue: string; unit: string; quantityValue: string; retailPrice: string; wholesalePrice: string; costPrice: string; lowStockThreshold: string; weightGrams: string; initialStock: string; isActive: boolean; sortOrder: string; stockQuantity?: number };
type ApiVariant = { id: string; sku: string; name: string; option_value: string | null; unit: string | null; quantity_value: number | null; retail_price: number; wholesale_price: number | null; cost_price: number | null; low_stock_threshold: number; weight_grams: number | null; is_active: boolean; sort_order: number; stock_quantity: number };
const newVariant = (): VariantForm => ({ sku: '', name: '', optionValue: '', unit: '', quantityValue: '', retailPrice: '', wholesalePrice: '', costPrice: '', lowStockThreshold: '0', weightGrams: '', initialStock: '0', isActive: true, sortOrder: '0' });
const emptyProduct = { name: '', slug: '', categoryId: '', shortDescription: '', description: '', brand: '', status: 'draft', isFeatured: false, seoTitle: '', seoDescription: '' };

function toNullableInteger(value: string) { return value.trim() === '' ? null : Number(value); }

function StockMovement({ variant, onApplied }: { variant: VariantForm; onApplied: () => void }) {
  const [quantityDelta, setQuantityDelta] = useState('');
  const [movementType, setMovementType] = useState('adjustment');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  async function submit() {
    setMessage(null);
    const response = await fetch(`/api/insumos/admin/variants/${variant.id}/inventory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantityDelta: Number(quantityDelta), movementType, note }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.message || 'No se pudo registrar el movimiento.'); return; }
    setQuantityDelta(''); setNote(''); setMessage('Movimiento registrado.'); onApplied();
  }
  return <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3"><label className="text-xs text-stone-600">Movimiento<select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="mt-1 block rounded border p-2 text-sm"><option value="purchase">Compra (+)</option><option value="return">Devolución (+)</option><option value="sale">Venta (-)</option><option value="reservation">Reserva (-)</option><option value="release">Liberación (+)</option><option value="adjustment">Ajuste (+/-)</option></select></label><label className="text-xs text-stone-600">Cantidad firmada<input required type="number" value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} className="mt-1 block w-28 rounded border p-2 text-sm" placeholder="Ej: 10" /></label><label className="min-w-44 flex-1 text-xs text-stone-600">Nota<input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 block w-full rounded border p-2 text-sm" /></label><button type="button" onClick={submit} className="rounded border border-stone-300 px-3 py-2 text-sm font-medium">Registrar</button>{message && <span className="text-xs text-stone-600">{message}</span>}</div>;
}

export function ProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const [product, setProduct] = useState(emptyProduct);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([newVariant()]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [resolvedProductId, setResolvedProductId] = useState<string | undefined>(productId);
  const [pendingMedia, setPendingMedia] = useState<PendingProductMedia[]>([]);

  const load = useCallback(async () => {
    const categoryResponse = await fetch('/api/insumos/admin/categories');
    const categoryData = await categoryResponse.json();
    if (!categoryResponse.ok) throw new Error(categoryData.message || 'No fue posible cargar categorías.');
    setCategories(categoryData.categories || []);
    if (!productId) return;
    const [productResponse, variantResponse] = await Promise.all([fetch(`/api/insumos/admin/products/${productId}`), fetch(`/api/insumos/admin/products/${productId}/variants`)]);
    const productData = await productResponse.json(); const variantData = await variantResponse.json();
    if (!productResponse.ok) throw new Error(productData.message || 'No fue posible cargar el producto.');
    if (!variantResponse.ok) throw new Error(variantData.message || 'No fue posible cargar las variantes.');
    const value = productData.product;
    setProduct({ name: value.name || '', slug: value.slug || '', categoryId: value.category_id || '', shortDescription: value.short_description || '', description: value.description || '', brand: value.brand || '', status: value.status || 'draft', isFeatured: value.is_featured === true, seoTitle: value.seo_title || '', seoDescription: value.seo_description || '' });
    setVariants((variantData.variants || []).map((variant: ApiVariant) => ({ id: variant.id, sku: variant.sku, name: variant.name, optionValue: variant.option_value || '', unit: variant.unit || '', quantityValue: variant.quantity_value?.toString() || '', retailPrice: variant.retail_price?.toString() || '', wholesalePrice: variant.wholesale_price?.toString() || '', costPrice: variant.cost_price?.toString() || '', lowStockThreshold: variant.low_stock_threshold?.toString() || '0', weightGrams: variant.weight_grams?.toString() || '', initialStock: '0', isActive: variant.is_active !== false, sortOrder: variant.sort_order?.toString() || '0', stockQuantity: variant.stock_quantity }))); 
  }, [productId]);
  useEffect(() => { load().catch((caught) => setMessage(caught.message)).finally(() => setLoading(false)); }, [load]);

  function updateVariant(index: number, patch: Partial<VariantForm>) { setVariants((current) => current.map((variant, itemIndex) => itemIndex === index ? { ...variant, ...patch } : variant)); }
  function removeVariant(index: number) { setVariants((current) => { const value = current[index]; if (value.id) setRemovedVariantIds((ids) => [...ids, value.id as string]); return current.filter((_, itemIndex) => itemIndex !== index); }); }
  function variantPayload(variant: VariantForm, includeInitialStock: boolean) {
    return { sku: variant.sku, name: variant.name, optionValue: variant.optionValue || null, unit: variant.unit || null, quantityValue: toNullableInteger(variant.quantityValue), retailPrice: Number(variant.retailPrice), wholesalePrice: toNullableInteger(variant.wholesalePrice), costPrice: toNullableInteger(variant.costPrice), lowStockThreshold: Number(variant.lowStockThreshold || 0), weightGrams: toNullableInteger(variant.weightGrams), isActive: variant.isActive, sortOrder: Number(variant.sortOrder || 0), ...(includeInitialStock ? { initialStock: Number(variant.initialStock || 0) } : {}) };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      if (variants.length === 0) throw new Error('Agrega al menos una variante.');
      const productPayload = { ...product, categoryId: product.categoryId || null };
      let id = productId;
      if (!id) {
        const response = await fetch('/api/insumos/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productPayload) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || 'No se pudo crear el producto.'); id = data.product.id;
      } else {
        const response = await fetch(`/api/insumos/admin/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productPayload) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || 'No se pudo guardar el producto.');
      }
      for (const variant of variants) {
        const response = await fetch(variant.id ? `/api/insumos/admin/variants/${variant.id}` : `/api/insumos/admin/products/${id}/variants`, { method: variant.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(variantPayload(variant, !variant.id)) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || `No se pudo guardar la variante ${variant.name}.`);
      }
      for (const variantId of removedVariantIds) {
        const response = await fetch(`/api/insumos/admin/variants/${variantId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('No se pudo eliminar una variante.');
      }
      if (pendingMedia.length > 0) {
        const uploadResult = await uploadPendingProductMedia(id, pendingMedia, setPendingMedia, product.name);
        if (uploadResult.failures.length > 0) {
          setResolvedProductId(id);
          setMessage(`El producto fue guardado, pero falló la carga de: ${uploadResult.failures.join(', ')}. Puedes reintentar las imágenes sin perder el producto.`);
          return;
        }
      }
      router.push(`/admin/productos/${id}`); router.refresh();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Error inesperado.'); } finally { setSaving(false); }
  }

  if (loading) return <p className="py-10 text-stone-500">Cargando producto...</p>;
  return <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-stone-900">{productId ? 'Editar producto' : 'Nuevo producto'}</h1><p className="mt-1 text-sm text-stone-600">SKU, precio y stock se definen por variante.</p></div><button type="button" onClick={() => router.push('/admin/productos')} className="text-sm text-stone-600">Volver</button></div>{message && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2"><h2 className="sm:col-span-2 text-lg font-semibold">Información del producto</h2><label className="text-sm font-medium">Nombre<input required value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm font-medium">Slug<input required value={product.slug} onChange={(event) => setProduct({ ...product, slug: event.target.value })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm font-medium">Categoría<select value={product.categoryId} onChange={(event) => setProduct({ ...product, categoryId: event.target.value })} className="mt-1 w-full rounded border p-2"><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm font-medium">Marca<input value={product.brand} onChange={(event) => setProduct({ ...product, brand: event.target.value })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm font-medium">Estado<select value={product.status} onChange={(event) => setProduct({ ...product, status: event.target.value as typeof product.status })} className="mt-1 w-full rounded border p-2"><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Archivado</option></select></label><label className="inline-flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={product.isFeatured} onChange={(event) => setProduct({ ...product, isFeatured: event.target.checked })} /> Destacado</label><label className="sm:col-span-2 text-sm font-medium">Descripción corta<textarea value={product.shortDescription} onChange={(event) => setProduct({ ...product, shortDescription: event.target.value })} className="mt-1 min-h-20 w-full rounded border p-2" /></label><label className="sm:col-span-2 text-sm font-medium">Descripción<textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} className="mt-1 min-h-28 w-full rounded border p-2" /></label><label className="text-sm font-medium">Título SEO<input value={product.seoTitle} onChange={(event) => setProduct({ ...product, seoTitle: event.target.value })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm font-medium">Descripción SEO<input value={product.seoDescription} onChange={(event) => setProduct({ ...product, seoDescription: event.target.value })} className="mt-1 w-full rounded border p-2" /></label></section>
    <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5"><div><h2 className="text-lg font-semibold">Variantes y formatos</h2><p className="text-sm text-stone-600">Cada formato tiene su propio SKU, precio y saldo de stock.</p></div>{variants.map((variant, index) => <div key={variant.id || `new-${index}`} className="rounded border border-stone-200 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-medium">Nombre<input required value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" placeholder="1 kg" /></label><label className="text-xs font-medium">SKU<input required value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Valor opción<input value={variant.optionValue} onChange={(event) => updateVariant(index, { optionValue: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" placeholder="1 kg" /></label><label className="text-xs font-medium">Unidad<input value={variant.unit} onChange={(event) => updateVariant(index, { unit: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" placeholder="kg, ml" /></label><label className="text-xs font-medium">Cantidad formato<input type="number" min="0.001" step="0.001" value={variant.quantityValue} onChange={(event) => updateVariant(index, { quantityValue: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Precio minorista<input required type="number" min="0" value={variant.retailPrice} onChange={(event) => updateVariant(index, { retailPrice: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Precio mayorista<input type="number" min="0" value={variant.wholesalePrice} onChange={(event) => updateVariant(index, { wholesalePrice: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Costo<input type="number" min="0" value={variant.costPrice} onChange={(event) => updateVariant(index, { costPrice: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Stock inicial{variant.id ? <span className="mt-1 block rounded bg-stone-100 p-2 text-sm">{variant.stockQuantity ?? 0} actual</span> : <input type="number" min="0" value={variant.initialStock} onChange={(event) => updateVariant(index, { initialStock: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" />}</label><label className="text-xs font-medium">Alerta stock bajo<input type="number" min="0" value={variant.lowStockThreshold} onChange={(event) => updateVariant(index, { lowStockThreshold: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Peso (g)<input type="number" min="0" value={variant.weightGrams} onChange={(event) => updateVariant(index, { weightGrams: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-xs font-medium">Orden<input type="number" min="0" value={variant.sortOrder} onChange={(event) => updateVariant(index, { sortOrder: event.target.value })} className="mt-1 w-full rounded border p-2 text-sm" /></label></div><div className="mt-3 flex items-center gap-4"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(index, { isActive: event.target.checked })} /> Activa</label><button type="button" onClick={() => removeVariant(index)} className="text-sm text-red-700 hover:underline">Quitar variante</button></div>{variant.id && <StockMovement variant={variant} onApplied={() => load().catch((caught) => setMessage(caught.message))} />}</div>)}<button type="button" onClick={() => setVariants((current) => [...current, newVariant()])} className="rounded border border-stone-300 px-3 py-2 text-sm">Agregar variante</button></section>
    <ProductMediaManager productId={resolvedProductId} pending={pendingMedia} setPending={setPendingMedia} /><div className="flex justify-end"><button disabled={saving} className="rounded bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar producto'}</button></div>
  </form>;
}
