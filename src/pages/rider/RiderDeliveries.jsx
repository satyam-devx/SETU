import React, { useState } from 'react';
import { MapPin, Package, Camera, CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { ORDERS } from '@/lib/mockData';

const riderOrders = ORDERS.filter(o => o.riderId === 'r1');

export default function RiderDeliveries() {
  const [tab, setTab] = useState('active');
  const active = riderOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const history = riderOrders.filter(o => ['delivered', 'cancelled'].includes(o.status));
  const orders = tab === 'active' ? active : history;

  return (
    <div className="pb-20">
      <AppHeader title="Deliveries" />
      <div className="px-4 py-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="active" className="flex-1">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History ({history.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 space-y-2">
        {orders.map(order => (
          <Card key={order.id} className={`p-4 border-border ${tab === 'active' ? 'bg-primary/5 border-primary/20' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono">{order.orderNumber}</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="font-medium">{order.vendorName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>{order.customerName}, {order.village}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
              <span className="font-bold text-foreground">₹{order.total}</span>
            </div>
            {tab === 'active' && (
              <div className="flex gap-2">
                {order.status === 'on_the_way' && (
                  <>
                    <Button size="sm" className="flex-1 h-8 text-xs"><Camera className="w-3 h-3 mr-1" /> Photo Proof</Button>
                    <Button size="sm" className="flex-1 h-8 text-xs bg-accent hover:bg-accent/90"><CheckCircle className="w-3 h-3 mr-1" /> Delivered</Button>
                  </>
                )}
                {order.status === 'picked_up' && (
                  <Button size="sm" className="w-full h-8 text-xs">Start Delivery</Button>
                )}
              </div>
            )}
            {tab === 'history' && order.status === 'delivered' && (
              <div className="flex items-center gap-1 text-xs text-accent">
                <CheckCircle className="w-3 h-3" />
                <span>Delivered at {new Date(order.deliveredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}