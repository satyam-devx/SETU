import React, { useState } from 'react';
import { Search, UserCheck, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore } from '@/lib/store';
import { RIDERS } from '@/lib/mockData';

export default function AdminOrders() {
  const { state, dispatch } = useStore();
  const [tab, setTab]         = useState('all');
  const [query, setQuery]     = useState('');
  const [assigning, setAssigning] = useState(null);

  const filtered = state.orders.filter(o => {
    const matchQ  = !query || o.orderNumber.includes(query) || (o.customerName || '').toLowerCase().includes(query.toLowerCase()) || (o.vendorName || '').toLowerCase().includes(query.toLowerCase());
    const active  = !['delivered', 'cancelled'].includes(o.status);
    if (tab === 'active')    return matchQ && active;
    if (tab === 'pending')   return matchQ && o.status === 'pending';
    if (tab === 'delivered') return matchQ && o.status === 'delivered';
    return matchQ;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleAssignRider = (orderId, riderId) => {
    setAssigning(orderId);
    setTimeout(() => {
      dispatch({ type: 'RIDER_ACCEPT_ORDER', payload: { orderId, riderId } });
      setAssigning(null);
    }, 600);
  };

  const availableRiders = RIDERS.filter(r => r.isOnline);

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Orders" />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="icon"><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"       className="text-xs">All ({state.orders.length})</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="pending"   className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">Done</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {sorted.map(order => (
            <Card key={order.id} className={`p-4 border ${order.status === 'pending' && !order.riderId ? 'border-amber-300 bg-amber-50/30' : 'border-border'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-mono font-bold">{order.orderNumber}</p>
                  <p className="text-sm font-semibold">{order.customerName || 'Customer'} · {order.village}</p>
                  <p className="text-xs text-muted-foreground">{order.vendorName}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold">₹{order.total}</p>
                  <StatusBadge status={order.status} />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                  {order.riderName
                    ? <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">{order.riderName}</Badge>
                    : <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">No rider</Badge>
                  }
                </div>

                {/* Assign rider if none */}
                {!order.riderId && !['delivered', 'cancelled'].includes(order.status) && availableRiders.length > 0 && (
                  <div className="flex gap-1">
                    {availableRiders.slice(0, 2).map(r => (
                      <Button key={r.id} size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={assigning === order.id}
                        onClick={() => handleAssignRider(order.id, r.id)}>
                        <UserCheck className="w-3 h-3" />
                        {assigning === order.id ? '...' : r.name.split(' ')[0]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
          {sorted.length === 0 && (
            <Card className="p-6 text-center border-border">
              <p className="text-sm text-muted-foreground">No orders match filters</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
