import type { CheckoutBillingData, CheckoutCustomerInput, CheckoutItemInput, CheckoutPayload, CheckoutShippingAddress } from './types';
import { isValidRegion, isValidRegionComuna } from './regionComuna';
import { isValidRut, normalizeRut } from './rut';
import { isValidFullName, normalizeFullName } from './name';
import { isValidEmail, normalizeEmail } from './email';
import { isValidChileanMobile } from './phone';
import { isValidBillingDocumentType, isValidCarrier, isValidDeliveryMethod, type BillingDocumentType, type DeliveryMethod, type PreferredCarrier } from './shipping';

// Loose but real: the server never trusts this alone — create_pending_order
// re-validates existence, status and stock. This just rejects obviously
// malformed payloads before they reach the database.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guards against typos/abuse (e.g. quantity: 999999999) reaching the RPC as a
// valid-looking integer. The real ceiling per product is max_quantity in the
// database; this is just a sanity bound independent of any one product.
export const MAX_ITEM_QUANTITY = 999;
export const MAX_ITEMS_PER_ORDER = 50;

const MAX_LENGTHS = {
  fullName: 120,
  email: 200,
  // Normalized phones are always exactly "+56" + 9 digits (12 chars) — see phone.ts.
  phone: 12,
  region: 100,
  comuna: 100,
  address: 200,
  number: 20,
  unit: 100,
  sector: 100,
  deliveryNotes: 500,
  rut: 12,
  businessName: 160,
  businessActivity: 160,
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

function assertRegionComuna(region: string, comuna: string, context: string) {
  if (!isValidRegion(region)) throw new Error(`${context}: la región no es válida.`);
  if (!isValidRegionComuna(region, comuna)) throw new Error(`${context}: la comuna no pertenece a la región seleccionada.`);
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

// fallbackAddress is null for store_pickup orders (there is no despacho
// address to copy from). In that case every billing field must be supplied
// explicitly — assertText below throws on the resulting empty string rather
// than silently persisting billing_data built from a pickup order's
// nonexistent shipping address.
function assertValidBillingData(raw: unknown, fallbackAddress: CheckoutShippingAddress | null): CheckoutBillingData {
  if (!raw || typeof raw !== 'object') throw new Error('Los datos de facturación son obligatorios para factura.');
  const input = raw as Record<string, unknown>;

  const rawRut = assertText(input.rut, 'El RUT', MAX_LENGTHS.rut);
  if (!isValidRut(rawRut)) throw new Error('El RUT no es válido.');
  const rut = normalizeRut(rawRut);

  const businessName = assertText(input.businessName, 'La razón social', MAX_LENGTHS.businessName);
  const businessActivity = assertText(input.businessActivity, 'El giro', MAX_LENGTHS.businessActivity);
  const email = assertText(input.email, 'El email de facturación', MAX_LENGTHS.email);
  if (!isValidEmail(email)) throw new Error('El email de facturación no es válido.');

  // "Usar misma dirección de despacho" is a pure client-side convenience —
  // the server only ever sees the resulting billing address fields, sent
  // either copied from shipping or entered separately. Either way they're
  // validated identically here, against the same region/comuna dataset.
  const region = assertText(input.region, 'La región de facturación', MAX_LENGTHS.region, false) || fallbackAddress?.region || '';
  const comuna = assertText(input.comuna, 'La comuna de facturación', MAX_LENGTHS.comuna, false) || fallbackAddress?.comuna || '';
  const address = assertText(input.address, 'La dirección de facturación', MAX_LENGTHS.address, false) || fallbackAddress?.address || '';
  const number = assertText(input.number, 'El número de facturación', MAX_LENGTHS.number, false) || fallbackAddress?.number || '';
  const unit = assertText(input.unit, 'La oficina/local/depto de facturación', MAX_LENGTHS.unit, false) || null;

  assertText(region, 'La región de facturación', MAX_LENGTHS.region);
  assertText(comuna, 'La comuna de facturación', MAX_LENGTHS.comuna);
  assertText(address, 'La dirección de facturación', MAX_LENGTHS.address);
  assertText(number, 'El número de facturación', MAX_LENGTHS.number);
  assertRegionComuna(region, comuna, 'Facturación');

  return { rut, businessName, businessActivity, email, region, comuna, address, number, unit };
}

export function assertValidCustomer(customer: unknown): CheckoutCustomerInput {
  if (!customer || typeof customer !== 'object') throw new Error('Los datos del comprador son obligatorios.');
  const input = customer as Record<string, unknown>;

  const rawFullName = assertText(input.fullName, 'El nombre completo', MAX_LENGTHS.fullName);
  if (!isValidFullName(rawFullName)) throw new Error('Ingresa un nombre válido.');
  const fullName = normalizeFullName(rawFullName);

  const rawEmail = assertText(input.email, 'El email', MAX_LENGTHS.email);
  if (!isValidEmail(rawEmail)) throw new Error('Ingresa un correo electrónico válido.');
  const email = normalizeEmail(rawEmail);

  const phone = assertText(input.phone, 'El teléfono', MAX_LENGTHS.phone);
  if (!isValidChileanMobile(phone)) throw new Error('Ingresa un celular chileno válido.');

  // Not sent by the client at all defaults to 'shipping', matching the UI's
  // own default — but anything sent must be one of the two real values.
  const deliveryMethod: DeliveryMethod = input.deliveryMethod === undefined
    ? 'shipping'
    : (() => {
      if (!isValidDeliveryMethod(input.deliveryMethod)) throw new Error('Selecciona una forma de entrega válida.');
      return input.deliveryMethod;
    })();

  let shippingAddress: CheckoutShippingAddress | null = null;
  let preferredCarrier: PreferredCarrier | null = null;

  if (deliveryMethod === 'shipping') {
    const rawAddress = input.shippingAddress;
    if (!rawAddress || typeof rawAddress !== 'object') throw new Error('La dirección de entrega es obligatoria.');
    const address = rawAddress as Record<string, unknown>;

    shippingAddress = {
      region: assertText(address.region, 'La región', MAX_LENGTHS.region),
      comuna: assertText(address.comuna, 'La comuna', MAX_LENGTHS.comuna),
      address: assertText(address.address, 'La dirección', MAX_LENGTHS.address),
      number: assertText(address.number, 'El número', MAX_LENGTHS.number),
      unit: assertText(address.unit, 'El departamento/casa', MAX_LENGTHS.unit, false) || null,
      sector: assertText(address.sector, 'La villa/población/sector', MAX_LENGTHS.sector, false) || null,
    };
    assertRegionComuna(shippingAddress.region, shippingAddress.comuna, 'Despacho');

    if (!isValidCarrier(input.preferredCarrier)) {
      throw new Error('Selecciona un transportista válido.');
    }
    preferredCarrier = input.preferredCarrier;
  }
  // store_pickup: shippingAddress and preferredCarrier stay null regardless
  // of whatever the client sent for them — there is no despacho for a
  // pickup order, so neither field has any authority here.

  const deliveryNotes = assertText(input.deliveryNotes, 'Las indicaciones de entrega', MAX_LENGTHS.deliveryNotes, false) || null;

  // Not sent by the client at all defaults to boleta, matching the UI's
  // own default — but anything sent must be one of the two real values.
  const billingDocumentType: BillingDocumentType = input.billingDocumentType === undefined
    ? 'boleta'
    : (() => {
      if (!isValidBillingDocumentType(input.billingDocumentType)) throw new Error('Selecciona un documento tributario válido.');
      return input.billingDocumentType;
    })();

  const billingData = billingDocumentType === 'factura'
    ? assertValidBillingData(input.billingData, shippingAddress)
    : null;

  return { fullName, email, phone, deliveryMethod, shippingAddress, deliveryNotes, preferredCarrier, billingDocumentType, billingData };
}

export function assertValidCheckoutPayload(payload: unknown): CheckoutPayload {
  if (!payload || typeof payload !== 'object') throw new Error('Solicitud inválida.');
  const body = payload as Record<string, unknown>;
  const items = normalizeCheckoutItems(body.items);
  const customer = assertValidCustomer(body.customer);
  return { items, customer };
}
