'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Truck } from 'lucide-react';
import { useInsumosCart } from '@/features/cart/CartProvider';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

type CheckoutForm = {
  fullName: string;
  email: string;
  phone: string;
  region: string;
  comuna: string;
  address: string;
  number: string;
  unit: string;
  deliveryNotes: string;
};

const emptyForm: CheckoutForm = {
  fullName: '', email: '', phone: '', region: '', comuna: '', address: '', number: '', unit: '', deliveryNotes: '',
};

const inputClass = 'mt-1 w-full rounded-lg border border-insumos-line bg-white px-3 py-2.5 text-sm text-insumos-ink outline-none focus:border-insumos-forest focus:ring-2 focus:ring-insumos-mint';
const labelClass = 'block text-sm font-semibold text-insumos-ink';

export default function FinalizarCompraPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, hydrated } = useInsumosCart();
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // clearCart() re-renders this still-mounted page with items.length === 0
  // before router.push to the confirmation page actually navigates away —
  // without this flag, the empty-cart guard below (meant for someone who
  // opens /finalizar-compra directly with nothing in their cart) would win
  // that race and bounce a just-completed order back to /carrito instead.
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    if (hydrated && items.length === 0 && !orderPlaced) router.replace('/carrito');
  }, [hydrated, items.length, orderPlaced, router]);

  function updateField<K extends keyof CheckoutForm>(field: K, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.region.trim() || !form.comuna.trim() || !form.address.trim() || !form.number.trim()) {
      setErrorMessage('Completa todos los campos obligatorios.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/insumos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
          customer: {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            shippingAddress: {
              region: form.region.trim(),
              comuna: form.comuna.trim(),
              address: form.address.trim(),
              number: form.number.trim(),
              unit: form.unit.trim() || null,
            },
            deliveryNotes: form.deliveryNotes.trim() || null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.message || 'No pudimos crear tu pedido. Intenta nuevamente.');
        setSubmitting(false);
        return;
      }
      // Only clear the cart once the server has actually confirmed the order —
      // on any failure above (or thrown below) the cart stays exactly as it was.
      setOrderPlaced(true);
      clearCart();
      router.push(`/pedido/${data.orderId}/confirmacion?token=${encodeURIComponent(data.confirmationToken)}`);
    } catch {
      setErrorMessage('No pudimos conectar con el servidor. Intenta nuevamente.');
      setSubmitting(false);
    }
  }

  if (!hydrated || (items.length === 0 && !orderPlaced)) {
    return <div className="min-h-screen bg-insumos-cream" />;
  }

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/carrito" className="inline-flex items-center gap-1.5 text-sm font-semibold text-insumos-forest hover:text-insumos-forest-dark">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al carrito
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-insumos-ink sm:text-3xl">Finalizar compra</h1>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
          <div className="space-y-6 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-base font-bold text-insumos-ink">Datos del cliente</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="fullName">Nombre completo</label>
                  <input id="fullName" required maxLength={120} className={inputClass} value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="email">Email</label>
                  <input id="email" type="email" required maxLength={200} className={inputClass} value={form.email} onChange={(event) => updateField('email', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="phone">Teléfono</label>
                  <input id="phone" type="tel" required maxLength={40} className={inputClass} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-insumos-line pt-6">
              <h2 className="text-base font-bold text-insumos-ink">Datos de entrega</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="region">Región</label>
                  <input id="region" required maxLength={100} className={inputClass} value={form.region} onChange={(event) => updateField('region', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="comuna">Comuna</label>
                  <input id="comuna" required maxLength={100} className={inputClass} value={form.comuna} onChange={(event) => updateField('comuna', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="address">Dirección</label>
                  <input id="address" required maxLength={200} className={inputClass} value={form.address} onChange={(event) => updateField('address', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="number">Número</label>
                  <input id="number" required maxLength={20} className={inputClass} value={form.number} onChange={(event) => updateField('number', event.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="unit">Departamento/casa (opcional)</label>
                  <input id="unit" maxLength={100} className={inputClass} value={form.unit} onChange={(event) => updateField('unit', event.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="deliveryNotes">Indicaciones de entrega (opcional)</label>
                  <textarea id="deliveryNotes" maxLength={500} rows={3} className={inputClass} value={form.deliveryNotes} onChange={(event) => updateField('deliveryNotes', event.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-insumos-cream px-4 py-3 text-sm text-stone-600">
              <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-insumos-sage" aria-hidden />
              <span>El despacho se coordina por separado y todavía no tiene una tarifa definida. Te contactaremos para confirmarlo.</span>
            </div>

            {errorMessage && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-insumos-forest px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Enviando pedido...' : 'Confirmar pedido'}
            </button>
          </div>

          <aside className="rounded-2xl border border-insumos-line bg-white p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-base font-bold text-insumos-ink">Resumen del pedido</h2>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={`${item.productId}:${item.variantId}`} className="flex gap-3">
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-insumos-line bg-insumos-cream">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.productName} className="absolute inset-0 h-full w-full object-contain p-1" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[9px] font-medium text-insumos-sage">Sin imagen</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold text-insumos-ink">{item.productName}</p>
                    <p className="text-xs text-stone-500">{item.variantName} · x{item.quantity}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{formatPrice(item.unitPrice)} c/u</p>
                  </div>
                  <p className="flex-shrink-0 text-sm font-semibold text-insumos-ink">{formatPrice(item.unitPrice * item.quantity)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-insumos-line pt-4 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>Subtotal productos</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span>Despacho</span>
                <span>Por coordinar</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-insumos-line pt-3 text-base font-extrabold text-insumos-ink">
              <span>Total productos</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              El costo de despacho todavía no está incluido y se sumará al confirmar el envío contigo.
            </p>
          </aside>
        </form>
      </section>
    </div>
  );
}
