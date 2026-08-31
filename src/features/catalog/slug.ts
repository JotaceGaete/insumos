/**
 * Normaliza un texto a un slug URL-safe: minúsculas, sin tildes/diacríticos,
 * espacios y símbolos convertidos a un único guión, sin guiones al inicio/fin.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
