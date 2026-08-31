'use client';

import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useInsumosCart } from './CartProvider';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

/**
 * Always mounted (once) alongside InsumosCartProvider so open/close can
 * animate with a CSS transition instead of mounting/unmounting the panel.
 */
export function CartDrawer() {
  const { items, subtotal, isDrawerOpen, closeDrawer, increment, decrement, removeItem } = useInsumosCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-insumos-ink/40 transition-opacity ${isDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        aria-hidden={!isDrawerOpen}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-[calc(100%-2rem)] flex-col bg-white shadow-2xl transition-transform duration-300 sm:w-[400px] sm:max-w-[400px] ${
          isDrawerOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-insumos-line px-5 py-4">
          <h2 className="text-lg font-bold text-insumos-ink">Carrito</h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar carrito"
            className="grid h-9 w-9 place-items-center rounded-full text-stone-500 hover:bg-insumos-cream"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-insumos-mint text-insumos-forest">
              <ShoppingBag className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-insumos-ink">Tu carrito está vacío</p>
            <Link href="/productos" onClick={closeDrawer} className="text-sm font-semibold text-insumos-forest hover:underline">
              Explorar productos
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={`${item.productId}:${item.variantId}`} className="flex gap-3">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-insumos-line bg-insumos-cream">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.productName} className="absolute inset-0 h-full w-full object-contain p-1" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-medium text-insumos-sage">Sin imagen</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold text-insumos-ink">{item.productName}</p>
                    <p className="text-xs text-stone-500">{item.variantName}</p>
                    <p className="mt-1 text-sm font-semibold text-insumos-forest">{formatPrice(item.unitPrice)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border border-insumos-line">
                        <button
                          type="button"
                          onClick={() => decrement(item.productId, item.variantId)}
                          disabled={item.quantity <= 1}
                          aria-label="Restar cantidad"
                          className="grid h-7 w-7 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-insumos-ink">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => increment(item.productId, item.variantId)}
                          disabled={item.stockAvailable !== null && item.quantity >= item.stockAvailable}
                          aria-label="Sumar cantidad"
                          className="grid h-7 w-7 place-items-center rounded-full text-insumos-forest disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.variantId)}
                        aria-label={`Eliminar ${item.productName} del carrito`}
                        className="text-stone-400 transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-insumos-line px-5 py-4">
            <div className="flex items-center justify-between text-base font-bold text-insumos-ink">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Link
              href="/carrito"
              onClick={closeDrawer}
              className="mt-4 flex w-full items-center justify-center rounded-full bg-insumos-forest px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark"
            >
              Ver carrito
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
