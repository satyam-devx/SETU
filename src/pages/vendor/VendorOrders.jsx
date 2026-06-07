import React, { useState, useEffect, useRef } from 'react';
import { Search, Clock, CheckCircle, Package, Loader2, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore } from '@/lib/store';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { VendorAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const VENDOR_ID = 'vn1'; // Phase 3: replace with vendor profile from auth

// ── Loading skeleton ──────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="space-y-2 px-4 pt-2 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-28 bg-muted rounded-xl" />
      ))}
    </div>
  );
}

export default function VendorOrders() {
  const { dispatch }          = useStore();
  const { profile }           = useAuth();
  const vendorId              = profile?.vendor_id ?? VENDOR_ID;

  const [tab, setTab]         = useState('active');
  const [query, setQuery]     = useState('');
  const [acting, setActing]   = useState(null);
  const [newOrderBanner, setNewOrderBanner] = useState(null);

  // ── Realtime orders for this vendor ──
  const { orders, isLoading, refetch } = useRealtimeOrders({
    mode:     'vendor',
    vendorId,
  });

  // ── Track previous order count to detect new arrivals ──
  const prevPendingCount = useRef(0);
  const pendingOrders    = orders.filter(o => o.status === 'pending');

  useEffect(() => {
    const current = pendingOrders.length;
    if (current > prevPendingCount.current && prevPendingCount.current !== 0) {
      // New order arrived
      const newest = pendingOrders[0];
      setNewOrderBanner(newest);
      // Auto-dismiss after 8 seconds
      const t = setTimeout(() => setNewOrderBanner(null), 8000);
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      return () => clearTimeout(t);
    }
    prevPendingCount.current = current;
  }, [pendingOrders.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter displayed orders ──
  const filtered = orders.filter(o => {
    const matchQ = !query ||
      (o.orderNumber ?? o.order_number ?? '').includes(query) ||
      (o.customerName ?? o.customer_name ?? '').toLowerCase().includes(query.toLowerCase());
    const isActive = !['delivered', 'cancelled'].includes(o.status);
    if (tab === 'active')    return matchQ && isActive;
    if (tab === 'completed') return matchQ && o.status === 'delivered';
    if (tab === 'cancelled') return matchQ && o.status === 'cancelled';
    return matchQ;
  });

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt ?? b.created_at ?? 0) - new Date(a.createdAt ?? a.created_at ?? 0)
  );

  // ── Vendor actions: optimistic dispatch + API persist ──
  const act = async (actionType, orderId, extra = {}) => {
    const key = orderId + actionType;
    setActing(key);

    // 1. Optimistic store update (instant UI)
    dispatch({ type: actionType, payload: { orderId, ...extra } });

    // 2. Persist to DB
    try {
      if (actionType === 'VENDOR_CONFIRM_ORDER') {
        await VendorAPI.confirmOrder(orderId);
      } else if (actionType === 'VENDOR_REJECT_ORDER') {
        await VendorAPI.rejectOrder(orderId, extra.reason ?? 'Out of stock');
      } else if (actionType === 'VENDOR_MARK_READY') {
        await VendorAPI.markReady(orderId);
      }
    } catch (e) {
      console.error('[VendorOrders] action failed, reverting may be needed:', e);
    } finally {
      setActing(null);
    }
  };

  const activeCount    = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length;
  const pendingCount   = pendingOrders.length;

  return (
    <div className="pb-20">
      <AppHeader
        title="Orders"
        subtitle={`${activeCount} active · ${pendingCount} pending`}
        notificationCount={pendingCount}
      />

      {/* New order banner */}
      {newOrderBanner && (
        <div className="mx-4 mt-3 p-3 bg-primary text-white rounded-2xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2">
          <Bell className="w-5 h-5 shrink-0 animate-bounce" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">New Order!</p>
            <p className="text-xs opacity-90 truncate">
              {newOrderBanner.orderNumber ?? newOrderBanner.order_number} ·
              ₹{newOrderBanner.total}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 h-7 text-xs bg-white text-primary hover:bg-white/90"
            onClick={() => { setTab('active'); setNewOrderBanner(null); }}
          >
            View
          </Button>
        </div>
      )}

      <div className="px-4 py-3 space-y-3">

        {/* Search + refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              className="pl-9 h-8 text-sm"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={refetch}>
            <Loader2 className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"       className="text-xs">All</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading state */}
        {isLoading && <OrdersSkeleton />}

        {/* Empty state */}
        {!isLoading && sorted.length === 0 && (
          <Card className="p-8 border-border text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders here</p>
          </Card>
        )}

        {/* Order cards */}
        {!isLoading && sorted.map(order => {
          const orderNum   = order.orderNumber ?? order.order_number ?? '—';
          const custName   = order.customerName ?? order.customer_name ?? 'Customer';
          const village    = order.village ?? '—';
          const total      = order.total ?? 0;
          const payMethod  = order.paymentMethod ?? order.payment_method ?? 'COD';
          const items      = order.items ?? order.order_items ?? [];
          const createdAt  = order.createdAt ?? order.created_at;
          const isPending  = order.status === 'pending';

          return (
            <Card
              key={order.id}
              className={`p-4 border transition-colors ${
                isPending ? 'border-amber-300 bg-amber-50/40' : 'border-border'
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-mono font-bold">{orderNum}</p>
                  <p className="text-sm font-semibold mt-0.5">{custName}</p>
                  <p className="text-xs text-muted-foreground">
                    {village} · {createdAt
                      ? new Date(createdAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })
                      : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold">₹{total}</p>
                  <StatusBadge status={order.status} />
                </div>
              </div>

              {/* Items preview */}
              {items.length > 0 && (
                <p className="text-xs text-muted-foreground mb-3 truncate">
                  {items.map(i => `${i.name} ×${i.qty}`).join(', ')}
                </p>
              )}

              {/* Meta badges + action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[9px]">{payMethod}</Badge>

                <div className="ml-auto flex gap-1.5">
                  {isPending && (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={acting === order.id + 'VENDOR_CONFIRM_ORDER'}
                        onClick={() => act('VENDOR_CONFIRM_ORDER', order.id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {acting === order.id + 'VENDOR_CONFIRM_ORDER' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : 'Accept'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-destructive border-destructive/30"
                        disabled={acting === order.id + 'VENDOR_REJECT_ORDER'}
                        onClick={() => act('VENDOR_REJECT_ORDER', order.id, { reason: 'Out of stock' })}
                      >
                        {acting === order.id + 'VENDOR_REJECT_ORDER' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : 'Reject'}
                      </Button>
                    </>
                  )}

                  {(order.status === 'confirmed' || order.status === 'preparing') && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={acting === order.id + 'VENDOR_MARK_READY'}
                      onClick={() => act('VENDOR_MARK_READY', order.id)}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {acting === order.id + 'VENDOR_MARK_READY' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : 'Mark Ready'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
