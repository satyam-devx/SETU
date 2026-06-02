import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { ORDERS } from '@/lib/mockData';

const vendorOrders = ORDERS.filter(o => o.vendorId === 'vn1');

export default function VendorOrders() {
  const [tab, setTab] = useState('new');
  const filterMap = {
    new: ['pending', 'confirmed'],
    preparing: ['preparing', 'ready'],
    completed: ['picked_up', 'on_the_way', 'delivered'],
    cancelled: ['cancelled'],
  };
  const filtered = vendorOrders.filter(o => filterMap[tab]?.includes(o.status));

  return (
    <div className="pb-20">
      <AppHeader title="Orders" subtitle="Ramesh Kirana Store" />
      <div className="px-4 py-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-muted grid grid-cols-4">
            <TabsTrigger value="new" className="text-xs">New</TabsTrigger>
            <TabsTrigger value="preparing" className="text-xs">Preparing</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No orders in this category</div>
        ) : (
          filtered.map(order => (
            <Card key={order.id} className="p-4 border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-mono text-muted-foreground">{order.orderNumber}</span>
                  <StatusBadge status={order.status} className="ml-2" />
                </div>
                <span className="text-lg font-bold">₹{order.total}</span>
              </div>
              <p className="text-sm font-medium mb-1">{order.customerName} · {order.village}</p>
              <div className="space-y-1 mb-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.name} × {item.qty}</span>
                    <span>₹{item.price}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <Clock className="w-3 h-3" />
                <span>{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="mx-1">·</span>
                <span>{order.paymentMethod}</span>
              </div>
              {order.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs"><CheckCircle className="w-3 h-3 mr-1" /> Accept</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-destructive"><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                </div>
              )}
              {order.status === 'confirmed' && (
                <Button size="sm" className="w-full h-8 text-xs">Mark as Preparing</Button>
              )}
              {order.status === 'preparing' && (
                <Button size="sm" className="w-full h-8 text-xs bg-accent hover:bg-accent/90">Mark as Ready</Button>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}