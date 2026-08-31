import { PublicCatalogPage } from '@/features/catalog/components/PublicCatalogPage';
import { listCatalogProductListings } from '@/features/catalog/server/queries';

type ProductosPageProps = { searchParams: Promise<{ q?: string }> };

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  const [listings, { q }] = await Promise.all([listCatalogProductListings(), searchParams]);

  return <PublicCatalogPage listings={listings} initialSearch={q || ''} />;
}
