// Email validation shared by client (immediate UX feedback) and server
// (authoritative check). Intentionally not RFC-5322-exact — that regex is
// famously enormous and still wrong at the edges — just strict enough to
// reject the obviously-broken inputs a real buyer might type.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(raw.trim());
}
