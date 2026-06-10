import React, { useState, useEffect } from 'react';
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
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
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

  // ── Live active orders ───────────────────────────────────
  const { orders: liveOrders, isLoading: ordersLoading } = useRealtimeOrders('rider', riderId);

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
                <div className="h-64 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
                  <RiderNavigationMap
                    riderUuid={riderId}
                    destination={navigating.customer_location ?? { lat: 26.35, lng: 86.07 }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-tight opacity-70">Queue</p>
                    <p className="text-sm font-black">{activeDeliveries.length} Orders Pending</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-green-600">
                    ₹{(activeDeliveries.length * 40).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">Est. Fee</p>
                </div>
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
                      <Badge className="bg-primary/10 text-primary text-[10px] font-black uppercase px-2 h-5">
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
