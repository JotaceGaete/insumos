import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PaymentProvider, PaymentPreferenceResult } from '../types';
import { getSiteUrl } from '../provider';

// No network, no credentials — generates a synthetic preference id and a
// checkout URL that points straight at our own /pago/retorno with the same
// query shape Mercado Pago itself appends on redirect (order_id, status,
// preference_id), so the return page's logic is exercised identically
// whether the provider is mock or real.
export const mockPaymentProvider: PaymentProvider = {
  async createPreference(request): Promise<PaymentPreferenceResult> {
    const preferenceId = `mock_pref_${randomUUID()}`;
    console.log('[payment:mock] would create preference', {
      orderId: request.orderId,
      totalAmount: request.totalAmount,
      itemCount: request.items.length,
    });
    const checkoutUrl = `${getSiteUrl()}/pago/retorno?order_id=${encodeURIComponent(request.orderId)}&status=pending&preference_id=${encodeURIComponent(preferenceId)}`;
    return { status: 'created', providerPreferenceId: preferenceId, checkoutUrl };
  },
};
