'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CARRIER_LABELS, type BillingDocumentType, type DeliveryMethod, type PreferredCarrier } from '@/features/checkout/shipping';

type CustomerProfileData = {
  id: string;
  fullName: string | null;
  emailNormalized: string;
  phoneNormalized: string | null;
  rutNormalized: string | null;
  createdAt: string;
  updatedAt: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  lastDeliveryMethod: DeliveryMethod | null;
  lastPreferredCarrier: PreferredCarrier | null;
  lastBillingDocumentType: BillingDocumentType | null;
};

type ShippingAddressSnapshot = {
  region: string;
  comuna: string;
  address: string;
  number: string;
  unit: string | null;
  sector: string | null;
};

type CustomerOrderSummary = {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  paymentStatus: string;
  deliveryMethod: DeliveryMethod;
  preferredCarrier: PreferredCarrier | null;
  billingDocumentType: BillingDocumentType;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: ShippingAddressSnapshot | null;
};

type DetailResponse = { customer: CustomerProfileData; orders: CustomerOrderSummary[] };

const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  shipping: 'Despacho',
  store_pickup: 'Retiro en tienda',
};

const BILLING_DOCUMENT_LABELS: Record<BillingDocumentType, string> = {
  boleta: 'Boleta',
  factura: 'Factura',
};

// Subtle, not exaggerated — light background + matching text, same shape as
// every other status pill already used in the admin (rounded-full px-2 py-1
// text-xs), just one color per order status so paid/fulfilled/pending/
// awaiting_payment/cancelled read apart from each other at a glance.
const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  fulfilled: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  awaiting_payment: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-red-50 text-red-700',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  fulfilled: 'Completado',
  pending: 'Pendiente',
  awaiting_payment: 'Esperando pago',
  cancelled: 'Cancelado',
};

// Presentation-only — the underlying payment_status value from the backend
// is never touched, this only decides what text renders. An unrecognized
// future value falls back to itself rather than guessing a translation.
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

function formatPaymentStatus(paymentStatus: string): string {
  return PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function OrderStatusBadge({ status }: { status: string }) {
  const style = ORDER_STATUS_STYLES[status] || 'bg-stone-100 text-stone-700';
  const label = ORDER_STATUS_LABELS[status] || status;
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${style}`}>{label}</span>;
}

export function CustomerProfile({ customerId }: { customerId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/insumos/admin/customers/${customerId}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'No fue posible cargar el cliente.');
        setData(body as DetailResponse);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Error inesperado.'))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <p className="py-10 text-center text-stone-500">Cargando cliente...</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return null;

  const { customer, orders } = data;

  return (
    <section className="space-y-6">
      <div>
        <Link href="/admin/clientes" className="text-sm font-medium text-amber-800 hover:underline">← Clientes</Link>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">{customer.fullName || '—'}</h1>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-stone-600 sm:grid-cols-2">
          <div><dt className="inline text-stone-400">Email: </dt><dd className="inline">{customer.emailNormalized}</dd></div>
          <div><dt className="inline text-stone-400">Teléfono: </dt><dd className="inline">{customer.phoneNormalized || '—'}</dd></div>
          <div><dt className="inline text-stone-400">RUT: </dt><dd className="inline">{customer.rutNormalized || '—'}</dd></div>
          <div><dt className="inline text-stone-400">Cliente desde: </dt><dd className="inline">{formatDate(customer.createdAt)}</dd></div>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Compras</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{customer.totalOrders}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Total gastado</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{formatPrice(customer.totalSpent)}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Ticket promedio</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{customer.averageOrderValue === null ? '—' : formatPrice(customer.averageOrderValue)}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Primera compra</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{formatDate(customer.firstOrderAt)}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Última compra</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{formatDate(customer.lastOrderAt)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900">Datos del último pedido</h2>
        <p className="mt-1 text-xs text-stone-500">Información registrada en el pedido más reciente del cliente.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-stone-600 sm:grid-cols-3">
          <div><dt className="inline text-stone-400">Entrega: </dt><dd className="inline">{customer.lastDeliveryMethod ? DELIVERY_METHOD_LABELS[customer.lastDeliveryMethod] : '—'}</dd></div>
          <div><dt className="inline text-stone-400">Transportista: </dt><dd className="inline">{customer.lastPreferredCarrier ? CARRIER_LABELS[customer.lastPreferredCarrier] : '—'}</dd></div>
          <div><dt className="inline text-stone-400">Documento: </dt><dd className="inline">{customer.lastBillingDocumentType ? BILLING_DOCUMENT_LABELS[customer.lastBillingDocumentType] : '—'}</dd></div>
        </dl>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-stone-900">Historial de pedidos</h2>
        {orders.length === 0 ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-white px-4 py-10 text-center text-stone-500">
            Este cliente todavía no tiene pedidos.
          </div>
        ) : (
          <>
            <div className="mt-3 hidden overflow-x-auto rounded-lg border border-stone-200 bg-white md:block">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3">Entrega</th>
                    <th className="px-4 py-3">Transportista</th>
                    <th className="px-4 py-3">Documento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-mono text-xs text-stone-500">{shortId(order.id)}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDateTime(order.createdAt)}</td>
                      <td className="px-4 py-3 text-stone-900">{formatPrice(order.total)}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 text-stone-600">{formatPaymentStatus(order.paymentStatus)}</td>
                      <td className="px-4 py-3 text-stone-600">{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</td>
                      <td className="px-4 py-3 text-stone-600">{order.preferredCarrier ? CARRIER_LABELS[order.preferredCarrier] : '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{BILLING_DOCUMENT_LABELS[order.billingDocumentType]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-3 space-y-3 md:hidden">
              {orders.map((order) => (
                <li key={order.id} className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-stone-500">{shortId(order.id)}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-xs text-stone-500">{formatDateTime(order.createdAt)}</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{formatPrice(order.total)}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-stone-600">
                    <span>Pago: {formatPaymentStatus(order.paymentStatus)}</span>
                    <span>{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</span>
                    <span>{order.preferredCarrier ? CARRIER_LABELS[order.preferredCarrier] : '—'}</span>
                    <span>{BILLING_DOCUMENT_LABELS[order.billingDocumentType]}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
