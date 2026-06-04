import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { useStore } from '@/lib/store';

const CUSTOMER_ID = 'u1';

export default function CustomerOrders() {
  const { state } = useStore();
  const [tab, setTab]     = useState('all');
  const [query, setQuery] = useState('');

  const myOrders = state.orders.filter(o => o.customerId === CUSTOMER_ID || !o.customerId);

  const filtered = myOrders.filter(o => {
    const matchQ = !query || o.orderNumber.toLowerCase().includes(query.toLowerCase()) || (o.vendorName || '').toLowerCase().includes(query.toLowerCase());
    if (tab === 'active')    return matchQ && !['delivered', 'cancelled'].includes(o.status);
    if (tab === 'completed') return matchQ && o.status === 'delivered';
    if (tab === 'cancelled') return matchQ && o.status === 'cancelled';
    return matchQ;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="pb-20">
      <AppHeader title="My Orders" />
      <div className="px-4 py-3 space-y-3">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search orders..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"       className="text-xs">All</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {sorted.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No orders yet" description="Start shopping to see your orders here"
            action={<Link to="/customer"><Button className="mt-3">Browse Products</Button></Link>}
          />
        ) : (
          <div className="space-y-2">
            {sorted.map(order => {
              const isActive = !['delivered', 'cancelled'].includes(order.status);
              return (
                <Link key={order.id} to={`/customer/orders/${order.id}`}>
                  <Card className={`p-4 border transition-colors ${isActive ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                        <p className="text-sm font-semibold mt-0.5">{order.vendorName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold">₹{order.total}</p>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        {(order.items || []).map(i => i.name).join(', ').slice(0, 40)}{order.items?.length > 1 ? '...' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                        {isActive && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
