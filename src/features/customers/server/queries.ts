import 'server-only';
import { createInsumosSupabaseAdmin } from '@/features/shared/server/supabase';
import { requireCustomerManager } from '@/features/auth/server/authorization';
import type { BillingDocumentType, DeliveryMethod, PreferredCarrier } from '@/features/checkout/shipping';
import type { CheckoutShippingAddress } from '@/features/checkout/types';
import type {
  CustomerCommercialSummary,
  CustomerListItem,
  CustomerOrderSummary,
  CustomerProfile,
  ListCustomersParams,
  ListCustomersResult,
} from '../types';

// Only these two order statuses represent money the customer actually paid.
// 'pending'/'awaiting_payment' orders may still be mid-checkout or waiting
// on a Mercado Pago redirect that never completes — counting them would
// overstate revenue the moment real payments start flowing (Etapa 2B).
// 'cancelled' orders never resulted in payment either. Applied identically
// to totalOrders/totalSpent/averageOrderValue/firstOrderAt/lastOrderAt so
// the average is always spent-over-orders on the exact same set — never a
// numerator/denominator mismatch between the count and the sum.
const COMMERCIAL_ORDER_STATUSES = ['paid', 'fulfilled'] as const;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
// This stage intentionally does not paginate the DB query itself (the sort
// key — last commercial order — is derived, not a real column to ORDER BY
// server-side). This bounds how much a single listCustomers call will ever
// load into memory. Revisit with a DB-side aggregate (view or RPC) once
// real customer volume makes this cap a real constraint — not before.
const MAX_CUSTOMERS_LOADED = 500;

type CustomerRow = {
  id: string;
  full_name: string | null;
  email_normalized: string;
  phone_normalized: string | null;
  rut_normalized: string | null;
  created_at: string;
  updated_at: string;
};

type OrderMetricsRow = { buyer_id: string | null; created_at: string; total: number };

type OrderPreferenceRow = {
  status: string;
  created_at: string;
  total: number;
  delivery_method: DeliveryMethod;
  preferred_carrier: PreferredCarrier | null;
  billing_document_type: BillingDocumentType;
};

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
  shipping_address: CheckoutShippingAddress | null;
};

function emptySummary(): CustomerCommercialSummary {
  return { totalOrders: 0, totalSpent: 0, averageOrderValue: null, firstOrderAt: null, lastOrderAt: null };
}

function summarize(rows: Array<{ created_at: string; total: number }>): CustomerCommercialSummary {
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

function isCommercialStatus(status: string): boolean {
  return (COMMERCIAL_ORDER_STATUSES as readonly string[]).includes(status);
}

// PostgREST's .or() filter string treats ',' and '()' as syntax — strip
// them from user input so a search term can never break out of the
// intended email/full_name/phone_normalized ILIKE conditions into a
// different filter. supabase-js still parameterizes the actual SQL
// underneath; this is purely about keeping the filter-string grammar sane.
function sanitizeSearchTerm(raw: string): string {
  return raw.trim().replace(/[,()]/g, '');
}

async function fetchCommercialSummariesByCustomerId(
  supabase: ReturnType<typeof createInsumosSupabaseAdmin>,
  customerIds: string[],
): Promise<Map<string, CustomerCommercialSummary>> {
  if (customerIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('orders')
    .select('buyer_id, created_at, total')
    .in('buyer_id', customerIds)
    .in('status', [...COMMERCIAL_ORDER_STATUSES]);
  if (error) throw new Error(error.message);

  const rowsByCustomer = new Map<string, OrderMetricsRow[]>();
  for (const row of (data || []) as OrderMetricsRow[]) {
    if (!row.buyer_id) continue;
    const list = rowsByCustomer.get(row.buyer_id) ?? [];
    list.push(row);
    rowsByCustomer.set(row.buyer_id, list);
  }

  const summaries = new Map<string, CustomerCommercialSummary>();
  for (const [customerId, rows] of rowsByCustomer) {
    summaries.set(customerId, summarize(rows));
  }
  return summaries;
}

/**
 * Lists customers with search and pagination, each row carrying commercial
 * metrics derived live from orders (never stored on customers — see
 * COMMERCIAL_ORDER_STATUSES above for exactly which orders count).
 *
 * Query strategy: fetch the matching customers first (search filter, order
 * by created_at desc, capped at MAX_CUSTOMERS_LOADED), then batch-fetch
 * every commercial order for exactly those customer ids in a single second
 * query (`.in('buyer_id', ids)`) and aggregate per customer in application
 * code — the same batch-fetch-then-map pattern catalog/server/queries.ts
 * already uses for variants/media. Exactly two round trips regardless of
 * how many customers exist — no N+1. Sorting by the derived "last order"
 * key and pagination both happen in memory afterward, since that key isn't
 * a real column postgrest could ORDER BY server-side. This is deliberately
 * simple for today's scale rather than a dedicated aggregate view/RPC.
 */
export async function listCustomers(params: ListCustomersParams = {}): Promise<ListCustomersResult> {
  await requireCustomerManager();
  const supabase = createInsumosSupabaseAdmin();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  let query = supabase
    .from('customers')
    .select('id, full_name, email_normalized, phone_normalized, rut_normalized, created_at, updated_at');

  const term = params.search ? sanitizeSearchTerm(params.search) : '';
  if (term.length > 0) {
    const pattern = `%${term.toLowerCase()}%`;
    query = query.or(`email_normalized.ilike.${pattern},full_name.ilike.${pattern},phone_normalized.ilike.${pattern}`);
  }

  const { data: customerRows, error } = await query.order('created_at', { ascending: false }).limit(MAX_CUSTOMERS_LOADED);
  if (error) throw new Error(error.message);
  const customers = (customerRows || []) as CustomerRow[];

  const summaries = await fetchCommercialSummariesByCustomerId(supabase, customers.map((row) => row.id));

  const withSummaries: CustomerListItem[] = customers.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    emailNormalized: row.email_normalized,
    phoneNormalized: row.phone_normalized,
    createdAt: row.created_at,
    ...(summaries.get(row.id) ?? emptySummary()),
  }));

  // Última compra DESC — customers with no commercial order yet (empty
  // lastOrderAt) sort after everyone who has one; within either group,
  // fall back to created_at DESC.
  withSummaries.sort((a, b) => {
    const aKey = a.lastOrderAt ?? '';
    const bKey = b.lastOrderAt ?? '';
    if (aKey !== bKey) return aKey > bKey ? -1 : 1;
    return a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0;
  });

  const total = withSummaries.length;
  const start = (page - 1) * pageSize;
  return { customers: withSummaries.slice(start, start + pageSize), total, page, pageSize };
}

