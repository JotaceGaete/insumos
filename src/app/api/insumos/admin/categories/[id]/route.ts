import { NextRequest, NextResponse } from 'next/server';
import { deleteCategory, updateCategory } from '@/features/catalog/server/mutations';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json({ category: await updateCategory(id, {
      name: body.name,
      slug: body.slug,
      parentId: body.parent_id,
      description: body.description,
      isActive: body.is_active,
      sortOrder: body.sort_order,
    }) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await deleteCategory(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
