// ═══════════════════════════════════════════════════════════
// SETU — AdminOrders  (v3 — production-grade)
// Full order management:
//   - Realtime list with search, tabs, sort
//   - Order detail panel: items, timeline, rider, addresses
//   - Assign rider dropdown
//   - Admin status override (force-advance or cancel)
//   - Cancel order with reason
// Route: /admin/orders
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, UserCheck, RefreshCw, Loader2, X,
  ShoppingBag, Bike, MapPin, Phone, Package,
  ChevronRight, XCircle, CheckCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered'];

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Order detail modal ────────────────────────────────────
function OrderDetailModal({ orderId, riders, onClose, onRefetch }) {
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    AdminAPI.getOrderDetail(orderId).then(res => {
      if (active && res.data) setOrder(res.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [orderId]);

  if (loading) return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!order) return null;

  const curIdx  = STATUS_FLOW.indexOf(order.status);
  const nextSt  = STATUS_FLOW[curIdx + 1];
  const canAdv  = nextSt && order.status !== 'delivered' && order.status !== 'cancelled';
  const canCxl  = !['delivered', 'cancelled'].includes(order.status);

  const handleAssign = async (riderId) => {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return;
    setActing('assign');
    await AdminAPI.assignRider(order.id, rider.id, rider.name);
    setActing(null);
    const res = await AdminAPI.getOrderDetail(order.id);
    if (res.data) setOrder(res.data);
    onRefetch();
  };

  const handleAdvance = async () => {
    if (!nextSt) return;
    setActing('advance');
    await AdminAPI.updateOrderStatus(order.id, nextSt, 'Advanced by admin');
    const res = await AdminAPI.getOrderDetail(order.id);
    if (res.data) setOrder(res.data);
    setActing(null);
    onRefetch();
  };

  const handleCancel = async () => {
    setActing('cancel');
    await AdminAPI.cancelOrder(order.id, cancelReason || 'Cancelled by admin');
    setActing(null);
    setCancelModal(false);
    const res = await AdminAPI.getOrderDetail(order.id);
    if (res.data) setOrder(res.data);
    onRefetch();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status + meta */}
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} />
            <span className="text-xs text-muted-foreground">{fmtTime(order.created_at)}</span>
          </div>

          {/* Key info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Customer',   value: order.customer_name ?? '—' },
              { label: 'Vendor',     value: order.vendor_name   ?? '—' },
              { label: 'Village',    value: order.village       ?? '—' },
              { label: 'Payment',    value: order.payment_method ?? '—' },
              { label: 'Total',      value: `₹${order.total}` },
              { label: 'Rider',      value: order.rider_name ?? 'Unassigned' },
            ].map(f => (
              <div key={f.label} className="p-2.5 bg-muted/40 rounded-lg">
                <p className="text-muted-foreground">{f.label}</p>
                <p className="font-medium">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Order items */}
          {(order.order_items ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2">Items</p>
              <div className="space-y-1.5">
                {order.order_items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs p-2 bg-muted/40 rounded-lg">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">×{item.qty}</span>
                      <span className="font-semibold">₹{item.price * item.qty}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs p-2 font-semibold">
                  <span>Total</span>
                  <span>₹{order.total}</span>
                </div>
              </div>
            </div>
          )}

          {/* Rider assignment */}
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <div>
              <Label className="text-xs mb-1.5 block">Assign / Re-assign Rider</Label>
              <Select
                value={order.rider_id ?? ''}
                onValueChange={handleAssign}
                disabled={acting === 'assign'}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select rider…" />
                </SelectTrigger>
                <SelectContent>
                  {riders.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} · {r.village ?? '—'} {r.is_online ? '🟢' : '⚫'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Admin actions */}
          <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
            {canAdv && (
              <Button
                size="sm"
                className="gap-1 h-8 text-xs flex-1"
                disabled={!!acting}
                onClick={handleAdvance}
              >
                {acting === 'advance'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <CheckCircle className="w-3 h-3" />}
                Advance to "{nextSt?.replace(/_/g, ' ')}"
              </Button>
            )}
            {canCxl && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs text-destructive border-destructive/30"
                disabled={!!acting}
                onClick={() => setCancelModal(true)}
              >
                <XCircle className="w-3 h-3" /> Cancel
              </Button>
            )}
          </div>

          {/* Cancel confirmation */}
          {cancelModal && (
            <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-xl space-y-3">
              <p className="text-xs font-medium text-destructive">Cancel Order</p>
              <Textarea
                placeholder="Reason (optional)"
                className="h-16 text-sm"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setCancelModal(false)}>Back</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={acting === 'cancel'}
                  onClick={handleCancel}
                >
                  {acting === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Confirm Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────
export default function AdminOrders() {
  const [orders,    setOrders]    = useState([]);
  const [riders,    setRiders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab,       setTab]       = useState('all');
  const [query,     setQuery]     = useState('');
  const [selectedId,setSelectedId]= useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [ordersRes, ridersRes] = await Promise.all([
      AdminAPI.getOrders({ limit: 200 }),
      AdminAPI.getRiders(),
    ]);
    if (ordersRes.error) setLoadError('Failed to load orders.');
    else setOrders(ordersRes.data ?? []);
    setRiders((ridersRes.data ?? []).filter(r => r.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-rt-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filtered = orders.filter(o => {
    const active = !['delivered', 'cancelled'].includes(o.status);
    const matchQ = !query
      || (o.order_number  ?? '').toLowerCase().includes(query.toLowerCase())
      || (o.customer_name ?? '').toLowerCase().includes(query.toLowerCase())
      || (o.vendor_name   ?? '').toLowerCase().includes(query.toLowerCase());
    if (tab === 'active')    return matchQ && active;
    if (tab === 'pending')   return matchQ && o.status === 'pending';
    if (tab === 'delivered') return matchQ && o.status === 'delivered';
    if (tab === 'cancelled') return matchQ && o.status === 'cancelled';
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
        subtitle={unassignedCount > 0 ? `${unassignedCount} unassigned` : `${orders.length} total`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-3 max-w-3xl">

        {/* Unassigned alert */}
        {!loading && unassignedCount > 0 && (
          <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-2">
            <Bike className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1 font-medium">
              {unassignedCount} order{unassignedCount > 1 ? 's' : ''} need rider assignment
            </p>
          </Card>
        )}

        {/* Error */}
        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadData}>Retry</Button>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search order, customer or vendor…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all"       className="text-xs">All</TabsTrigger>
            <TabsTrigger value="pending"   className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">Done</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading */}
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        )}

        {/* Empty */}
        {!loading && sorted.length === 0 && (
          <Card className="p-6 border-border text-center">
            <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders in this filter</p>
          </Card>
        )}

        {/* Order list */}
        <div className="space-y-2">
          {sorted.map(o => {
            const needsRider = !o.rider_id && !['delivered', 'cancelled'].includes(o.status);
            return (
              <Card
                key={o.id}
                className={`p-3 border-border cursor-pointer hover:bg-muted/30 transition-colors ${needsRider ? 'border-amber-300' : ''}`}
                onClick={() => setSelectedId(o.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{o.order_number}</p>
                    <p className="text-sm font-medium truncate">
                      {o.customer_name ?? 'Customer'} · {o.vendor_name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {o.village ?? '—'} · {relTime(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-bold">₹{o.total}</p>
                    <StatusBadge status={o.status} />
                    {needsRider && (
                      <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700">No Rider</Badge>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Showing {sorted.length} of {orders.length} orders
        </p>
      </div>

      {selectedId && (
        <OrderDetailModal
          orderId={selectedId}
          riders={riders}
          onClose={() => setSelectedId(null)}
          onRefetch={loadData}
        />
      )}
    </div>
  );
}
