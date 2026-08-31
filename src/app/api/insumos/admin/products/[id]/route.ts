import { NextRequest, NextResponse } from 'next/server';
import { deleteProduct, updateProduct } from '@/features/catalog/server/mutations';
import { requireCatalogManager } from '@/features/auth/server/authorization';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  try {
    await requireCatalogManager();
    const { id } = await params;
    const { data, error } = await (await createInsumosSupabaseServer()).from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Producto no encontrado.' }, { status: 404 });
    return NextResponse.json({ product: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json({ product: await updateProduct(id, await request.json()) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await deleteProduct(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
