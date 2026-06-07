import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Phone, CheckCircle, Package, ArrowRight, Loader2 } from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import RiderNavigationMap from '@/components/maps/RiderNavigationMap';
import { useAuth } from '@/lib/AuthContext';

export default function RiderDeliveries() {
  const { state } = useStore();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const riderUuid = profile?.rider_id;

  const activeDeliveries = state.orders.filter(o =>
    (o.riderId === riderUuid || o.rider_id === riderUuid) &&
    ['picked_up', 'on_the_way', 'ready'].includes(o.status)
  );

  const completedToday = state.orders.filter(o =>
    (o.riderId === riderUuid || o.rider_id === riderUuid) &&
    o.status === 'delivered'
  ).length;

  const [navigating, setNavigating] = useState(null);

  return (
    <div className="pb-20">
      <AppHeader title="My Deliveries" subtitle={`${activeDeliveries.length} active · ${completedToday} done`} />

      <div className="px-4 py-4 space-y-4">

        {/* Active Navigation Card (If any) */}
        {navigating ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-sm">Navigation</h3>
              <button onClick={() => setNavigating(null)} className="text-[10px] font-bold text-primary uppercase">Close Map</button>
            </div>
            <div className="h-64 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
               <RiderNavigationMap
                riderUuid={riderUuid}
                destination={navigating.customer_location || { lat: 26.35, lng: 86.07 }}
               />
            </div>
          </div>
        ) : (
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                   <Navigation className="w-5 h-5 text-primary" />
                </div>
                <div>
                   <p className="text-xs font-bold uppercase tracking-tight opacity-70">Queue</p>
                   <p className="text-sm font-black">{activeDeliveries.length} Orders Pending</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-xs font-bold text-green-600">₹{(activeDeliveries.length * 40).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Est. Fee</p>
             </div>
          </div>
        )}

        {/* Deliveries List */}
        <div className="space-y-3">
          {activeDeliveries.map((order, idx) => (
            <Card key={order.id} className={`p-4 border-l-4 transition-all ${idx === 0 ? 'border-l-primary shadow-md' : 'border-l-muted'}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary text-[10px] font-black uppercase px-2 h-5">
                    {order.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">{order.orderNumber || order.order_number}</span>
                </div>
                <p className="text-sm font-black">₹{order.total}</p>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3">
                   <div className="mt-1 w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                   <div className="min-w-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Pickup</p>
                      <p className="text-sm font-bold truncate">{order.vendorName || order.vendor_name}</p>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <MapPin className="w-4 h-4 text-primary shrink-0" />
                   <div className="min-w-0">
                      <p className="text-[10px] font-bold text-primary uppercase leading-none mb-1">Deliver to</p>
                      <p className="text-sm font-black truncate">{order.customerName || order.customer_name}</p>
                      <p className="text-xs text-muted-foreground font-medium truncate">{order.delivery_address || 'Madhepur Ward 3'}</p>
                   </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 h-10 rounded-xl text-xs font-bold gap-2 shadow-sm"
                  onClick={() => setNavigating(order)}
                >
                  <Navigation className="w-3.5 h-3.5" /> Start Navigation
                </Button>
                <Button
                  variant="outline"
                  className="h-10 w-12 rounded-xl border-border"
                  onClick={() => window.location.href = `tel:${order.phone || '9876543210'}`}
                >
                  <Phone className="w-4 h-4 text-primary" />
                </Button>
              </div>
            </Card>
          ))}

          {activeDeliveries.length === 0 && (
            <div className="text-center py-12 px-6">
               <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-muted-foreground/40" />
               </div>
               <h3 className="font-bold text-base mb-1">All caught up!</h3>
               <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">No active deliveries. Check the dashboard for new available orders.</p>
               <button
                onClick={() => navigate('/rider')}
                className="mt-6 text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 mx-auto"
               >
                 Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
               </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
