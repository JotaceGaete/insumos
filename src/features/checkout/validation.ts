import type { CheckoutCustomerInput, CheckoutItemInput, CheckoutPayload } from './types';

// Loose but real: the server never trusts this alone — create_pending_order
// re-validates existence, status and stock. This just rejects obviously
// malformed payloads before they reach the database.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Guards against typos/abuse (e.g. quantity: 999999999) reaching the RPC as a
// valid-looking integer. The real ceiling per product is max_quantity in the
// database; this is just a sanity bound independent of any one product.
export const MAX_ITEM_QUANTITY = 999;
export const MAX_ITEMS_PER_ORDER = 50;

const MAX_LENGTHS = {
  fullName: 120,
  email: 200,
  phone: 40,
  region: 100,
  comuna: 100,
  address: 200,
  number: 20,
  unit: 100,
  deliveryNotes: 500,
} as const;

function assertText(value: unknown, field: string, maxLength: number, required = true): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    if (required) throw new Error(`${field} es obligatorio.`);
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field} es demasiado largo.`);
  return trimmed;
}

/**
 * Merges duplicate variantId lines by summing their quantity, exactly like
 * the client-side cart reducer does — but re-run here because the server
 * must never assume the caller (browser, script, replay) already merged
 * correctly. This runs before any per-item validation.
 */
export function normalizeCheckoutItems(rawItems: unknown): CheckoutItemInput[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('El carrito está vacío.');
  }
  if (rawItems.length > MAX_ITEMS_PER_ORDER) {
    throw new Error('El pedido tiene demasiadas líneas distintas.');
  }

  const quantities = new Map<string, number>();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') throw new Error('El carrito contiene un artículo inválido.');
    const { variantId, quantity } = raw as { variantId?: unknown; quantity?: unknown };
    if (typeof variantId !== 'string' || !UUID_PATTERN.test(variantId)) {
      throw new Error('El carrito contiene una variante inválida.');
    }
    if (!Number.isInteger(quantity) || (quantity as number) <= 0) {
      throw new Error('La cantidad debe ser un entero positivo.');
    }
    if ((quantity as number) > MAX_ITEM_QUANTITY) {
      throw new Error('La cantidad solicitada es demasiado alta.');
    }
    quantities.set(variantId, (quantities.get(variantId) || 0) + (quantity as number));
  }

  for (const quantity of quantities.values()) {
    if (quantity > MAX_ITEM_QUANTITY) throw new Error('La cantidad solicitada es demasiado alta.');
  }

  return Array.from(quantities.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
}

export function assertValidCustomer(customer: unknown): CheckoutCustomerInput {
  if (!customer || typeof customer !== 'object') throw new Error('Los datos del comprador son obligatorios.');
  const input = customer as Record<string, unknown>;

  const fullName = assertText(input.fullName, 'El nombre completo', MAX_LENGTHS.fullName);
  const email = assertText(input.email, 'El email', MAX_LENGTHS.email);
  if (!EMAIL_PATTERN.test(email)) throw new Error('El email no es válido.');
  const phone = assertText(input.phone, 'El teléfono', MAX_LENGTHS.phone);

  const rawAddress = input.shippingAddress;
  if (!rawAddress || typeof rawAddress !== 'object') throw new Error('La dirección de entrega es obligatoria.');
  const address = rawAddress as Record<string, unknown>;

  const shippingAddress = {
    region: assertText(address.region, 'La región', MAX_LENGTHS.region),
    comuna: assertText(address.comuna, 'La comuna', MAX_LENGTHS.comuna),
    address: assertText(address.address, 'La dirección', MAX_LENGTHS.address),
    number: assertText(address.number, 'El número', MAX_LENGTHS.number),
    unit: assertText(address.unit, 'El departamento/casa', MAX_LENGTHS.unit, false) || null,
  };

  const deliveryNotes = assertText(input.deliveryNotes, 'Las indicaciones de entrega', MAX_LENGTHS.deliveryNotes, false) || null;

  return { fullName, email, phone, shippingAddress, deliveryNotes };
}

export function assertValidCheckoutPayload(payload: unknown): CheckoutPayload {
  if (!payload || typeof payload !== 'object') throw new Error('Solicitud inválida.');
  const body = payload as Record<string, unknown>;
  const items = normalizeCheckoutItems(body.items);
  const customer = assertValidCustomer(body.customer);
  return { items, customer };
}
