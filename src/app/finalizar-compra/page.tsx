'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Minus, Plus, Store, Trash2, Truck } from 'lucide-react';
import { useInsumosCart } from '@/features/cart/CartProvider';
import { listComunasForRegion, listRegionNames } from '@/features/checkout/regionComuna';
import {
  BILLING_DOCUMENT_TYPES,
  CARRIER_LABELS,
  DELIVERY_METHODS,
  FREE_SHIPPING_THRESHOLD,
  PREFERRED_CARRIERS,
  amountUntilFreeShipping,
  computeShippingPolicy,
  type BillingDocumentType,
  type DeliveryMethod,
  type PreferredCarrier,
} from '@/features/checkout/shipping';
import { isValidRut } from '@/features/checkout/rut';
import { isValidFullName } from '@/features/checkout/name';
import { isValidEmail } from '@/features/checkout/email';
import { CHILE_COUNTRY_CODE, isValidChileanMobile, normalizeChileanMobile, sanitizeNationalDigits } from '@/features/checkout/phone';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  shipping: 'Despacho',
  store_pickup: 'Retiro en tienda — Gratis',
};

type CheckoutForm = {
  fullName: string;
  email: string;
  phoneDigits: string;
  deliveryMethod: DeliveryMethod;
  region: string;
  comuna: string;
  address: string;
  number: string;
  unit: string;
  sector: string;
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
  fullName: '', email: '', phoneDigits: '', deliveryMethod: 'shipping',
  region: '', comuna: '', address: '', number: '', unit: '', sector: '', deliveryNotes: '',
  preferredCarrier: 'starken',
  billingDocumentType: 'boleta',
  useSameAddressForBilling: true,
  billingRut: '', businessName: '', businessActivity: '', billingEmail: '',
  billingRegion: '', billingComuna: '', billingAddress: '', billingNumber: '', billingUnit: '',
};

type TouchedFields = { fullName: boolean; email: boolean; phone: boolean };
const emptyTouched: TouchedFields = { fullName: false, email: false, phone: false };

const inputClass = 'mt-1 w-full rounded-lg border border-insumos-line bg-white px-3 py-2.5 text-sm text-insumos-ink outline-none focus:border-insumos-forest focus:ring-2 focus:ring-insumos-mint disabled:bg-insumos-cream disabled:text-stone-400';
const errorInputClass = 'mt-1 w-full rounded-lg border border-red-400 bg-white px-3 py-2.5 text-sm text-insumos-ink outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100';
const labelClass = 'block text-sm font-semibold text-insumos-ink';
const fieldErrorClass = 'mt-1 text-xs font-semibold text-red-600';
const REGION_NAMES = listRegionNames();

