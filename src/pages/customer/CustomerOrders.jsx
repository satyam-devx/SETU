import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, ChevronRight, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import AppHeader from '@/components/shared/AppHeader';
import { ORDERS } from '@/lib/mockData';

export default function CustomerOrders() {
  const [tab, setTab] = useState('active');
  const activeOrders = ORDERS.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const pastOrders = ORDERS.filter(o => ['delivered', 'cancelled'].includes(o.status));
  const orders = tab === 'active' ? activeOrders : pastOrders;

  return (
    <div className="pb-20">
      <AppHeader title="My Orders" notificationCount={3} />
      <div className="px-4 py-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="active" className="flex-1">Active ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="past" className="flex-1">Past ({pastOrders.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 space-y-3">
        {orders.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" description="Start shopping to see your orders here" action={<Button asChild><Link to="/customer">Browse Products</Link></Button>} />
        ) : (
          orders.map(order => (
            <Link key={order.id} to={`/customer/order/${order.id}`}>
              <Card className="p-4 border-border hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{order.orderNumber}</p>
                    <h4 className="text-sm font-semibold mt-0.5">{order.vendorName}</h4>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {order.items.map(i => `${i.name} × ${i.qty}`).join(', ')}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-bold text-foreground">₹{order.total}</span>
                  <div className="flex items-center gap-2">
                    {order.status === 'delivered' && (
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <RotateCcw className="w-3 h-3 mr-1" /> Reorder
                      </Button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}