import 'server-only';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import type { CheckoutPayload, CreatedOrderConfirmation, ReservationLine } from '../types';
import type { ShippingPolicy } from '../shipping';

// create_pending_order and reserve_order_inventory raise their own Spanish,
// user-safe messages for the business-rule failures a real buyer can hit
// (stock changed, variant unavailable, missing fields, quantity out of
// range, invalid shipping/billing data, order already paid/cancelled, order
// not found). Only messages matching those known shapes are shown as-is;
// anything else — a Postgrest error (missing function, constraint
// violation, connection issue), a raw column name, whatever — falls back to
// a generic message so internal Supabase details never reach the customer.
const KNOWN_MESSAGE_PATTERNS = [
  /^El carrito está vacío\.$/,
  /^El email es obligatorio\.$/,
  /^El nombre es obligatorio\.$/,
  /^La cantidad debe ser un entero positivo\.$/,
  /^Esta variante ya no está disponible\.$/,
  /^Este producto ya no está disponible\.$/,
  /^La cantidad mínima para .+ es \d+\.$/,
  /^La cantidad máxima para .+ es \d+\.$/,
  /^El stock de .+ cambió\. Hay \d+ unidades disponibles\.$/,
  /^La región o comuna de despacho no es válida\.$/,
  /^Selecciona un transportista válido\.$/,
  /^Selecciona un documento tributario válido\.$/,
  /^Los datos de facturación son incompletos o inválidos\.$/,
  /^Selecciona una forma de entrega válida\.$/,
  /^Ingresa un nombre válido\.$/,
  /^Ingresa un correo electrónico válido\.$/,
  /^Ingresa un celular chileno válido\.$/,
  /^Pedido no encontrado\.$/,
  /^Este pedido ya fue pagado\.$/,
  /^Este pedido fue cancelado\.$/,
  /^El pedido no tiene productos\.$/,
  /^No es posible liberar un pedido ya pagado\.$/,
];

function toClientMessage(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
      ? (error as { message: string }).message
      : null;
  if (raw && KNOWN_MESSAGE_PATTERNS.some((pattern) => pattern.test(raw))) return raw;
  return 'No pudimos crear tu pedido. Intenta nuevamente.';
}

/**
 * Calls the create_pending_order RPC, which is the only writer for
 * orders/order_items: it re-validates every item against the live catalog
 * and creates the order + its lines atomically in one PL/pgSQL transaction.
 * Nothing here — price, stock, product/variant name, shipping_policy — is
 * trusted from the caller; only variantId + quantity, the buyer's own
 * contact/shipping data, carrier preference and billing data are sent.
 */
export async function createPendingOrder(payload: CheckoutPayload): Promise<CreatedOrderConfirmation> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.rpc('create_pending_order', {
    p_items: payload.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    p_customer_email: payload.customer.email,
    p_customer_name: payload.customer.fullName,
    p_customer_phone: payload.customer.phone,
    p_shipping_address: payload.customer.shippingAddress,
    p_notes: payload.customer.deliveryNotes,
    p_preferred_carrier: payload.customer.preferredCarrier,
    p_billing_document_type: payload.customer.billingDocumentType,
    p_billing_data: payload.customer.billingData ?? null,
    p_delivery_method: payload.customer.deliveryMethod,
  });
  if (error) throw new Error(toClientMessage(error));

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('No pudimos crear tu pedido. Intenta nuevamente.');
  return {
    orderId: row.order_id,
    confirmationToken: row.confirmation_token,
    subtotal: row.subtotal,
    total: row.total,
    shippingPolicy: row.shipping_policy as ShippingPolicy,
  };
}

/**
 * Calls reserve_order_inventory — the only writer for inventory_reservations
 * and the pending -> awaiting_payment transition. No reservation logic is
 * duplicated here: this is a thin RPC wrapper, identical in shape to
 * createPendingOrder above. Throws a client-safe message on failure (stock
 * changed, order not found/already paid/cancelled, empty order) — the
 * caller decides what that means for the response (no preference is ever
 * created after this throws).
 */
export async function reserveOrderInventory(orderId: string, confirmationToken: string): Promise<ReservationLine[]> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.rpc('reserve_order_inventory', {
    p_order_id: orderId,
    p_confirmation_token: confirmationToken,
  });
  if (error) throw new Error(toClientMessage(error));

  const rows = (data || []) as Array<{ reservation_id: string; variant_id: string; quantity: number; expires_at: string }>;
  return rows.map((row) => ({
    reservationId: row.reservation_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    expiresAt: row.expires_at,
  }));
}

/**
 * Calls release_order_payment_reservation — used exclusively from the
 * checkout route's payment-preference-failure recovery path. Deliberately
 * never throws: a failure here must not turn an already-handled preference
 * error into an unhandled one. Unlike plain release_order_inventory (which
 * never touches order.status by design, so other future callers — e.g. a
 * "buyer cancelled" flow — keep their own outcome), this RPC also reverts
 * status from 'awaiting_payment' back to 'pending' when payment_status is
 * still 'pending', so a payment-prep failure never leaves an order stuck
 * "awaiting payment" with no active reservation behind it.
 */
export async function releaseOrderPaymentReservation(orderId: string, confirmationToken: string, reason?: string): Promise<void> {
  const supabase = await createInsumosSupabaseServer();
  const { error } = await supabase.rpc('release_order_payment_reservation', {
    p_order_id: orderId,
    p_confirmation_token: confirmationToken,
    p_reason: reason ?? null,
  });
  if (error) console.error('[checkout] release_order_payment_reservation failed', error);
}
