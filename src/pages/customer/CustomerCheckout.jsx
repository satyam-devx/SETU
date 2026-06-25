import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Smartphone, CreditCard, Wallet,
  CheckCircle, Shield, Loader2, AlertCircle, Ticket, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useCart } from '@/lib/cartContext';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { useVillage } from '@/lib/village';
import { useFeatureFlag } from '@/lib/featureFlags';
import { OrderAPI, PaymentAPI, cancelOrderWithRefund, getFeeConfig, CouponAPI } from '@/lib/api';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';

const PAY_METHODS = [
  { id: 'cod',    label: 'Cash on Delivery', sub: 'Pay when order arrives',    icon: CreditCard  },
  { id: 'upi',    label: 'UPI Payment',      sub: 'Google Pay, PhonePe, BHIM', icon: Smartphone  },
  { id: 'wallet', label: 'SETU Wallet',      sub: 'Pay from balance',          icon: Wallet      },
];

// ── Helper: derive complete vendor context from first cart item ──
function resolveVendor(firstItem) {
  if (!firstItem) return { id: null, name: null };

  // The vendor object may be nested (from getProductById's join) or flat
  const nested = firstItem.vendors; // { id?, name?, village? } if joined

  const id =
    nested?.id         ??
    firstItem.vendor_id ??
    firstItem.vendorId  ??
    null;

  const name =
    nested?.name            ??
    firstItem.vendor_name   ??
    firstItem.vendorName    ??
    'Vendor';

  const village =
    nested?.village         ??
    firstItem.vendor_village ??
    firstItem.vendorVillage  ??
    null;

  const phone =
    nested?.phone           ??
    firstItem.vendor_phone  ??
    null;

  return { id, name, village, phone };
}

