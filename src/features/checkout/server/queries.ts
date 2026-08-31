import 'server-only';
import { createInsumosSupabaseAdmin } from '@/features/shared/server/supabase';
import type { OrderConfirmationDetail, OrderConfirmationLine } from '../types';

type OrderRow = {
  id: string; customer_name: string; customer_email: string; customer_phone: string | null;
  status: string; payment_status: string; subtotal: number; shipping_total: number;
  discount_total: number; total: number; shipping_address: Record<string, unknown> | null;
  notes: string | null; created_at: string;
};

type OrderItemRow = {
  product_id: string; variant_id: string; product_name: string; variant_name: string;
  sku: string; unit_price: number; quantity: number; line_total: number;
};

/**
 * Guest orders have customer_id = null, so the "customers read own orders"
 * RLS policy can never match them — by design, order confirmation reads go
 * through the service-role client instead, gated entirely by matching BOTH
 * the order id and its random confirmation_token. Knowing the id alone
 * (e.g. by guessing or enumerating) is not enough to see anyone's order.
 */
// This gates a page carrying personal data (name, email, address), so a
// lookup failure of any kind — wrong token, a transient DB error, a schema
// mismatch — must fail to "not found" rather than surface a stack trace.
// Genuine problems still go to the server log; the visitor only ever sees
// the same 404 as a made-up order id.
export async function getOrderConfirmation(orderId: string, token: string): Promise<OrderConfirmationDetail | null> {
  if (!orderId || !token) return null;
  try {
    return await fetchOrderConfirmation(orderId, token);
  } catch (error) {
    console.error('getOrderConfirmation failed', error);
    return null;
  }
}

async function fetchOrderConfirmation(orderId: string, token: string): Promise<OrderConfirmationDetail | null> {
  const admin = createInsumosSupabaseAdmin();

  const { data: orderRow, error: orderError } = await admin
    .from('orders')
    .select('id, customer_name, customer_email, customer_phone, status, payment_status, subtotal, shipping_total, discount_total, total, shipping_address, notes, created_at')
    .eq('id', orderId)
    .eq('confirmation_token', token)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!orderRow) return null;

  const { data: itemRows, error: itemsError } = await admin
    .from('order_items')
    .select('product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total')
    .eq('order_id', orderId)
    .order('created_at');
  if (itemsError) throw itemsError;

  const order = orderRow as OrderRow;
  return {
    id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotal: order.subtotal,
    shippingTotal: order.shipping_total,
    discountTotal: order.discount_total,
    total: order.total,
    shippingAddress: (order.shipping_address as unknown as OrderConfirmationDetail['shippingAddress']) || null,
    notes: order.notes,
    createdAt: order.created_at,
    items: ((itemRows || []) as OrderItemRow[]).map((row): OrderConfirmationLine => ({
      productId: row.product_id,
      variantId: row.variant_id,
      productName: row.product_name,
      variantName: row.variant_name,
      sku: row.sku,
      unitPrice: row.unit_price,
      quantity: row.quantity,
      lineTotal: row.line_total,
    })),
  };
}
