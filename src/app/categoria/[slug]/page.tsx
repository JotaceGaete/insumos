import { notFound } from 'next/navigation';
import { PublicCatalogPage } from '@/features/catalog/components/PublicCatalogPage';
import { getCatalogCategory, listCatalogProductListings } from '@/features/catalog/server/queries';

type CategoryPageProps = { params: Promise<{ slug: string }> };

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [category, listings] = await Promise.all([getCatalogCategory(slug), listCatalogProductListings()]);
  if (!category) notFound();
  return <PublicCatalogPage listings={listings} title={category.name} description={category.description || 'Explora los insumos disponibles en esta categoría.'} lockedCategoryId={category.id} />;
}
