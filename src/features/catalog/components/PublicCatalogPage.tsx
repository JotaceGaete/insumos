'use client';

import { useDeferredValue, useState } from 'react';
import { Search } from 'lucide-react';
import type { CatalogProductListing } from '@/features/catalog/server/queries';
import { ProductCard } from './ProductCard';

function listingMatchesSearch(listing: CatalogProductListing, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-CL');
  if (!normalizedSearch) return true;
  return [listing.product.name, listing.product.shortDescription, listing.product.description, listing.category?.name, ...listing.variants.map((variant) => variant.name), ...listing.variants.map((variant) => variant.optionValue)]
    .some((value) => value?.toLocaleLowerCase('es-CL').includes(normalizedSearch));
}

type PublicCatalogPageProps = {
  listings: CatalogProductListing[];
  title?: string;
  description?: string | null;
  lockedCategoryId?: string;
  initialSearch?: string;
};

export function PublicCatalogPage({
  listings,
  title = 'Materias primas para crear',
  description = 'Explora formatos, precios y disponibilidad para tu producción.',
  lockedCategoryId,
  initialSearch = '',
}: PublicCatalogPageProps) {
  const [search, setSearch] = useState(initialSearch);
  const [categoryId, setCategoryId] = useState('');
  const deferredSearch = useDeferredValue(search);
  const categories = Array.from(new Map(listings.flatMap((listing) => listing.category ? [[listing.category.id, listing.category]] : [])).values())
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const effectiveCategoryId = lockedCategoryId || categoryId;
  const filteredListings = listings.filter((listing) => (!effectiveCategoryId || listing.category?.id === effectiveCategoryId) && listingMatchesSearch(listing, deferredSearch));

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-insumos-sage">Catálogo de insumos</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-insumos-ink sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 text-base text-stone-600 sm:text-lg">{description}</p>}
        </div>

        <div className="mt-8 grid gap-3 rounded-2xl border border-insumos-line bg-white p-4 sm:grid-cols-[1fr_240px]">
          <label className="text-sm font-semibold text-insumos-ink">
            Buscar productos
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-insumos-line px-3 py-2.5 focus-within:border-insumos-forest focus-within:ring-2 focus-within:ring-insumos-mint">
              <Search className="h-4 w-4 flex-shrink-0 text-insumos-sage" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej: cera de soja, esencia, frasco"
                className="w-full font-normal text-insumos-ink outline-none"
              />
            </div>
          </label>
          {!lockedCategoryId && (
            <label className="text-sm font-semibold text-insumos-ink">
              Categoría
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-insumos-line bg-white px-3 py-2.5 font-normal text-insumos-ink outline-none transition focus:border-insumos-forest focus:ring-2 focus:ring-insumos-mint"
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <p className="mt-6 text-sm text-stone-600">{filteredListings.length} producto{filteredListings.length === 1 ? '' : 's'} disponible{filteredListings.length === 1 ? '' : 's'}</p>

        {filteredListings.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredListings.map((listing) => <ProductCard key={listing.product.id} listing={listing} />)}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-insumos-line bg-white px-6 py-12 text-center text-stone-600">
            No encontramos productos con esos filtros.
          </div>
        )}
      </section>
    </div>
  );
}
