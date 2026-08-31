'use client';

import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useInsumosCart } from '@/features/cart/CartProvider';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

export default function CarritoPage() {
  const { items, subtotal, increment, decrement, removeItem } = useInsumosCart();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-insumos-cream">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-insumos-mint text-insumos-forest">
            <ShoppingBag className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-insumos-ink sm:text-3xl">Tu carrito está vacío</h1>
          <p className="mt-2 text-sm text-stone-600 sm:text-base">Explora el catálogo y agrega los insumos que necesitas.</p>
          <Link
            href="/productos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-insumos-forest px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark"
          >
            Explorar productos
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-insumos-ink sm:text-3xl">Tu carrito</h1>
        <p className="mt-1 text-sm text-stone-600">
          {items.length} producto{items.length === 1 ? '' : 's'} en tu carrito
        </p>

        <ul className="mt-6 space-y-4">
          {items.map((item) => {
            const lineSubtotal = item.unitPrice * item.quantity;
            const atMaxStock = item.stockAvailable !== null && item.quantity >= item.stockAvailable;
            return (
              <li key={`${item.productId}:${item.variantId}`} className="flex gap-4 rounded-2xl border border-insumos-line bg-white p-4 sm:p-5">
                <Link
                  href={`/producto/${item.slug}`}
                  className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-insumos-line bg-insumos-cream sm:h-24 sm:w-24"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.productName} className="absolute inset-0 h-full w-full object-contain p-2" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-medium text-insumos-sage">Sin imagen</div>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <Link href={`/producto/${item.slug}`} className="line-clamp-1 text-sm font-bold text-insumos-ink hover:text-insumos-forest sm:text-base">
                      {item.productName}
                    </Link>
                    <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">{item.variantName}</p>
                    <p className="mt-1 text-sm font-semibold text-insumos-forest">{formatPrice(item.unitPrice)}</p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-insumos-line">
                      <button
                        type="button"
                        onClick={() => decrement(item.productId, item.variantId)}
                        disabled={item.quantity <= 1}
                        aria-label={`Restar cantidad de ${item.productName}`}
                        className="grid h-9 w-9 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-insumos-ink">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => increment(item.productId, item.variantId)}
                        disabled={atMaxStock}
                        aria-label={`Sumar cantidad de ${item.productName}`}
                        className="grid h-9 w-9 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-insumos-ink">{formatPrice(lineSubtotal)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.productId, item.variantId)}
                  aria-label={`Eliminar ${item.productName} del carrito`}
                  className="self-start text-stone-400 transition-colors hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 rounded-2xl border border-insumos-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between text-lg font-extrabold text-insumos-ink">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            El precio final, el stock y los costos de despacho se confirman al finalizar la compra.
          </p>
          <Link
            href="/finalizar-compra"
            className="mt-4 flex w-full items-center justify-center rounded-full bg-insumos-forest px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark"
          >
            Continuar al checkout
          </Link>
          <Link href="/productos" className="mt-3 block text-center text-sm font-semibold text-insumos-forest hover:underline">
            Seguir explorando productos
          </Link>
        </div>
      </section>
    </div>
  );
}
