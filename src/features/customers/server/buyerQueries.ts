import 'server-only';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import type { BillingDocumentType, DeliveryMethod, PreferredCarrier } from '@/features/checkout/shipping';
import type { CustomerCommercialSummary, CustomerOrderSummary } from '../types';

// Identical semantics to Etapa 3's admin queries (customers/server/queries.ts
// COMMERCIAL_ORDER_STATUSES) — only 'paid'/'fulfilled' orders represent
// money actually received. 'pending'/'awaiting_payment' orders may still be
// mid-checkout or waiting on Mercado Pago (Etapa 2B); 'cancelled' orders
// never resulted in payment. Not a new metric — the same already-approved
// definition, confirmed by reading the existing code before writing this.
const COMMERCIAL_ORDER_STATUSES = ['paid', 'fulfilled'] as const;

type OrderMetricsRow = { created_at: string; total: number };

type OrderHistoryRow = {
  id: string;
  created_at: string;
  total: number;
  status: string;
  payment_status: string;
  delivery_method: DeliveryMethod;
  preferred_carrier: PreferredCarrier | null;
  billing_document_type: BillingDocumentType;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: CustomerOrderSummary['shippingAddress'];
};

function emptySummary(): CustomerCommercialSummary {
  return { totalOrders: 0, totalSpent: 0, averageOrderValue: null, firstOrderAt: null, lastOrderAt: null };
}

function summarize(rows: OrderMetricsRow[]): CustomerCommercialSummary {
  if (rows.length === 0) return emptySummary();
  const totalSpent = rows.reduce((sum, row) => sum + row.total, 0);
  const dates = rows.map((row) => row.created_at).sort();
  return {
    totalOrders: rows.length,
    totalSpent,
    averageOrderValue: Math.round(totalSpent / rows.length),
    firstOrderAt: dates[0],
    lastOrderAt: dates[dates.length - 1],
  };
}

/**
 * Commercial summary for the CURRENTLY AUTHENTICATED buyer only. Uses
 * createInsumosSupabaseServer() (session-aware, cookie-based) — never
 * service_role — so the Etapa 6C RLS policy ("buyers read own orders" via
 * customers.user_id = auth.uid()) is the real authorization boundary.
 * customerId is used for query correctness (WHERE buyer_id = customerId),
 * not as the security check: a mismatched/foreign id would still return
 * zero rows under RLS, never another buyer's data.
 */
export async function getMyCommercialSummary(customerId: string): Promise<CustomerCommercialSummary> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase
    .from('orders')
    .select('created_at, total')
    .eq('buyer_id', customerId)
    .in('status', [...COMMERCIAL_ORDER_STATUSES]);
  if (error) throw new Error(error.message);
  return summarize((data || []) as OrderMetricsRow[]);
}

/**
 * Full order history for the currently authenticated buyer — every status
 * included (unlike the commercial summary above), newest first, every
 * field read as-is from the order snapshot. Same RLS-only authorization
 * boundary as getMyCommercialSummary.
 */
export async function listMyOrders(customerId: string): Promise<CustomerOrderSummary[]> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase
    .from('orders')
    .select('id, created_at, total, status, payment_status, delivery_method, preferred_carrier, billing_document_type, customer_name, customer_email, customer_phone, shipping_address')
    .eq('buyer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data || []) as OrderHistoryRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    total: row.total,
    status: row.status,
    paymentStatus: row.payment_status,
    deliveryMethod: row.delivery_method,
    preferredCarrier: row.preferred_carrier,
    billingDocumentType: row.billing_document_type,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    shippingAddress: row.shipping_address,
  }));
}
