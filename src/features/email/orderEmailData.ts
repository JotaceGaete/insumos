import 'server-only';
import { createInsumosSupabaseAdmin } from '@/features/shared/server/supabase';
import type { BillingDocumentType, DeliveryMethod, PreferredCarrier, ShippingPolicy } from '@/features/checkout/shipping';

export interface OrderEmailLine {
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Everything a transactional email template needs, built exclusively from
 * what create_pending_order already persisted (orders/order_items) — never
 * from localStorage or the original checkout request body. Deliberately
 * excludes billing_data (RUT, razón social, giro): the email only ever
 * shows the document *type* (boleta/factura), matching what the
 * confirmation page already does.
 */
export interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  items: OrderEmailLine[];
  subtotal: number;
  shippingTotal: number;
  total: number;
  deliveryMethod: DeliveryMethod;
  shippingPolicy: ShippingPolicy;
  preferredCarrier: PreferredCarrier | null;
  billingDocumentType: BillingDocumentType;
}

type OrderRow = {
  id: string; customer_name: string; customer_email: string; created_at: string;
  subtotal: number; shipping_total: number; total: number;
  delivery_method: string; shipping_policy: string; preferred_carrier: string | null;
  billing_document_type: string;
};

type OrderItemRow = {
  product_name: string; variant_name: string; quantity: number; unit_price: number; line_total: number;
};

export async function getOrderEmailData(orderId: string): Promise<OrderEmailData | null> {
  if (!orderId) return null;
  try {
    const admin = createInsumosSupabaseAdmin();

    const { data: orderRow, error: orderError } = await admin
      .from('orders')
      .select('id, customer_name, customer_email, created_at, subtotal, shipping_total, total, delivery_method, shipping_policy, preferred_carrier, billing_document_type')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError || !orderRow) return null;

    const { data: itemRows, error: itemsError } = await admin
      .from('order_items')
      .select('product_name, variant_name, quantity, unit_price, line_total')
      .eq('order_id', orderId)
      .order('created_at');
    if (itemsError) return null;

    const order = orderRow as OrderRow;
    return {
      orderId: order.id,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      createdAt: order.created_at,
      subtotal: order.subtotal,
      shippingTotal: order.shipping_total,
      total: order.total,
      deliveryMethod: order.delivery_method as DeliveryMethod,
      shippingPolicy: order.shipping_policy as ShippingPolicy,
      preferredCarrier: order.preferred_carrier as PreferredCarrier | null,
      billingDocumentType: order.billing_document_type as BillingDocumentType,
      items: ((itemRows || []) as OrderItemRow[]).map((row) => ({
        productName: row.product_name,
        variantName: row.variant_name,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
      })),
    };
  } catch (error) {
    console.error('[email] getOrderEmailData failed', error);
    return null;
  }
}
