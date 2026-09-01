import 'server-only';
import type { PaymentProvider } from './types';
import { mockPaymentProvider } from './providers/mockPaymentProvider';
import { mercadoPagoProvider } from './providers/mercadoPagoProvider';

export const PAYMENT_PROVIDERS = ['mock', 'mercadopago'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export function getConfiguredPaymentProviderName(): string {
  return (process.env.INSUMOS_PAYMENT_PROVIDER || 'mock').trim().toLowerCase();
}

/**
 * The only place in the app that knows which concrete payment provider
 * exists. Everything else (createPaymentPreference, checkout) calls this
 * and gets back a PaymentProvider — never a provider-specific import.
 */
export function getPaymentProvider(): PaymentProvider {
  const name = getConfiguredPaymentProviderName();
  switch (name) {
    case 'mock':
      return mockPaymentProvider;
    case 'mercadopago':
      return mercadoPagoProvider;
    default:
      console.error(`[payments] Unknown INSUMOS_PAYMENT_PROVIDER "${name}" — falling back to mock.`);
      return mockPaymentProvider;
  }
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_INSUMOS_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}
