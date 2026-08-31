import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getOrderConfirmation } from '@/features/checkout/server/queries';
import { CARRIER_LABELS } from '@/features/checkout/shipping';
import { formatRut } from '@/features/checkout/rut';

type ConfirmationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

// The order id alone is not a secret (it's a sequential-looking UUID exposed
// in the redirect URL). Access is gated by also matching confirmation_token,
// a value only the buyer's own browser receives at checkout — see
// getOrderConfirmation. Missing/wrong token renders the same notFound() as a
// missing order, so it never confirms whether an id exists.
export default async function OrderConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const order = await getOrderConfirmation(id, token);
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-insumos-mint text-insumos-forest">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-insumos-ink sm:text-3xl">Pedido recibido</h1>
          <p className="mt-2 max-w-md text-sm text-stone-600">
            Hemos recibido tu solicitud de compra. El despacho y el pago se confirmarán en el siguiente paso.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-insumos-sage">N.º de pedido: {order.id}</p>
        </div>

        <div className="mt-8 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-insumos-ink">Datos del comprador</h2>
          <dl className="mt-3 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-insumos-ink">Nombre</dt>
              <dd>{order.customerName}</dd>
            </div>
            <div>
              <dt className="font-semibold text-insumos-ink">Email</dt>
              <dd>{order.customerEmail}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-insumos-ink">Despacho y facturación</h2>
          <dl className="mt-3 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-insumos-ink">Documento</dt>
              <dd className="capitalize">{order.billingDocumentType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-insumos-ink">Transportista preferido</dt>
              <dd>{order.preferredCarrier ? CARRIER_LABELS[order.preferredCarrier] : 'No especificado'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-insumos-ink">Despacho</dt>
              <dd>{order.shippingPolicy === 'free' ? 'Envío gratis' : 'Envío por pagar'}</dd>
            </div>
            {order.billingDocumentType === 'factura' && order.billingData && (
              <div>
                <dt className="font-semibold text-insumos-ink">Facturar a</dt>
                <dd>{order.billingData.businessName} · {formatRut(order.billingData.rut)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-insumos-ink">Productos</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((item) => (
              <li key={`${item.productId}:${item.variantId}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-insumos-ink">{item.productName}</p>
                  <p className="text-xs text-stone-500">{item.variantName} · x{item.quantity}</p>
                </div>
                <p className="flex-shrink-0 font-semibold text-insumos-ink">{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2 border-t border-insumos-line pt-4 text-sm">
            <div className="flex items-center justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-stone-600">
              <span>Despacho</span>
              <span>{order.shippingPolicy === 'free' ? 'Gratis' : 'Por pagar'}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-insumos-line pt-3 text-base font-extrabold text-insumos-ink">
            <span>Total productos</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            {order.shippingPolicy === 'free'
              ? 'El envío está incluido en este total.'
              : 'El costo de despacho se paga aparte, directamente al transportista, y no está incluido en este total.'}
          </p>
        </div>

        <Link href="/productos" className="mt-6 block text-center text-sm font-semibold text-insumos-forest hover:underline">
          Seguir explorando productos
        </Link>
      </section>
    </div>
  );
}
