import type { CartLine, InsumosCart } from './types';

export const EMPTY_CART: InsumosCart = { lines: [], itemCount: 0, subtotal: 0 };

export function getCartLineKey(line: Pick<CartLine, 'productId' | 'variantId'>) {
  return `${line.productId}:${line.variantId}`;
}

function summarize(lines: CartLine[]): InsumosCart {
  return {
    lines,
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    subtotal: lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0),
  };
}

function assertQuantity(quantity: number, allowZero = false) {
  if (!Number.isInteger(quantity) || quantity < 0 || (!allowZero && quantity === 0)) {
    throw new Error('La cantidad debe ser un entero positivo.');
  }
}

// UX-only ceiling: caps a requested quantity at the stock snapshot carried by
// the line, when that snapshot is known. Unknown stock (null/undefined) never
// blocks a quantity — the server remains the real authority at checkout time.
function clampToStock(quantity: number, stockAvailable: number | null | undefined) {
  if (stockAvailable === null || stockAvailable === undefined) return quantity;
  return Math.min(quantity, Math.max(stockAvailable, 0));
}

export function addCartLine(cart: InsumosCart, line: CartLine): InsumosCart {
  assertQuantity(line.quantity);
  if (line.stockAvailable !== null && line.stockAvailable !== undefined && line.stockAvailable <= 0) {
    throw new Error('Este formato no tiene stock disponible.');
  }
  const key = getCartLineKey(line);
  const exists = cart.lines.some((current) => getCartLineKey(current) === key);
  const lines = exists
    ? cart.lines.map((current) => getCartLineKey(current) === key
      ? { ...current, quantity: clampToStock(current.quantity + line.quantity, line.stockAvailable), unitPrice: line.unitPrice, stockAvailable: line.stockAvailable }
      : current)
    : [...cart.lines, { ...line, quantity: clampToStock(line.quantity, line.stockAvailable) }];
  return summarize(lines);
}

export function setCartLineQuantity(cart: InsumosCart, productId: string, variantId: string, quantity: number): InsumosCart {
  assertQuantity(quantity, true);
  const key = `${productId}:${variantId}`;
  const lines = quantity === 0
    ? cart.lines.filter((line) => getCartLineKey(line) !== key)
    : cart.lines.map((line) => getCartLineKey(line) === key ? { ...line, quantity: clampToStock(quantity, line.stockAvailable) } : line);
  return summarize(lines);
}

export function removeCartLine(cart: InsumosCart, productId: string, variantId: string): InsumosCart {
  return setCartLineQuantity(cart, productId, variantId, 0);
}

export function incrementCartLine(cart: InsumosCart, productId: string, variantId: string): InsumosCart {
  const key = `${productId}:${variantId}`;
  const line = cart.lines.find((current) => getCartLineKey(current) === key);
  if (!line) return cart;
  return setCartLineQuantity(cart, productId, variantId, line.quantity + 1);
}

// Decrementing only ever settles at 1 — it never removes the line on its own.
// Removal is always an explicit, separate action (removeCartLine).
export function decrementCartLine(cart: InsumosCart, productId: string, variantId: string): InsumosCart {
  const key = `${productId}:${variantId}`;
  const line = cart.lines.find((current) => getCartLineKey(current) === key);
  if (!line) return cart;
  return setCartLineQuantity(cart, productId, variantId, Math.max(1, line.quantity - 1));
}

export function clearCart(): InsumosCart {
  return EMPTY_CART;
}

function isStoredCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === 'string' && line.productId.length > 0 &&
    typeof line.variantId === 'string' && line.variantId.length > 0 &&
    Number.isInteger(line.quantity) && (line.quantity as number) > 0 &&
    typeof line.unitPrice === 'number' && Number.isFinite(line.unitPrice) &&
    typeof line.productName === 'string' &&
    typeof line.variantName === 'string'
  );
}

/**
 * Rebuilds a cart from arbitrary (e.g. persisted) data, re-running every line
 * through addCartLine so merging, stock clamping and validation all apply the
 * same as a live add. Anything malformed or out of stock is silently skipped
 * rather than throwing, since this is meant for recovering from storage, not
 * for reporting errors to a user.
 */
export function hydrateCart(rawLines: unknown): InsumosCart {
  if (!Array.isArray(rawLines)) return EMPTY_CART;
  return rawLines.reduce<InsumosCart>((cart, raw) => {
    if (!isStoredCartLine(raw)) return cart;
    try {
      return addCartLine(cart, raw);
    } catch {
      return cart;
    }
  }, EMPTY_CART);
}