export default function FinalizarCompraPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, hydrated, increment, decrement, removeItem } = useInsumosCart();
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [touched, setTouched] = useState<TouchedFields>(emptyTouched);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // clearCart() re-renders this still-mounted page with items.length === 0
  // before the browser actually leaves for paymentUrl — without this flag,
  // the empty-cart guard below (meant for someone who opens
  // /finalizar-compra directly with nothing in their cart) would win that
  // race and bounce a just-completed order back to /carrito instead.
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    if (hydrated && items.length === 0 && !orderPlaced) router.replace('/carrito');
  }, [hydrated, items.length, orderPlaced, router]);

  const isShipping = form.deliveryMethod === 'shipping';
  // Sections 3 (Dirección) and 4 (Transportista) only exist for shipping —
  // renumber so store_pickup goes straight from 2 to 3 instead of jumping
  // to 5, rather than leaving gaps where hidden sections used to be.
  const addressSectionNumber = 3;
  const carrierSectionNumber = 4;
  const documentSectionNumber = isShipping ? 5 : 3;
  const shippingPolicy = useMemo(() => computeShippingPolicy(subtotal), [subtotal]);
  const remainderForFreeShipping = useMemo(() => amountUntilFreeShipping(subtotal), [subtotal]);
  const comunasForRegion = useMemo(() => listComunasForRegion(form.region), [form.region]);
  const billingComunasForRegion = useMemo(() => listComunasForRegion(form.billingRegion), [form.billingRegion]);
  const isFactura = form.billingDocumentType === 'factura';

  // Only flag a format error once the field has been touched (blurred) and
  // actually holds something — an empty untouched field, or one the buyer
  // hasn't left yet, never shows red. Emptiness itself is caught by the
  // top-of-form "completa los campos obligatorios" message on submit.
  const fullNameError = touched.fullName && form.fullName.trim().length > 0 && !isValidFullName(form.fullName)
    ? 'Ingresa un nombre válido.' : null;
  const emailError = touched.email && form.email.trim().length > 0 && !isValidEmail(form.email)
    ? 'Ingresa un correo electrónico válido.' : null;
  const normalizedPhone = normalizeChileanMobile(form.phoneDigits);
  const phoneError = touched.phone && form.phoneDigits.length > 0 && !isValidChileanMobile(normalizedPhone)
    ? 'Ingresa un celular chileno válido.' : null;

  function updateField<K extends keyof CheckoutForm>(field: K, value: CheckoutForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function markTouched(field: keyof TouchedFields) {
    setTouched((current) => ({ ...current, [field]: true }));
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

  function updateDeliveryMethod(deliveryMethod: DeliveryMethod) {
    setForm((current) => {
      if (deliveryMethod === 'store_pickup') {
        // Retiro en tienda has no despacho address, so the "usar misma
        // dirección" convenience makes no sense — force it off and clear
        // whatever billing address might have been synced from shipping,
        // rather than let a now-nonexistent shipping address linger as a
        // stale billing address.
        return {
          ...current,
          deliveryMethod,
          useSameAddressForBilling: false,
          billingRegion: '', billingComuna: '', billingAddress: '', billingNumber: '', billingUnit: '',
        };
      }
      return { ...current, deliveryMethod };
    });
  }

  // "Usar misma dirección de despacho": while checked, billing address
  // fields stay mirrored to shipping — including when the buyer edits
  // shipping *after* checking the box. Unchecking lets them diverge; the
  // buyer can always re-check to resync. Never runs for store_pickup — the
  // checkbox is hidden and forced off there (see updateDeliveryMethod).
  useEffect(() => {
    if (!isShipping || !form.useSameAddressForBilling) return;
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
  }, [isShipping, form.useSameAddressForBilling, form.region, form.comuna, form.address, form.number, form.unit]);

  // Moving the CTA into the summary card (far from the fields it validates)
  // means the top-of-form error banner alone can go unnoticed — scroll to
  // and focus the first invalid field so the buyer sees exactly what to fix.
  function focusField(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus({ preventScroll: true });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setTouched({ fullName: true, email: true, phone: true });

    if (!form.fullName.trim() || !form.email.trim() || !form.phoneDigits.trim()) {
      setErrorMessage('Completa todos los campos obligatorios.');
      focusField(!form.fullName.trim() ? 'fullName' : !form.email.trim() ? 'email' : 'phone');
      return;
    }
    if (!isValidFullName(form.fullName)) {
      setErrorMessage('Ingresa un nombre válido.');
      focusField('fullName');
      return;
    }
    if (!isValidEmail(form.email)) {
      setErrorMessage('Ingresa un correo electrónico válido.');
      focusField('email');
      return;
    }
    if (!isValidChileanMobile(normalizedPhone)) {
      setErrorMessage('Ingresa un celular chileno válido.');
      focusField('phone');
      return;
    }
    if (isShipping && (!form.region.trim() || !form.comuna.trim() || !form.address.trim() || !form.number.trim())) {
      setErrorMessage('Completa todos los campos obligatorios.');
      focusField(!form.region.trim() ? 'region' : !form.comuna.trim() ? 'comuna' : !form.address.trim() ? 'address' : 'number');
      return;
    }
    if (isFactura) {
      if (!isValidRut(form.billingRut)) {
        setErrorMessage('Ingresa un RUT válido para la factura.');
        focusField('billingRut');
        return;
      }
      if (!form.businessName.trim() || !form.businessActivity.trim() || !form.billingEmail.trim() || !form.billingRegion.trim() || !form.billingComuna.trim() || !form.billingAddress.trim() || !form.billingNumber.trim()) {
        setErrorMessage('Completa todos los datos de facturación.');
        focusField(
          !form.businessName.trim() ? 'businessName'
            : !form.businessActivity.trim() ? 'businessActivity'
              : !form.billingEmail.trim() ? 'billingEmail'
                : !form.billingRegion.trim() ? 'billingRegion'
                  : !form.billingComuna.trim() ? 'billingComuna'
                    : !form.billingAddress.trim() ? 'billingAddress'
                      : 'billingNumber'
        );
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
            phone: normalizedPhone,
            deliveryMethod: form.deliveryMethod,
            shippingAddress: isShipping ? {
              region: form.region.trim(),
              comuna: form.comuna.trim(),
              address: form.address.trim(),
              number: form.number.trim(),
              unit: form.unit.trim() || null,
              sector: form.sector.trim() || null,
            } : null,
            deliveryNotes: form.deliveryNotes.trim() || null,
            preferredCarrier: isShipping ? form.preferredCarrier : null,
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
      // Only clear the cart once the server has actually confirmed the order,
      // reserved inventory AND created a payment preference (all three
      // already happened server-side by the time this response is 201) — on
      // any failure above (or thrown below) the cart stays exactly as it was.
      setOrderPlaced(true);
      clearCart();
      // Full navigation, not router.push: paymentUrl is the payment
      // provider's own checkout page, entirely outside this app.
      window.location.href = data.paymentUrl;
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
                  <input
                    id="fullName" required maxLength={120}
                    className={fullNameError ? errorInputClass : inputClass}
                    value={form.fullName}
                    onChange={(event) => updateField('fullName', event.target.value)}
                    onBlur={() => markTouched('fullName')}
                    aria-invalid={!!fullNameError}
                  />
                  {fullNameError && <p className={fieldErrorClass}>{fullNameError}</p>}
                </div>
                <div>
                  <label className={labelClass} htmlFor="email">Email</label>
                  <input
                    id="email" type="email" required maxLength={200}
                    className={emailError ? errorInputClass : inputClass}
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    onBlur={() => markTouched('email')}
                    aria-invalid={!!emailError}
                  />
                  {emailError && <p className={fieldErrorClass}>{emailError}</p>}
                </div>
                <div>
                  <label className={labelClass} htmlFor="phone">Teléfono</label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex-shrink-0 rounded-lg border border-insumos-line bg-insumos-cream px-3 py-2.5 text-sm font-semibold text-insumos-ink">
                      {CHILE_COUNTRY_CODE}
                    </span>
                    <input
                      id="phone" type="tel" inputMode="numeric" required placeholder="9 1234 5678" maxLength={9}
                      className={(phoneError ? errorInputClass : inputClass) + ' mt-0'}
                      value={form.phoneDigits}
                      onChange={(event) => updateField('phoneDigits', sanitizeNationalDigits(event.target.value))}
                      onBlur={() => markTouched('phone')}
                      aria-invalid={!!phoneError}
                    />
                  </div>
                  {phoneError && <p className={fieldErrorClass}>{phoneError}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-insumos-ink">2. Forma de entrega</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {DELIVERY_METHODS.map((method) => (
                  <label
                    key={method}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      form.deliveryMethod === method ? 'border-insumos-forest bg-insumos-mint text-insumos-forest' : 'border-insumos-line text-stone-600 hover:bg-insumos-cream'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value={method}
                      checked={form.deliveryMethod === method}
                      onChange={() => updateDeliveryMethod(method)}
                      className="sr-only"
                    />
                    {method === 'shipping' ? <Truck className="h-4 w-4" aria-hidden /> : <Store className="h-4 w-4" aria-hidden />}
                    {DELIVERY_METHOD_LABELS[method]}
                  </label>
                ))}
              </div>
              {!isShipping && (
                <div className="flex items-start gap-2 rounded-lg bg-insumos-mint px-4 py-3 text-sm text-insumos-forest">
                  <Store className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                  <div>
                    <p className="font-semibold">Retiro en tienda — Gratis</p>
                    <p className="mt-0.5 text-insumos-forest/80">Te avisaremos cuando tu pedido esté listo para retirar.</p>
                  </div>
                </div>
              )}
            </div>

            {isShipping && (
              <div className="space-y-4 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
                <h2 className="text-base font-bold text-insumos-ink">{addressSectionNumber}. Dirección de despacho</h2>
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
                    <label className={labelClass} htmlFor="sector">Villa / población / sector (opcional)</label>
                    <input id="sector" maxLength={100} className={inputClass} value={form.sector} onChange={(event) => updateField('sector', event.target.value)} />
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
            )}

            {isShipping && (
              <div className="space-y-3 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
                <h2 className="text-base font-bold text-insumos-ink">{carrierSectionNumber}. Transportista</h2>
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
            )}

            <div className="space-y-4 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-insumos-ink">{documentSectionNumber}. Documento tributario</h2>
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

                  {isShipping && (
                    <label className="flex items-center gap-2 text-sm font-semibold text-insumos-ink">
                      <input
                        type="checkbox"
                        checked={form.useSameAddressForBilling}
                        onChange={(event) => updateField('useSameAddressForBilling', event.target.checked)}
                        className="h-4 w-4 rounded border-insumos-line text-insumos-forest focus:ring-insumos-mint"
                      />
                      Usar misma dirección de despacho
                    </label>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="billingRegion">Región</label>
                      <select id="billingRegion" required disabled={isShipping && form.useSameAddressForBilling} className={inputClass} value={form.billingRegion} onChange={(event) => updateBillingRegion(event.target.value)}>
                        <option value="">Selecciona una región</option>
                        {REGION_NAMES.map((region) => <option key={region} value={region}>{region}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingComuna">Comuna</label>
                      <select id="billingComuna" required disabled={(isShipping && form.useSameAddressForBilling) || !form.billingRegion} className={inputClass} value={form.billingComuna} onChange={(event) => updateField('billingComuna', event.target.value)}>
                        <option value="">{form.billingRegion ? 'Selecciona una comuna' : 'Elige primero una región'}</option>
                        {billingComunasForRegion.map((comuna) => <option key={comuna} value={comuna}>{comuna}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingAddress">Dirección</label>
                      <input id="billingAddress" required disabled={isShipping && form.useSameAddressForBilling} maxLength={200} className={inputClass} value={form.billingAddress} onChange={(event) => updateField('billingAddress', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingNumber">Número</label>
                      <input id="billingNumber" required disabled={isShipping && form.useSameAddressForBilling} maxLength={20} className={inputClass} value={form.billingNumber} onChange={(event) => updateField('billingNumber', event.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="billingUnit">Oficina/local/depto (opcional)</label>
                      <input id="billingUnit" disabled={isShipping && form.useSameAddressForBilling} maxLength={100} className={inputClass} value={form.billingUnit} onChange={(event) => updateField('billingUnit', event.target.value)} />
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
          </div>

          <aside className="rounded-2xl border border-insumos-line bg-white p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-base font-bold text-insumos-ink">Resumen del pedido</h2>
            <ul className="mt-4 space-y-4">
              {items.map((item) => {
                // Same ceiling ProductDetail/carrito already enforce: stock is
                // the only real per-line limit modeled in the cart today (no
                // min_quantity/max_quantity on CartLine) — decrementCartLine
                // itself already floors at 1, so quantity never needs a
                // separate minimum check here.
                const atMaxStock = item.stockAvailable !== null && item.quantity >= item.stockAvailable;
                return (
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-bold text-insumos-ink">{item.productName}</p>
                          <p className="text-xs text-stone-500">{item.variantName}</p>
                          <p className="mt-0.5 text-xs text-stone-500">{formatPrice(item.unitPrice)} c/u</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantId)}
                          aria-label={`Eliminar ${item.productName} del pedido`}
                          className="flex-shrink-0 p-1 text-stone-400 transition-colors hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-full border border-insumos-line">
                          <button
                            type="button"
                            onClick={() => decrement(item.productId, item.variantId)}
                            disabled={item.quantity <= 1}
                            aria-label={`Restar cantidad de ${item.productName}`}
                            className="grid h-8 w-8 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold text-insumos-ink">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => increment(item.productId, item.variantId)}
                            disabled={atMaxStock}
                            aria-label={`Sumar cantidad de ${item.productName}`}
                            className="grid h-8 w-8 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-insumos-ink">{formatPrice(item.unitPrice * item.quantity)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 space-y-2 border-t border-insumos-line pt-4 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>Subtotal productos</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {isShipping ? (
                <div className="flex items-center justify-between text-stone-600">
                  <span>Despacho</span>
                  <span className={shippingPolicy === 'free' ? 'font-semibold text-insumos-forest' : ''}>{shippingPolicy === 'free' ? 'GRATIS' : 'Por pagar'}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Entrega</span>
                    <span>Retiro en tienda</span>
                  </div>
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Costo</span>
                    <span className="font-semibold text-insumos-forest">GRATIS</span>
                  </div>
                </>
              )}
            </div>

            {isShipping && (
              shippingPolicy === 'free' ? (
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
              )
            )}

            <div className="mt-3 flex items-center justify-between border-t border-insumos-line pt-3 text-base font-extrabold text-insumos-ink">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-insumos-forest px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Enviando pedido...' : 'Ir a pagar'}
            </button>

            <p className="mt-3 text-xs text-stone-500">
              {!isShipping
                ? 'Retira tu pedido sin costo en tienda.'
                : shippingPolicy === 'free'
                  ? 'El envío está incluido en este total.'
                  : 'El costo de despacho se paga aparte, directamente al transportista, y no está incluido en este total.'}
            </p>
          </aside>
        </form>
      </section>
    </div>
  );
}
