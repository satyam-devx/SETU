import React, { useState } from 'react';
import { MapPin, Phone, CheckCircle, Clock, Package, Camera, Navigation } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore } from '@/lib/store';

const RIDER_ID = 'r1';

export default function RiderDeliveries() {
  const { state, dispatch } = useStore();
  const [tab, setTab]       = useState('active');
  const [delivering, setDelivering] = useState(null);

  const myOrders = state.orders.filter(o => o.riderId === RIDER_ID);
  const active   = myOrders.filter(o => !['delivered','cancelled'].includes(o.status));
  const done     = myOrders.filter(o => o.status === 'delivered');

  const list = tab === 'active' ? active : done;

  const handleDeliver = (orderId, total) => {
    setDelivering(orderId);
    setTimeout(() => {
      dispatch({ type: 'RIDER_DELIVER', payload: { orderId, riderId: RIDER_ID, codCollected: true, amount: total } });
      setDelivering(null);
    }, 700);
  };

  return (
    <div className="pb-20">
      <AppHeader title="My Deliveries" subtitle={`${active.length} active · ${done.length} done today`} />
      <div className="px-4 py-3 space-y-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="active" className="text-xs">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="done"   className="text-xs">Completed ({done.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {list.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === 'active' ? 'No active deliveries. Go online to receive orders.' : 'No deliveries completed yet today.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {list.map(order => (
              <Card key={order.id} className={`p-4 border ${!['delivered','cancelled'].includes(order.status) ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-mono font-bold">{order.orderNumber}</p>
                    <p className="text-sm font-semibold mt-0.5">{order.customerName || 'Customer'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold">₹{order.total}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span>Pickup: {order.vendorName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    <span>Deliver: {order.customerName}, {order.village}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                  {order.paymentMethod === 'COD' && (
                    <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">Collect ₹{order.total}</Badge>
                  )}
                </div>

                {!['delivered','cancelled'].includes(order.status) && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1 h-8 text-xs">
                      <Phone className="w-3 h-3" /> Call
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 h-8 text-xs">
                      <Navigation className="w-3 h-3" /> Navigate
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                      <Camera className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 gap-1 h-8 text-xs bg-accent hover:bg-accent/90"
                      disabled={delivering === order.id}
                      onClick={() => handleDeliver(order.id, order.total)}
                    >
                      <CheckCircle className="w-3 h-3" />
                      {delivering === order.id ? '...' : 'Delivered'}
                    </Button>
                  </div>
                )}

                {order.status === 'delivered' && (
                  <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Delivered · Earned ₹80
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
