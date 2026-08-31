import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/features/catalog/components/ProductDetail';
import { getCatalogProductListing } from '@/features/catalog/server/queries';

type ProductPageProps = { params: Promise<{ slug: string }> };

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const listing = await getCatalogProductListing(slug);
  if (!listing) notFound();
  return <ProductDetail listing={listing} />;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getCatalogProductListing(slug);
  if (!listing) return { title: 'Producto no encontrado' };
  return {
    title: listing.product.seoTitle || listing.product.name,
    description: listing.product.seoDescription || listing.product.shortDescription || undefined,
  };
}
