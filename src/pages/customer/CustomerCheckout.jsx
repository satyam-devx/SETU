import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CheckCircle, ChevronRight, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useCart } from '@/lib/cartContext';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { OrderAPI } from '@/lib/api';
import { initiateUPIPayment } from '@/lib/payments';
import PaymentSheet from '@/components/PaymentSheet';

export default function CustomerCheckout() {
  const { items, totalPrice, clearCart } = useCart();
  const { dispatch, state }     = useStore();
  const { user, profile }       = useAuth();
  const navigate                = useNavigate();

  const [payMethod, setPayMethod]   = useState('cod');
  const [useCredit, setUseCredit]   = useState(false);
  const [placing, setPlacing]       = useState(false);
  const [placed, setPlaced]         = useState(false);
  const [orderId, setOrderId]       = useState(null);
  const [error, setError]           = useState(null);

  const walletBalance    = state.wallet?.balance ?? 0;
  const creditDiscount   = useCredit ? Math.min(totalPrice * 0.1, 500) : 0;
  const finalTotal       = totalPrice - creditDiscount;
  const deliveryFee      = totalPrice >= 200 ? 0 : 20;
  const platformFee      = Math.round(finalTotal * 0.02);
  const grandTotal       = finalTotal + deliveryFee + platformFee;

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setError(null);

    try {
      // 1. Create order record in Supabase
      const payload = {
        customerId:      user.id,
        customerName:    profile?.name || 'Customer',
        vendorId:        items[0]?.vendorId,
        vendorName:      items[0]?.vendorName || 'Ramesh Kirana Store',
        items:           items.map(i => ({ product_id: i.id, name: i.name, qty: i.quantity, price: i.price })),
        subtotal:        totalPrice,
        deliveryFee,
        platformFee,
        total:           grandTotal,
        paymentMethod:   payMethod.toUpperCase(),
        village:         profile?.village || 'Madhepur',
        villageId:       profile?.village_id,
        deliveryAddress: 'House No. 12, Ward 3, Madhepur', // Example
        useCredit
      };

      const { data: order, error: orderErr } = await OrderAPI.create(payload);
      if (orderErr) throw orderErr;

      const newOrderId = order.id;

      // 2. Handle Payment
      if (payMethod === 'upi') {
        const pResult = await initiateUPIPayment({
          amount: grandTotal,
          orderId: newOrderId,
          customerName: profile?.name,
          phone: profile?.phone
        });

        if (pResult.cancelled) {
          // Keep order record but status stays 'pending' and payment_status 'pending'
          // User can retry from order history
          setPlacing(false);
          setError('Payment was cancelled. You can complete it from your Orders page.');
          return;
        }
      }

      // 3. Success
      dispatch({ type: 'ORDER_PLACE', payload: order });
      clearCart();
      setPlacing(false);
      setPlaced(true);
      setOrderId(newOrderId);
      setTimeout(() => navigate(`/customer/orders/${newOrderId}`), 2500);

    } catch (err) {
      console.error('[Checkout] failed:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setPlacing(false);
    }
  };

  if (placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Order Placed!</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your order has been placed successfully. {payMethod === 'cod' ? 'Pay upon delivery.' : 'Payment confirmed.'}
        </p>
        <p className="text-xs text-muted-foreground">Redirecting to tracker...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-md mx-auto min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer/cart" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm">Checkout</span>
        <Shield className="w-4 h-4 text-green-600 ml-auto" />
        <span className="text-xs text-green-600 font-medium">Secure</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 items-start">
            <span className="text-red-600 text-lg leading-none">⚠️</span>
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Delivery Address */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Delivery Address
          </h3>
          <p className="text-sm">{profile?.village || 'Madhepur'}, House No. 12, Ward 3</p>
          <p className="text-xs text-muted-foreground">Near Shiv Temple · Bihar</p>
          <Link to="/customer/addresses">
            <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs gap-1 text-primary px-0 hover:bg-transparent">
              Change address <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </Card>

        {/* Payment Method */}
        <Card className="p-4 border-border">
          <PaymentSheet
            selectedId={payMethod}
            onSelect={setPayMethod}
            walletBalance={walletBalance}
            totalAmount={grandTotal}
          />
        </Card>

        {/* SETU Credit */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Use SETU Credit</p>
              <p className="text-xs text-muted-foreground">Save ₹{Math.min(totalPrice * 0.1, 500).toFixed(0)} (10% off)</p>
            </div>
            <Switch checked={useCredit} onCheckedChange={setUseCredit} />
          </div>
          {useCredit && (
            <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-100">
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
                <span className="shrink-0 font-medium">₹{i.price * i.quantity}</span>
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
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Platform Fee</span><span>₹{platformFee}</span>
            </div>
            {useCredit && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>SETU Credit</span><span>-₹{creditDiscount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 mt-1 border-t border-border">
              <span>Total</span><span>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </Card>

        {deliveryFee === 0 && (
          <p className="text-xs text-green-600 text-center font-medium">🎉 Free delivery applied!</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <Button
          className="w-full text-sm font-semibold h-12 rounded-xl shadow-lg"
          onClick={handlePlaceOrder}
          disabled={placing || items.length === 0}
        >
          {placing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing...
            </>
          ) : `Place Order · ₹${grandTotal.toFixed(0)}`}
        </Button>
      </div>
    </div>
  );
}
