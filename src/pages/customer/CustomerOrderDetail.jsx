import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, Clock, Package, Bike, MapPin, Phone,
  AlertTriangle, Copy, MessageSquare, RefreshCw, X, Loader2, AlertCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import OrderTrackingMap from '@/components/maps/OrderTrackingMap';
import { useRealtimeOrder } from '@/hooks/useRealtimeOrders';
import { useStore, canTransition, ORDER_STATUS } from '@/lib/store';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getOrderById, rateOrder, updateOrderStatus, cancelOrderWithRefund } from '@/lib/api';

// ── Timeline config per status ──────────────────────────
const TIMELINE = {
  pending:    [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Vendor Confirming',  done: false, active: true,  icon: Clock      },
    { label: 'Preparing',          done: false, active: false, icon: Package    },
    { label: 'Rider Pickup',       done: false, active: false, icon: Bike       },
    { label: 'Delivered',          done: false, active: false, icon: CheckCircle },
  ],
  confirmed:  [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Vendor Confirmed',   done: true,  active: false, icon: CheckCircle },
    { label: 'Preparing',          done: false, active: true,  icon: Package    },
    { label: 'Rider Pickup',       done: false, active: false, icon: Bike       },
    { label: 'Delivered',          done: false, active: false, icon: CheckCircle },
  ],
  preparing:  [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Confirmed',          done: true,  active: false, icon: CheckCircle },
    { label: 'Preparing',          done: false, active: true,  icon: Package    },
    { label: 'Rider Pickup',       done: false, active: false, icon: Bike       },
    { label: 'Delivered',          done: false, active: false, icon: CheckCircle },
  ],
  ready:      [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Confirmed',          done: true,  active: false, icon: CheckCircle },
    { label: 'Ready for Pickup',   done: true,  active: true,  icon: Package    },
    { label: 'Awaiting Rider',     done: false, active: false, icon: Bike       },
    { label: 'Delivered',          done: false, active: false, icon: CheckCircle },
  ],
  picked_up:  [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Confirmed',          done: true,  active: false, icon: CheckCircle },
    { label: 'Prepared',           done: true,  active: false, icon: Package    },
    { label: 'Rider Picked Up',    done: true,  active: true,  icon: Bike       },
    { label: 'Delivered',          done: false, active: false, icon: CheckCircle },
  ],
  on_the_way: [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Confirmed',          done: true,  active: false, icon: CheckCircle },
    { label: 'Prepared',           done: true,  active: false, icon: Package    },
    { label: 'On the Way 🛵',      done: true,  active: true,  icon: MapPin     },
    { label: 'Delivered',          done: false, active: false, icon: CheckCircle },
  ],
  delivered:  [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Confirmed',          done: true,  active: false, icon: CheckCircle },
    { label: 'Prepared',           done: true,  active: false, icon: Package    },
    { label: 'Picked Up',          done: true,  active: false, icon: Bike       },
    { label: 'Delivered ✓',        done: true,  active: false, icon: CheckCircle },
  ],
  cancelled:  [
    { label: 'Order Placed',       done: true,  active: false, icon: Package    },
    { label: 'Cancelled',          done: true,  active: false, icon: X          },
  ],
};

// ── Loading skeleton ─────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="pb-24 animate-pulse">
      <div className="h-14 bg-muted" />
      <div className="h-24 bg-primary/5 border-b border-border" />
      <div className="px-4 py-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── "Last updated X ago" helper ──────────────────────────
function useLastUpdated(order) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!order) return;
    const ts = order.updatedAt || order.updated_at || order.createdAt || order.created_at;
    if (!ts) return;

    const update = () => {
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 60)        setLabel(`Updated ${diff}s ago`);
      else if (diff < 3600) setLabel(`Updated ${Math.floor(diff / 60)}m ago`);
      else                  setLabel(`Updated ${Math.floor(diff / 3600)}h ago`);
    };
    update();
    const t = setInterval(update, 10_000);
    return () => clearInterval(t);
  }, [order]);

  return label;
}

