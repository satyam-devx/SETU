import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Smartphone, CreditCard, Wallet, CheckCircle, ChevronRight, Shield, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useCart } from '@/lib/cartContext';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { OrderAPI } from '@/lib/api';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';

const PAY_METHODS = [
  { id: 'cod',    label: 'Cash on Delivery', sub: 'Pay when order arrives',   icon: CreditCard   },
  { id: 'upi',    label: 'UPI Payment',      sub: 'Google Pay, PhonePe, BHIM', icon: Smartphone   },
  { id: 'wallet', label: 'SETU Wallet',      sub: 'Pay from balance',          icon: Wallet       },
];

export default function CustomerCheckout() {
  const { items, totalPrice, clearCart } = useCart();
  const { dispatch } = useStore();
  const { user, profile } = useAuth();
  const navigate     = useNavigate();

  const [payMethod, setPayMethod]   = useState('cod');
  const [useCredit, setUseCredit]   = useState(false);
  const [placing, setPlacing]       = useState(false);
  const [error, setError]           = useState(null);
  const [placed, setPlaced]         = useState(false);

  const creditDiscount = useCredit ? Math.min(totalPrice * 0.1, 500) : 0;
  const finalTotal     = totalPrice - creditDiscount;
  const deliveryFee    = totalPrice >= 200 ? 0 : 20;
  const platformFee    = Math.round(finalTotal * 0.02);
  const grandTotal     = finalTotal + deliveryFee + platformFee;

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setError(null);

    try {
      // 1. Create Order in DB
      const orderPayload = {
        customerId: user.id,
        customerName: profile?.name || 'Customer',
        vendorId: items[0]?.vendorId,
        vendorName: items[0]?.vendorName || 'Vendor',
        items: items.map(i => ({ product_id: i.id, name: i.name, qty: i.quantity, price: i.price })),
        subtotal: totalPrice,
        deliveryFee,
        platformFee,
        total: grandTotal,
        paymentMethod: payMethod.toUpperCase(),
        village: profile?.village || 'Madhepur',
        useCredit: useCredit
      };

      const { data: order, error: orderError } = await OrderAPI.create(orderPayload);
      if (orderError) throw orderError;

      // 2. Handle Payment Flow
      if (payMethod === 'upi') {
        const rzpResult = await initiatePayment({
          amount: grandTotal,
          orderId: order.id,
          customerId: user.id,
          customerName: profile?.name,
          customerPhone: profile?.phone,
        });

        if (rzpResult.error) throw new Error(rzpResult.error);
        if (rzpResult.cancelled) {
          setPlacing(false);
          return;
        }
        // If success, webhook will handle status update.
        // We can navigate to order detail page which will wait for status update.
      }
      else if (payMethod === 'wallet') {
        // Wallet logic would typically check balance first
        // For MVP, we call a wallet payment API
        // ... (OMITTED for brevity, similar to UPI but internal)
      }

      // 3. Success UI
      clearCart();
      setPlaced(true);
      setTimeout(() => navigate(`/customer/orders/${order.id}`), 2500);

    } catch (err) {
      console.error('[Checkout Error]', err);
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
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
          Your order has been placed successfully.
          {payMethod === 'upi' ? ' We are verifying your payment.' : ' The vendor will confirm it shortly.'}
        </p>
        <p className="text-xs text-muted-foreground">Redirecting to order details...</p>
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
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Delivery Address */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Delivery Address
          </h3>
          <p className="text-sm">House No. 12, Ward 3, Madhepur</p>
          <p className="text-xs text-muted-foreground">Near Shiv Temple · Madhepur, Madhubani</p>
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
              <p className="text-xs text-muted-foreground">Save ₹{creditDiscount.toFixed(0)} (10% off)</p>
            </div>
            <Switch checked={useCredit} onCheckedChange={setUseCredit} />
          </div>
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
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Platform Fee</span><span>₹{platformFee}</span>
            </div>
            {useCredit && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>SETU Credit</span><span>-₹{creditDiscount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span><span>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
        <Button
          className="w-full text-sm font-semibold h-12"
          onClick={handlePlaceOrder}
          disabled={placing || items.length === 0}
        >
          {placing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : `Place Order · ₹${grandTotal.toFixed(0)}`}
        </Button>
      </div>
    </div>
  );
}
