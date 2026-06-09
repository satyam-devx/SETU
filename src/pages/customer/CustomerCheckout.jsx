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
import { useVillage } from '@/lib/village';
import { OrderAPI, PaymentAPI } from '@/lib/api';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';

const PAY_METHODS = [
  { id: 'cod',    label: 'Cash on Delivery', sub: 'Pay when order arrives',   icon: CreditCard   },
  { id: 'upi',    label: 'UPI Payment',      sub: 'Google Pay, PhonePe, BHIM', icon: Smartphone   },
  { id: 'wallet', label: 'SETU Wallet',      sub: 'Pay from balance',          icon: Wallet       },
];

export default function CustomerCheckout() {
  const { items, totalPrice, clearCart } = useCart();
  const { state, dispatch } = useStore();
  const { user, profile }   = useAuth();
  const { village }         = useVillage();
  const navigate            = useNavigate();

  const [payMethod, setPayMethod] = useState('cod');
  const [useCredit, setUseCredit] = useState(false);
  const [placing, setPlacing]     = useState(false);
  const [error, setError]         = useState(null);
  const [placed, setPlaced]       = useState(false);

  // Wallet balance from store (hydrated from Supabase on app load)
  const walletBalance = state.wallet?.balance ?? 0;

  const creditDiscount = useCredit ? Math.min(totalPrice * 0.1, 500) : 0;
  const finalTotal     = totalPrice - creditDiscount;
  const deliveryFee    = totalPrice >= 200 ? 0 : 20;
  const platformFee    = Math.round(finalTotal * 0.01);
  const grandTotal     = finalTotal + deliveryFee + platformFee;

  // Derived: can the user afford wallet payment
  const walletSufficient = walletBalance >= grandTotal;

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setError(null);

    // ── Pre-flight: wallet balance check ────────────────────
    if (payMethod === 'wallet' && !walletSufficient) {
      setError(`Insufficient wallet balance. Available: ₹${walletBalance}, Required: ₹${grandTotal}`);
      setPlacing(false);
      return;
    }

    try {
      // 1. Create Order in DB
      const orderPayload = {
        customer_id:    user.id,
        customer_name:  profile?.name || 'Customer',
        vendor_id:      items[0]?.vendor_id || items[0]?.vendorId,
        vendor_name:    items[0]?.vendorName || items[0]?.vendor_name || 'Vendor',
        village_id:     village?.id ?? profile?.village_id ?? null,
        village:        village?.name ?? profile?.village ?? 'Madhepur',
        items:          items.map(i => ({ product_id: i.id, name: i.name, qty: i.quantity, price: i.price })),
        payment_method: payMethod.toUpperCase(),
        delivery_address: profile?.village ?? village?.name ?? '',
      };

      const { data: order, error: orderError } = await OrderAPI.create(orderPayload);
      if (orderError) throw orderError;

      // 2. Handle Payment Flow
      if (payMethod === 'upi') {
        // ── UPI via Razorpay ──────────────────────────────────
        const rzpResult = await initiatePayment({
          amount:        grandTotal,
          orderId:       order.id,
          customerId:    user.id,
          customerName:  profile?.name,
          customerPhone: profile?.phone,
        });

        if (rzpResult.error) throw new Error(rzpResult.error);
        if (rzpResult.cancelled) {
          // User dismissed modal — cancel the pending order
          await OrderAPI.advanceStatus(order.id, 'cancelled', { cancel_reason: 'Payment cancelled by user' });
          setPlacing(false);
          return;
        }
        // Webhook will confirm payment and update order status to 'confirmed'

      } else if (payMethod === 'wallet') {
        // ── Wallet deduction ──────────────────────────────────
        // Debit the wallet first. If this fails, cancel the order.
        const { error: walletError } = await PaymentAPI.walletPay(user.id, grandTotal, order.id);
        if (walletError) {
          // Rollback: cancel the order that was created
          await OrderAPI.advanceStatus(order.id, 'cancelled', { cancel_reason: 'Wallet payment failed' });
          throw new Error(walletError.message ?? 'Wallet payment failed. Please try again.');
        }

        // Mark order as paid immediately (wallet is synchronous, no webhook needed)
        await OrderAPI.advanceStatus(order.id, 'confirmed', {
          payment_status: 'paid',
          payment_method: 'WALLET',
        });

        // Optimistically update local wallet balance
        dispatch({
          type:    'UPDATE_WALLET_BALANCE',
          payload: { balance: walletBalance - grandTotal },
        });

      }
      // COD: no payment action needed, order stays as 'pending' for vendor to confirm

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
          {payMethod === 'upi'    ? ' We are verifying your payment.'         : ''}
          {payMethod === 'wallet' ? ' Payment deducted from your SETU Wallet.' : ''}
          {payMethod === 'cod'    ? ' The vendor will confirm it shortly.'     : ''}
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
          <p className="text-sm">{profile?.address || 'House No. 12, Ward 3'}</p>
          <p className="text-xs text-muted-foreground">
            Near Shiv Temple · {village?.name ?? profile?.village ?? 'Village'}, {village?.district ?? ''}
          </p>
        </Card>

        {/* Payment Method */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Payment Method</h3>
          <div className="space-y-2">
            {PAY_METHODS.map(pm => {
              const isWallet = pm.id === 'wallet';
              const disabled = isWallet && !walletSufficient;
              return (
                <button
                  key={pm.id}
                  onClick={() => !disabled && setPayMethod(pm.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left
                    ${payMethod === pm.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${payMethod === pm.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <pm.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{pm.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {isWallet
                        ? `Balance: ₹${walletBalance}${!walletSufficient ? ' (insufficient)' : ''}`
                        : pm.sub}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 transition-colors
                    ${payMethod === pm.id ? 'border-primary bg-primary' : 'border-border'}`} />
                </button>
              );
            })}
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
          {placing
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
            : `Place Order · ₹${grandTotal.toFixed(0)}`}
        </Button>
      </div>
    </div>
  );
}
