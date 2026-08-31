import { NextRequest, NextResponse } from 'next/server';
import { createCategory } from '@/features/catalog/server/mutations';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import { requireCatalogManager } from '@/features/auth/server/authorization';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireCatalogManager();
    const { data, error } = await (await createInsumosSupabaseServer()).from('categories').select('*').order('sort_order').order('name');
    if (error) throw error;
    return NextResponse.json({ categories: data || [] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ category: await createCategory({
      name: body.name,
      slug: body.slug,
      parentId: body.parent_id,
      description: body.description,
      isActive: body.is_active,
      sortOrder: body.sort_order,
    }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
