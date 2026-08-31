import { NextRequest, NextResponse } from 'next/server';
import { createProductMedia, deleteProductMedia, listAdminProductMedia, updateProductMedia } from '@/features/catalog/server/mediaMutations';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json({ media: await listAdminProductMedia(id) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 403 });
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json({ media: await createProductMedia({ productId: id, storagePath: body.storage_path, altText: body.alt_text, sortOrder: body.sort_order, isPrimary: body.is_primary }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json({ media: await updateProductMedia(id, body.media_id, { isPrimary: body.is_primary, sortOrder: body.sort_order, altText: body.alt_text }) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    await deleteProductMedia(id, body.media_id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
