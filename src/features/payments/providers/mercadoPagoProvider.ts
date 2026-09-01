import 'server-only';
import type { PaymentDetails, PaymentProvider, PaymentPreferenceResult } from '../types';

// Real implementation, prepared but not connected: without
// INSUMOS_MP_ACCESS_TOKEN this fails in a controlled way, the same shape as
// a real provider error. Never invents an endpoint or a fallback token.
export const mercadoPagoProvider: PaymentProvider = {
  async createPreference(request): Promise<PaymentPreferenceResult> {
    const accessToken = process.env.INSUMOS_MP_ACCESS_TOKEN;
    if (!accessToken) {
      return { status: 'failed', error: 'Mercado Pago no está configurado.' };
    }

    try {
      const { MercadoPagoConfig, Preference } = await import('mercadopago');
      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);

      // expiration_date_to (mirroring the inventory reservation window) is
      // deliberately NOT set here: the SDK's own type surface confirms the
      // field exists, but its exact interaction with expires/auto_return
      // could not be verified against live Mercado Pago docs without a real
      // sandbox account, and getting it wrong risks invalidating a
      // legitimate preference early. Per the agreed fallback, the internal
      // inventory_reservations window stays the sole authority for the
      // hold; this should be revisited once real credentials are connected
      // and can be tested against an actual sandbox.
      //
      // auto_return is deliberately NOT set: confirmed against the live
      // Mercado Pago API (real test credentials, 2026-09-01) that it
      // rejects the request with 400 "auto_return invalid. back_url.success
      // must be defined" whenever back_urls.success isn't a publicly
      // reachable https URL — localhost fails this even though it's a
      // syntactically valid absolute URL. back_urls are still sent, so a
      // buyer completing payment on Mercado Pago can still click through to
      // return manually; only the automatic redirect is affected. Revisit
      // once NEXT_PUBLIC_INSUMOS_SITE_URL is a real deployed https domain.
      const result = await preference.create({
        body: {
          items: request.items.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            currency_id: request.currency,
          })),
          payer: { email: request.payerEmail, name: request.payerName },
          external_reference: request.externalReference,
          back_urls: request.backUrls,
        },
      });

      const checkoutUrl = result.init_point || result.sandbox_init_point;
      if (!checkoutUrl || !result.id) {
        return { status: 'failed', error: 'Mercado Pago no devolvió una URL de pago válida.' };
      }
      return { status: 'created', providerPreferenceId: result.id, checkoutUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error creando la preferencia de pago.';
      return { status: 'failed', error: message };
    }
  },

  // Authoritative server-side payment lookup — GET /v1/payments/{id} via
  // the SDK's Payment resource, confirmed against the real, currently
  // installed mercadopago@2.10.0 type definitions
  // (node_modules/mercadopago/dist/clients/payment/commonTypes.d.ts).
  //
  // Deliberately does NOT expose a preference_id on the normalized result:
  // the SDK's own PaymentResponse type has no preference_id field at all
  // (only a bare `order?: { id, type }`, which is Mercado Pago's *merchant
  // order* id, a different concept). Correlating a payment back to the
  // preference that created it is not reliably documented on this
  // endpoint, so this deliberately isn't invented — order correlation here
  // relies entirely on external_reference, which is a real, typed,
  // documented field.
  async getPayment(paymentId: string): Promise<PaymentDetails | null> {
    const accessToken = process.env.INSUMOS_MP_ACCESS_TOKEN;
    if (!accessToken) return null;

    try {
      const { MercadoPagoConfig, Payment } = await import('mercadopago');
      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);
      const result = await payment.get({ id: paymentId });
      if (!result.id) return null;
      return {
        id: String(result.id),
        status: result.status ?? 'unknown',
        statusDetail: result.status_detail ?? null,
        externalReference: result.external_reference ?? null,
        transactionAmount: result.transaction_amount ?? null,
        currencyId: result.currency_id ?? null,
        dateApproved: result.date_approved ?? null,
      };
    } catch (error) {
      console.error('[payments] getPayment (mercadopago) failed', error);
      return null;
    }
  },
};
