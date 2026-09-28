import { createContext, use, useMemo, useState, type ReactNode } from 'react';

import type { Product, Store } from '@/lib/types';

type Line = { product: Product; quantity: number };

type CartState = {
  store: Store | null;
  lines: Line[];
  count: number;
  subtotal: number;
  quantityOf: (productId: string) => number;
  /** Adding from a different store empties the cart first; returns true when that happened. */
  add: (store: Store, product: Product) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const value = useMemo<CartState>(() => {
    const quantityOf = (id: string) => lines.find((l) => l.product.id === id)?.quantity ?? 0;
    return {
      store,
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0),
      quantityOf,
      add(nextStore, product) {
        const switching = store !== null && store.id !== nextStore.id;
        setStore(nextStore);
        setLines((prev) => {
          const base = switching ? [] : prev;
          const existing = base.find((l) => l.product.id === product.id);
          if (existing) {
            return base.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
          }
          return [...base, { product, quantity: 1 }];
        });
        return switching;
      },
      remove(productId) {
        setLines((prev) => {
          const next = prev
            .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity - 1 } : l))
            .filter((l) => l.quantity > 0);
          if (next.length === 0) setStore(null);
          return next;
        });
      },
      clear() {
        setLines([]);
        setStore(null);
      },
    };
  }, [store, lines]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const value = use(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
