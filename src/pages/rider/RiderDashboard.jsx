import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, IndianRupee, Package, Clock, AlertTriangle, CheckCircle, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore, useRiderState } from '@/lib/store';
import { RIDERS } from '@/lib/mockData';

const RIDER_ID = 'r1';
const rider = RIDERS[0];

export default function RiderDashboard() {
  const { state, dispatch } = useStore();
  const { isOnline, toggleOnline } = useRiderState();
  const [accepting, setAccepting] = useState(null);
  const [delivering, setDelivering] = useState(null);

  const orders = state.orders;
  const myOrders = orders.filter(o => o.riderId === RIDER_ID && !['delivered', 'cancelled'].includes(o.status));
  const available = orders.filter(o => !o.riderId && o.status === 'pending');

  const handleAccept = (orderId) => {
    setAccepting(orderId);
    setTimeout(() => {
      dispatch({ type: 'RIDER_ACCEPT_ORDER', payload: { orderId, riderId: RIDER_ID } });
      setAccepting(null);
    }, 600);
  };

  const handleDeliver = (orderId, total) => {
    setDelivering(orderId);
    setTimeout(() => {
      dispatch({
        type: 'RIDER_DELIVER',
        payload: { orderId, riderId: RIDER_ID, codCollected: true, amount: total, photoUrl: 'delivery_proof.jpg' },
      });
      setDelivering(null);
    }, 800);
  };

  return (
    <div className="pb-20">
      <AppHeader
        title={rider.name}
        subtitle={`Zone: ${rider.zone}`}
        notificationCount={2}
        rightAction={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
            <Switch checked={isOnline} onCheckedChange={toggleOnline} />
          </div>
        }
      />

      {/* Online status banner */}
      {!isOnline && (
        <div className="mx-4 mt-3 p-3 bg-muted rounded-xl text-center">
          <p className="text-sm font-medium text-muted-foreground">You are offline — toggle to go online and receive orders</p>
        </div>
      )}

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

      {/* My Active Deliveries */}
      {myOrders.length > 0 && (
        <div className="px-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">My Active Deliveries ({myOrders.length})</h3>
          {myOrders.map(order => (
            <Card key={order.id} className="p-3 border-primary/30 bg-primary/5 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center gap-2 text-xs mb-2 text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{order.vendorName} → {order.customerName}, {order.village}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                  <span className="text-sm font-bold">₹{order.total}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                    <Phone className="w-3 h-3" />
                  </Button>
                  {['picked_up', 'on_the_way', 'ready'].includes(order.status) && (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-accent hover:bg-accent/90"
                      onClick={() => handleDeliver(order.id, order.total)}
                      disabled={delivering === order.id}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {delivering === order.id ? '...' : 'Delivered'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Available Orders */}
      {isOnline && (
        <div className="px-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Available Orders ({available.length})</h3>
          {available.length === 0 ? (
            <Card className="p-4 border-border text-center">
              <p className="text-sm text-muted-foreground">No new orders right now. Stay online!</p>
            </Card>
          ) : (
            available.map(order => (
              <Card key={order.id} className="p-3 border-border mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono">{order.orderNumber}</span>
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                </div>
                <p className="text-sm font-medium">{order.vendorName} → {order.village}</p>
                <p className="text-xs text-muted-foreground">₹{order.total} · {order.items?.length ?? '?'} items</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> 45s to auto-decline
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleAccept(order.id)}
                      disabled={accepting === order.id}
                    >
                      {accepting === order.id ? 'Accepting...' : 'Accept'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Decline</Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* COD Balance */}
      <div className="px-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">COD Cash Balance</p>
              <p className="text-xl font-bold">₹{rider.codBalance}</p>
              <p className="text-xs text-muted-foreground">Deposit before end of day</p>
            </div>
            <Link to="/rider/cod">
              <Button variant="outline" size="sm" className="text-xs">Manage COD</Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* SOS */}
      <div className="px-4 mt-3 mb-2">
        <Link to="/rider/safety">
          <Button variant="outline" className="w-full border-destructive/30 text-destructive gap-2">
            <AlertTriangle className="w-4 h-4" /> Safety Center / SOS
          </Button>
        </Link>
      </div>
    </div>
  );
}
