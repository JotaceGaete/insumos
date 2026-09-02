import { CustomerProfile } from '@/features/admin/components/CustomerProfile';

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerProfile customerId={id} />;
}
