import Link from 'next/link';
import { Clock } from 'lucide-react';

type PagoRetornoPageProps = {
  searchParams: Promise<{ order_id?: string; status?: string; collection_status?: string }>;
};

// This page is UX-only. It NEVER treats a querystring value — from Mercado
// Pago or our own mock provider — as proof of payment, no matter what
// `status`/`collection_status` says (including 'approved'): a browser
// return is trivially spoofable and is never the authority for order or
// payment state. The only future authority for that will be a webhook +
// server-side consultation with the payment provider (Etapa 2, not yet
// built). This page deliberately does not call confirm_order_paid or write
// to payment_status — it only reads searchParams to decide which secondary
// hint to show underneath the one message that's always true regardless of
// status: we are still verifying.
export default async function PagoRetornoPage({ searchParams }: PagoRetornoPageProps) {
  const { order_id: orderId, status, collection_status: collectionStatus } = await searchParams;
  const effectiveStatus = (status || collectionStatus || '').toLowerCase();
  const looksRejected = effectiveStatus === 'rejected' || effectiveStatus === 'cancelled';

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-insumos-mint text-insumos-forest">
          <Clock className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-insumos-ink sm:text-3xl">
          Estamos verificando tu pago
        </h1>
        <p className="mt-3 max-w-md text-sm text-stone-600">
          Tu pedido ya fue registrado. Estamos confirmando el estado de tu pago con el medio de pago — este proceso
          puede tardar unos minutos. Te avisaremos por correo apenas quede confirmado.
        </p>
        {orderId && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-insumos-sage">
            N.º de pedido: {orderId}
          </p>
        )}
        {looksRejected && (
          <p className="mt-4 max-w-md text-sm text-stone-600">
            Si tu pago no se completó, puedes volver a intentarlo desde tu carrito.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 rounded-full bg-insumos-forest px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark"
          >
            Seguir explorando productos
          </Link>
          {looksRejected && (
            <Link
              href="/carrito"
              className="inline-flex items-center gap-2 rounded-full border border-insumos-line px-6 py-3 text-sm font-semibold text-insumos-ink transition-colors hover:bg-white"
            >
              Volver al carrito
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
