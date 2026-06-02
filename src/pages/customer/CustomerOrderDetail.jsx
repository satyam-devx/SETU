import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, Package, Bike, MapPin, Phone, Star, AlertTriangle, Copy, ChevronRight, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { ORDERS } from '@/lib/mockData';

const ORDER_TIMELINE = {
  pending: [
    { label: 'Order Placed', time: '10:00 AM', done: true, icon: Package },
    { label: 'Vendor Confirming', time: 'Waiting...', done: false, active: true, icon: Clock },
    { label: 'Preparing', time: '', done: false, icon: Package },
    { label: 'Rider Picked Up', time: '', done: false, icon: Bike },
    { label: 'Out for Delivery', time: '', done: false, icon: MapPin },
    { label: 'Delivered', time: '', done: false, icon: CheckCircle },
  ],
  preparing: [
    { label: 'Order Placed', time: '9:30 AM', done: true, icon: Package },
    { label: 'Vendor Confirmed', time: '9:32 AM', done: true, icon: CheckCircle },
    { label: 'Preparing Order', time: '9:35 AM', done: true, active: true, icon: Package },
    { label: 'Rider Assigned', time: 'Finding rider...', done: false, icon: Bike },
    { label: 'Out for Delivery', time: '', done: false, icon: MapPin },
    { label: 'Delivered', time: '', done: false, icon: CheckCircle },
  ],
  picked_up: [
    { label: 'Order Placed', time: '8:45 AM', done: true, icon: Package },
    { label: 'Vendor Confirmed', time: '8:47 AM', done: true, icon: CheckCircle },
    { label: 'Order Prepared', time: '9:00 AM', done: true, icon: Package },
    { label: 'Rider Picked Up', time: '9:10 AM', done: true, icon: Bike },
    { label: 'Out for Delivery', time: 'Estimated 9:35 AM', done: false, active: true, icon: MapPin },
    { label: 'Delivered', time: '', done: false, icon: CheckCircle },
  ],
  delivered: [
    { label: 'Order Placed', time: '10:30 AM', done: true, icon: Package },
    { label: 'Vendor Confirmed', time: '10:32 AM', done: true, icon: CheckCircle },
    { label: 'Order Prepared', time: '10:45 AM', done: true, icon: Package },
    { label: 'Rider Picked Up', time: '10:55 AM', done: true, icon: Bike },
    { label: 'Out for Delivery', time: '11:05 AM', done: true, icon: MapPin },
    { label: 'Delivered ✓', time: '11:15 AM', done: true, icon: CheckCircle },
  ],
};

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const order = ORDERS.find(o => o.id === orderId) || ORDERS[0];
  const timeline = ORDER_TIMELINE[order.status] || ORDER_TIMELINE.pending;
  const isLive = !['delivered', 'cancelled'].includes(order.status);

  return (
    <div className="pb-24">
      <AppHeader title={order.orderNumber} subtitle={`Placed ${new Date(order.createdAt).toLocaleString('en-IN')}`} showBack backTo="/customer/orders" />

      {/* Status hero */}
      <div className={`px-4 py-5 ${isLive ? 'bg-primary/5 border-b border-primary/10' : order.status === 'delivered' ? 'bg-accent/5 border-b border-accent/10' : ''}`}>
        {isLive && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Live Order</p>
          </div>
        )}
        <h2 className="text-2xl font-bold mb-1">
          {order.status === 'pending' && '⏳ Waiting for confirmation'}
          {order.status === 'preparing' && '👨‍🍳 Vendor is preparing your order'}
          {order.status === 'on_the_way' && '🛵 Rider is on the way!'}
          {order.status === 'picked_up' && '🛵 Rider heading to you'}
          {order.status === 'delivered' && '✅ Delivered successfully!'}
          {order.status === 'cancelled' && '❌ Order cancelled'}
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
            <Button size="icon" variant="outline" className="h-9 w-9"><MessageSquare className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      {/* Order Timeline */}
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
                    <p className={`text-sm font-medium ${step.active ? 'text-primary' : step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                    {step.time && <p className="text-xs text-muted-foreground">{step.time}</p>}
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
              <span className="text-sm">{item.name}</span>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[9px]">×{item.qty}</Badge>
                <span className="text-sm font-bold">₹{item.price}</span>
              </div>
            </div>
          ))}
          <div className="mt-3 space-y-1 pt-2 border-t border-border">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Delivery fee</span><span>₹{order.deliveryFee}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Platform fee</span><span>₹{order.platformFee}</span></div>
            <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-border"><span>Total</span><span>₹{order.total}</span></div>
          </div>
        </Card>
      </div>

      {/* Payment & vendor */}
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

      {/* Actions */}
      <div className="px-4 space-y-2">
        {order.status === 'delivered' && (
          <Card className="p-4 border-accent/30 bg-accent/5">
            <h3 className="font-semibold text-sm mb-3">Rate your experience</h3>
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} className="text-3xl hover:scale-110 transition-transform">⭐</button>
              ))}
            </div>
            <Button className="w-full text-xs h-9">Submit Rating</Button>
          </Card>
        )}
        {isLive && order.status !== 'picked_up' && (
          <Button variant="outline" className="w-full text-destructive border-destructive/30 text-xs">
            <AlertTriangle className="w-3 h-3 mr-2" /> Cancel Order
          </Button>
        )}
        <Link to="/customer/support">
          <Button variant="outline" className="w-full text-xs">
            <MessageSquare className="w-3 h-3 mr-2" /> Raise Issue with this Order
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => navigator.clipboard?.writeText(order.orderNumber)}>
            <Copy className="w-3 h-3 mr-1" /> Copy Order ID
          </Button>
          <Button variant="outline" className="flex-1 text-xs h-9">Reorder</Button>
        </div>
      </div>
    </div>
  );
}