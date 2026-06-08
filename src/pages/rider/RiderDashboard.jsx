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
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import RiderNavigationMap from '@/components/maps/RiderNavigationMap';
import { RiderAPI } from '@/lib/api';

// ── Loading skeleton ──────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
    </div>
  );
}

export default function RiderDashboard() {
  const { state, dispatch }        = useStore();
  const { isOnline, toggleOnline } = useRiderState();
  const { user, profile }          = useAuth();

  // ── Use authenticated user's real UUID — never hardcode seed ──
  const riderUUID = user?.id ?? null;

  const { location: currentLocation } = useRiderLocation(riderUUID, isOnline);
  const [accepting, setAccepting]     = useState(null);
  const [delivering, setDelivering]   = useState(null);

  // ── Derived display values from real auth profile ─────────
  const riderName = profile?.name ?? 'Rider';
  const riderZone = profile?.zone  ?? 'Village Zone';

  // ── Realtime: orders assigned to this rider (active) ──────
  const { orders: myOrders, isLoading: loadingMine } = useRealtimeOrders({
    mode:       'rider',
    riderId:    riderUUID,
    activeOnly: true,
  });

  // ── Realtime: available (unassigned pending) orders ───────
  const availableOrders = state.orders.filter(o =>
    !o.riderId && !o.rider_id && o.status === 'pending'
  );

  // ── Accept order ──────────────────────────────────────────
  const handleAccept = async (orderId) => {
    if (!riderUUID) return;
    setAccepting(orderId);
    // Optimistic update (uses local store ID for UI only)
    dispatch({ type: 'RIDER_ACCEPT_ORDER', payload: { orderId, riderId: riderUUID } });
    // Persist with real auth UUID
    await RiderAPI.acceptOrder(orderId, riderUUID, riderName);
    // Seed an initial location write so rider appears on map immediately
    if (currentLocation) {
      await RiderAPI.updateLocation(riderUUID, currentLocation.lat, currentLocation.lng);
    }
    setAccepting(null);
  };

  // ── Mark delivered ────────────────────────────────────────
  const handleDeliver = async (orderId, total) => {
    if (!riderUUID) return;
    setDelivering(orderId);
    // Optimistic
    dispatch({
      type: 'RIDER_DELIVER',
      payload: { orderId, riderId: riderUUID, codCollected: true, amount: total },
    });
    // Persist
    await RiderAPI.markDelivered(orderId, {
      rider_id:      riderUUID,
      cod_collected: true,
      amount:        total,
    });
    setDelivering(null);
  };

  // ── Toggle online → persist ───────────────────────────────
  const handleToggleOnline = async () => {
    if (!riderUUID) return;
    toggleOnline();
    await RiderAPI.toggleOnline(riderUUID, !isOnline);
  };

  if (!riderUUID) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <AppHeader
        title={riderName}
        subtitle={`Zone: ${riderZone}`}
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
          value={`₹${state.riderEarningsToday ?? 0}`}
          trend="15% above avg"
          trendUp
          icon={IndianRupee}
        />
        <StatCard
          title="Deliveries Today"
          value={String(state.riderDeliveriesToday ?? 0)}
          subtitle={`${state.riderTotalDeliveries ?? 0} total`}
          icon={Package}
        />
      </div>

      {/* Map */}
      <div className="px-4 mb-4 h-48">
        <RiderNavigationMap
          currentLocation={currentLocation}
          destination={{ lat: 26.355, lng: 86.075, address: 'Customer Address' }}
          onArrived={() => console.log('Arrived')}
        />
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
              <p className="text-xl font-bold">₹{state.riderCODBalance ?? 0}</p>
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
