import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Navigation, IndianRupee, Package,
  Clock, AlertTriangle, CheckCircle, Phone, Loader2, Download
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore, useRiderState } from '@/lib/store';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { RiderAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import RiderNavigationMap from '@/components/maps/RiderNavigationMap';

export default function RiderDashboard() {
  const { state, dispatch }           = useStore();
  const { profile }                   = useAuth();
  const { isOnline, toggleOnline }    = useRiderState();
  const [accepting, setAccepting]     = useState(null);
  const [delivering, setDelivering]   = useState(null);
  const [downloading, setDownloading] = useState(false);

  const riderUuid = profile?.rider_id;
  const riderName = profile?.name ?? 'Rider';

  // ── GPS Tracking ──
  useRiderLocation(riderUuid, isOnline);

  // ── Realtime: orders assigned to this rider ──
  const { orders: myOrders, isLoading: loadingMine } = useRealtimeOrders({
    mode:       'rider',
    riderId:    riderUuid,
    activeOnly: true,
  });

  const availableOrders = state.orders.filter(o =>
    !o.riderId && !o.rider_id && o.status === 'pending'
  );

  const handleAccept = async (orderId) => {
    setAccepting(orderId);
    dispatch({ type: 'RIDER_ACCEPT_ORDER', payload: { orderId, riderId: 'r1' } });
    await RiderAPI.acceptOrder(orderId, riderUuid, riderName);
    setAccepting(null);
  };

  const handleDeliver = async (orderId, total) => {
    setDelivering(orderId);
    dispatch({
      type: 'RIDER_DELIVER',
      payload: { orderId, riderId: 'r1', codCollected: true, amount: total },
    });
    await RiderAPI.markDelivered(orderId, {
      rider_id:      riderUuid,
      cod_collected: true,
      amount:        total,
    });
    setDelivering(null);
  };

  const handleToggleOnline = async () => {
    toggleOnline();
    await RiderAPI.toggleOnline(riderUuid, !isOnline);
  };

  const activeOrder = myOrders.find(o => ['picked_up', 'on_the_way'].includes(o.status));

  return (
    <div className="pb-20">
      <AppHeader
        title={riderName}
        subtitle={`Zone: Madhepur`}
        notificationCount={availableOrders.length}
        rightAction={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <Switch checked={isOnline} onCheckedChange={handleToggleOnline} />
          </div>
        }
      />

      {!isOnline && (
        <div className="mx-4 mt-3 p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-muted text-center animate-in fade-in zoom-in-95">
          <p className="text-sm font-bold text-muted-foreground">
            You're currently offline
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Toggle switch above to start receiving orders</p>
        </div>
      )}

      {/* Map Section */}
      <div className="px-4 mt-4">
        <div className="relative group">
          <div className="h-48 rounded-2xl overflow-hidden shadow-md">
            {activeOrder ? (
              <RiderNavigationMap
                riderUuid={riderUuid}
                destination={activeOrder.customer_location}
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center border border-border">
                 <div className="text-center opacity-40 group-hover:opacity-60 transition-opacity">
                    <Navigation className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Active Task</p>
                 </div>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 h-7 text-[10px] bg-background/80 backdrop-blur font-bold gap-1.5 shadow-sm border border-border"
            onClick={() => { setDownloading(true); setTimeout(() => setDownloading(false), 2000); }}
          >
            {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {downloading ? 'Downloading...' : 'Offline Map'}
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <StatCard
          title="Today's Earnings"
          value={`₹1,240`}
          trend="+12%"
          trendUp
          icon={IndianRupee}
        />
        <StatCard
          title="Deliveries"
          value="14"
          subtitle="4 in last hour"
          icon={Package}
        />
      </div>

      {/* Active deliveries */}
      <div className="px-4 mb-4">
        <h3 className="font-bold text-sm mb-3 px-1">Active Deliveries ({myOrders.length})</h3>
        {myOrders.length === 0 ? (
          <Card className="p-6 border-dashed border-2 border-muted flex flex-col items-center justify-center text-center">
            <Package className="w-6 h-6 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground font-medium">No active tasks assigned to you</p>
          </Card>
        ) : (
          myOrders.map(order => (
            <Card key={order.id} className="p-4 border-primary/20 bg-primary/5 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-black tracking-wider uppercase text-primary">
                  {order.orderNumber || order.order_number}
                </span>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate leading-none mb-1">
                    {order.customerName || order.customer_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {order.delivery_address || 'Madhepur Ward 3, House 12'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-primary/10">
                <div className="flex items-center gap-2">
                   <Badge variant="secondary" className="bg-white text-primary border-primary/20 text-[9px]">₹{order.total}</Badge>
                   <Badge variant="outline" className="text-[9px] border-primary/30 uppercase font-black">{order.paymentMethod || 'COD'}</Badge>
                </div>
                <div className="flex gap-2">
                   <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-primary/30 bg-white">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                   </Button>
                   <Button
                    size="sm"
                    className="h-8 text-xs font-bold px-4 rounded-lg shadow-sm"
                    disabled={delivering === order.id}
                    onClick={() => handleDeliver(order.id, order.total)}
                   >
                     {delivering === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Mark Delivered'}
                   </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Available orders */}
      {isOnline && (
        <div className="px-4 mb-4">
          <h3 className="font-bold text-sm mb-3 px-1">Available Nearby ({availableOrders.length})</h3>
          {availableOrders.slice(0, 3).map(order => (
            <Card key={order.id} className="p-4 border-border mb-2 hover:border-primary/40 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{order.orderNumber || order.order_number}</span>
                <Badge variant="outline" className="text-[9px] font-black uppercase">₹{order.total}</Badge>
              </div>
              <p className="text-sm font-bold group-hover:text-primary transition-colors">
                {order.vendorName || order.vendor_name} → {order.village}
              </p>
              <div className="flex items-center justify-between mt-3">
                 <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                   <Clock className="w-3 h-3" /> Pickup within 10 mins
                 </p>
                 <Button
                  size="sm"
                  className="h-8 text-xs font-bold px-6 rounded-lg"
                  disabled={accepting === order.id}
                  onClick={() => handleAccept(order.id)}
                 >
                   {accepting === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Accept'}
                 </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="px-4 grid grid-cols-2 gap-2 mt-4">
        <Link to="/rider/cod" className="w-full">
           <Button variant="outline" className="w-full h-12 rounded-xl text-xs gap-2 border-border shadow-sm">
             <IndianRupee className="w-4 h-4 text-green-600" /> COD Balance
           </Button>
        </Link>
        <Link to="/rider/safety" className="w-full">
           <Button variant="outline" className="w-full h-12 rounded-xl text-xs gap-2 border-destructive/30 text-destructive shadow-sm">
             <AlertTriangle className="w-4 h-4" /> SOS / Support
           </Button>
        </Link>
      </div>
    </div>
  );
}
