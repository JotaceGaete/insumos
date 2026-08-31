import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { CatalogProductListing } from '@/features/catalog/server/queries';
import { getProductMediaPublicUrl } from '@/features/catalog/productMedia';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Compact product card shared by the homepage, /productos and /categoria/[slug]
 * so the grid density and visual language stay identical across all three.
 */
export function ProductCard({ listing }: { listing: CatalogProductListing }) {
  const { product, category, variants, media } = listing;
  const lowestPrice = variants.reduce<number | null>(
    (lowest, variant) => (lowest === null || variant.retailPrice < lowest ? variant.retailPrice : lowest),
    null,
  );
  const hasStock = variants.some((variant) => variant.availableStock > 0);
  const primaryMedia = media.find((item) => item.isPrimary) || media[0];
  const imageUrl = primaryMedia ? getProductMediaPublicUrl(primaryMedia.storagePath) : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-insumos-line bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-insumos-cream">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={primaryMedia?.altText || product.name} className="absolute inset-0 h-full w-full object-contain p-3" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-insumos-sage">
            Imagen del producto
          </div>
        )}
        {!hasStock && (
          <span className="absolute left-3 top-3 rounded-full bg-insumos-ink/85 px-2.5 py-1 text-xs font-semibold text-white">
            Sin stock
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {category && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-insumos-sage">{category.name}</p>
        )}
        <h3 className="mt-1.5 line-clamp-1 text-base font-bold text-insumos-ink">{product.name}</h3>
        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-sm text-stone-600">{product.shortDescription}</p>
        )}
        <div className="mt-3 flex flex-1 items-end justify-between gap-3">
          <p className="text-base font-bold text-insumos-forest">
            {lowestPrice === null ? 'Sin formatos' : `Desde ${formatPrice(lowestPrice)}`}
          </p>
        </div>
        <Link
          href={`/producto/${product.slug}`}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-insumos-forest px-4 py-2 text-sm font-semibold text-insumos-forest transition-colors hover:bg-insumos-forest hover:text-white"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden />
          Ver opciones
        </Link>
      </div>
    </article>
  );
}
