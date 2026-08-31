import { NextRequest, NextResponse } from 'next/server';
import { assertValidCheckoutPayload } from '@/features/checkout/validation';
import { createPendingOrder } from '@/features/checkout/server/mutations';

export const runtime = 'nodejs';

function toClientMessage(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
      ? (error as { message: string }).message
      : null;
  return raw || 'No pudimos crear tu pedido. Intenta nuevamente.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = assertValidCheckoutPayload(body);
    const confirmation = await createPendingOrder(payload);
    return NextResponse.json({
      orderId: confirmation.orderId,
      confirmationToken: confirmation.confirmationToken,
      subtotal: confirmation.subtotal,
      total: confirmation.total,
      shippingPolicy: confirmation.shippingPolicy,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: toClientMessage(error) }, { status: 400 });
  }
}
