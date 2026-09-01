import 'server-only';
import { createInsumosSupabaseAdmin } from '@/features/shared/server/supabase';
import { getPaymentProvider, getConfiguredPaymentProviderName, getSiteUrl } from './provider';
import type { PaymentPreferenceRequest } from './types';

export interface CreatePaymentPreferenceInput {
  orderId: string;
  confirmationToken: string;
  // From reserve_order_inventory's own return value — never recomputed
  // here, so this module never duplicates reservation logic.
  reservationExpiresAt: string | null;
}

export type CreatePaymentPreferenceStatus = 'created' | 'reused' | 'failed';

export interface CreatePaymentPreferenceResult {
  status: CreatePaymentPreferenceStatus;
  paymentUrl?: string;
  providerPreferenceId?: string;
  error?: string;
}

type OrderRow = {
  id: string;
  status: string;
  total: number;
  customer_email: string;
  customer_name: string;
  confirmation_token: string | null;
  payment_provider: string | null;
  payment_provider_preference_id: string | null;
  payment_checkout_url: string | null;
};

type OrderItemRow = {
  variant_id: string;
  product_name: string;
  variant_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

/**
 * Creates (or reuses) a payment preference for an order that has already
 * been created and reserved. Never throws — every failure resolves to
 * { status: 'failed', error }, so the caller decides what to do (release
 * the reservation, respond to the client) instead of catching an exception.
 *
 * The amount and items are read fresh from orders/order_items every call —
 * never from any caller-supplied payload — so nothing client-controlled can
 * influence what Mercado Pago charges.
 */
export async function createPaymentPreference(input: CreatePaymentPreferenceInput): Promise<CreatePaymentPreferenceResult> {
  const admin = createInsumosSupabaseAdmin();

  const { data: orderRow, error: orderError } = await admin
    .from('orders')
    .select('id, status, total, customer_email, customer_name, confirmation_token, payment_provider, payment_provider_preference_id, payment_checkout_url')
    .eq('id', input.orderId)
    .maybeSingle();
  if (orderError || !orderRow) {
    return { status: 'failed', error: 'Pedido no encontrado.' };
  }
  const order = orderRow as OrderRow;
  if (order.confirmation_token !== input.confirmationToken) {
    return { status: 'failed', error: 'Pedido no encontrado.' };
  }
  if (order.status !== 'awaiting_payment') {
    return { status: 'failed', error: 'El pedido no está listo para pago.' };
  }
  if (!(order.total > 0) || !Number.isInteger(order.total)) {
    return { status: 'failed', error: 'El total del pedido no es válido.' };
  }

  const providerName = getConfiguredPaymentProviderName();

  // Idempotency: while the order stays 'awaiting_payment' under the same
  // provider, a persisted preference is reused as-is instead of creating a
  // new one on every refresh/double-click. This is safe without separately
  // re-checking reservation freshness here: reserve_order_inventory (always
  // called by the checkout route immediately before this function) never
  // extends an existing hold, and expire_inventory_reservations flips the
  // order to 'cancelled' the moment its reservation lapses — so
  // status === 'awaiting_payment' already IS the up-to-date signal that the
  // inventory hold backing this preference is still legitimate.
  if (order.payment_provider === providerName && order.payment_provider_preference_id && order.payment_checkout_url) {
    return { status: 'reused', paymentUrl: order.payment_checkout_url, providerPreferenceId: order.payment_provider_preference_id };
  }

  const { data: itemRows, error: itemsError } = await admin
    .from('order_items')
    .select('variant_id, product_name, variant_name, unit_price, quantity, line_total')
    .eq('order_id', input.orderId)
    .order('created_at');
  if (itemsError || !itemRows || itemRows.length === 0) {
    return { status: 'failed', error: 'El pedido no tiene productos.' };
  }
  const rows = itemRows as OrderItemRow[];

  const itemsSum = rows.reduce((sum, row) => sum + row.line_total, 0);
  if (itemsSum !== order.total) {
    return { status: 'failed', error: 'Inconsistencia en el total del pedido.' };
  }

  const siteUrl = getSiteUrl();
  const returnUrl = `${siteUrl}/pago/retorno?order_id=${order.id}`;

  const request: PaymentPreferenceRequest = {
    orderId: order.id,
    externalReference: order.id,
    items: rows.map((row) => ({
      id: row.variant_id,
      title: `${row.product_name} — ${row.variant_name}`,
      quantity: row.quantity,
      unitPrice: row.unit_price,
    })),
    totalAmount: order.total,
    currency: 'CLP',
    payerEmail: order.customer_email,
    payerName: order.customer_name,
    backUrls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
    expiresAt: input.reservationExpiresAt,
  };

  const provider = getPaymentProvider();
  const result = await provider.createPreference(request);

  if (result.status !== 'created' || !result.checkoutUrl || !result.providerPreferenceId) {
    return { status: 'failed', error: result.error || 'No se pudo crear la preferencia de pago.' };
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      payment_provider: providerName,
      payment_provider_preference_id: result.providerPreferenceId,
      payment_checkout_url: result.checkoutUrl,
      payment_created_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (updateError) {
    console.error('[payments] failed to persist preference', updateError);
    return { status: 'failed', error: 'No se pudo registrar la preferencia de pago.' };
  }

  return { status: 'created', paymentUrl: result.checkoutUrl, providerPreferenceId: result.providerPreferenceId };
}
