import { NextRequest, NextResponse } from 'next/server';
import { recordInventoryMovement } from '@/features/catalog/server/mutations';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    const movement = await recordInventoryMovement(id, body.quantityDelta, body.movementType, body.referenceType, body.referenceId, body.note);
    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Error interno.' }, { status: 400 });
  }
}
