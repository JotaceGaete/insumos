// Free-shipping threshold policy, shared by /carrito, /finalizar-compra and
// the server. The server is the only one that persists shipping_policy —
// these helpers exist so the client can render the *same* number without
// duplicating the threshold, not so the client can dictate the outcome.
export const FREE_SHIPPING_THRESHOLD = 50_000;

export type ShippingPolicy = 'free' | 'receiver_pays';

export function computeShippingPolicy(subtotal: number): ShippingPolicy {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 'free' : 'receiver_pays';
}

/** CLP still owed to reach free shipping; 0 once eligible. */
export function amountUntilFreeShipping(subtotal: number): number {
  return Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
}

/** 0..1 progress toward the free-shipping threshold, for a progress bar. */
export function freeShippingProgress(subtotal: number): number {
  if (FREE_SHIPPING_THRESHOLD <= 0) return 1;
  return Math.min(Math.max(subtotal, 0) / FREE_SHIPPING_THRESHOLD, 1);
}

export const PREFERRED_CARRIERS = ['starken', 'chilexpress', 'blue_express'] as const;
export type PreferredCarrier = (typeof PREFERRED_CARRIERS)[number];

export const CARRIER_LABELS: Record<PreferredCarrier, string> = {
  starken: 'Starken',
  chilexpress: 'Chilexpress',
  blue_express: 'Blue Express',
};

export function isValidCarrier(value: unknown): value is PreferredCarrier {
  return typeof value === 'string' && (PREFERRED_CARRIERS as readonly string[]).includes(value);
}

export const BILLING_DOCUMENT_TYPES = ['boleta', 'factura'] as const;
export type BillingDocumentType = (typeof BILLING_DOCUMENT_TYPES)[number];

export function isValidBillingDocumentType(value: unknown): value is BillingDocumentType {
  return typeof value === 'string' && (BILLING_DOCUMENT_TYPES as readonly string[]).includes(value);
}
