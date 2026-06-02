import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/lib/cartContext';
import EmptyState from '@/components/shared/EmptyState';

export default function CustomerCart() {
  const { items, updateQuantity, removeItem, totalItems, totalPrice } = useCart();

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm flex-1">My Cart</span>
        {totalItems > 0 && <span className="text-xs text-muted-foreground">{totalItems} items</span>}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState icon={ShoppingCart} title="Cart is empty" description="Add items from vendors near you" action={<Link to="/customer"><Button className="mt-4">Browse Products</Button></Link>} />
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {items.map(item => (
            <Card key={item.id} className="p-3 border-border flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                <p className="text-sm font-bold text-primary mt-0.5">₹{item.price}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 border border-border rounded-lg">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1.5"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1.5"><Plus className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="ml-auto p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          <Card className="p-4 border-border space-y-2">
            <h3 className="font-semibold text-sm">Order Summary</h3>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>₹{totalPrice}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery Fee</span><span className="text-green-600">Free</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-bold"><span>Total</span><span>₹{totalPrice}</span></div>
          </Card>
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
          <Link to="/customer/checkout">
            <Button className="w-full">Proceed to Checkout — ₹{totalPrice}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
