// ═══════════════════════════════════════════════════════════
// SETU — CustomerCart (v2)
// Fixes:
//  - Delivery fee calculated correctly (free above ₹200)
//  - Platform fee shown (1%)
//  - Image fallback (no broken img)
//  - Multi-vendor warning (Constitution: single-vendor orders)
//  - Vendor grouping hint
//  - Accessible quantity controls
//  - formatCurrency everywhere
//  - Bottom CTA above safe area
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, AlertCircle } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { useCart } from '@/lib/cartContext';
import { formatCurrency, calcOrderTotals } from '@/lib/utils';

function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCart();
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="setu-card p-3 flex gap-3">
      {/* Image */}
      <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden">
        {item.image_url && !imgErr ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🛒</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold line-clamp-2 leading-snug">{item.name}</p>
        {item.unit && <p className="text-[10px] text-muted-foreground">{item.unit}</p>}
        <p className="text-sm font-bold text-primary mt-1">{formatCurrency(item.price)}</p>

        <div className="flex items-center gap-2 mt-2">
          {/* Quantity controls */}
          <div
            className="flex items-center border border-border rounded-lg"
            role="group"
            aria-label={`Quantity for ${item.name}`}
          >
            <button
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              className="p-1.5 touch-target flex items-center justify-center"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" aria-hidden="true" />
            </button>
            <span className="text-xs font-bold w-6 text-center" aria-live="polite">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              className="p-1.5 touch-target flex items-center justify-center"
              aria-label="Increase quantity"
              disabled={item.stock != null && item.quantity >= item.stock}
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>

          {/* Line total */}
          <span className="text-xs text-muted-foreground ml-1">
            = {formatCurrency(item.price * item.quantity)}
          </span>

          {/* Remove */}
          <button
            onClick={() => removeItem(item.id)}
            className="ml-auto p-1.5 text-muted-foreground hover:text-destructive transition-colors touch-target flex items-center justify-center"
            aria-label={`Remove ${item.name} from cart`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerCart() {
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, clearCart } = useCart();

  const { subtotal, deliveryFee, platformFee, total } = calcOrderTotals(
    items.map(i => ({ price: i.price, qty: i.quantity }))
  );

  // Check for multi-vendor (Constitution: orders are per-vendor)
  const vendors = [...new Set(items.map(i => i.vendor_id).filter(Boolean))];
  const isMultiVendor = vendors.length > 1;

  return (
    <div className="pb-28 animate-fade-in" role="main">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 touch-target flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="font-semibold text-sm flex-1">
          My Cart {totalItems > 0 && <span className="text-muted-foreground font-normal">({totalItems} items)</span>}
        </span>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Clear cart"
          >
            Clear All
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Add items from vendors near you to get started"
            action={() => navigate('/customer')}
            actionLabel="Browse Products"
          />
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {/* Multi-vendor warning */}
          {isMultiVendor && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-yellow-700">
                <strong>Multiple vendors detected.</strong> Each vendor will be a separate order with its own delivery.
              </p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-3" role="list" aria-label="Cart items">
            {items.map(item => (
              <div key={item.id} role="listitem">
                <CartItem item={item} />
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="setu-card p-4 space-y-2" aria-label="Order summary">
            <h3 className="font-semibold text-sm">Order Summary</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                {deliveryFee === 0
                  ? <span className="text-green-600 font-medium">FREE</span>
                  : <span>{formatCurrency(deliveryFee)}</span>
                }
              </div>
              {platformFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee (1%)</span>
                  <span>{formatCurrency(platformFee)}</span>
                </div>
              )}
              {subtotal < 200 && (
                <p className="text-[10px] text-muted-foreground bg-muted rounded-lg px-2 py-1">
                  Add {formatCurrency(200 - subtotal)} more for free delivery
                </p>
              )}
            </div>
            <div className="border-t border-border pt-2.5 flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-background/95 backdrop-blur border-t border-border px-4 py-3 pb-safe">
          <Link to="/customer/checkout" className="block">
            <button className="btn-primary w-full text-sm">
              Proceed to Checkout — {formatCurrency(total)}
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
