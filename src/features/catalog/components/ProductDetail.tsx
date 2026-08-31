'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { CatalogProductListing } from '@/features/catalog/server/queries';
import { getProductMediaPublicUrl } from '@/features/catalog/productMedia';
import { useInsumosCart } from '@/features/cart/CartProvider';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

function formatVariant(variant: CatalogProductListing['variants'][number]) {
  if (variant.optionValue) return variant.optionValue;
  if (variant.quantityValue && variant.unit) return `${variant.quantityValue} ${variant.unit}`;
  return variant.name;
}

export function ProductDetail({ listing }: { listing: CatalogProductListing }) {
  const { addItem } = useInsumosCart();
  const [selectedVariantId, setSelectedVariantId] = useState(listing.variants[0]?.id || '');
  const [selectedMediaId, setSelectedMediaId] = useState((listing.media.find((media) => media.isPrimary) || listing.media[0])?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const selectedVariant = listing.variants.find((variant) => variant.id === selectedVariantId) || null;
  const selectedMedia = listing.media.find((media) => media.id === selectedMediaId) || listing.media.find((media) => media.isPrimary) || listing.media[0];
  const imageUrl = selectedMedia ? getProductMediaPublicUrl(selectedMedia.storagePath) : null;
  const inStock = (selectedVariant?.stockQuantity || 0) > 0;
  const maxQuantity = selectedVariant ? Math.max(selectedVariant.stockQuantity, 0) : 0;

  useEffect(() => {
    setQuantity(1);
    setJustAdded(false);
  }, [selectedVariantId]);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 2500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  function handleAddToCart() {
    if (!selectedVariant || !inStock) return;
    const primaryMedia = listing.media.find((media) => media.isPrimary) || listing.media[0];
    addItem({
      productId: listing.product.id,
      variantId: selectedVariant.id,
      quantity,
      productName: listing.product.name,
      variantName: formatVariant(selectedVariant),
      slug: listing.product.slug,
      sku: selectedVariant.sku,
      imageUrl: primaryMedia ? getProductMediaPublicUrl(primaryMedia.storagePath) : null,
      unit: selectedVariant.unit,
      quantityValue: selectedVariant.quantityValue,
      // Snapshot for display only — the server recalculates price at checkout.
      unitPrice: selectedVariant.retailPrice,
      stockAvailable: selectedVariant.stockQuantity,
    });
    setQuantity(1);
    setJustAdded(true);
  }

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/productos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-insumos-forest hover:text-insumos-forest-dark">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al catálogo
        </Link>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-insumos-line bg-insumos-cream">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={selectedMedia?.altText || listing.product.name} className="absolute inset-0 h-full w-full object-contain p-6" />
              ) : <div className="flex h-full items-center justify-center text-sm font-medium text-insumos-sage">Imagen del producto</div>}
            </div>
            {listing.media.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{listing.media.map((media) => {
              const thumbnailUrl = getProductMediaPublicUrl(media.storagePath);
              return <button key={media.id} type="button" onClick={() => setSelectedMediaId(media.id)} className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-insumos-cream ${media.id === selectedMedia?.id ? 'border-insumos-forest' : 'border-transparent'}`} aria-label={`Ver imagen de ${listing.product.name}`}>
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-contain p-1" />
                ) : <span className="block h-full bg-insumos-sand" />}
              </button>;
            })}</div>}
          </div>
          <div className="rounded-2xl border border-insumos-line bg-white p-6 sm:p-8">
            {listing.category && <Link href={`/categoria/${listing.category.slug}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-insumos-sage hover:text-insumos-forest">{listing.category.name}</Link>}
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-insumos-ink sm:text-4xl">{listing.product.name}</h1>
            {(listing.product.description || listing.product.shortDescription) && <p className="mt-4 whitespace-pre-line text-stone-600">{listing.product.description || listing.product.shortDescription}</p>}
            <div className="mt-8">
              <label className="block text-sm font-semibold text-insumos-ink" htmlFor="variant">Elige un formato</label>
              {listing.variants.length > 0 ? <select id="variant" value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="mt-2 w-full rounded-lg border border-insumos-line bg-white px-3 py-3 text-insumos-ink outline-none focus:border-insumos-forest focus:ring-2 focus:ring-insumos-mint">
                {listing.variants.map((variant) => <option key={variant.id} value={variant.id}>{formatVariant(variant)} · {formatPrice(variant.retailPrice)}</option>)}
              </select> : <p className="mt-2 text-sm text-stone-600">Este producto no tiene formatos disponibles.</p>}
            </div>
            {selectedVariant && <div className="mt-6 rounded-xl bg-insumos-cream p-4">
              <p className="text-2xl font-bold text-insumos-forest">{formatPrice(selectedVariant.retailPrice)}</p>
              <p className="mt-1 text-sm text-stone-600">SKU: {selectedVariant.sku}</p>
              <p className={`mt-3 text-sm font-semibold ${inStock ? 'text-insumos-sage' : 'text-stone-600'}`}>{inStock ? `${selectedVariant.stockQuantity} unidades disponibles` : 'Sin stock'}</p>
            </div>}

            {inStock && (
              <div className="mt-6">
                <span className="block text-sm font-semibold text-insumos-ink">Cantidad</span>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-insumos-line">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={quantity <= 1}
                    aria-label="Restar cantidad"
                    className="grid h-10 w-10 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="w-10 text-center text-base font-semibold text-insumos-ink">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                    disabled={quantity >= maxQuantity}
                    aria-label="Sumar cantidad"
                    className="grid h-10 w-10 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedVariant || !inStock}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
                !selectedVariant || !inStock
                  ? 'bg-stone-200 text-stone-500'
                  : 'bg-insumos-forest text-white hover:bg-insumos-forest-dark'
              }`}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {!selectedVariant || !inStock ? 'Sin stock' : 'Agregar al carrito'}
            </button>
            {justAdded && (
              <p role="status" className="mt-3 text-center text-sm font-semibold text-insumos-sage">
                Agregado al carrito
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
