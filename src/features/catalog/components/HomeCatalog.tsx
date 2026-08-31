import type { CatalogCategoryWithCount, CatalogProductListing } from '@/features/catalog/server/queries';
import { Hero } from './home/Hero';
import { CategoryGrid } from './home/CategoryGrid';
import { FeaturedProducts } from './home/FeaturedProducts';
import { TrustStrip } from './home/TrustStrip';

export function HomeCatalog({
  listings,
  categories,
}: {
  listings: CatalogProductListing[];
  categories: CatalogCategoryWithCount[];
}) {
  return (
    <div className="bg-white">
      <Hero />
      <CategoryGrid categories={categories} />
      <FeaturedProducts listings={listings} />
      <TrustStrip />
    </div>
  );
}
