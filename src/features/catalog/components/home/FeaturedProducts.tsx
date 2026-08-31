import Link from 'next/link';
import type { CatalogProductListing } from '@/features/catalog/server/queries';
import { ProductCard } from '../ProductCard';

export function FeaturedProducts({ listings }: { listings: CatalogProductListing[] }) {
  const featured = listings.filter((listing) => listing.product.isFeatured);
  const shown = (featured.length > 0 ? featured : listings).slice(0, 8);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8 lg:pb-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-bold text-insumos-ink sm:text-xl">Productos destacados</h2>
          {shown.length > 0 && (
            <Link href="/productos" className="hidden text-sm font-semibold text-insumos-forest hover:underline sm:inline-block">
              Ver todos los productos →
            </Link>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-insumos-line bg-insumos-cream p-10 text-center text-stone-600">
            Aún no hay productos publicados.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((listing) => (
              <ProductCard key={listing.product.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
