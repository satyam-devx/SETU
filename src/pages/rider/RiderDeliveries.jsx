import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin, Navigation, Phone, CheckCircle, ArrowRight,
  Loader2, Package,
} from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { useNavigate } from 'react-router-dom';
import RiderNavigationMap from '@/components/maps/RiderNavigationMap';
import { useAuth } from '@/lib/AuthContext';
import { RiderAPI } from '@/lib/api';
import { useStore, useRiderState } from '@/lib/store';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { supabase } from '@/lib/supabase';

const ACTIVE_STATUSES = ['accepted', 'picked_up', 'on_the_way', 'ready'];

export default function RiderDeliveries() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Resolve riders.id from user.id ──────────────────────
  const [riderId,  setRiderId]  = useState(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    RiderAPI.getProfile(user.id).then(({ data }) => {
      if (data?.id) setRiderId(data.id);
      setResolving(false);
    });
  }, [user?.id]);

  // Live GPS position for the map's rider marker — this page's map
  // usage was passing a `riderUuid` prop that RiderNavigationMap has
  // never actually accepted (only currentLocation/destination/onArrived
  // are used), so the rider's own position never appeared or tracked
  // on this specific map. isOnline reads from the same shared store
  // Dashboard's online toggle writes to, so no duplicate toggle needed
  // here.
  const { isOnline } = useRiderState();
  const { location: currentLocation } = useRiderLocation(user?.id, isOnline);

  // ── Active orders ──────────────────────────────────────────
  // RiderLayout already holds the one live realtime channel for this
  // portal and keeps state.orders current for every rider page. This
  // page used to open a SECOND subscription on the exact same topic
  // via useRealtimeOrders — the same duplicate-subscription bug found
  // and fixed on RiderDashboard (which is also this page's twin: both
  // raced the layout to subscribe/unsubscribe the same channel name
  // while riderId was still resolving). A plain REST fetch (which also
  // now includes the customer's phone for the "call customer" button
  // below — see getOrdersByRider) seeds/refreshes the store instead;
  // live updates still arrive through the layout's single channel.
  const { state, dispatch } = useStore();
  const { data: fetchedOrders, isLoading: ordersLoading } = useDataFetch(
    () => RiderAPI.getOrders(riderId, { limit: 50 }),
    [riderId],
    { cacheKey: `rider-orders-${riderId}`, enabled: !!riderId }
  );
  useEffect(() => {
    if (fetchedOrders?.length) dispatch({ type: 'SET_ORDERS', payload: { orders: fetchedOrders } });
  }, [fetchedOrders, dispatch]);
  const liveOrders = useMemo(
    () => riderId ? state.orders.filter(o => (o.riderId ?? o.rider_id) === riderId) : [],
    [state.orders, riderId]
  );

  const activeDeliveries = liveOrders.filter(o =>
    ACTIVE_STATUSES.includes(o.status)
  );

  // ── Completed orders (paginated, DB fetch) ───────────────
  const [tab,       setTab]       = useState('active');
  const [completed, setCompleted] = useState([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [page,      setPage]      = useState(0);
  const [hasMore,   setHasMore]   = useState(true);
  const PAGE_SIZE = 15;

  useEffect(() => {
    if (tab !== 'completed' || !riderId) return;
    setLoadingCompleted(true);

    supabase
      .from('orders')
      .select('id, order_number, status, total, customer_name, vendor_name, delivery_address, created_at, is_cod')
      .eq('rider_id', riderId)
      .eq('status', 'delivered')
      .range(0, PAGE_SIZE - 1)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCompleted(data ?? []);
        setPage(0);
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
        setLoadingCompleted(false);
      });
  }, [tab, riderId]);

  const loadMoreCompleted = async () => {
    if (!riderId) return;
    const nextPage = page + 1;
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, total, customer_name, vendor_name, delivery_address, created_at, is_cod')
      .eq('rider_id', riderId)
      .eq('status', 'delivered')
      .range(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE - 1)
      .order('created_at', { ascending: false });

    setCompleted(prev => [...prev, ...(data ?? [])]);
    setPage(nextPage);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
  };

  // ── Navigation state ─────────────────────────────────────
  const [navigating, setNavigating] = useState(null);

  if (resolving || ordersLoading) {
    return (
      <div className="pb-20">
        <AppHeader title="My Deliveries" />
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <AppHeader
        title="My Deliveries"
        subtitle={`${activeDeliveries.length} active`}
      />

      <div className="px-4 py-4 space-y-4">

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="active"    className="flex-1 text-xs">Active ({activeDeliveries.length})</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 text-xs">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'active' && (
          <>
            {/* Navigation map */}
            {navigating ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-sm">Navigation</h3>
                  <button
                    onClick={() => setNavigating(null)}
                    className="text-[10px] font-bold text-primary uppercase"
                  >
                    Close Map
                  </button>
                </div>
                {/* customer_location has never existed on an order — there's
                    nowhere it could come from: customer_addresses only ever
                    stores text (label/address/landmark), never
                    coordinates, so this always silently fell back to the
                    same fixed point regardless of where the delivery
                    actually is. Kept as a fallback so the map still centers
                    on something sensible, but now says so honestly instead
                    of quietly pretending the pin is the real address —
                    rely on the address text on the order card below. */}
                {!navigating.customer_location && (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                    Exact delivery pin isn't available — map is centered on the area only. Use the address on the order card.
                  </div>
                )}
                <div className="h-64 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
                  <RiderNavigationMap
                    currentLocation={currentLocation}
                    destination={navigating.customer_location ?? { lat: 26.35, lng: 86.07, address: navigating.delivery_address }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Navigation className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-tight opacity-70">Queue</p>
                  <p className="text-sm font-black">{activeDeliveries.length} Orders Pending</p>
                </div>
                {/* Removed a "Est. Fee" figure that was activeDeliveries.length
                    * ₹40 — a flat per-order guess with no connection to how
                    * rider payouts actually work (Onboarding's own Earnings
                    * Structure shows distance-tiered ₹30/₹50/₹70, which isn't
                    * data available per order here). One made-up number
                    * standing in for another isn't a real fix — the real
                    * figure belongs on the Earnings page, which computes it
                    * from actual wallet_transactions. */}
              </div>
            )}

            {/* Active order cards */}
            <div className="space-y-3">
              {activeDeliveries.map((order, idx) => (
                <Card
                  key={order.id}
                  className={`p-4 border-l-4 transition-all ${idx === 0 ? 'border-l-primary shadow-md' : 'border-l-muted'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="chip-primary text-[10px] font-black uppercase px-2 h-5 border-0">
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">
                        {order.order_number}
                      </span>
                    </div>
                    <p className="text-sm font-black">₹{order.total}</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Pickup</p>
                        <p className="text-sm font-bold truncate">{order.vendor_name ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-primary uppercase leading-none mb-1">Deliver to</p>
                        <p className="text-sm font-black truncate">{order.customer_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground font-medium truncate">
                          {order.delivery_address ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 h-10 rounded-xl text-xs font-bold gap-2 shadow-sm"
                      onClick={() => setNavigating(order)}
                    >
                      <Navigation className="w-3.5 h-3.5" /> Start Navigation
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 w-12 rounded-xl border-border"
                      onClick={() => { window.location.href = `tel:${order.customer_phone ?? ''}`; }}
                    >
                      <Phone className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </Card>
              ))}

              {activeDeliveries.length === 0 && (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-bold text-base mb-1">All caught up!</h3>
                  <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                    No active deliveries. Check the dashboard for new available orders.
                  </p>
                  <button
                    onClick={() => navigate('/rider')}
                    className="mt-6 text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 mx-auto"
                  >
                    Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'completed' && (
          <div className="space-y-2">
            {loadingCompleted ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : completed.length === 0 ? (
              <Card className="p-6 text-center border-border">
                <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No completed deliveries yet</p>
              </Card>
            ) : (
              <>
                {completed.map(order => (
                  <Card key={order.id} className="p-3 border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {order.customer_name} · {order.vendor_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">₹{order.total}</p>
                        {order.is_cod && (
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 mt-0.5">COD</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {hasMore && (
                  <Button variant="outline" className="w-full text-xs" onClick={loadMoreCompleted}>
                    Load more
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
