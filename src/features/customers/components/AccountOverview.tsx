import Link from 'next/link';
import type { BuyerAccount } from '@/features/auth/types';
import type { CustomerCommercialSummary, CustomerOrderSummary } from '../types';
import { DELIVERY_METHOD_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, formatPaymentStatus } from '../orderLabels';

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

function deliveryLabel(method: string) {
  return DELIVERY_METHOD_LABELS[method] || method;
}

export function AccountOverview({
  account,
  summary,
  orders,
}: {
  account: BuyerAccount;
  summary: CustomerCommercialSummary;
  orders: CustomerOrderSummary[];
}) {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Mi cuenta</h1>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-stone-600 sm:grid-cols-3">
          <div><dt className="inline text-stone-400">Nombre: </dt><dd className="inline">{account.displayName || '—'}</dd></div>
          <div><dt className="inline text-stone-400">Email: </dt><dd className="inline">{account.email}</dd></div>
          <div><dt className="inline text-stone-400">Teléfono: </dt><dd className="inline">{account.phoneNormalized || '—'}</dd></div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Compras</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{summary.totalOrders}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Total gastado</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{formatPrice(summary.totalSpent)}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">Última compra</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{formatDate(summary.lastOrderAt)}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-stone-900">Historial de pedidos</h2>
        {orders.length === 0 ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-white px-4 py-10 text-center text-stone-500">
            <p>Todavía no tienes pedidos.</p>
            <Link
              href="/productos"
              className="mt-4 inline-block rounded-md bg-insumos-forest px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop: table. Mobile: cards — same pattern as the admin
                customer profile, matching the existing visual language. */}
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
                      <td className="px-4 py-3 text-stone-600">{deliveryLabel(order.deliveryMethod)}</td>
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
                    <span>{deliveryLabel(order.deliveryMethod)}</span>
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
