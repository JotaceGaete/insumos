import { PublicCatalogPage } from '@/features/catalog/components/PublicCatalogPage';
import { listCatalogProductListings } from '@/features/catalog/server/queries';

export default async function ProductosPage() {
  const listings = await listCatalogProductListings();

  return <PublicCatalogPage listings={listings} />;
}
