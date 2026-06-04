import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle, Clock, Package, Bike, MapPin, Phone,
  AlertTriangle, Copy, MessageSquare, RefreshCw, X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { useStore, useOrder, canTransition, ORDER_STATUS } from '@/lib/store';
import { ORDERS } from '@/lib/mockData';

const ORDER_TIMELINE = {
  pending:    [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Vendor Confirming', done: false, active: true, icon: Clock }, { label: 'Preparing', done: false, icon: Package }, { label: 'Rider Picked Up', done: false, icon: Bike }, { label: 'Delivered', done: false, icon: CheckCircle }],
  confirmed:  [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Vendor Confirmed', done: true, icon: CheckCircle }, { label: 'Preparing', done: false, active: true, icon: Package }, { label: 'Rider Pickup', done: false, icon: Bike }, { label: 'Delivered', done: false, icon: CheckCircle }],
  preparing:  [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Vendor Confirmed', done: true, icon: CheckCircle }, { label: 'Preparing', done: true, active: true, icon: Package }, { label: 'Rider Pickup', done: false, icon: Bike }, { label: 'Delivered', done: false, icon: CheckCircle }],
  picked_up:  [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Confirmed', done: true, icon: CheckCircle }, { label: 'Prepared', done: true, icon: Package }, { label: 'Rider Picked Up', done: true, icon: Bike }, { label: 'Delivering', done: false, active: true, icon: MapPin }, { label: 'Delivered', done: false, icon: CheckCircle }],
  on_the_way: [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Confirmed', done: true, icon: CheckCircle }, { label: 'Prepared', done: true, icon: Package }, { label: 'Picked Up', done: true, icon: Bike }, { label: 'On The Way', done: true, active: true, icon: MapPin }, { label: 'Delivered', done: false, icon: CheckCircle }],
  delivered:  [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Confirmed', done: true, icon: CheckCircle }, { label: 'Prepared', done: true, icon: Package }, { label: 'Picked Up', done: true, icon: Bike }, { label: 'On The Way', done: true, icon: MapPin }, { label: 'Delivered ✓', done: true, icon: CheckCircle }],
  cancelled:  [{ label: 'Order Placed', done: true, icon: Package }, { label: 'Cancelled', done: true, icon: X }],
};

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { dispatch } = useStore();

  // Try store first, then fall back to seed data
  const storeOrder = useOrder(orderId);
  const order = storeOrder || ORDERS.find(o => o.id === orderId) || ORDERS[0];

  const [rating, setRating]           = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(!!order.isRated);
  const [cancelling, setCancelling]   = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [copied, setCopied]           = useState(false);

  const timeline = ORDER_TIMELINE[order.status] || ORDER_TIMELINE.pending;
  const isLive    = !['delivered', 'cancelled'].includes(order.status);
  const canCancel = canTransition(order.status, ORDER_STATUS.CANCELLED);

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    dispatch({ type: 'ORDER_CANCEL', payload: { orderId: order.id, reason: cancelReason } });
    setTimeout(() => {
      setCancelling(false);
      setShowCancelModal(false);
    }, 600);
  };

  const handleRating = () => {
    if (rating === 0) return;
    dispatch({
      type: 'ORDER_RATE',
      payload: { orderId: order.id, vendorRating: rating, riderRating: rating, comment: ratingComment },
    });
    setRatingSubmitted(true);
  };

  const handleReorder = () => {
    navigate(`/customer/reorder/${order.id}`);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pb-24">
      <AppHeader
        title={order.orderNumber}
        subtitle={`Placed ${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`}
        showBack
        backTo="/customer/orders"
      />

      {/* Status hero */}
      <div className={`px-4 py-5 ${isLive ? 'bg-primary/5 border-b border-primary/10' : order.status === 'delivered' ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
        {isLive && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Live Order</p>
          </div>
        )}
        <h2 className="text-xl font-bold">
          {order.status === 'pending'    && '⏳ Waiting for vendor'}
          {order.status === 'confirmed'  && '✅ Vendor confirmed'}
          {order.status === 'preparing'  && '👨‍🍳 Being prepared'}
          {order.status === 'ready'      && '📦 Ready for pickup'}
          {order.status === 'picked_up'  && '🛵 Rider on the way'}
          {order.status === 'on_the_way' && '🛵 Almost there!'}
          {order.status === 'delivered'  && '✅ Delivered!'}
          {order.status === 'cancelled'  && '❌ Cancelled'}
        </h2>
        {order.riderName && isLive && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-card rounded-xl border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">
              {order.riderName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{order.riderName}</p>
              <p className="text-xs text-muted-foreground">Your delivery rider</p>
            </div>
            <Button size="icon" variant="outline" className="h-9 w-9"><Phone className="w-4 h-4" /></Button>
          </div>
        )}
        {order.cancelReason && (
          <p className="text-sm text-red-600 mt-2 font-medium">Reason: {order.cancelReason}</p>
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
                    step.done ? 'bg-accent text-white' : step.active ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="pt-1">
                    <p className={`text-sm font-medium ${step.active ? 'text-primary' : step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
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
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm flex-1">{item.name}</span>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[9px]">×{item.qty}</Badge>
                <span className="text-sm font-bold">₹{item.price}</span>
              </div>
            </div>
          ))}
          <div className="mt-3 space-y-1 pt-2 border-t border-border">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Delivery</span><span>₹{order.deliveryFee}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Platform fee</span><span>₹{order.platformFee}</span></div>
            <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-border"><span>Total</span><span>₹{order.total}</span></div>
          </div>
        </Card>
      </div>

      {/* Payment & Vendor */}
      <div className="px-4 mb-4 grid grid-cols-2 gap-3">
        <Card className="p-3 border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Payment</p>
          <p className="text-sm font-bold">{order.paymentMethod}</p>
          <Badge variant="outline" className={`text-[9px] mt-1 ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {order.paymentStatus}
          </Badge>
        </Card>
        <Card className="p-3 border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Vendor</p>
          <p className="text-sm font-bold truncate">{order.vendorName}</p>
          <p className="text-xs text-muted-foreground">{order.village}</p>
        </Card>
      </div>

      {/* Rating (after delivery, if not yet rated) */}
      {order.status === 'delivered' && !ratingSubmitted && !order.isRated && (
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
            <Button className="w-full text-xs h-9" onClick={handleRating} disabled={rating === 0}>
              Submit Rating
            </Button>
          </Card>
        </div>
      )}
      {(ratingSubmitted || order.isRated) && order.status === 'delivered' && (
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
        <Link to="/customer/support">
          <Button variant="outline" className="w-full text-xs">
            <MessageSquare className="w-3 h-3 mr-2" /> Raise Issue
          </Button>
        </Link>
        <Button variant="outline" className="w-full text-xs h-9" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" /> {copied ? 'Copied!' : 'Copy Order ID'}
        </Button>
      </div>

      {/* Cancel Modal */}
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
                  className={`w-full text-left text-sm p-3 rounded-lg border transition-colors ${cancelReason === r ? 'border-destructive bg-destructive/5' : 'border-border'}`}
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
