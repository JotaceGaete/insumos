import 'server-only';
import { getPaymentProvider } from './provider';
import type { PaymentDetails } from './types';

/**
 * The only place that fetches an authoritative payment from a provider.
 * Delegates entirely to whichever provider is configured (mock or
 * mercadopago) — callers never import a concrete provider directly, same
 * convention as createPaymentPreference.
 */
export async function getMercadoPagoPayment(paymentId: string): Promise<PaymentDetails | null> {
  const provider = getPaymentProvider();
  return provider.getPayment(paymentId);
}
