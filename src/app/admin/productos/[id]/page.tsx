import { ProductEditor } from '@/features/admin/components/ProductEditor';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditor productId={id} />;
}
