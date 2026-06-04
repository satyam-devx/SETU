import React, { useState } from 'react';
import { Clock, CheckCircle, Package, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore } from '@/lib/store';

const VENDOR_ID = 'vn1';

export default function VendorOrders() {
  const { state, dispatch } = useStore();
  const [tab, setTab]       = useState('active');
  const [query, setQuery]   = useState('');
  const [acting, setActing] = useState(null);

  const vendorOrders = state.orders.filter(o => o.vendorId === VENDOR_ID);

  const filtered = vendorOrders.filter(o => {
    const matchQuery = !query || o.orderNumber.includes(query) || (o.customerName || '').toLowerCase().includes(query.toLowerCase());
    const isActive   = !['delivered', 'cancelled'].includes(o.status);
    if (tab === 'active')    return matchQuery && isActive;
    if (tab === 'completed') return matchQuery && o.status === 'delivered';
    if (tab === 'cancelled') return matchQuery && o.status === 'cancelled';
    return matchQuery;
  });

  const act = (type, orderId, extra) => {
    setActing(orderId + type);
    setTimeout(() => {
      dispatch({ type, payload: { orderId, ...extra } });
      setActing(null);
    }, 500);
  };

  return (
    <div className="pb-20">
      <AppHeader title="Orders" notificationCount={vendorOrders.filter(o => o.status === 'pending').length} />
      <div className="px-4 py-3 space-y-3">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search orders..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"       className="text-xs">All</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders here</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(order => (
              <Card key={order.id} className={`p-4 border ${order.status === 'pending' ? 'border-amber-300 bg-amber-50/40' : 'border-border'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-mono font-bold">{order.orderNumber}</p>
                    <p className="text-sm font-semibold mt-0.5">{order.customerName || 'Customer'}</p>
                    <p className="text-xs text-muted-foreground">{order.village} · {new Date(order.createdAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold">₹{order.total}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mb-3">
                  {(order.items || []).map(i => `${i.name} ×${i.qty}`).join(', ')}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                  <div className="ml-auto flex gap-1.5">
                    {order.status === 'pending' && (
                      <>
                        <Button size="sm" className="h-7 text-xs"
                          disabled={acting === order.id + 'VENDOR_CONFIRM_ORDER'}
                          onClick={() => act('VENDOR_CONFIRM_ORDER', order.id)}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {acting === order.id + 'VENDOR_CONFIRM_ORDER' ? '...' : 'Accept'}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30"
                          disabled={acting === order.id + 'VENDOR_REJECT_ORDER'}
                          onClick={() => act('VENDOR_REJECT_ORDER', order.id, { reason: 'Out of stock' })}>
                          {acting === order.id + 'VENDOR_REJECT_ORDER' ? '...' : 'Reject'}
                        </Button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <Button size="sm" className="h-7 text-xs"
                        disabled={acting === order.id + 'VENDOR_MARK_READY'}
                        onClick={() => act('VENDOR_MARK_READY', order.id)}>
                        <Clock className="w-3 h-3 mr-1" />
                        {acting === order.id + 'VENDOR_MARK_READY' ? '...' : 'Mark Ready'}
                      </Button>
                    )}
                    {order.status === 'preparing' && (
                      <Button size="sm" className="h-7 text-xs"
                        disabled={acting === order.id + 'VENDOR_MARK_READY'}
                        onClick={() => act('VENDOR_MARK_READY', order.id)}>
                        <Package className="w-3 h-3 mr-1" /> Ready
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
