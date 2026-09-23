import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Navigation, IndianRupee, Package,
  Clock, AlertTriangle, CheckCircle, Phone, Loader2, ChevronRight, X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { useRiderState, useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { RiderAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// ── Loading skeleton ──────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
    </div>
  );
}

export default function RiderDashboard() {
  const { isOnline, toggleOnline } = useRiderState();
  const { user, profile }          = useAuth();

  // Resolve the rider's riders.id — orders, locations and earnings are
  // all keyed by it, NOT the auth uid. (Bug fix: the dashboard used
  // user.id everywhere, so orders never matched and accept/deliver wrote
  // an invalid rider_id that violated the FK.)
  const { data: rider } = useDataFetch(
    () => RiderAPI.getProfile(user?.id),
    [user?.id],
    { cacheKey: `rider-profile-${user?.id}`, enabled: !!user?.id }
  );
  const riderId = rider?.id ?? null;

  // useRiderLocation resolves riders.id internally from the auth user
  // id passed in — it does its own `riders.select('id').eq('user_id',
  // userId)` lookup. This was passing riderId (already riders.id, the
  // PK) instead of user.id (auth.users.id, what user_id actually
  // stores), so that internal lookup could never match anything —
  // resolvedRiderId never resolved, the GPS watch never started, and
  // currentLocation has been permanently null. No rider's live
  // location has ever actually been tracked.
  const { location: currentLocation } = useRiderLocation(user?.id, isOnline);
  const [accepting, setAccepting]     = useState(null);
  const [delivering, setDelivering]   = useState(null);
  const [deliveryTarget, setDeliveryTarget] = useState(null);
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [deliveryError, setDeliveryError] = useState('');
  const [availableOrders, setAvailableOrders] = useState([]);

  // ── Display values from the real rider row ────────────────
  const riderName = rider?.name ?? profile?.name ?? 'Rider';
  const riderZone = rider?.zone ?? profile?.zone  ?? 'Village Zone';

  // ── My active orders ───────────────────────────────────────
  // RiderLayout already holds the one live realtime channel for this
  // portal (`orders-rider-{riderId}`) and keeps state.orders current
  // for every rider page. This page used to open a SECOND subscription
  // on that exact same topic via useRealtimeOrders — the same bug
  // already found and fixed in the vendor portal's Orders page: while
  // riderId is still resolving (null -> rider.id), this component and
  // the layout race to subscribe/unsubscribe the same channel name
  // within the same tick, which is exactly the kind of thing that
  // crashes a page intermittently — and this is the FIRST screen a
  // rider sees after logging in, not a secondary page, so it's worse
  // here than it was for vendor. A plain REST fetch seeds/refreshes
  // the store instead; live updates still arrive through the layout's
  // single channel.
  const { state, dispatch } = useStore();
  const { data: fetchedOrders, isLoading: loadingMine, refetch: refetchMine } = useDataFetch(
    () => RiderAPI.getOrders(riderId, { limit: 50 }),
    [riderId],
    { cacheKey: `rider-orders-${riderId}`, enabled: !!riderId }
  );
  useEffect(() => {
    if (fetchedOrders?.length) dispatch({ type: 'SET_ORDERS', payload: { orders: fetchedOrders } });
  }, [fetchedOrders, dispatch]);
  const myOrders = React.useMemo(
    () => riderId ? state.orders.filter(o => (o.riderId ?? o.rider_id) === riderId) : [],
    [state.orders, riderId]
  );

  // ── Server-matched rider offers ───────────────────────────
  // Phase 4: only server-generated, time-bound offers are shown. This
  // prevents a village-wide claim race and lets the backend reassign
  // expired offers deterministically.
  const loadAvailable = useCallback(async () => {
    if (!riderId || !rider?.village_id || !isOnline) { setAvailableOrders([]); return; }
    const { data } = await RiderAPI.getAvailableOrders(riderId);
    setAvailableOrders(data ?? []);
  }, [riderId, rider?.village_id, isOnline]);

  useEffect(() => { loadAvailable(); }, [loadAvailable]);

  // Phase 4 realtime: server-generated rider offers are authoritative.
  // Notifications are useful as a secondary signal, but this subscription
  // makes the offer card itself appear/disappear immediately on insert,
  // acceptance, expiry, cancellation, or reassignment.
  useEffect(() => {
    if (!riderId) return undefined;
    const channel = supabase
      .channel(`rider-dispatch-offers-${riderId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rider_offers',
        filter: `rider_id=eq.${riderId}`,
      }, () => { loadAvailable(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dispatch_assignment_events',
        filter: `rider_id=eq.${riderId}`,
      }, () => { loadAvailable(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [riderId, loadAvailable]);

  // ── Auto-decline countdown ──────────────────────────────────
  // Offers carry a server expiry. The local countdown is only presentation;
  // the database checks expires_at again inside respond_to_rider_offer, so
  // a stale client can never accept an expired offer.
  const DECLINE_SECONDS = 45;
  const [countdowns, setCountdowns] = useState({});

  useEffect(() => {
    setCountdowns(prev => {
      const next = { ...prev };
      for (const o of availableOrders) {
        if (!(o.id in next)) next[o.id] = Math.max(1, Math.ceil((new Date(o.offer_expires_at || Date.now() + DECLINE_SECONDS * 1000).getTime() - Date.now()) / 1000));
      }
      for (const id of Object.keys(next)) {
        if (!availableOrders.some(o => o.id === id)) delete next[id];
      }
      return next;
    });
  }, [availableOrders]);

  useEffect(() => {
    if (Object.keys(countdowns).length === 0) return;
    const t = setInterval(() => {
      setCountdowns(prev => {
        const next = {};
        let expired = [];
        for (const [id, secs] of Object.entries(prev)) {
          if (secs <= 1) expired.push(id);
          else next[id] = secs - 1;
        }
        if (expired.length) {
          setAvailableOrders(cur => cur.filter(o => !expired.includes(o.id)));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdowns]);

  const handleDecline = (orderId) => {
    setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
    setCountdowns(prev => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  // ── Accept order ──────────────────────────────────────────
  const handleAccept = async (orderId) => {
    if (!riderId) return;
    setAccepting(orderId);
    const offerId = availableOrders.find(o => o.id === orderId)?.offer_id;
    const { error } = await RiderAPI.acceptOrder(orderId, riderId, riderName, offerId);
    if (!error && currentLocation) {
      await RiderAPI.updateLocation(riderId, currentLocation.lat, currentLocation.lng);
    }
    await Promise.all([loadAvailable(), refetchMine()]);
    setAccepting(null);
  };

  // ── Mark delivered ────────────────────────────────────────
  const handleDeliver = async () => {
    if (!riderId || !deliveryTarget) return;
    if (!/^[0-9]{6}$/.test(deliveryOtp)) { setDeliveryError('Enter the 6-digit customer OTP.'); return; }
    if (!deliveryProof) { setDeliveryError('Take/select a delivery proof photo before completing delivery.'); return; }
    setDelivering(deliveryTarget.id);
    setDeliveryError('');
    const { error } = await RiderAPI.markDelivered(
      deliveryTarget.id, deliveryOtp, deliveryProof, currentLocation
    );
    if (error) {
      setDeliveryError(error.message);
    } else {
      setDeliveryTarget(null); setDeliveryOtp(''); setDeliveryProof(null);
      await refetchMine();
    }
    setDelivering(null);
  };

  // ── Toggle online → persist ───────────────────────────────
  const handleToggleOnline = async () => {
    if (!riderId) return;
    toggleOnline();
    await RiderAPI.toggleOnline(riderId, !isOnline);
  };

  if (!riderId) {
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
      {/* "Today's Earnings" used to also pass trend="15% above avg" +
          trendUp — StatCard's actual props are trend ('up'/'neutral')
          + trendValue (the text), not trendUp + arbitrary trend text.
          Passing the wrong shape meant trend evaluated to "not up, not
          neutral" and rendered a red down-arrow with no text at all —
          a real rendering bug on top of the number itself being a
          hardcoded claim with nothing behind it (no data source this
          rider's earnings were ever actually compared against).
          Removed rather than fixed with a real comparison — there's no
          "average rider earnings" query anywhere to compute one from. */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard
          title="Today's Earnings"
          value={`₹${rider?.today_earnings ?? 0}`}
          icon={IndianRupee}
        />
        <StatCard
          title="Deliveries Today"
          value={String(rider?.today_deliveries ?? 0)}
          subtitle={`${rider?.total_deliveries ?? 0} total`}
          icon={Package}
        />
      </div>

      {/* Quick nav — the small embedded preview map here always showed
          a single hardcoded point (26.355, 86.075, "Customer Address")
          regardless of which order was actually active, which is
          actively misleading rather than just incomplete — a map that
          never reflects reality is worse than no map. Real per-order
          navigation (with the rider's live position) already lives on
          the Deliveries page; this links there instead of duplicating
          a fake preview. */}
      {myOrders.length > 0 && (
        <div className="px-4 mb-4">
          <Link to="/rider/deliveries">
            <Card className="p-3 border-border flex items-center justify-between hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">Navigate your next delivery</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Card>
          </Link>
        </div>
      )}

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
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={!(order.customerPhone ?? order.customer_phone)}
                      onClick={() => { window.location.href = `tel:${order.customerPhone ?? order.customer_phone}`; }}
                    >
                      <Phone className="w-3 h-3" />
                    </Button>
                    {canDeliver && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-accent hover:bg-accent/90"
                        disabled={delivering === order.id}
                        onClick={() => { setDeliveryTarget(order); setDeliveryOtp(''); setDeliveryProof(null); setDeliveryError(''); }}
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

      <Dialog open={!!deliveryTarget} onOpenChange={(open) => { if (!open && !delivering) setDeliveryTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete delivery</DialogTitle>
            <DialogDescription>Verify the customer's OTP and attach proof. Delivery and rider earnings are finalized together.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium">Customer OTP</label>
              <input
                inputMode="numeric" maxLength={6} value={deliveryOtp}
                onChange={e => setDeliveryOtp(e.target.value.replace(/\D/g, '').slice(0,6))}
                placeholder="6-digit OTP"
                className="mt-1 w-full h-11 rounded-xl border border-border bg-background px-3 text-center text-lg tracking-[0.35em] font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Delivery proof photo</label>
              <input
                type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
                onChange={e => setDeliveryProof(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-xs"
              />
              {deliveryProof && <p className="text-[10px] text-muted-foreground mt-1 truncate">{deliveryProof.name}</p>}
            </div>
            {deliveryError && <p className="text-xs text-red-600">{deliveryError}</p>}
            <Button className="w-full" disabled={!!delivering} onClick={handleDeliver}>
              {delivering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {delivering ? 'Finalizing…' : 'Verify & Deliver'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                      <span>{countdowns[order.id] ?? DECLINE_SECONDS}s to auto-decline</span>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleDecline(order.id)}
                      >
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
              <p className="text-xl font-bold">₹{rider?.cod_balance ?? 0}</p>
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
