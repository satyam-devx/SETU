import React, { useState } from 'react';
import { Search, Phone, MapPin, IndianRupee, Package, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useStore } from '@/lib/store';
import { RIDERS } from '@/lib/mockData';

export default function AdminRiders() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [riders, setRiders] = useState(RIDERS);

  const filtered = riders.filter(r =>
    !query || r.name.toLowerCase().includes(query.toLowerCase()) || r.phone.includes(query)
  );

  const online  = riders.filter(r => r.isOnline).length;
  const onDelivery = state.orders.filter(o => o.riderId && !['delivered','cancelled'].includes(o.status)).map(o => o.riderId);

  const toggleOnline = (id) => setRiders(rs => rs.map(r => r.id === id ? { ...r, isOnline: !r.isOnline } : r));

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Riders" subtitle={`${online} online · ${riders.length} total`} />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2">
          <StatCard title="Online"    value={String(online)}                          icon={MapPin} />
          <StatCard title="On Trip"   value={String(onDelivery.length)}               icon={Package} />
          <StatCard title="Available" value={String(online - onDelivery.length)}      icon={Star} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search riders..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="space-y-2">
          {filtered.map(rider => {
            const isOnTrip = onDelivery.includes(rider.id);
            return (
              <Card key={rider.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {rider.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${rider.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{rider.name}</p>
                      <p className="text-xs text-muted-foreground">{rider.zone} · {rider.vehicleNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium">{rider.rating}</span>
                    </div>
                    {isOnTrip && <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0 mt-0.5">On Trip</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-muted/40 rounded-lg p-1.5">
                    <p className="text-xs font-bold">{rider.todayDeliveries}</p>
                    <p className="text-[9px] text-muted-foreground">Today</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-1.5">
                    <p className="text-xs font-bold">₹{rider.todayEarnings}</p>
                    <p className="text-[9px] text-muted-foreground">Earned</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-1.5">
                    <p className="text-xs font-bold">₹{rider.codBalance}</p>
                    <p className="text-[9px] text-muted-foreground">COD</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Online</span>
                    <Switch checked={rider.isOnline} onCheckedChange={() => toggleOnline(rider.id)} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <Phone className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
