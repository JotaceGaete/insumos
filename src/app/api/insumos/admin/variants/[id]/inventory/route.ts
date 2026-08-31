import { NextRequest, NextResponse } from 'next/server';
import { recordInventoryMovement } from '@/features/catalog/server/mutations';

type Context = { params: Promise<{ id: string }> };

// record_inventory_movement raises these in English from PL/pgSQL; map the
// ones a real admin can hit through this form to a message worth showing.
const KNOWN_MESSAGES: Record<string, string> = {
  'Not authorized to update inventory': 'No tienes autorización para modificar el inventario.',
  'Insufficient stock': 'Stock insuficiente para este movimiento.',
  'Variant not found': 'La variante no existe.',
  'Inventory movement quantity cannot be zero': 'La cantidad del movimiento no puede ser cero.',
};

function toClientMessage(error: unknown): string {
  // Postgrest RPC errors reach here as a plain {code, message, details, hint}
  // object, not an Error instance, even though their .d.ts claims otherwise —
  // so both shapes are checked instead of relying on `instanceof Error`.
  const raw = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
      ? (error as { message: string }).message
      : null;
  if (!raw) return 'Error interno.';
  return KNOWN_MESSAGES[raw] || raw;
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    const movement = await recordInventoryMovement(id, body.quantityDelta, body.movementType, body.referenceType, body.referenceId, body.note);
    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: toClientMessage(error) }, { status: 400 });
  }
}
