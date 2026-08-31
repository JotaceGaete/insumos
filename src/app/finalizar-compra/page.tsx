'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Truck } from 'lucide-react';
import { useInsumosCart } from '@/features/cart/CartProvider';
import { listComunasForRegion, listRegionNames } from '@/features/checkout/regionComuna';
import {
  BILLING_DOCUMENT_TYPES,
  CARRIER_LABELS,
  FREE_SHIPPING_THRESHOLD,
  PREFERRED_CARRIERS,
  amountUntilFreeShipping,
  computeShippingPolicy,
  type BillingDocumentType,
  type PreferredCarrier,
} from '@/features/checkout/shipping';
import { isValidRut } from '@/features/checkout/rut';

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
  preferredCarrier: PreferredCarrier;
  billingDocumentType: BillingDocumentType;
  useSameAddressForBilling: boolean;
  billingRut: string;
  businessName: string;
  businessActivity: string;
  billingEmail: string;
  billingRegion: string;
  billingComuna: string;
  billingAddress: string;
  billingNumber: string;
  billingUnit: string;
};

const emptyForm: CheckoutForm = {
  fullName: '', email: '', phone: '', region: '', comuna: '', address: '', number: '', unit: '', deliveryNotes: '',
  preferredCarrier: 'starken',
  billingDocumentType: 'boleta',
  useSameAddressForBilling: true,
  billingRut: '', businessName: '', businessActivity: '', billingEmail: '',
  billingRegion: '', billingComuna: '', billingAddress: '', billingNumber: '', billingUnit: '',
};

