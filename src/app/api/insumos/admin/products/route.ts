import { NextRequest, NextResponse } from 'next/server';
import { createProduct } from '@/features/catalog/server/mutations';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import { requireCatalogManager } from '@/features/auth/server/authorization';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireCatalogManager();
    const { data, error } = await (await createInsumosSupabaseServer()).from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ products: data || [] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ product: await createProduct(await request.json()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
