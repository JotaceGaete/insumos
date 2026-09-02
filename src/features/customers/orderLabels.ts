// Shared Spanish translations for order-facing status/preference fields —
// presentation only, never mutates the underlying value. Source of truth
// for every value below is the live orders table CHECK constraints
// (orders_status_allowed, orders_payment_status_allowed, orders_delivery_
// method_check, orders_billing_document_type_check), confirmed directly
// against the schema in Etapa 6E's audit rather than assumed. Kept
// identical to the translations already approved for the admin customer
// profile (Etapa 4) — created here as the first shared copy now that a
// second real consumer (buyer /mi-cuenta) needs the same mapping; the
// admin component's own inline copy is left untouched to avoid touching
// already-approved, already-tested code for a pure refactor.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  fulfilled: 'Completado',
  pending: 'Pendiente',
  awaiting_payment: 'Esperando pago',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  fulfilled: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  awaiting_payment: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-red-50 text-red-700',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  shipping: 'Despacho',
  store_pickup: 'Retiro en tienda',
};

export const BILLING_DOCUMENT_LABELS: Record<string, string> = {
  boleta: 'Boleta',
  factura: 'Factura',
};

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function formatPaymentStatus(paymentStatus: string): string {
  return PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus;
}