/**
 * Full profile for one customer: master data, commercial summary (same
 * COMMERCIAL_ORDER_STATUSES filter as listCustomers), and preferences
 * derived from their single most recent order regardless of its status — a
 * carrier/delivery choice expressed on a not-yet-paid or even cancelled
 * order is still real signal of how this person shops, and there is no
 * reason to discard it. Never guesses a value: all three preference fields
 * are null when the customer has no orders at all.
 *
 * One query for the customer row, one for all of their orders (used both
 * for the commercial summary and the most-recent-order preferences) — no
 * further round trips.
 */
export async function getCustomerById(customerId: string): Promise<CustomerProfile | null> {
  await requireCustomerManager();
  const supabase = createInsumosSupabaseAdmin();

  const { data: customerRow, error: customerError } = await supabase
    .from('customers')
    .select('id, full_name, email_normalized, phone_normalized, rut_normalized, created_at, updated_at')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError) throw new Error(customerError.message);
  if (!customerRow) return null;
  const row = customerRow as CustomerRow;

  const { data: orderRows, error: ordersError } = await supabase
    .from('orders')
    .select('status, created_at, total, delivery_method, preferred_carrier, billing_document_type')
    .eq('buyer_id', customerId)
    .order('created_at', { ascending: false });
  if (ordersError) throw new Error(ordersError.message);
  const orders = (orderRows || []) as OrderPreferenceRow[];

  const summary = summarize(orders.filter((order) => isCommercialStatus(order.status)));
  // orders is already sorted created_at desc, so index 0 is the most
  // recent order regardless of status.
  const mostRecent = orders[0] ?? null;

  return {
    id: row.id,
    fullName: row.full_name,
    emailNormalized: row.email_normalized,
    phoneNormalized: row.phone_normalized,
    rutNormalized: row.rut_normalized,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...summary,
    lastDeliveryMethod: mostRecent?.delivery_method ?? null,
    lastPreferredCarrier: mostRecent?.preferred_carrier ?? null,
    lastBillingDocumentType: mostRecent?.billing_document_type ?? null,
  };
}

/**
 * Full order history for one customer, newest first, every field read
 * as-is from orders — never filtered by status (unlike the commercial
 * summary above, the history is meant to show everything, including
 * cancelled/pending attempts, for admin context) and never altered.
 */
export async function listCustomerOrders(customerId: string): Promise<CustomerOrderSummary[]> {
  await requireCustomerManager();
  const supabase = createInsumosSupabaseAdmin();

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
