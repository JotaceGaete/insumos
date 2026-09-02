import type { BillingDocumentType, DeliveryMethod, PreferredCarrier } from '@/features/checkout/shipping';
import type { CheckoutShippingAddress } from '@/features/checkout/types';

// All commercial metrics below (totalOrders/totalSpent/averageOrderValue/
// firstOrderAt/lastOrderAt) are DERIVED from orders at query time — never
// stored on customers — and only ever count orders whose status is 'paid'
// or 'fulfilled'. See server/queries.ts (COMMERCIAL_ORDER_STATUSES) for the
// full reasoning; the short version: 'pending'/'awaiting_payment' orders
// haven't actually been paid, and 'cancelled' ones never will be, so
// counting either would overstate a customer's real spend.
export interface CustomerCommercialSummary {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

export interface CustomerListItem extends CustomerCommercialSummary {
  id: string;
  fullName: string | null;
  emailNormalized: string;
  phoneNormalized: string | null;
  createdAt: string;
}

export interface CustomerProfile extends CustomerCommercialSummary {
  id: string;
  fullName: string | null;
  emailNormalized: string;
  phoneNormalized: string | null;
  rutNormalized: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived from the customer's most recent order (by created_at, across
  // ALL statuses — a preference expressed on a cancelled/pending order is
  // still a real signal of how this person prefers to shop). Null when the
  // customer has no orders yet, never guessed/defaulted.
  lastDeliveryMethod: DeliveryMethod | null;
  lastPreferredCarrier: PreferredCarrier | null;
  lastBillingDocumentType: BillingDocumentType | null;
}

// One row of a customer's order history. Every field here is the snapshot
// exactly as persisted on the order at checkout time — never re-derived
// from the customer's current master data, and never mutated by this
// feature. See queries.ts: listCustomerOrders selects these columns as-is.
export interface CustomerOrderSummary {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  paymentStatus: string;
  deliveryMethod: DeliveryMethod;
  preferredCarrier: PreferredCarrier | null;
  billingDocumentType: BillingDocumentType;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: CheckoutShippingAddress | null;
}

export interface ListCustomersParams {
  /** Matched case-insensitively, trimmed, against email_normalized, full_name and phone_normalized. */
  search?: string;
  /** 1-based. Defaults to 1. */
  page?: number;
  /** Defaults to 20, capped at 100. */
  pageSize?: number;
}

export interface ListCustomersResult {
  customers: CustomerListItem[];
  /** Total matching customers before pagination — for computing page count. */
  total: number;
  page: number;
  pageSize: number;
}