const inputClass = 'mt-1 w-full rounded-lg border border-insumos-line bg-white px-3 py-2.5 text-sm text-insumos-ink outline-none focus:border-insumos-forest focus:ring-2 focus:ring-insumos-mint disabled:bg-insumos-cream disabled:text-stone-400';
const labelClass = 'block text-sm font-semibold text-insumos-ink';
const REGION_NAMES = listRegionNames();

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

  const shippingPolicy = useMemo(() => computeShippingPolicy(subtotal), [subtotal]);
  const remainderForFreeShipping = useMemo(() => amountUntilFreeShipping(subtotal), [subtotal]);
  const comunasForRegion = useMemo(() => listComunasForRegion(form.region), [form.region]);
  const billingComunasForRegion = useMemo(() => listComunasForRegion(form.billingRegion), [form.billingRegion]);
  const isFactura = form.billingDocumentType === 'factura';

  function updateField<K extends keyof CheckoutForm>(field: K, value: CheckoutForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateRegion(region: string) {
    // Changing region invalidates whatever comuna was picked before —
    // reset it rather than leave a comuna selected that no longer belongs
    // to the new region.
    setForm((current) => ({ ...current, region, comuna: '' }));
  }

  function updateBillingRegion(region: string) {
    setForm((current) => ({ ...current, billingRegion: region, billingComuna: '' }));
  }

  // "Usar misma dirección de despacho": while checked, billing address
  // fields stay mirrored to shipping — including when the buyer edits
  // shipping *after* checking the box. Unchecking lets them diverge; the
  // buyer can always re-check to resync.
  useEffect(() => {
    if (!form.useSameAddressForBilling) return;
    setForm((current) => {
      if (
        current.billingRegion === current.region
        && current.billingComuna === current.comuna
        && current.billingAddress === current.address
        && current.billingNumber === current.number
        && current.billingUnit === current.unit
      ) return current;
      return {
        ...current,
        billingRegion: current.region,
        billingComuna: current.comuna,
        billingAddress: current.address,
        billingNumber: current.number,
        billingUnit: current.unit,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.useSameAddressForBilling, form.region, form.comuna, form.address, form.number, form.unit]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.region.trim() || !form.comuna.trim() || !form.address.trim() || !form.number.trim()) {
      setErrorMessage('Completa todos los campos obligatorios.');
      return;
    }
    if (isFactura) {
      if (!isValidRut(form.billingRut)) {
        setErrorMessage('Ingresa un RUT válido para la factura.');
        return;
      }
      if (!form.businessName.trim() || !form.businessActivity.trim() || !form.billingEmail.trim() || !form.billingRegion.trim() || !form.billingComuna.trim() || !form.billingAddress.trim() || !form.billingNumber.trim()) {
        setErrorMessage('Completa todos los datos de facturación.');
        return;
      }
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
            preferredCarrier: form.preferredCarrier,
            billingDocumentType: form.billingDocumentType,
            billingData: isFactura ? {
              rut: form.billingRut.trim(),
              businessName: form.businessName.trim(),
              businessActivity: form.businessActivity.trim(),
              email: form.billingEmail.trim(),
              region: form.billingRegion.trim(),
              comuna: form.billingComuna.trim(),
              address: form.billingAddress.trim(),
              number: form.billingNumber.trim(),
              unit: form.billingUnit.trim() || null,
            } : null,
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
          <div className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-insumos-ink">1. Datos de contacto</h2>
              <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-4 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-insumos-ink">2. Dirección de despacho</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="region">Región</label>
                  <select id="region" required className={inputClass} value={form.region} onChange={(event) => updateRegion(event.target.value)}>
                    <option value="">Selecciona una región</option>
                    {REGION_NAMES.map((region) => <option key={region} value={region}>{region}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="comuna">Comuna</label>
                  <select id="comuna" required disabled={!form.region} className={inputClass} value={form.comuna} onChange={(event) => updateField('comuna', event.target.value)}>
                    <option value="">{form.region ? 'Selecciona una comuna' : 'Elige primero una región'}</option>
                    {comunasForRegion.map((comuna) => <option key={comuna} value={comuna}>{comuna}</option>)}
                  </select>
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

            <div className="space-y-3 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-insumos-ink">3. Transportista</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {PREFERRED_CARRIERS.map((carrier) => (
                  <label
                    key={carrier}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      form.preferredCarrier === carrier ? 'border-insumos-forest bg-insumos-mint text-insumos-forest' : 'border-insumos-line text-stone-600 hover:bg-insumos-cream'
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferredCarrier"
                      value={carrier}
                      checked={form.preferredCarrier === carrier}
                      onChange={() => updateField('preferredCarrier', carrier)}
                      className="sr-only"
                    />
                    {CARRIER_LABELS[carrier]}
                  </label>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-insumos-cream px-4 py-3 text-sm text-stone-600">
                <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-insumos-sage" aria-hidden />
                {shippingPolicy === 'free' ? (
                  <span>Envío gratis mediante uno de nuestros transportistas disponibles. Tu preferencia queda registrada, pero ArteInsumos podría usar otro transportista si fuera necesario para completar tu envío.</span>
                ) : (
                  <span>Para pedidos menores a {formatPrice(FREE_SHIPPING_THRESHOLD)}, el envío se despacha por pagar mediante el transportista que selecciones.</span>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-insumos-ink">4. Documento tributario</h2>
              <div className="grid grid-cols-2 gap-2">
                {BILLING_DOCUMENT_TYPES.map((docType) => (
                  <label
                    key={docType}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${
                      form.billingDocumentType === docType ? 'border-insumos-forest bg-insumos-mint text-insumos-forest' : 'border-insumos-line text-stone-600 hover:bg-insumos-cream'
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingDocumentType"
                      value={docType}
                      checked={form.billingDocumentType === docType}
                      onChange={() => updateField('billingDocumentType', docType)}
                      className="sr-only"
                    />
                    {docType}
                  </label>
                ))}
              </div>

              {isFactura && (
                <div className="space-y-4 border-t border-insumos-line pt-4">
                  <h3 className="text-sm font-bold text-insumos-ink">Datos de facturación</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="billingRut">RUT</label>
                      <input id="billingRut" required placeholder="12.345.678-5" maxLength={12} className={inputClass} value={form.billingRut} onChange={(event) => updateField('billingRut', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="businessName">Razón social</label>
                      <input id="businessName" required maxLength={160} className={inputClass} value={form.businessName} onChange={(event) => updateField('businessName', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="businessActivity">Giro</label>
                      <input id="businessActivity" required maxLength={160} className={inputClass} value={form.businessActivity} onChange={(event) => updateField('businessActivity', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingEmail">Email de facturación</label>
                      <input id="billingEmail" type="email" required maxLength={200} className={inputClass} value={form.billingEmail} onChange={(event) => updateField('billingEmail', event.target.value)} />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-insumos-ink">
                    <input
                      type="checkbox"
                      checked={form.useSameAddressForBilling}
                      onChange={(event) => updateField('useSameAddressForBilling', event.target.checked)}
                      className="h-4 w-4 rounded border-insumos-line text-insumos-forest focus:ring-insumos-mint"
                    />
                    Usar misma dirección de despacho
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="billingRegion">Región</label>
                      <select id="billingRegion" required disabled={form.useSameAddressForBilling} className={inputClass} value={form.billingRegion} onChange={(event) => updateBillingRegion(event.target.value)}>
                        <option value="">Selecciona una región</option>
                        {REGION_NAMES.map((region) => <option key={region} value={region}>{region}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingComuna">Comuna</label>
                      <select id="billingComuna" required disabled={form.useSameAddressForBilling || !form.billingRegion} className={inputClass} value={form.billingComuna} onChange={(event) => updateField('billingComuna', event.target.value)}>
                        <option value="">{form.billingRegion ? 'Selecciona una comuna' : 'Elige primero una región'}</option>
                        {billingComunasForRegion.map((comuna) => <option key={comuna} value={comuna}>{comuna}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingAddress">Dirección</label>
                      <input id="billingAddress" required disabled={form.useSameAddressForBilling} maxLength={200} className={inputClass} value={form.billingAddress} onChange={(event) => updateField('billingAddress', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingNumber">Número</label>
                      <input id="billingNumber" required disabled={form.useSameAddressForBilling} maxLength={20} className={inputClass} value={form.billingNumber} onChange={(event) => updateField('billingNumber', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingUnit">Oficina/local/depto (opcional)</label>
                      <input id="billingUnit" disabled={form.useSameAddressForBilling} maxLength={100} className={inputClass} value={form.billingUnit} onChange={(event) => updateField('billingUnit', event.target.value)} />
                    </div>
                  </div>
                </div>
              )}
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
                <span className={shippingPolicy === 'free' ? 'font-semibold text-insumos-forest' : ''}>{shippingPolicy === 'free' ? 'GRATIS' : 'Por pagar'}</span>
              </div>
            </div>

            {shippingPolicy === 'free' ? (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-insumos-mint px-3 py-2 text-xs font-semibold text-insumos-forest">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden />
                ¡Tu pedido tiene envío gratis!
              </p>
            ) : (
              <div className="mt-3 rounded-lg bg-insumos-cream px-3 py-2.5">
                <p className="text-xs font-semibold text-insumos-ink">
                  Te faltan {formatPrice(remainderForFreeShipping)} para obtener envío gratis.
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-insumos-line">
                  <div className="h-full rounded-full bg-insumos-forest transition-all" style={{ width: `${Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }} />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-insumos-line pt-3 text-base font-extrabold text-insumos-ink">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              {shippingPolicy === 'free'
                ? 'El envío está incluido en este total.'
                : 'El costo de despacho se paga aparte, directamente al transportista, y no está incluido en este total.'}
            </p>
          </aside>
        </form>
      </section>
    </div>
  );
}
