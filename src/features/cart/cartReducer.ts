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

export function addCartLine(cart: InsumosCart, line: CartLine): InsumosCart {
  assertQuantity(line.quantity);
  const key = getCartLineKey(line);
  const exists = cart.lines.some((current) => getCartLineKey(current) === key);
  const lines = exists
    ? cart.lines.map((current) => getCartLineKey(current) === key
      ? { ...current, quantity: current.quantity + line.quantity, unitPrice: line.unitPrice }
      : current)
    : [...cart.lines, line];
  return summarize(lines);
}

export function setCartLineQuantity(cart: InsumosCart, productId: string, variantId: string, quantity: number): InsumosCart {
  assertQuantity(quantity, true);
  const key = `${productId}:${variantId}`;
  const lines = quantity === 0
    ? cart.lines.filter((line) => getCartLineKey(line) !== key)
    : cart.lines.map((line) => getCartLineKey(line) === key ? { ...line, quantity } : line);
  return summarize(lines);
}
