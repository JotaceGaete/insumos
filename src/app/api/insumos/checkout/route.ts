import { NextRequest, NextResponse } from 'next/server';
import { assertValidCheckoutPayload } from '@/features/checkout/validation';
import { createPendingOrder, reserveOrderInventory, releaseOrderPaymentReservation } from '@/features/checkout/server/mutations';
import { getOrderEmailData } from '@/features/email/orderEmailData';
import { renderOrderReceivedEmail } from '@/features/email/templates/OrderReceivedEmail';
import { sendTransactionalEmail } from '@/features/email/sendTransactionalEmail';
import { getEmailFrom } from '@/features/email/provider';
import { createPaymentPreference } from '@/features/payments/createPaymentPreference';

export const runtime = 'nodejs';

function toClientMessage(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
      ? (error as { message: string }).message
      : null;
  return raw || 'No pudimos crear tu pedido. Intenta nuevamente.';
}

// Fires the "Pedido recibido" email for an order that is already committed.
// Deliberately swallows every possible failure (data fetch, template,
// provider, DB write) — sendTransactionalEmail already never throws, but
// this wrapper is the hard guarantee that a checkout response can never be
// downgraded by an email problem, no matter what changes here later.
async function notifyOrderReceived(orderId: string): Promise<void> {
  try {
    const data = await getOrderEmailData(orderId);
    if (!data) return;
    const { subject, html, text } = renderOrderReceivedEmail(data);
    await sendTransactionalEmail({
      eventType: 'order_received',
      orderId,
      message: {
        from: getEmailFrom(),
        to: { email: data.customerEmail, name: data.customerName },
        subject,
        html,
        text,
        metadata: { eventType: 'order_received', orderId },
      },
    });
  } catch (error) {
    console.error('[email] notifyOrderReceived failed', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = assertValidCheckoutPayload(body);
    const confirmation = await createPendingOrder(payload);

    // The order is already committed at this point — an email failure past
    // this line must never change the response status or body.
    await notifyOrderReceived(confirmation.orderId);

    // If this throws (stock changed, order already paid/cancelled, etc.),
    // it falls straight into the catch below: the order stays created, no
    // reservation exists, no preference is attempted, no stock is touched.
    const reservation = await reserveOrderInventory(confirmation.orderId, confirmation.confirmationToken);
    const reservationExpiresAt = reservation[0]?.expiresAt ?? null;

    const preference = await createPaymentPreference({
      orderId: confirmation.orderId,
      confirmationToken: confirmation.confirmationToken,
      reservationExpiresAt,
    });

    if (preference.status === 'failed') {
      // The reservation already succeeded, so — unlike a reservation
      // failure — it must be explicitly released rather than left dangling.
      // release_order_payment_reservation both releases the reservation and
      // reverts status from awaiting_payment back to pending (only when
      // payment_status is still pending), so the order stays a real,
      // retryable order instead of getting stuck "awaiting payment" with no
      // active reservation behind it. No stock or inventory_movements
      // change either way.
      await releaseOrderPaymentReservation(confirmation.orderId, confirmation.confirmationToken, 'Fallo al crear preferencia de pago');
      return NextResponse.json({
        orderId: confirmation.orderId,
        confirmationToken: confirmation.confirmationToken,
        message: preference.error || 'No pudimos iniciar el pago. Intenta nuevamente.',
      }, { status: 502 });
    }

    return NextResponse.json({
      orderId: confirmation.orderId,
      confirmationToken: confirmation.confirmationToken,
      subtotal: confirmation.subtotal,
      total: confirmation.total,
      shippingPolicy: confirmation.shippingPolicy,
      paymentUrl: preference.paymentUrl,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: toClientMessage(error) }, { status: 400 });
  }
}
