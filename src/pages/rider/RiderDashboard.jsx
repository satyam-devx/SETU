import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Navigation, IndianRupee, Package,
  Clock, AlertTriangle, CheckCircle, Phone, Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore, useRiderState } from '@/lib/store';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { RiderAPI } from '@/lib/api';
import { RIDERS } from '@/lib/mockData';

const RIDER_ID   = 'r1';
const RIDER_UUID = '33000000-0000-0000-0000-000000000001'; // DB uuid from seed

// ── Loading skeleton ──────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
    </div>
  );
}

export default function RiderDashboard() {
  const { state, dispatch }           = useStore();
  const { isOnline, toggleOnline }    = useRiderState();
  const [accepting, setAccepting]     = useState(null);
  const [delivering, setDelivering]   = useState(null);

  const rider = RIDERS[0];

  // ── Realtime: orders assigned to this rider (active) ──
  const { orders: myOrders, isLoading: loadingMine } = useRealtimeOrders({
    mode:       'rider',
    riderId:    RIDER_UUID,
    activeOnly: true,
  });

  // ── Realtime: available (unassigned pending) orders ──
  // When Supabase is configured this filters server-side.
  // In demo mode we filter store state.
  const availableOrders = state.orders.filter(o =>
    !o.riderId && !o.rider_id && o.status === 'pending'
  );

  // ── Accept order ──────────────────────────────────────
  const handleAccept = async (orderId) => {
    setAccepting(orderId);
    // Optimistic
    dispatch({ type: 'RIDER_ACCEPT_ORDER', payload: { orderId, riderId: RIDER_ID } });
    // Persist
    await RiderAPI.acceptOrder(orderId, RIDER_UUID, rider.name);
    // Update rider online status in DB
    await RiderAPI.updateLocation(RIDER_UUID, 26.350, 86.070);
    setAccepting(null);
  };

  // ── Mark delivered ────────────────────────────────────
  const handleDeliver = async (orderId, total) => {
    setDelivering(orderId);
    // Optimistic
    dispatch({
      type: 'RIDER_DELIVER',
      payload: { orderId, riderId: RIDER_ID, codCollected: true, amount: total },
    });
    // Persist
    await RiderAPI.markDelivered(orderId, {
      rider_id:      RIDER_UUID,
      cod_collected: true,
      amount:        total,
    });
    setDelivering(null);
  };

  // ── Toggle online → persist ───────────────────────────
  const handleToggleOnline = async () => {
    toggleOnline();
    await RiderAPI.toggleOnline(RIDER_UUID, !isOnline);
  };

  return (
    <div className="pb-20">
      <AppHeader
        title={rider.name}
        subtitle={`Zone: ${rider.zone}`}
        notificationCount={availableOrders.length}
        rightAction={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <Switch checked={isOnline} onCheckedChange={handleToggleOnline} />
          </div>
        }
      />

      {/* Offline banner */}
      {!isOnline && (
        <div className="mx-4 mt-3 p-3 bg-muted rounded-xl text-center">
          <p className="text-sm font-medium text-muted-foreground">
            You're offline — toggle to start receiving orders
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard
          title="Today's Earnings"
          value={`₹${rider.todayEarnings}`}
          trend="15% above avg"
          trendUp
          icon={IndianRupee}
        />
        <StatCard
          title="Deliveries Today"
          value={String(rider.todayDeliveries)}
          subtitle={`${rider.totalDeliveries} total`}
          icon={Package}
        />
      </div>

      {/* Map placeholder */}
      <div className="px-4 mb-4">
        <Card className="h-36 bg-muted border-border flex items-center justify-center relative overflow-hidden">
          <div className="text-center z-10">
            <Navigation className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Madhepur Zone Map</p>
            <p className="text-xs text-muted-foreground">Offline navigation ready</p>
          </div>
        </Card>
      </div>

      {/* Active deliveries */}
      <div className="px-4 mb-4">
        <h3 className="font-semibold text-sm mb-2">
          My Active Deliveries ({myOrders.length})
        </h3>

        {loadingMine ? (
          <OrdersSkeleton />
        ) : myOrders.length === 0 ? (
          <Card className="p-4 border-border text-center">
            <p className="text-sm text-muted-foreground">No active deliveries</p>
          </Card>
        ) : (
          myOrders.map(order => {
            const orderNum  = order.orderNumber ?? order.order_number ?? '—';
            const custName  = order.customerName ?? order.customer_name ?? 'Customer';
            const village   = order.village ?? '—';
            const total     = order.total ?? 0;
            const payMethod = order.paymentMethod ?? order.payment_method ?? 'COD';
            const canDeliver = ['picked_up', 'on_the_way', 'ready'].includes(order.status);

            return (
              <Card key={order.id} className="p-3 border-primary/30 bg-primary/5 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold">{orderNum}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center gap-2 text-xs mb-2 text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {order.vendorName ?? order.vendor_name} → {custName}, {village}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{payMethod}</Badge>
                    <span className="text-sm font-bold">₹{total}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <Phone className="w-3 h-3" />
                    </Button>
                    {canDeliver && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-accent hover:bg-accent/90"
                        disabled={delivering === order.id}
                        onClick={() => handleDeliver(order.id, total)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {delivering === order.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : 'Delivered'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Available orders (unassigned) */}
      {isOnline && (
        <div className="px-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">
            Available Orders ({availableOrders.length})
          </h3>
          {availableOrders.length === 0 ? (
            <Card className="p-4 border-border text-center">
              <p className="text-sm text-muted-foreground">
                No new orders right now. Stay online!
              </p>
            </Card>
          ) : (
            availableOrders.map(order => {
              const orderNum  = order.orderNumber ?? order.order_number ?? '—';
              const total     = order.total ?? 0;
              const payMethod = order.paymentMethod ?? order.payment_method ?? 'COD';
              const itemCount = (order.items ?? order.order_items ?? []).length;

              return (
                <Card key={order.id} className="p-3 border-border mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold">{orderNum}</span>
                    <Badge variant="outline" className="text-[9px]">{payMethod}</Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {order.vendorName ?? order.vendor_name} → {order.village}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ₹{total} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>45s to auto-decline</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={accepting === order.id}
                        onClick={() => handleAccept(order.id)}
                      >
                        {accepting === order.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : 'Accept'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Decline
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* COD balance */}
      <div className="px-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">COD Cash Balance</p>
              <p className="text-xl font-bold">₹{rider.codBalance}</p>
              <p className="text-xs text-muted-foreground">Deposit before end of shift</p>
            </div>
            <Link to="/rider/cod">
              <Button variant="outline" size="sm" className="text-xs">Manage COD</Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* SOS */}
      <div className="px-4 mt-3 mb-2">
        <Link to="/rider/safety">
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> Safety Center / SOS
          </Button>
        </Link>
      </div>
    </div>
  );
}
