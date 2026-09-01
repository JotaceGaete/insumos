// Chilean mobile phone handling: the UI locks the +56 country code so a
// buyer can never type a different one — only the 9 national digits are
// ever editable — and what gets persisted is always the same normalized
// shape: "+56" followed by exactly 9 digits starting with 9 (the Chilean
// mobile range). Landlines aren't accepted: nothing in this checkout (or
// the rest of the app) currently depends on a landline number, so this
// stage assumes mobile-only, same as the spec that introduced this field.
export const CHILE_COUNTRY_CODE = '+56';
export const CHILE_MOBILE_NATIONAL_DIGITS = 9;

/** Strips everything but digits — paste-safe against "9 1234 5678", "+56...", etc. */
export function extractDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Keeps only digits and caps at 9 — what the national-digits input holds. */
export function sanitizeNationalDigits(raw: string): string {
  return extractDigits(raw).slice(0, CHILE_MOBILE_NATIONAL_DIGITS);
}

/** Builds the persisted value from the national digits alone: "+56912345678". */
export function normalizeChileanMobile(nationalDigits: string): string {
  return `${CHILE_COUNTRY_CODE}${sanitizeNationalDigits(nationalDigits)}`;
}

/** True only for a complete +56 mobile number: 9 digits, starting with 9. */
export function isValidChileanMobile(fullPhone: string): boolean {
  return /^\+569\d{8}$/.test(fullPhone.trim());
}
