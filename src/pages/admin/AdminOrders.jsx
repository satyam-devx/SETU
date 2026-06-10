import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserCheck, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminOrders() {
  const [orders,    setOrders]    = useState([]);
  const [riders,    setRiders]    = useState([]);   // online riders for assignment
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab,       setTab]       = useState('all');
  const [query,     setQuery]     = useState('');
  const [assigning, setAssigning] = useState(null); // orderId being assigned

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [ordersRes, ridersRes] = await Promise.all([
      AdminAPI.getOrders({ limit: 100 }),
      AdminAPI.getRiders(),
    ]);
    if (ordersRes.error) setLoadError('Failed to load orders.');
    else setOrders(ordersRes.data ?? []);
    // Keep only online + active riders for assignment dropdown
    setRiders((ridersRes.data ?? []).filter(r => r.is_online && r.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: incoming orders
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleAssignRider = async (orderId, rider) => {
    setAssigning(orderId);
    const { error } = await AdminAPI.assignRider(orderId, rider.id, rider.name);
    if (!error) {
      setOrders(os => os.map(o =>
        o.id === orderId
          ? { ...o, rider_id: rider.id, rider_name: rider.name, status: 'confirmed' }
          : o
      ));
    }
    setAssigning(null);
  };

  // ── Derived ────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const active = !['delivered', 'cancelled'].includes(o.status);
    const matchQ = !query
      || (o.order_number  ?? '').includes(query)
      || (o.customer_name ?? '').toLowerCase().includes(query.toLowerCase())
      || (o.vendor_name   ?? '').toLowerCase().includes(query.toLowerCase());
    if (tab === 'active')    return matchQ && active;
    if (tab === 'pending')   return matchQ && o.status === 'pending';
    if (tab === 'delivered') return matchQ && o.status === 'delivered';
    return matchQ;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const unassignedCount = orders.filter(o =>
    !o.rider_id && !['delivered', 'cancelled'].includes(o.status)
  ).length;

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Orders"
        subtitle={unassignedCount > 0 ? `${unassignedCount} unassigned` : undefined}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              className="pl-9"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadData}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        {/* Rider availability note */}
        {riders.length === 0 && !loading && (
          <Card className="p-2 border-amber-200 bg-amber-50/40">
            <p className="text-xs text-amber-700 text-center">No riders online — rider assignment unavailable</p>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"       className="text-xs">All ({orders.length})</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="pending"   className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">Done</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          <Card className="p-6 text-center border-border">
            <p className="text-sm text-muted-foreground">No orders match filters</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {sorted.map(order => {
              const needsRider = !order.rider_id && !['delivered', 'cancelled'].includes(order.status);
              const isAssigning = assigning === order.id;

              return (
                <Card
                  key={order.id}
                  className={`p-4 border ${needsRider ? 'border-amber-300 bg-amber-50/30' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-mono font-bold">{order.order_number}</p>
                      <p className="text-sm font-semibold">
                        {order.customer_name ?? 'Customer'}
                        {order.village ? ` · ${order.village}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.vendor_name ?? '—'} · {relTime(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-base font-bold">₹{Number(order.total).toLocaleString()}</p>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">
                        {order.payment_method ?? 'COD'}
                      </Badge>
                      {order.rider_name
                        ? <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">{order.rider_name}</Badge>
                        : <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">No rider</Badge>
                      }
                    </div>

                    {/* Assign rider buttons — show up to 3 online riders */}
                    {needsRider && riders.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {riders.slice(0, 3).map(r => (
                          <Button
                            key={r.id}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={isAssigning}
                            onClick={() => handleAssignRider(order.id, r)}
                          >
                            {isAssigning
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><UserCheck className="w-3 h-3" />{r.name.split(' ')[0]}</>
                            }
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
