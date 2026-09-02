import { NextRequest, NextResponse } from 'next/server';
import { getCustomerById, listCustomerOrders } from '@/features/customers/server/queries';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

// Read-only by design — GET only, no mutations. Combines the profile and
// the full order history into one response since the detail page always
// needs both at once; auth is enforced inside each query function itself.
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const [customer, orders] = await Promise.all([
      getCustomerById(id),
      listCustomerOrders(id),
    ]);
    if (!customer) return NextResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 });
    return NextResponse.json({ customer, orders });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}
