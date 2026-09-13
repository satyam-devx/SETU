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
import { OrderAPI, PaymentAPI, cancelOrderWithRefund, getFeeConfig, CouponAPI, getAddresses } from '@/lib/api';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';
import { useDataFetch } from '@/hooks/useDataFetch';

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

  // The delivery address card used to always show a hardcoded fake
  // address ("House No. 12, Ward 3 · Near Shiv Temple") for every
  // customer, and the order itself was created with
  // `delivery_address: profile?.address` — a field that doesn't exist
  // anywhere on the profiles table, so it was always undefined, falling
  // through to just the village name at best. The customer's real,
  // carefully-saved addresses (CustomerAddresses.jsx — label, full
  // address, landmark, a chosen default) were never read here at all:
  // every real order was placed with no usable delivery address.
  const {
    data: addresses,
    isLoading: addressesLoading,
    error: addressesError,
    refetch: refetchAddresses,
  } = useDataFetch(
    () => getAddresses(user?.id),
    [user?.id],
    { cacheKey: `addresses:${user?.id}`, enabled: !!user?.id }
  );
  // getAddresses orders is_default first, so [0] is the default (or the
  // only one, or the earliest-added if none is marked default).
  const selectedAddress = addresses?.[0] ?? null;

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
    if (couponBusy) return; // re-entry guard — see handlePlaceOrder above
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

  // Guard against reaching Checkout with nothing to check out — e.g. the
  // cart was already cleared by a completed order and the user hits the
  // browser "back" button from the order-detail page. Previously this
  // rendered a confusing near-blank checkout (₹0 summary, disabled button,
  // no explanation) instead of sending them somewhere useful.
  useEffect(() => {
    if (items.length === 0 && !placed) {
      navigate('/customer/cart', { replace: true });
    }
  }, [items.length, placed, navigate]);

  if (items.length === 0 && !placed) return null;

  const handlePlaceOrder = async () => {
    // Re-entry guard: the trigger button is already disabled while
    // placing is true, but that disabled state only takes effect on
    // React's next render — a fast double-tap (common on the lower-end
    // Android hardware this app targets) can fire this handler twice
    // before that happens. Guard here too rather than rely on the
    // button alone.
    if (placing) return;
    if (!vendor.id) {
      setError('Cannot determine vendor. Please clear cart and try again.');
      return;
    }
    if (!selectedAddress) {
      // Previously this was never actually checked — an order could be
      // placed with no real address on file at all (see the
      // delivery_address fix above), leaving the vendor/rider nothing
      // usable to deliver to.
      setError('Please add a delivery address before placing your order.');
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
        delivery_address: selectedAddress
          ? `${selectedAddress.address}${selectedAddress.landmark ? ', ' + selectedAddress.landmark : ''}`
          : (profile?.village ?? village?.name ?? ''),
      };

      const { data: order, error: orderError } = await OrderAPI.create(orderPayload);
      if (orderError) throw orderError;

      // Authoritative amount to charge comes from the server, never the client.
      const serverTotal = order.total ?? grandTotal;

      // 2. Handle payment
      if (payMethod === 'upi') {
        try {
          const rzpResult = await initiatePayment({
            amount:        serverTotal,
            orderId:       order.id,
            customerId:    user.id,
            customerName:  profile?.name,
            customerPhone: profile?.phone,
          });

          if (rzpResult.error)     throw new Error(rzpResult.error);
          if (rzpResult.cancelled) {
            // Use atomic cancel (no refund needed — payment never captured)
            await cancelOrderWithRefund(order.id, user.id, 'customer', 'Payment cancelled by user');
            setPlacing(false);
            return;
          }
          // Webhook confirms payment → order status + payment_status updated server-side.
          // DO NOT set payment_status from here — the guard trigger will reject it.
        } catch (payErr) {
          // Any UPI failure — SDK/script didn't load, the create-order edge
          // function errored, or Razorpay's own "payment.failed" event —
          // used to leave the order `create_order` had already committed
          // sitting there uncancelled forever. Worse, since the cart was
          // only cleared on eventual success, tapping "Place Order" again
          // created a SECOND order on top of it — a vendor could end up
          // with several duplicate pending orders from one failed
          // checkout attempt. Cancel this one before surfacing the error
          // so a retry starts clean.
          await cancelOrderWithRefund(order.id, user.id, 'customer', 'Payment failed').catch(() => {});
          throw payErr;
        }

      } else if (payMethod === 'wallet') {
        // Single atomic RPC: charges order.total, confirms order, credits escrow.
        const { data: walletRes, error: walletError } = await PaymentAPI.payOrderFromWallet(order.id);

        // PASS 7 FIX: a same-order retry after a real, already-committed
        // success is reported by the RPC as success:true with
        // already_paid:true (see migration 059) — it therefore never
        // reaches this `if (walletError)` branch at all, and is handled
        // by the normal success path below exactly as it should be:
        // the order genuinely was placed and paid, just not on this
        // particular call. This block only ever runs for a GENUINE
        // payment failure (insufficient funds, or the order having
        // become non-payable for some other real reason) — never for
        // an already-successful payment — so cancelling here remains
        // safe and correct.
        if (walletError) {
          // Wallet debit failed — cancel the order atomically (nothing captured)
          await cancelOrderWithRefund(order.id, user.id, 'customer', 'Wallet payment failed');
          throw new Error(walletError.message ?? 'Wallet payment failed. Please try again.');
        }

        if (walletRes?.already_paid) {
          // Reconciliation path: this exact order was already paid by
          // an earlier attempt whose response we never received. Do
          // NOT re-debit, do NOT cancel — treat it as the success it
          // already is.
          dispatch({
            type:    'UPDATE_WALLET_BALANCE',
            payload: { balance: walletRes?.new_balance ?? walletBalance },
          });
        } else {
          dispatch({
            type:    'UPDATE_WALLET_BALANCE',
            payload: { balance: walletRes?.new_balance ?? (walletBalance - serverTotal) },
          });
        }
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
        <Link
          to="/customer/cart"
          className="touch-target flex items-center justify-center -ml-2"
          aria-label="Back to cart"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" aria-hidden="true" /> Delivery Address
            </h3>
            {selectedAddress && (
              <Link to="/customer/addresses" className="text-xs text-primary font-medium">Change</Link>
            )}
          </div>
          {addressesLoading ? (
            <div className="h-10 flex items-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : addressesError ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Could not load your address.
              </p>
              <button onClick={refetchAddresses} className="text-xs text-primary font-semibold shrink-0 underline">
                Retry
              </button>
            </div>
          ) : selectedAddress ? (
            <>
              <p className="text-sm">
                {selectedAddress.label && <Badge variant="outline" className="mr-1.5 text-[10px]">{selectedAddress.label}</Badge>}
                {selectedAddress.address}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedAddress.landmark ? `${selectedAddress.landmark} · ` : ''}
                {village?.name ?? profile?.village ?? ''}
                {village?.district ? `, ${village.district}` : ''}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                No delivery address saved yet.
              </p>
              <Link to="/customer/addresses" className="text-xs text-primary font-semibold shrink-0">
                Add address
              </Link>
            </div>
          )}
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
          <h3 className="font-semibold text-sm mb-3" id="pay-method-label">Payment Method</h3>
          <div className="space-y-2" role="radiogroup" aria-labelledby="pay-method-label">
            {payMethods.map(pm => {
              const isWallet = pm.id === 'wallet';
              const disabled = isWallet && !walletSufficient;
              return (
                <button
                  key={pm.id}
                  onClick={() => !disabled && setPayMethod(pm.id)}
                  disabled={disabled}
                  role="radio"
                  aria-checked={payMethod === pm.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left
                    ${payMethod === pm.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${payMethod === pm.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <pm.icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{pm.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {isWallet
                        ? `Balance: ₹${walletBalance.toLocaleString('en-IN')}${!walletSufficient ? ' (insufficient)' : ''}`
                        : pm.sub}
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className={`w-4 h-4 rounded-full border-2 transition-colors shrink-0
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
            <Switch checked={useCredit} onCheckedChange={setUseCredit} aria-label="Use SETU Credit" />
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
                  aria-label="Coupon code"
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
          disabled={placing || items.length === 0 || (!addressesLoading && !selectedAddress)}
        >
          {placing
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
            : `Place Order · ₹${grandTotal.toFixed(0)}`}
        </Button>
      </div>
    </div>
  );
}
