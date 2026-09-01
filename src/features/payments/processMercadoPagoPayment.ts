import 'server-only';
import { createInsumosSupabaseAdmin } from '@/features/shared/server/supabase';
import { getMercadoPagoPayment } from './getMercadoPagoPayment';
import { getConfiguredPaymentProviderName } from './provider';

export type ProcessMercadoPagoPaymentStatus = 'confirmed' | 'ignored' | 'rejected' | 'error';

export interface ProcessMercadoPagoPaymentOutcome {
  status: ProcessMercadoPagoPaymentStatus;
  reason: string;
  orderId?: string;
  alreadyConfirmed?: boolean;
}

/**
 * The authoritative core of the webhook: given a payment id (already
 * extracted from an authenticated notification — signature verification is
 * the route/verifyMercadoPagoWebhook's job, not this function's), fetches
 * the REAL payment server-side and decides whether to confirm the order.
 *
 * Never trusts anything about amount/status/external_reference/currency
 * from the webhook body itself — only from this server-side lookup. Never
 * throws: every outcome (including unexpected errors) resolves to a result
 * object, so the route can always map it to a controlled HTTP response
 * instead of leaking a stack trace to Mercado Pago's retry logic.
 *
 * 'ignored' vs 'rejected': 'ignored' means there was nothing wrong, just
 * nothing to do (payment not found, or a legitimate non-approved status
 * like pending/rejected). 'rejected' means the payment WAS approved but
 * failed a business/security validation this system requires before ever
 * confirming an order (amount mismatch, currency mismatch, missing/invalid
 * external_reference, provider mismatch, expired reservation, payment_id
 * already claimed by another order). Both map to HTTP 200 at the route —
 * Mercado Pago's own guidance is to acknowledge and not retry once a
 * decision has been made — but the distinction matters for logs/tests.
 */
export async function processMercadoPagoPayment(paymentId: string): Promise<ProcessMercadoPagoPaymentOutcome> {
  let payment;
  try {
    payment = await getMercadoPagoPayment(paymentId);
  } catch (error) {
    console.error('[payments] processMercadoPagoPayment: getMercadoPagoPayment threw', error);
    return { status: 'error', reason: 'Error inesperado al consultar el pago.' };
  }

  if (!payment) {
    return { status: 'ignored', reason: 'Payment no encontrado.' };
  }

  if (payment.status !== 'approved') {
    return { status: 'ignored', reason: `status "${payment.status}" no requiere confirmación.` };
  }

  if (!payment.externalReference) {
    return { status: 'rejected', reason: 'Payment aprobado sin external_reference.' };
  }

  const admin = createInsumosSupabaseAdmin();

  const { data: orderRow, error: orderError } = await admin
    .from('orders')
    .select('id, total, payment_provider')
    .eq('id', payment.externalReference)
    .maybeSingle();
  if (orderError || !orderRow) {
    return { status: 'rejected', reason: 'external_reference no corresponde a un pedido válido.' };
  }
  const order = orderRow as { id: string; total: number; payment_provider: string | null };

  // Cross-check that this payment's own preference was created under the
  // same provider currently configured — guards against a mock-mode
  // notification confirming an order whose preference came from the real
  // provider, or vice versa. This is independent of, and does not replace,
  // amount/currency/external_reference validation below.
  const configuredProvider = getConfiguredPaymentProviderName();
  if (order.payment_provider !== configuredProvider) {
    return { status: 'rejected', reason: `El pedido fue creado con provider "${order.payment_provider}", no coincide con el provider configurado.` };
  }

  if (payment.currencyId !== 'CLP') {
    return { status: 'rejected', reason: `currency_id "${payment.currencyId}" inválido, se esperaba CLP.` };
  }

  if (!(order.total > 0) || !Number.isInteger(order.total)) {
    return { status: 'rejected', reason: 'orders.total no es válido.' };
  }

  if (!Number.isInteger(payment.transactionAmount) || payment.transactionAmount !== order.total) {
    return { status: 'rejected', reason: `transaction_amount (${payment.transactionAmount}) no coincide con orders.total (${order.total}).` };
  }

  // preference_id correlation (payment.preference_id vs
  // orders.payment_provider_preference_id) is deliberately NOT checked:
  // the real mercadopago SDK's PaymentResponse type has no preference_id
  // field at all (verified against the installed mercadopago@2.10.0 type
  // definitions — only a bare order.id, which is Mercado Pago's *merchant
  // order* id, a different concept). Inventing a check against an
  // undocumented/unreliable field would be worse than not checking it.
  // external_reference — a real, typed, documented field — is the sole
  // correlation mechanism here.

  try {
    const { data: confirmData, error: confirmError } = await admin.rpc('confirm_order_payment_reference', {
      p_order_id: order.id,
      p_payment_reference: String(payment.id),
    });
    if (confirmError) {
      console.error('[payments] confirm_order_payment_reference failed', confirmError);
      return { status: 'rejected', reason: confirmError.message || 'No se pudo confirmar el pedido.' };
    }
    const row = Array.isArray(confirmData) ? confirmData[0] : confirmData;
    if (!row) {
      return { status: 'error', reason: 'confirm_order_payment_reference no devolvió resultado.' };
    }
    return { status: 'confirmed', reason: 'Pedido confirmado.', orderId: row.order_id, alreadyConfirmed: row.already_confirmed };
  } catch (error) {
    console.error('[payments] processMercadoPagoPayment: unexpected error confirming order', error);
    return { status: 'error', reason: 'Error inesperado al confirmar el pedido.' };
  }
}
