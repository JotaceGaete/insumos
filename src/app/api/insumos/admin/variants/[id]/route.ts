import { NextRequest, NextResponse } from 'next/server';
import { deleteVariant, updateVariant } from '@/features/catalog/server/mutations';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json({ variant: await updateVariant(id, await request.json()) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await deleteVariant(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