// ── MAIN COMPONENT ───────────────────────────────────────
export default function CustomerOrderDetail() {
  const { orderId }  = useParams();
  const navigate     = useNavigate();
  const { state, dispatch } = useStore();

  // 1. Check global store first (hydrated by CustomerOrders)
  const storeOrder = state.orders.find(o => o.id === orderId);

  // 2. Fetch from DB only when not in store
  const { data: fetchedOrder, isLoading: fetchLoading } = useDataFetch(
    () => getOrderById(orderId),
    [orderId],
    { cacheKey: `order:${orderId}`, enabled: !storeOrder && !!orderId }
  );

  // 3. Realtime subscription merges live updates into store
  useRealtimeOrder(orderId);

  // Prefer realtime-updated store copy, fall back to fetched
  const order = state.orders.find(o => o.id === orderId) ?? fetchedOrder;
  const isLoading = fetchLoading && !order;

  const lastUpdated = useLastUpdated(order);

  const [rating,          setRating]          = useState(0);
  const [ratingComment,   setRatingComment]   = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [cancelling,      setCancelling]      = useState(false);
  const [cancelReason,    setCancelReason]    = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [actionLoading,   setActionLoading]   = useState(false);

  if (isLoading) return <OrderSkeleton />;

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Order not found.</p>
        <Button onClick={() => navigate('/customer/orders')}>Back to Orders</Button>
      </div>
    );
  }

  // Normalise field names
  const orderNumber  = order.orderNumber   ?? order.order_number ?? '—';
  const createdAt    = order.createdAt     ?? order.created_at;
  const riderId      = order.rider_id      ?? order.riderId;
  const riderName    = order.riderName     ?? order.rider_name;
  const cancelReason2 = order.cancelReason ?? order.cancel_reason;
  const paymentMethod = order.paymentMethod ?? order.payment_method;
  const paymentStatus = order.paymentStatus ?? order.payment_status;
  const vendorName   = order.vendorName    ?? order.vendor_name;
  const deliveryFee  = order.deliveryFee   ?? order.delivery_fee  ?? 0;
  const platformFee  = order.platformFee   ?? order.platform_fee  ?? 0;
  const isRated      = order.isRated       ?? order.is_rated       ?? false;
  const items        = order.items         ?? order.order_items    ?? [];

  const isLive    = !['delivered', 'cancelled'].includes(order.status);
  const canCancel = canTransition(order.status, ORDER_STATUS.CANCELLED);
  const timeline  = TIMELINE[order.status] ?? TIMELINE.pending;

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    dispatch({ type: 'ORDER_CANCEL', payload: { orderId: order.id, reason: cancelReason } });
    // Atomically cancels order AND issues wallet refund if payment was captured
    await cancelOrderWithRefund(order.id, user?.id, 'customer', cancelReason);
    setCancelling(false);
    setShowCancelModal(false);
  };

  const handleRating = async () => {
    if (rating === 0) return;
    setActionLoading(true);
    dispatch({ type: 'ORDER_RATE', payload: { orderId: order.id, vendorRating: rating, riderRating: rating, comment: ratingComment } });
    await rateOrder({ orderId: order.id, vendorRating: rating, riderRating: rating, comment: ratingComment });
    setActionLoading(false);
    setRatingSubmitted(true);
  };

  const handleReorder = () => navigate(`/customer/reorder/${order.id}`);

  const handleCopy = () => {
    navigator.clipboard?.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Vendor/customer coords — real addresses would come from order record
  const vendorLoc   = {
    lat: order.vendor_lat   ?? 26.350,
    lng: order.vendor_lng   ?? 86.070,
    name: vendorName,
  };
  const customerLoc = {
    lat: order.customer_lat ?? 26.355,
    lng: order.customer_lng ?? 86.075,
  };

  return (
    <div className="pb-24">
      <AppHeader
        title={orderNumber}
        subtitle={createdAt
          ? new Date(createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
          : ''}
        showBack
        backTo="/customer/orders"
      />

      {/* Map for Live Orders */}
      {isLive && (
        <div className="w-full h-64 border-b border-border">
          <OrderTrackingMap
            riderId={riderId}
            vendorLoc={vendorLoc}
            customerLoc={customerLoc}
          />
        </div>
      )}

      {/* Status hero */}
      <div className={`px-4 py-5 ${
        isLive
          ? 'bg-primary/5 border-b border-primary/10'
          : order.status === 'delivered'
          ? 'bg-green-50 border-b border-green-100'
          : 'bg-red-50 border-b border-red-100'
      }`}>
        {isLive && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Live Order</p>
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground ml-auto">{lastUpdated}</span>
            )}
          </div>
        )}
        <h2 className="text-xl font-bold">
          {order.status === 'pending'    && '⏳ Waiting for vendor'}
          {order.status === 'confirmed'  && '✅ Vendor confirmed'}
          {order.status === 'preparing'  && '👨‍🍳 Being prepared'}
          {order.status === 'ready'      && '📦 Ready for pickup'}
          {order.status === 'picked_up'  && '🛵 Rider has it'}
          {order.status === 'on_the_way' && '🛵 Almost there!'}
          {order.status === 'delivered'  && '✅ Delivered!'}
          {order.status === 'cancelled'  && '❌ Cancelled'}
        </h2>
        {riderName && isLive && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-card rounded-xl border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center font-bold text-primary text-sm">
              {riderName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{riderName}</p>
              <p className="text-xs text-muted-foreground">Your delivery rider</p>
            </div>
            <Button size="icon" variant="outline" className="h-9 w-9">
              <Phone className="w-4 h-4" />
            </Button>
          </div>
        )}
        {cancelReason2 && (
          <p className="text-sm text-red-600 mt-2 font-medium">Reason: {cancelReason2}</p>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-4">
        <h3 className="font-semibold text-sm mb-4">Order Timeline</h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {timeline.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                    step.active ? 'bg-primary text-white ring-4 ring-primary/20'
                    : step.done  ? 'bg-accent text-white'
                    :              'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="pt-1">
                    <p className={`text-sm font-medium ${
                      step.active ? 'text-primary'
                      : step.done  ? 'text-foreground'
                      :              'text-muted-foreground'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Order Items</h3>
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm flex-1">{item.name ?? item.product_name}</span>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[9px]">
                  ×{item.qty ?? item.quantity ?? 1}
                </Badge>
                <span className="text-sm font-bold">₹{item.price}</span>
              </div>
            </div>
          ))}
          <div className="mt-3 space-y-1 pt-2 border-t border-border text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery fee</span><span>₹{deliveryFee}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform fee</span><span>₹{platformFee}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-border">
              <span>Total</span><span>₹{order.total}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment & vendor */}
      <div className="px-4 mb-4 grid grid-cols-2 gap-3">
        <Card className="p-3 border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Payment</p>
          <p className="text-sm font-bold">{paymentMethod}</p>
          <Badge variant="outline" className={`text-[9px] mt-1 ${
            paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {paymentStatus}
          </Badge>
        </Card>
        <Card className="p-3 border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Vendor</p>
          <p className="text-sm font-bold truncate">{vendorName}</p>
          <p className="text-xs text-muted-foreground">{order.village}</p>
        </Card>
      </div>

      {/* Rating (post-delivery) */}
      {order.status === 'delivered' && !ratingSubmitted && !isRated && (
        <div className="px-4 mb-4">
          <Card className="p-4 border-accent/30 bg-accent/5">
            <h3 className="font-semibold text-sm mb-3">Rate your experience</h3>
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${star <= rating ? '' : 'opacity-40'}`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Optional: Tell us about your experience..."
              className="text-sm mb-3 h-20"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
            />
            <Button
              className="w-full text-xs h-9"
              onClick={handleRating}
              disabled={rating === 0 || actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Rating'}
            </Button>
          </Card>
        </div>
      )}
      {(ratingSubmitted || isRated) && order.status === 'delivered' && (
        <div className="px-4 mb-4">
          <Card className="p-3 border-green-200 bg-green-50 text-center">
            <p className="text-sm font-medium text-green-700">✓ Thanks for rating this order!</p>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 space-y-2">
        {order.status === 'delivered' && (
          <Button variant="outline" className="w-full text-xs gap-2" onClick={handleReorder}>
            <RefreshCw className="w-3 h-3" /> Reorder
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 text-xs"
            onClick={() => setShowCancelModal(true)}
          >
            <AlertTriangle className="w-3 h-3 mr-2" /> Cancel Order
          </Button>
        )}
        <Button variant="outline" className="w-full text-xs"
          onClick={() => navigate('/customer/support')}>
          <MessageSquare className="w-3 h-3 mr-2" /> Raise Issue
        </Button>
        <Button variant="outline" className="w-full text-xs h-9" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" /> {copied ? 'Copied!' : 'Copy Order ID'}
        </Button>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="bg-background rounded-t-2xl p-6 w-full max-w-md mx-auto">
            <h3 className="font-bold text-base mb-1">Cancel Order</h3>
            <p className="text-xs text-muted-foreground mb-3">Please tell us why you're cancelling</p>
            <div className="space-y-2 mb-3">
              {['Changed my mind', 'Ordered by mistake', 'Vendor taking too long', 'Found elsewhere'].map(r => (
                <button
                  key={r}
                  onClick={() => setCancelReason(r)}
                  className={`w-full text-left text-sm p-3 rounded-lg border transition-colors ${
                    cancelReason === r ? 'border-destructive bg-destructive/5' : 'border-border'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Or describe your reason..."
              className="text-sm mb-3 h-16"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Keep Order
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!cancelReason.trim() || cancelling}
                onClick={handleCancel}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