export default function CustomerCheckout() {
  const { items, totalPrice, clearCart }  = useCart();
  const { state, dispatch }               = useStore();
  const { user, profile }                 = useAuth();
  const { village }                       = useVillage();
  const navigate                          = useNavigate();

  const [payMethod, setPayMethod] = useState('cod');
  const [useCredit, setUseCredit] = useState(false);
  const [placing,   setPlacing]   = useState(false);
  const [error,     setError]     = useState(null);
  const [placed,    setPlaced]    = useState(false);
  // Fee parameters — single source of truth (server get_fee_config()).
  // Defaults match the server defaults so the estimate is correct even
  // before the fetch resolves; the authoritative total still comes from
  // create_order on the server.
  const [feeCfg, setFeeCfg] = useState({
    commission_pct: 1, delivery_flat: 20, free_threshold: 200,
    credit_discount_pct: 10, credit_discount_max: 500,
  });

  // Coupon state
  const [couponCode, setCouponCode]         = useState('');
  const [appliedCode, setAppliedCode]       = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg]           = useState(null);
  const [couponBusy, setCouponBusy]         = useState(false);

  // Wallet balance from store (hydrated from Supabase on app load)
  const walletBalance = state.wallet?.balance ?? 0;

  // Feature-flag gating: hide payment methods whose module is disabled.
  const walletEnabled  = useFeatureFlag('wallet');
  const onlineEnabled  = useFeatureFlag('payments');
  const couponsEnabled = useFeatureFlag('coupons');
  const payMethods = PAY_METHODS.filter(pm =>
    (pm.id !== 'wallet' || walletEnabled) &&
    (pm.id !== 'upi'    || onlineEnabled)
  );

  // If the selected method got disabled, fall back to the first available.
  useEffect(() => {
    if (!payMethods.some(pm => pm.id === payMethod)) {
      setPayMethod(payMethods[0]?.id ?? 'cod');
    }
  }, [payMethods, payMethod]);

  const creditDiscount = useCredit
    ? Math.min(totalPrice * (Number(feeCfg.credit_discount_pct) / 100), Number(feeCfg.credit_discount_max))
    : 0;
  // Mirror server create_order math: discounts can't push the final below 0.
  const finalAfter     = Math.max(0, totalPrice - creditDiscount - couponDiscount);
  const deliveryFee    = totalPrice >= Number(feeCfg.free_threshold) ? 0 : Number(feeCfg.delivery_flat);
  const platformFee    = Math.round(finalAfter * (Number(feeCfg.commission_pct) / 100));
  const grandTotal     = finalAfter + deliveryFee + platformFee;

  const walletSufficient = walletBalance >= grandTotal;

  // Derive vendor from first item (single-vendor cart is enforced by cartContext)
  const vendor = resolveVendor(items[0]);

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponMsg(null);
    const { data } = await CouponAPI.validate(code, totalPrice, vendor.id);
    if (data?.valid) {
      setCouponDiscount(Number(data.discount));
      setAppliedCode(code.toUpperCase());
      setCouponMsg({ ok: true, text: `Applied — ₹${Number(data.discount).toFixed(0)} off` });
    } else {
      setCouponDiscount(0);
      setAppliedCode(null);
      setCouponMsg({ ok: false, text: data?.reason ?? 'Invalid coupon' });
    }
    setCouponBusy(false);
  };

  const removeCoupon = () => {
    setAppliedCode(null); setCouponDiscount(0); setCouponCode(''); setCouponMsg(null);
  };

  useEffect(() => {
    loadRazorpayScript();
    getFeeConfig().then(({ data }) => { if (data) setFeeCfg((prev) => ({ ...prev, ...data })); });
  }, []);

  const handlePlaceOrder = async () => {
    if (!vendor.id) {
      setError('Cannot determine vendor. Please clear cart and try again.');
      return;
    }

    setPlacing(true);
    setError(null);

    // ── Pre-flight: wallet balance check ─────────────────────
    if (payMethod === 'wallet' && !walletSufficient) {
      setError(`Insufficient wallet balance. Available: ₹${walletBalance}, Required: ₹${grandTotal}`);
      setPlacing(false);
      return;
    }

    try {
      // 1. Build order payload — NO prices/totals sent. The server
      //    (create_order RPC) recomputes everything from the products
      //    table and returns the authoritative order, including total.
      const orderPayload = {
        vendor_id:        vendor.id,
        village_id:       village?.id   ?? profile?.village_id ?? null,
        items:            items.map(i => ({
          product_id: i.id,
          qty:        i.quantity,
        })),
        payment_method:   ({ cod: 'COD', upi: 'UPI', wallet: 'wallet' })[payMethod] ?? 'COD',
        use_credit:       useCredit,
        coupon_code:      appliedCode ?? null,
        delivery_address: profile?.address
          ?? profile?.village
          ?? village?.name
          ?? '',
      };

      const { data: order, error: orderError } = await OrderAPI.create(orderPayload);
      if (orderError) throw orderError;

      // Authoritative amount to charge comes from the server, never the client.
      const serverTotal = order.total ?? grandTotal;

      // 2. Handle payment
      if (payMethod === 'upi') {
        const rzpResult = await initiatePayment({
          amount:        serverTotal,
          orderId:       order.id,
          customerId:    user.id,
          customerName:  profile?.name,
          customerPhone: profile?.phone,
        });

        if (rzpResult.error) throw new Error(rzpResult.error);
        if (rzpResult.cancelled) {
          // Use atomic cancel (no refund needed — payment never captured)
          await cancelOrderWithRefund(order.id, user.id, 'customer', 'Payment cancelled by user');
          setPlacing(false);
          return;
        }
        // Webhook confirms payment → order status + payment_status updated server-side.
        // DO NOT set payment_status from here — the guard trigger will reject it.

      } else if (payMethod === 'wallet') {
        // Single atomic RPC: charges order.total, confirms order, credits escrow.
        const { data: walletRes, error: walletError } = await PaymentAPI.payOrderFromWallet(order.id);
        if (walletError) {
          // Wallet debit failed — cancel the order atomically (nothing captured)
          await cancelOrderWithRefund(order.id, user.id, 'customer', 'Wallet payment failed');
          throw new Error(walletError.message ?? 'Wallet payment failed. Please try again.');
        }

        dispatch({
          type:    'UPDATE_WALLET_BALANCE',
          payload: { balance: walletRes?.new_balance ?? (walletBalance - serverTotal) },
        });
      }
      // COD: no payment action — stays 'pending'

      // 3. Success
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

  // ── Success screen ────────────────────────────────────────
  if (placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Order Placed!</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your order has been placed successfully.
          {payMethod === 'upi'    ? ' We are verifying your payment.'          : ''}
          {payMethod === 'wallet' ? ' Payment deducted from your SETU Wallet.' : ''}
          {payMethod === 'cod'    ? ' The vendor will confirm it shortly.'      : ''}
        </p>
        <p className="text-xs text-muted-foreground">Redirecting to order details...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-md mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer/cart" className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
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
            Near Shiv Temple · {village?.name ?? profile?.village ?? 'Village'}
            {village?.district ? `, ${village.district}` : ''}
          </p>
        </Card>

        {/* Vendor summary (derived from cart) */}
        {vendor.id && (
          <Card className="p-3 border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Ordering from
            </p>
            <p className="text-sm font-semibold">{vendor.name}</p>
            {vendor.village && (
              <p className="text-xs text-muted-foreground">{vendor.village}</p>
            )}
          </Card>
        )}

        {/* Payment Method */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Payment Method</h3>
          <div className="space-y-2">
            {payMethods.map(pm => {
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
                        ? `Balance: ₹${walletBalance.toLocaleString('en-IN')}${!walletSufficient ? ' (insufficient)' : ''}`
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

        {/* SETU Credit toggle */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Use SETU Credit</p>
              <p className="text-xs text-muted-foreground">Save ₹{creditDiscount.toFixed(0)} (10% off)</p>
            </div>
            <Switch checked={useCredit} onCheckedChange={setUseCredit} />
          </div>
        </Card>

        {/* Coupon (feature-flagged) */}
        {couponsEnabled && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" /> Coupon
            </h3>
            {appliedCode ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 border-0">{appliedCode}</Badge>
                  <span className="text-xs text-green-700">−₹{couponDiscount.toFixed(0)}</span>
                </div>
                <button onClick={removeCoupon} className="text-muted-foreground" aria-label="Remove coupon">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  className="h-9 flex-1"
                />
                <Button size="sm" variant="outline" className="h-9" disabled={couponBusy || !couponCode.trim()} onClick={applyCoupon}>
                  {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}
            {couponMsg && (
              <p className={`text-xs mt-2 ${couponMsg.ok ? 'text-green-700' : 'text-destructive'}`}>{couponMsg.text}</p>
            )}
          </Card>
        )}

        {/* Order Summary */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate mr-2">
                  {i.name} × {i.quantity}
                </span>
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
            {appliedCode && couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Coupon ({appliedCode})</span><span>-₹{couponDiscount.toFixed(0)}</span>
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
