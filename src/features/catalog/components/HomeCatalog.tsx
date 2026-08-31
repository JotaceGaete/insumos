import Link from 'next/link';
import type { CatalogProductListing } from '@/features/catalog/server/queries';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(price);
}

function getMediaUrl(storagePath: string | undefined) {
  if (!storagePath) return null;
  return storagePath.startsWith('https://') || storagePath.startsWith('http://') || storagePath.startsWith('/')
    ? storagePath
    : null;
}

function ProductCard({ listing }: { listing: CatalogProductListing }) {
  const { product, category, variants, media } = listing;
  const lowestPrice = variants.reduce<number | null>(
    (lowest, variant) => lowest === null || variant.retailPrice < lowest ? variant.retailPrice : lowest,
    null,
  );
  const inStock = variants.some((variant) => variant.stockQuantity > 0);
  const primaryMedia = media.find((item) => item.isPrimary) || media[0];
  const imageUrl = getMediaUrl(primaryMedia?.storagePath);

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-stone-100">
        {imageUrl ? (
          // Product media may be an absolute public URL or an already-resolved local path.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={primaryMedia?.altText || product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 text-sm font-medium text-stone-500">
            Imagen del producto
          </div>
        )}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${inStock ? 'bg-emerald-700 text-white' : 'bg-stone-700 text-white'}`}>
          {inStock ? 'Disponible' : 'Sin stock'}
        </span>
      </div>
      <div className="p-5">
        {category && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{category.name}</p>}
        <h2 className="mt-2 text-lg font-bold text-stone-900">{product.name}</h2>
        {product.shortDescription && <p className="mt-2 line-clamp-2 text-sm text-stone-600">{product.shortDescription}</p>}
        <p className="mt-4 text-xl font-bold text-stone-900">
          {lowestPrice === null ? 'Sin formatos disponibles' : `Desde ${formatPrice(lowestPrice)}`}
        </p>
        {variants.length > 1 && <p className="mt-1 text-sm text-stone-500">{variants.length} formatos disponibles</p>}
        <Link href={`/productos/${product.slug}`} className="mt-5 inline-flex rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700">
          Ver opciones
        </Link>
      </div>
    </article>
  );
}

export function HomeCatalog({ listings }: { listings: CatalogProductListing[] }) {
  const featured = listings.filter((listing) => listing.product.isFeatured);
  const shown = featured.length > 0 ? featured : listings;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Insumos para crear</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">Materias primas para tus ideas</h1>
        <p className="mt-4 text-lg text-stone-600">Encuentra insumos para velas, jabones, perfumería y packaging. Elige el formato que mejor se adapte a tu producción.</p>
      </div>

      {shown.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-600">
          Aún no hay productos publicados.
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((listing) => <ProductCard key={listing.product.id} listing={listing} />)}
        </div>
      )}
    </section>
  );
}
