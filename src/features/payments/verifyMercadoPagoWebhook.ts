import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getConfiguredPaymentProviderName } from './provider';

// Implements Mercado Pago's currently documented webhook signature scheme
// exactly (cross-verified against the official docs for /developers/en/docs
// /checkout-pro/additional-content/notifications/webhooks on the .com.ar and
// .com.mx locales, 2026-09-01):
//
//   x-signature header: "ts=<millis>,v1=<hex hmac>"
//   manifest template:  "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
//     - the id is the `data.id` QUERY STRING parameter (not the JSON body),
//       lowercased if alphanumeric — Mercado Pago's own numeric payment ids
//       are unaffected by lowercasing, this only matters for non-numeric ids
//     - any pair whose value is missing is omitted entirely (not left blank)
//   signature: HMAC-SHA256(secret, manifest), hex-encoded, compared to v1
//
// Mercado Pago's official recommendation is to reject with HTTP 401 on a
// signature mismatch — see the webhook route for how this result maps to
// the actual HTTP response.
//
// Manual HMAC implementation, not the SDK's validator, is intentional: the
// installed mercadopago@2.10.0 does not export any WebhookSignatureValidator
// or InvalidWebhookSignatureError — verified directly against the installed
// package (root index, every client, and utils/), not assumed from docs
// describing a newer SDK version. Nothing here should be read as "our own
// crypto instead of the SDK's" by choice; it's the only option this pinned
// version supports. Revisit if the SDK is ever upgraded with explicit
// approval.

export interface WebhookSignatureInput {
  xSignature: string | null;
  xRequestId: string | null;
  dataIdFromQuery: string | null;
}

export type WebhookSignatureResult =
  | { status: 'valid' }
  | { status: 'invalid'; reason: string }
  // Deliberately distinct from 'valid': callers must not treat this the
  // same as a cryptographically verified signature — it exists only so a
  // local mock-mode webhook test can proceed without a real Mercado
  // Pago-issued secret.
  | { status: 'skipped_mock_mode' };

function parseXSignature(header: string): { ts: string | null; v1: string | null } {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(',')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === 'ts') ts = value;
    if (key === 'v1') v1 = value;
  }
  return { ts, v1 };
}

function buildManifest(parts: { id: string | null; requestId: string | null; ts: string | null }): string {
  let manifest = '';
  if (parts.id) manifest += `id:${parts.id};`;
  if (parts.requestId) manifest += `request-id:${parts.requestId};`;
  if (parts.ts) manifest += `ts:${parts.ts};`;
  return manifest;
}

/**
 * Verifies a Mercado Pago webhook's authenticity. This is the ONLY place
 * that decides whether a notification can be trusted — the webhook route
 * must reject (401) before doing anything else whenever this returns
 * 'invalid', and must never process a payment on the strength of an
 * unverified request body alone.
 *
 * The single explicit exception: when INSUMOS_MP_WEBHOOK_SECRET is unset
 * AND INSUMOS_PAYMENT_PROVIDER=mock — the same env var that already
 * switches every other payment code path to the mock provider — this is
 * treated as local/test mode and verification is skipped, loudly (a
 * console.warn, never silent). The moment a real secret is configured,
 * verification is mandatory unconditionally, in mock mode or not. This is
 * not a "no secret configured -> allow" bypass: it only ever fires when
 * gated by the same provider switch every other mock code path already
 * uses, so it can never accidentally activate against real traffic once a
 * real secret exists.
 */
export function verifyMercadoPagoWebhook(input: WebhookSignatureInput): WebhookSignatureResult {
  const secret = process.env.INSUMOS_MP_WEBHOOK_SECRET;

  if (!secret) {
    if (getConfiguredPaymentProviderName() === 'mock') {
      console.warn('[payments] webhook signature verification SKIPPED: INSUMOS_MP_WEBHOOK_SECRET not set and INSUMOS_PAYMENT_PROVIDER=mock');
      return { status: 'skipped_mock_mode' };
    }
    return { status: 'invalid', reason: 'INSUMOS_MP_WEBHOOK_SECRET no está configurado.' };
  }

  if (!input.xSignature) return { status: 'invalid', reason: 'Falta el header x-signature.' };

  const { ts, v1 } = parseXSignature(input.xSignature);
  if (!ts || !v1) return { status: 'invalid', reason: 'x-signature mal formado.' };

  // Per the official docs: lowercased "if alphanumeric" — real Mercado Pago
  // payment ids are always purely numeric, so this is a no-op for every
  // production notification either way. Guarding it here (rather than an
  // unconditional .toLowerCase()) just closes the gap with the literal
  // documented rule instead of leaving our own interpretation of it.
  const isAlphanumeric = (value: string) => /^[a-z0-9]+$/i.test(value);
  const id = input.dataIdFromQuery
    ? (isAlphanumeric(input.dataIdFromQuery) ? input.dataIdFromQuery.toLowerCase() : input.dataIdFromQuery)
    : null;
  const manifest = buildManifest({ id, requestId: input.xRequestId, ts });
  const expectedHex = createHmac('sha256', secret).update(manifest).digest('hex');

  let expectedBuffer: Buffer;
  let providedBuffer: Buffer;
  try {
    expectedBuffer = Buffer.from(expectedHex, 'hex');
    providedBuffer = Buffer.from(v1, 'hex');
  } catch {
    return { status: 'invalid', reason: 'v1 no es hexadecimal válido.' };
  }
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { status: 'invalid', reason: 'Firma inválida.' };
  }
  return { status: 'valid' };
}
