// Deliberately has NO 'server-only' import and NO Buffer/Node-specific
// API: unlike every other file in this module, nothing here touches env
// vars, the database, or any server-only capability — it's pure
// JSON/URI-encode-decode using only standard ECMAScript globals — so it's
// kept genuinely dependency-free and directly unit-testable, the same
// reasoning that keeps renderOrderReceivedEmail
// (src/features/email/templates) free of it too.
//
// Shared encode/decode for synthetic mock payment ids. A mock payment id is
// entirely self-describing (status/externalReference/amount/currency
// URI-encoded into the id itself) so any caller — the mock provider's own
// getPayment, or a test script posting a synthetic webhook payload — can
// construct exactly the scenario it needs without any shared mutable state
// or a database round trip. This only exists so createPreference's mock
// flow and webhook testing can agree on one format; it is never used by
// the real mercadoPagoProvider.
const MOCK_PAYMENT_PREFIX = 'mock_payment_';

export interface MockPaymentFixture {
  status: string;
  externalReference?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export function encodeMockPaymentId(fixture: MockPaymentFixture): string {
  const payload = encodeURIComponent(JSON.stringify(fixture));
  return `${MOCK_PAYMENT_PREFIX}${payload}`;
}

export function decodeMockPaymentId(paymentId: string): MockPaymentFixture | null {
  if (!paymentId.startsWith(MOCK_PAYMENT_PREFIX)) return null;
  try {
    const payload = paymentId.slice(MOCK_PAYMENT_PREFIX.length);
    const decoded = JSON.parse(decodeURIComponent(payload));
    if (!decoded || typeof decoded !== 'object' || typeof decoded.status !== 'string') return null;
    return decoded as MockPaymentFixture;
  } catch {
    return null;
  }
}
