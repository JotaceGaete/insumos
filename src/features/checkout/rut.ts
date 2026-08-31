// Chilean RUT (RUN) validation — normalize, format, and verify the check
// digit. Deliberately hand-rolled: the algorithm is a dozen lines of modulo
// 11 arithmetic, not worth a dependency for.

/** Strips dots, dashes and whitespace; uppercases a trailing "k". Accepts
 * "12.345.678-5", "12345678-5" or "123456785" — all normalize the same way. */
export function normalizeRut(raw: string): string {
  return raw.replace(/[^0-9kK]/g, '').toUpperCase();
}

function computeCheckDigit(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

export function isValidRut(raw: string): boolean {
  const normalized = normalizeRut(raw);
  if (normalized.length < 2) return false;
  const body = normalized.slice(0, -1);
  const checkDigit = normalized.slice(-1);
  if (!/^\d{1,8}$/.test(body)) return false;
  return computeCheckDigit(body) === checkDigit;
}

/** Formats a normalized RUT as "12.345.678-5". Returns the input normalized
 * but unformatted if it's too short to format meaningfully. */
export function formatRut(raw: string): string {
  const normalized = normalizeRut(raw);
  if (normalized.length < 2) return normalized;
  const body = normalized.slice(0, -1);
  const checkDigit = normalized.slice(-1);
  const withThousands = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withThousands}-${checkDigit}`;
}
