import { NextRequest, NextResponse } from 'next/server';
import { listCustomers } from '@/features/customers/server/queries';

export const runtime = 'nodejs';

// Read-only by design (Etapa 4 is UI-only) — this route has no POST/PATCH/
// DELETE. Auth is enforced inside listCustomers() itself (requireCustomerManager),
// not duplicated here.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const result = await listCustomers({
      search,
      page: pageParam ? Number(pageParam) : undefined,
      pageSize: pageSizeParam ? Number(pageSizeParam) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}
