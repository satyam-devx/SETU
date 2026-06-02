import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/cartContext';

const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'cod', label: 'Cash on Delivery', icon: CreditCard },
  { id: 'wallet', label: 'SETU Wallet', icon: CreditCard },
];

export default function CustomerCheckout() {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [payMethod, setPayMethod] = useState('upi');
  const [placed, setPlaced] = useState(false);

  const handlePlaceOrder = () => {
    setPlaced(true);
    clearCart();
    setTimeout(() => navigate('/customer/orders'), 2000);
  };

  if (placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Order Placed!</h2>
        <p className="text-muted-foreground text-sm text-center">Your order has been placed successfully. Redirecting to orders...</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer/cart" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm">Checkout</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Delivery Address</h3>
          <p className="text-sm">House No. 12, Ward 3, Madhepur</p>
          <p className="text-xs text-muted-foreground">Near Shiv Temple</p>
          <Link to="/customer/addresses"><Button variant="outline" size="sm" className="mt-2 text-xs h-7">Change Address</Button></Link>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Payment Method</h3>
          <div className="space-y-2">
            {paymentMethods.map(pm => (
              <button key={pm.id} onClick={() => setPayMethod(pm.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${payMethod === pm.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <pm.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{pm.label}</span>
                {payMethod === pm.id && <Badge className="ml-auto text-[9px] bg-primary/10 text-primary border-0">Selected</Badge>}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border space-y-2">
          <h3 className="font-semibold text-sm">Order Summary</h3>
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm text-muted-foreground">
              <span>{item.name} × {item.quantity}</span>
              <span>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between font-bold"><span>Total</span><span>₹{totalPrice}</span></div>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
        <Button className="w-full" onClick={handlePlaceOrder}>Place Order — ₹{totalPrice}</Button>
      </div>
    </div>
  );
}
