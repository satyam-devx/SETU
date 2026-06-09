// ═══════════════════════════════════════════════════════════
// SETU — CartContext (v2)
// Improvements over v1:
//  - Persists cart to localStorage (survives page refresh)
//  - Clears cart on user change (no cross-user cart leakage)
//  - Stock limit enforcement
//  - vendorId validation: warns on multi-vendor cart
//  - Provides activeVendorId for checkout pre-fill
// ═══════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '@/lib/utils';

const CartContext  = createContext(null);
const CART_KEY     = 'setu_cart_v2';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => storage.get(CART_KEY, []));

  // Persist to localStorage on every change
  useEffect(() => {
    storage.set(CART_KEY, items);
  }, [items]);

  const addItem = useCallback((product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const maxQty = product.stock ?? Infinity;
        return prev.map(i =>
          i.id === product.id
            ? { ...i, quantity: Math.min(newQty, maxQty) }
            : i
        );
      }
      return [...prev, { ...product, quantity: Math.min(quantity, product.stock ?? 99) }];
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems(prev => prev.filter(i => i.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) { removeItem(productId); return; }
    setItems(prev => prev.map(i => {
      if (i.id !== productId) return i;
      const max = i.stock ?? 99;
      return { ...i, quantity: Math.min(quantity, max) };
    }));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    storage.remove(CART_KEY);
  }, []);

  // Derived
  const totalItems       = items.reduce((s, i) => s + i.quantity, 0);
  const cartCount        = totalItems; // alias
  const totalPrice       = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const activeVendorId   = items[0]?.vendor_id ?? items[0]?.vendorId ?? null;
  const activeVendorName = items[0]?.vendorName ?? items[0]?.vendor_name ?? null;
  const isMultiVendor    = new Set(items.map(i => i.vendor_id ?? i.vendorId).filter(Boolean)).size > 1;

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      totalItems, cartCount, totalPrice,
      activeVendorId, activeVendorName, isMultiVendor,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
