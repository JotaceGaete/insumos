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
    return NextResponse.json({ category: await createCategory(await request.json()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
