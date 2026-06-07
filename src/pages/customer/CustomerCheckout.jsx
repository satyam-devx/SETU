import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Smartphone, CreditCard, Wallet, CheckCircle, ChevronRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useCart } from '@/lib/cartContext';
import { useStore } from '@/lib/store';

const PAY_METHODS = [
  { id: 'cod',    label: 'Cash on Delivery', sub: 'Pay when order arrives',   icon: CreditCard   },
  { id: 'upi',    label: 'UPI Payment',      sub: 'Google Pay, PhonePe, BHIM', icon: Smartphone   },
  { id: 'wallet', label: 'SETU Wallet',      sub: 'Balance: ₹1,250',          icon: Wallet       },
];

export default function CustomerCheckout() {
  const { items, totalPrice, clearCart } = useCart();
  const { dispatch } = useStore();
  const navigate     = useNavigate();

  const [payMethod, setPayMethod]   = useState('cod');
  const [useCredit, setUseCredit]   = useState(false);
  const [placing, setPlacing]       = useState(false);
  const [placed, setPlaced]         = useState(false);
  const [orderId, setOrderId]       = useState(null);

  const creditDiscount = useCredit ? Math.min(totalPrice * 0.1, 500) : 0;
  const finalTotal     = totalPrice - creditDiscount;
  const deliveryFee    = totalPrice >= 200 ? 0 : 20;

  const handlePlaceOrder = () => {
    setPlacing(true);
    const newOrderId = `o${Date.now()}`;
    setTimeout(() => {
      dispatch({
        type: 'ORDER_PLACE',
        payload: {
          id: newOrderId,
          customerId: 'u1',
          customerName: 'Anita Devi',
          vendorId: items[0]?.vendorId || 'vn1',
          vendorName: 'Ramesh Kirana Store',
          items: items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          subtotal: totalPrice,
          deliveryFee,
          platformFee: Math.round(finalTotal * 0.02),
          total: finalTotal + deliveryFee,
          paymentMethod: payMethod.toUpperCase(),
          paymentStatus: payMethod === 'cod' ? 'pending' : 'paid',
          village: 'Madhepur',
          is_cod: payMethod === 'cod',
        },
      });
      clearCart();
      setPlacing(false);
      setPlaced(true);
      setOrderId(newOrderId);
      setTimeout(() => navigate('/customer/orders'), 2500);
    }, 1000);
  };

  if (placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Order Placed!</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your order has been placed successfully. The vendor will confirm it shortly.
        </p>
        <p className="text-xs text-muted-foreground">Redirecting to orders...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-md mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer/cart" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm">Checkout</span>
        <Shield className="w-4 h-4 text-green-600 ml-auto" />
        <span className="text-xs text-green-600 font-medium">Secure</span>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Delivery Address */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Delivery Address
          </h3>
          <p className="text-sm">House No. 12, Ward 3, Madhepur</p>
          <p className="text-xs text-muted-foreground">Near Shiv Temple · Madhepur, Madhubani</p>
          <Link to="/customer/addresses">
            <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs gap-1 text-primary px-0">
              Change address <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </Card>

        {/* Payment Method */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Payment Method</h3>
          <div className="space-y-2">
            {PAY_METHODS.map(pm => (
              <button
                key={pm.id}
                onClick={() => setPayMethod(pm.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${payMethod === pm.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${payMethod === pm.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  <pm.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{pm.label}</p>
                  <p className="text-xs text-muted-foreground">{pm.sub}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 transition-colors ${payMethod === pm.id ? 'border-primary bg-primary' : 'border-border'}`} />
              </button>
            ))}
          </div>
        </Card>

        {/* SETU Credit */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Use SETU Credit</p>
              <p className="text-xs text-muted-foreground">Save ₹{Math.min(totalPrice * 0.1, 500).toFixed(0)} (10% off, max ₹500)</p>
            </div>
            <Switch checked={useCredit} onCheckedChange={setUseCredit} />
          </div>
          {useCredit && (
            <div className="mt-2 p-2 bg-green-50 rounded-lg">
              <p className="text-xs text-green-700 font-medium">✓ Credit discount applied: -₹{creditDiscount.toFixed(0)}</p>
            </div>
          )}
        </Card>

        {/* Order Summary */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate mr-2">{i.name} × {i.quantity}</span>
                <span className="shrink-0">₹{i.price * i.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span><span>₹{totalPrice}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery</span>
              <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : ''}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
              </span>
            </div>
            {useCredit && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>SETU Credit</span><span>-₹{creditDiscount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span><span>₹{(finalTotal + deliveryFee).toFixed(0)}</span>
            </div>
          </div>
        </Card>

        {deliveryFee === 0 && (
          <p className="text-xs text-green-600 text-center font-medium">🎉 Free delivery on orders above ₹200</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
        <Button
          className="w-full text-sm font-semibold h-12"
          onClick={handlePlaceOrder}
          disabled={placing || items.length === 0}
        >
          {placing ? 'Placing Order...' : `Place Order · ₹${(finalTotal + deliveryFee).toFixed(0)}`}
        </Button>
      </div>
    </div>
  );
}
