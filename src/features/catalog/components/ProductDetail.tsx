'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CatalogProductListing } from '@/features/catalog/server/queries';
import { getProductMediaPublicUrl } from '@/features/catalog/productMedia';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

function formatVariant(variant: CatalogProductListing['variants'][number]) {
  if (variant.optionValue) return variant.optionValue;
  if (variant.quantityValue && variant.unit) return `${variant.quantityValue} ${variant.unit}`;
  return variant.name;
}

export function ProductDetail({ listing }: { listing: CatalogProductListing }) {
  const [selectedVariantId, setSelectedVariantId] = useState(listing.variants[0]?.id || '');
  const [selectedMediaId, setSelectedMediaId] = useState((listing.media.find((media) => media.isPrimary) || listing.media[0])?.id || '');
  const selectedVariant = listing.variants.find((variant) => variant.id === selectedVariantId) || null;
  const selectedMedia = listing.media.find((media) => media.id === selectedMediaId) || listing.media.find((media) => media.isPrimary) || listing.media[0];
  const imageUrl = selectedMedia ? getProductMediaPublicUrl(selectedMedia.storagePath) : null;
  const inStock = (selectedVariant?.stockQuantity || 0) > 0;

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/productos" className="text-sm font-semibold text-amber-800 hover:text-amber-950">Volver al catálogo</Link>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={selectedMedia?.altText || listing.product.name} className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 text-sm font-medium text-stone-500">Imagen del producto</div>}
            </div>
            {listing.media.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{listing.media.map((media) => {
              const thumbnailUrl = getProductMediaPublicUrl(media.storagePath);
              return <button key={media.id} type="button" onClick={() => setSelectedMediaId(media.id)} className={`aspect-square overflow-hidden rounded-lg border-2 ${media.id === selectedMedia?.id ? 'border-amber-700' : 'border-transparent'}`} aria-label={`Ver imagen de ${listing.product.name}`}>
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : <span className="block h-full bg-stone-200" />}
              </button>;
            })}</div>}
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            {listing.category && <Link href={`/categoria/${listing.category.slug}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 hover:text-amber-900">{listing.category.name}</Link>}
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">{listing.product.name}</h1>
            {(listing.product.description || listing.product.shortDescription) && <p className="mt-4 whitespace-pre-line text-stone-600">{listing.product.description || listing.product.shortDescription}</p>}
            <div className="mt-8">
              <label className="block text-sm font-semibold text-stone-800" htmlFor="variant">Elige un formato</label>
              {listing.variants.length > 0 ? <select id="variant" value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100">
                {listing.variants.map((variant) => <option key={variant.id} value={variant.id}>{formatVariant(variant)} · {formatPrice(variant.retailPrice)}</option>)}
              </select> : <p className="mt-2 text-sm text-stone-600">Este producto no tiene formatos disponibles.</p>}
            </div>
            {selectedVariant && <div className="mt-6 rounded-xl bg-stone-50 p-4">
              <p className="text-2xl font-bold text-stone-900">{formatPrice(selectedVariant.retailPrice)}</p>
              <p className="mt-1 text-sm text-stone-600">SKU: {selectedVariant.sku}</p>
              <p className={`mt-3 text-sm font-semibold ${inStock ? 'text-emerald-700' : 'text-stone-600'}`}>{inStock ? `${selectedVariant.stockQuantity} unidades disponibles` : 'Sin stock'}</p>
            </div>}
            <button type="button" disabled className="mt-6 w-full rounded-lg bg-stone-300 px-4 py-3 text-sm font-semibold text-stone-600" title="El carrito de insumos aún no está conectado">Compra próximamente</button>
          </div>
        </div>
      </section>
    </main>
  );
}
