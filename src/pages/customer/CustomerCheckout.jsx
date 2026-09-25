import React, { useState, useEffect, useMemo } from 'react';
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
import { useAuth } from '@/lib/AuthContext';
import { useVillage } from '@/lib/village';
import { useFeatureFlag } from '@/lib/featureFlags';
import { CouponAPI } from '@/lib/api';
import { useFeeConfig } from '@/hooks/queries/useCatalog';
import { useAddresses } from '@/hooks/queries/useAddresses';
import { useCheckoutMutations } from '@/hooks/mutations/useCheckoutMutations';
import SwipeToConfirm from '@/components/shared/SwipeToConfirm';

const PAY_METHODS = [
  { id: 'cod',    label: 'Cash on Delivery', sub: 'Pay when order arrives',    icon: CreditCard  },
  { id: 'upi',    label: 'UPI Payment',      sub: 'Google Pay, PhonePe, BHIM', icon: Smartphone  },
  { id: 'wallet', label: 'SETU Wallet',      sub: 'Pay from balance',          icon: Wallet      },
];

// Idempotency key for create_order (migration 083) — only needs to be
// unique per checkout attempt, not cryptographically unpredictable, so
// falling back to Math.random when crypto.randomUUID isn't available
// (older Android WebViews — this app's actual install base) is fine;
// what matters is never crashing checkout over a missing browser API.
function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ckout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const { submitCheckout } = useCheckoutMutations();
  const { items, totalPrice, clearCart }  = useCart();
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
  } = useAddresses(user?.id);
  // getAddresses orders is_default first, so [0] is the default (or the
  // only one, or the earliest-added if none is marked default).
  const selectedAddress = addresses?.[0] ?? null;

  const [payMethod, setPayMethod] = useState('cod');
  const [useCredit, setUseCredit] = useState(false);
  const [placing,   setPlacing]   = useState(false);
  const [error,     setError]     = useState(null);
  const [placed,    setPlaced]    = useState(false);
  // Idempotency key (migration 083) — generated once per mount of this
  // page (i.e. once per checkout attempt), not per tap of "Place
  // Order". Reused across every retry of THIS attempt, so if a
  // request reaches the server and succeeds but its response never
  // reaches the client (dropped connection, timeout), a second tap
  // returns the same order create_order already created instead of
  // placing a duplicate one. A fresh mount (navigating back into
  // checkout later, a genuinely new attempt) gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  // Fee parameters — single source of truth (server get_fee_config()).
  // Defaults match the server defaults so the estimate is correct even
  // before the fetch resolves; the authoritative total still comes from
  // create_order on the server.
  const { data: feeCfgData } = useFeeConfig({ staleTime: 300_000 });
  const feeCfg = useMemo(() => ({
    commission_pct: 1,
    delivery_flat: 20,
    free_threshold: 200,
    credit_discount_pct: 10,
    credit_discount_max: 500,
    ...(feeCfgData ?? {}),
  }), [feeCfgData]);


  // Coupon state
  const [couponCode, setCouponCode]         = useState('');
  const [appliedCode, setAppliedCode]       = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg]           = useState(null);
  const [couponBusy, setCouponBusy]         = useState(false);

  // Wallet balance from store (hydrated from Supabase on app load)
  const walletBalance = Number(profile?.wallet_balance ?? 0);

  // Feature-flag gating: hide payment methods whose module is disabled.
  const walletEnabled  = useFeatureFlag('wallet');
  const onlineEnabled  = useFeatureFlag('payments');
  const couponsEnabled = useFeatureFlag('coupons');
  const payMethods = useMemo(() => PAY_METHODS.filter(pm =>
    (pm.id !== 'wallet' || walletEnabled) &&
    (pm.id !== 'upi'    || onlineEnabled)
  ), [walletEnabled, onlineEnabled]);

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
    // Re-entry guard: protect the handler itself in addition to the disabled UI.
    if (placing) return;
    if (!vendor.id) {
      setError('Cannot determine vendor. Please clear cart and try again.');
      return;
    }
    if (!selectedAddress) {
      setError('Please add a delivery address before placing your order.');
      return;
    }

    // Client-side wallet check is UX only. The authoritative payment amount
    // and balance check remain server-side in pay_order_from_wallet().
    if (payMethod === 'wallet' && !walletSufficient) {
      setError(`Insufficient wallet balance. Available: ₹${walletBalance}, Required: ₹${grandTotal}`);
      return;
    }

    setPlacing(true);
    setError(null);

    try {
      const orderPayload = {
        vendor_id:        vendor.id,
        village_id:       village?.id ?? profile?.village_id ?? null,
        items:            items.map(i => ({ product_id: i.id, qty: i.quantity })),
        payment_method:   ({ cod: 'COD', upi: 'UPI', wallet: 'wallet' })[payMethod] ?? 'COD',
        use_credit:       useCredit,
        coupon_code:      appliedCode ?? null,
        idempotency_key:  idempotencyKey,
        address_id:       selectedAddress.id,
        delivery_address: `${selectedAddress.address}${selectedAddress.landmark ? ', ' + selectedAddress.landmark : ''}`,
      };

      const result = await submitCheckout({
        orderPayload,
        paymentMethod: payMethod,
        customerId: user?.id,
        vendorId: vendor?.id,
        customerName: profile?.name,
        customerPhone: profile?.phone,
      });

      if (result?.cancelled) {
        // The checkout attempt is now permanently cancelled. A fresh
        // idempotency key is required for the next genuine attempt.
        setIdempotencyKey(newIdempotencyKey());
        return;
      }

      clearCart();
      setPlaced(true);
      setTimeout(() => navigate(`/customer/orders/${result.data.id}`), 2500);
    } catch (err) {
      console.error('[Checkout Error]', err);
      // A failed payment is cancelled by the checkout mutation boundary.
      // Keep the key fresh so the next retry creates a new order attempt.
      if (payMethod === 'upi' || payMethod === 'wallet') setIdempotencyKey(newIdempotencyKey());
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
    <div className="pb-32 max-w-md mx-auto">
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

      {/* z-40 + pb-safe: sits above MobileNav (fixed bottom-0, z-50)
          instead of behind it, and clears the phone's own safe-area
          inset. MobileNav is dropped entirely on /customer/checkout
          now (CustomerLayout.jsx) so this no longer even needs to
          share the bottom edge with it — kept anyway as a harmless
          safety margin against any future change to that. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-background border-t border-border px-4 pt-4 pb-safe">
        <SwipeToConfirm
          label="Slide to Place Order"
          confirmingLabel="Placing your order…"
          confirmedLabel="Order Placed! ✓"
          amountLabel={`₹${grandTotal.toFixed(0)}`}
          onConfirm={handlePlaceOrder}
          loading={placing}
          success={placed}
          disabled={items.length === 0 || (!addressesLoading && !selectedAddress)}
        />
      </div>
    </div>
  );
}
