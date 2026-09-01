import { NextRequest, NextResponse } from 'next/server';
import { verifyMercadoPagoWebhook } from '@/features/payments/verifyMercadoPagoWebhook';
import { processMercadoPagoPayment } from '@/features/payments/processMercadoPagoPayment';

export const runtime = 'nodejs';

// ArteInsumos-only. Deliberately does not touch, import from, or share any
// code with the legacy Artesellos routes under src/app/api/checkout/mp/* —
// separate provider config, separate Supabase project, separate everything.

function extractPaymentId(body: unknown, dataIdFromQuery: string | null): string | null {
  if (body && typeof body === 'object') {
    const parsed = body as { type?: unknown; data?: { id?: unknown } };
    if (parsed.type === 'payment' && parsed.data && (typeof parsed.data.id === 'string' || typeof parsed.data.id === 'number')) {
      return String(parsed.data.id);
    }
  }
  return dataIdFromQuery;
}

/**
 * Thin by design: parse -> authenticate -> extract payment id ->
 * processMercadoPagoPayment -> map result to HTTP. All business logic
 * (payment lookup, amount/currency/external_reference validation, atomic
 * confirmation) lives in processMercadoPagoPayment — this file only decides
 * status codes.
 *
 * HTTP mapping, following Mercado Pago's own guidance to avoid pointless
 * retry storms once a decision has actually been made:
 *   - invalid signature            -> 401 (reject before any processing)
 *   - no payment id found          -> 200 (nothing to retry — not our data)
 *   - confirmed / ignored / rejected -> 200 (a decision was made either way)
 *   - unexpected internal error    -> 500 (genuinely transient, let MP retry)
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const dataIdFromQuery = url.searchParams.get('data.id');
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  const verification = verifyMercadoPagoWebhook({ xSignature, xRequestId, dataIdFromQuery });
  if (verification.status === 'invalid') {
    console.error('[webhook][mercadopago] signature rejected:', verification.reason);
    return NextResponse.json({ message: 'Firma inválida.' }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // A malformed body with a valid (or mock-mode-skipped) signature still
    // has nothing to process — acknowledge rather than let Mercado Pago
    // retry a payload that will never parse differently.
    return NextResponse.json({ status: 'ignored', reason: 'Payload no es JSON válido.' }, { status: 200 });
  }

  const paymentId = extractPaymentId(body, dataIdFromQuery);
  if (!paymentId) {
    return NextResponse.json({ status: 'ignored', reason: 'No se encontró payment id.' }, { status: 200 });
  }

  try {
    const outcome = await processMercadoPagoPayment(paymentId);
    if (outcome.status === 'error') {
      return NextResponse.json({ status: outcome.status, reason: outcome.reason }, { status: 500 });
    }
    return NextResponse.json({ status: outcome.status, reason: outcome.reason }, { status: 200 });
  } catch (error) {
    console.error('[webhook][mercadopago] unexpected error', error);
    return NextResponse.json({ status: 'error', reason: 'Error inesperado.' }, { status: 500 });
  }
}
