export interface PaymentItem {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentBackUrls {
  success: string;
  pending: string;
  failure: string;
}

export interface PaymentPreferenceRequest {
  orderId: string;
  externalReference: string;
  items: PaymentItem[];
  totalAmount: number;
  currency: 'CLP';
  payerEmail: string;
  payerName?: string;
  backUrls: PaymentBackUrls;
  // ISO timestamp mirroring the inventory reservation window, offered to a
  // provider that supports preference expiration. Not guaranteed to be
  // honored — see mercadoPagoProvider for why it's currently unused there.
  expiresAt?: string | null;
}

export type PaymentPreferenceStatus = 'created' | 'failed';

export interface PaymentPreferenceResult {
  status: PaymentPreferenceStatus;
  providerPreferenceId?: string;
  checkoutUrl?: string;
  error?: string;
}

// Statuses as documented by Mercado Pago (pending, approved, authorized,
// in_process, in_mediation, rejected, cancelled, refunded — status_detail
// carries finer-grained reasons). Kept as a plain string rather than a
// union: only 'approved' is ever treated specially by processing logic,
// everything else — including any future status Mercado Pago adds — falls
// through the same "do not confirm" path by default, so nothing here needs
// to enumerate the full set to stay safe.
export interface PaymentDetails {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  dateApproved: string | null;
}

export interface PaymentProvider {
  createPreference(request: PaymentPreferenceRequest): Promise<PaymentPreferenceResult>;
  // Authoritative, server-side lookup of a single payment by id. Returns
  // null if the provider has no such payment (never throws for a not-found
  // — only for a genuine transport/auth failure) — the caller decides what
  // "not found" means for a webhook (see processMercadoPagoPayment).
  getPayment(paymentId: string): Promise<PaymentDetails | null>;
}
