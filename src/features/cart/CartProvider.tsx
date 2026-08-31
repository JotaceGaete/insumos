'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  EMPTY_CART,
  addCartLine,
  clearCart as clearCartLines,
  decrementCartLine,
  hydrateCart,
  incrementCartLine,
  removeCartLine,
  setCartLineQuantity,
} from './cartReducer';
import type { CartLine, InsumosCart } from './types';

// Own key, independent from any Artesellos storage — never read/write theirs.
const CART_STORAGE_KEY = 'arteinsumos.cart.v1';

interface InsumosCartContextValue {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (line: CartLine) => void;
  removeItem: (productId: string, variantId: string) => void;
  setQuantity: (productId: string, variantId: string, quantity: number) => void;
  increment: (productId: string, variantId: string) => void;
  decrement: (productId: string, variantId: string) => void;
  clearCart: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const InsumosCartContext = createContext<InsumosCartContextValue | null>(null);

export function InsumosCartProvider({ children }: { children: ReactNode }) {
  // Safe default for both server render and the client's first render pass —
  // localStorage is only ever touched inside an effect, after mount, so there
  // is nothing for hydration to mismatch against.
  const [cart, setCart] = useState<InsumosCart>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      setCart(hydrateCart(parsed?.lines));
    } catch {
      // Corrupted JSON or storage access blocked — start from an empty cart.
      setCart(EMPTY_CART);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return; // avoid clobbering storage before the load above runs
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Private browsing / quota exceeded — cart keeps working in memory only.
    }
  }, [cart, hydrated]);

  const addItem = useCallback((line: CartLine) => {
    setCart((current) => addCartLine(current, line));
  }, []);
  const removeItem = useCallback((productId: string, variantId: string) => {
    setCart((current) => removeCartLine(current, productId, variantId));
  }, []);
  const setQuantity = useCallback((productId: string, variantId: string, quantity: number) => {
    setCart((current) => setCartLineQuantity(current, productId, variantId, quantity));
  }, []);
  const increment = useCallback((productId: string, variantId: string) => {
    setCart((current) => incrementCartLine(current, productId, variantId));
  }, []);
  const decrement = useCallback((productId: string, variantId: string) => {
    setCart((current) => decrementCartLine(current, productId, variantId));
  }, []);
  const clearCart = useCallback(() => setCart(clearCartLines()), []);
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const value = useMemo<InsumosCartContextValue>(() => ({
    items: cart.lines,
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    addItem,
    removeItem,
    setQuantity,
    increment,
    decrement,
    clearCart,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
  }), [cart, addItem, removeItem, setQuantity, increment, decrement, clearCart, isDrawerOpen, openDrawer, closeDrawer]);

  return <InsumosCartContext.Provider value={value}>{children}</InsumosCartContext.Provider>;
}

export function useInsumosCart() {
  const context = useContext(InsumosCartContext);
  if (!context) throw new Error('useInsumosCart debe usarse dentro de <InsumosCartProvider>.');
  return context;
}
