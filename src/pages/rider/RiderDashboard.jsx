import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, IndianRupee, Package, Clock, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { RIDERS, ORDERS } from '@/lib/mockData';

const rider = RIDERS[0];
const riderOrders = ORDERS.filter(o => o.riderId === 'r1' && !['delivered', 'cancelled'].includes(o.status));
const availableOrders = ORDERS.filter(o => !o.riderId && o.status === 'pending');

export default function RiderDashboard() {
  return (
    <div className="pb-20">
      <AppHeader title={rider.name} subtitle={`Zone: ${rider.zone}`} notificationCount={2} rightAction={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{rider.isOnline ? 'Online' : 'Offline'}</span>
          <Switch defaultChecked={rider.isOnline} />
        </div>
      } />

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Today's Earnings" value={`₹${rider.todayEarnings}`} trend="15% above avg" trendUp icon={IndianRupee} />
        <StatCard title="Deliveries Today" value={rider.todayDeliveries.toString()} subtitle={`${rider.totalDeliveries} total`} icon={Package} />
      </div>

      {/* Map placeholder */}
      <div className="px-4 mb-4">
        <Card className="h-36 bg-muted border-border flex items-center justify-center relative overflow-hidden">
          <div className="text-center z-10">
            <Navigation className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Madhepur Zone Map</p>
            <p className="text-xs text-muted-foreground">Offline navigation ready</p>
          </div>
        </Card>
      </div>

      {/* Active deliveries */}
      {riderOrders.length > 0 && (
        <div className="px-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Active Deliveries</h3>
          {riderOrders.map(order => (
            <Card key={order.id} className="p-3 border-primary/30 bg-primary/5 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center gap-2 text-xs mb-2">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span>{order.vendorName} → {order.customerName}, {order.village}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                  <span className="text-sm font-bold">₹{order.total}</span>
                </div>
                <div className="flex gap-1">
                  {order.status === 'picked_up' && (
                    <Button size="sm" className="h-7 text-xs bg-accent hover:bg-accent/90">
                      <CheckCircle className="w-3 h-3 mr-1" /> Deliver
                    </Button>
                  )}
                  {order.status === 'on_the_way' && (
                    <Button size="sm" className="h-7 text-xs bg-accent hover:bg-accent/90">
                      <CheckCircle className="w-3 h-3 mr-1" /> Delivered
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Available orders */}
      <div className="px-4 mb-4">
        <h3 className="font-semibold text-sm mb-2">Available Orders ({availableOrders.length})</h3>
        {availableOrders.map(order => (
          <Card key={order.id} className="p-3 border-border mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono">{order.orderNumber}</span>
              <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
            </div>
            <p className="text-sm">{order.vendorName} → {order.village}</p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" /> Auto-accept in 45s
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs">Accept</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">Decline</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* COD Balance */}
      <div className="px-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">COD Cash Balance</p>
              <p className="text-xl font-bold">₹{rider.codBalance}</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs">Deposit</Button>
          </div>
        </Card>
      </div>

      {/* SOS */}
      <div className="px-4 mt-3">
        <Button variant="outline" className="w-full border-destructive/30 text-destructive">
          <AlertTriangle className="w-4 h-4 mr-2" /> SOS Emergency
        </Button>
      </div>
    </div>
  );
}