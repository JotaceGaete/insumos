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

export interface PaymentProvider {
  createPreference(request: PaymentPreferenceRequest): Promise<PaymentPreferenceResult>;
}
