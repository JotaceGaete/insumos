'use client';

import { useDeferredValue, useState } from 'react';
import Link from 'next/link';
import type { CatalogProductListing } from '@/features/catalog/server/queries';
import { getProductMediaPublicUrl } from '@/features/catalog/productMedia';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

function listingMatchesSearch(listing: CatalogProductListing, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-CL');
  if (!normalizedSearch) return true;
  return [listing.product.name, listing.product.shortDescription, listing.product.description, listing.category?.name, ...listing.variants.map((variant) => variant.name), ...listing.variants.map((variant) => variant.optionValue)]
    .some((value) => value?.toLocaleLowerCase('es-CL').includes(normalizedSearch));
}

export function PublicProductCard({ listing }: { listing: CatalogProductListing }) {
  const primaryMedia = listing.media.find((media) => media.isPrimary) || listing.media[0];
  const imageUrl = primaryMedia ? getProductMediaPublicUrl(primaryMedia.storagePath) : null;
  const lowestPrice = listing.variants.reduce<number | null>((lowest, variant) => lowest === null || variant.retailPrice < lowest ? variant.retailPrice : lowest, null);
  const hasStock = listing.variants.some((variant) => variant.stockQuantity > 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-stone-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={primaryMedia?.altText || listing.product.name} className="h-full w-full object-cover" />
        ) : <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 text-sm font-medium text-stone-500">Imagen del producto</div>}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${hasStock ? 'bg-emerald-700 text-white' : 'bg-stone-700 text-white'}`}>{hasStock ? 'Disponible' : 'Sin stock'}</span>
      </div>
      <div className="p-5">
        {listing.category && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{listing.category.name}</p>}
        <h2 className="mt-2 text-lg font-bold text-stone-900">{listing.product.name}</h2>
        {listing.product.shortDescription && <p className="mt-2 line-clamp-2 text-sm text-stone-600">{listing.product.shortDescription}</p>}
        <p className="mt-4 text-xl font-bold text-stone-900">{lowestPrice === null ? 'Sin formatos disponibles' : `Desde ${formatPrice(lowestPrice)}`}</p>
        {listing.variants.length > 0 && <p className="mt-1 text-sm text-stone-500">{listing.variants.map((variant) => variant.optionValue || variant.name).join(' · ')}</p>}
        <Link href={`/producto/${listing.product.slug}`} className="mt-5 inline-flex rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700">Ver producto</Link>
      </div>
    </article>
  );
}

type PublicCatalogPageProps = {
  listings: CatalogProductListing[];
  title?: string;
  description?: string | null;
  lockedCategoryId?: string;
};

export function PublicCatalogPage({ listings, title = 'Materias primas para crear', description = 'Explora formatos, precios y disponibilidad para tu producción.', lockedCategoryId }: PublicCatalogPageProps) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const deferredSearch = useDeferredValue(search);
  const categories = Array.from(new Map(listings.flatMap((listing) => listing.category ? [[listing.category.id, listing.category]] : [])).values())
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const effectiveCategoryId = lockedCategoryId || categoryId;
  const filteredListings = listings.filter((listing) => (!effectiveCategoryId || listing.category?.id === effectiveCategoryId) && listingMatchesSearch(listing, deferredSearch));

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Catálogo de insumos</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">{title}</h1>
          {description && <p className="mt-4 text-lg text-stone-600">{description}</p>}
        </div>
        <div className="mt-8 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-[1fr_240px]">
          <label className="text-sm font-semibold text-stone-700">Buscar productos
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej: cera de soja, esencia, frasco" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 font-normal text-stone-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
          </label>
          {!lockedCategoryId && <label className="text-sm font-semibold text-stone-700">Categoría
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-normal text-stone-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100">
              <option value="">Todas las categorías</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>}
        </div>
        <p className="mt-6 text-sm text-stone-600">{filteredListings.length} producto{filteredListings.length === 1 ? '' : 's'} disponible{filteredListings.length === 1 ? '' : 's'}</p>
        {filteredListings.length > 0 ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredListings.map((listing) => <PublicProductCard key={listing.product.id} listing={listing} />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-600">No encontramos productos con esos filtros.</div>}
      </section>
    </main>
  );
}
