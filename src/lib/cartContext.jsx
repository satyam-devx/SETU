// ═══════════════════════════════════════════════════════════
// SETU — CartContext (v3)
// Changes over v2:
//  - Single-vendor enforcement: adding from a different vendor
//    clears the cart and shows a warning toast before proceeding
//  - addItem returns { replaced: true } when the cart was cleared
//    due to vendor switch — callers can act on this if needed
//  - activeVendor now carries the full vendor object (id + name
//    + any other fields stored on the first item), not just the id
// ═══════════════════════════════════════════════════════════
import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { storage } from '@/lib/utils';

const CartContext = createContext(null);
const CART_KEY   = 'setu_cart_v2';

export function CartProvider({ children }) {
  const [items,        setItems]        = useState(() => storage.get(CART_KEY, []));
  const [vendorAlert,  setVendorAlert]  = useState(null); // { oldName, newName }

  // Persist on every change
  useEffect(() => {
    storage.set(CART_KEY, items);
  }, [items]);

  // ── Derived ──────────────────────────────────────────────
  const totalItems       = items.reduce((s, i) => s + i.quantity, 0);
  const cartCount        = totalItems;
  const totalPrice       = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // Normalise vendor id across snake_case / camelCase field names
  const _vendorId   = (item) => item?.vendor_id  ?? item?.vendorId  ?? null;
  const _vendorName = (item) => item?.vendor_name ?? item?.vendorName ?? item?.vendors?.name ?? null;

  const activeVendorId   = items.length > 0 ? _vendorId(items[0])   : null;
  const activeVendorName = items.length > 0 ? _vendorName(items[0]) : null;
  const isMultiVendor    = new Set(items.map(_vendorId).filter(Boolean)).size > 1;

  // ── addItem — single-vendor enforcement ──────────────────
  /**
   * Add a product to the cart.
   *
   * If the incoming product belongs to a different vendor than the
   * current cart contents, the cart is cleared first and a warning
   * banner is surfaced via `vendorAlert` state.
   *
   * Returns { replaced: boolean } so callers can show their own UI
   * if needed (e.g. a toast in CustomerProductDetail).
   */
  const addItem = useCallback((product, quantity = 1) => {
    let replaced = false;

    setItems(prev => {
      const incomingVendorId = _vendorId(product);
      const existingVendorId = prev.length > 0 ? _vendorId(prev[0]) : null;

      // ── Vendor mismatch: clear cart and warn ─────────────
      if (
        incomingVendorId &&
        existingVendorId &&
        incomingVendorId !== existingVendorId
      ) {
        replaced = true;
        const oldName = _vendorName(prev[0]) ?? 'previous vendor';
        const newName = _vendorName(product) ?? 'this vendor';

        // Surface the warning (cleared outside of setItems to avoid batching issues)
        setTimeout(() => setVendorAlert({ oldName, newName }), 0);

        // Start fresh with just the new item
        return [{ ...product, quantity: Math.min(quantity, product.stock ?? 99) }];
      }

      // ── Same vendor or empty cart: normal upsert ─────────
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
      return [
        ...prev,
        { ...product, quantity: Math.min(quantity, product.stock ?? 99) },
      ];
    });

    return { replaced };
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

  const dismissVendorAlert = useCallback(() => setVendorAlert(null), []);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      totalItems, cartCount, totalPrice,
      activeVendorId, activeVendorName, isMultiVendor,
      vendorAlert, dismissVendorAlert,
    }}>
      {/* Inline vendor-switch warning banner */}
      {vendorAlert && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-sm shadow-lg"
          role="alert"
        >
          <span className="flex-1 text-xs font-medium">
            Cart cleared — items from <strong>{vendorAlert.oldName}</strong> removed.
            Now ordering from <strong>{vendorAlert.newName}</strong>.
          </span>
          <button
            onClick={dismissVendorAlert}
            className="ml-3 text-white/80 hover:text-white text-lg leading-none shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
