import { NextRequest, NextResponse } from 'next/server';
import { createVariant } from '@/features/catalog/server/mutations';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import { requireCatalogManager } from '@/features/auth/server/authorization';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  try {
    await requireCatalogManager();
    const { id } = await params;
    const { data, error } = await (await createInsumosSupabaseServer()).from('product_variants').select('*').eq('product_id', id).order('sort_order');
    if (error) throw error;
    return NextResponse.json({ variants: data || [] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json({ variant: await createVariant({ ...(await request.json()), productId: id }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
