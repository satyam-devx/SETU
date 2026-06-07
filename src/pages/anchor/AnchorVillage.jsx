import React, { useState } from 'react';
import { MapPin, Users, Store, Bike, Star, Phone, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import VillageMap from '@/components/maps/VillageMap';
import { VILLAGES, VENDORS, RIDERS, SEVA_PROVIDERS } from '@/lib/mockData';

export default function AnchorVillage() {
  const [tab, setTab] = useState('vendors');
  const village = VILLAGES[0];

  return (
    <div className="pb-6">
      <AppHeader title={`${village.name} Village`} subtitle={`${village.block} Block · Pop. ${(village.population/1000).toFixed(0)}k`} showBack={false} />
      <div className="px-4 py-3 space-y-3">
        {/* Village Map */}
        <div className="w-full h-48 rounded-2xl overflow-hidden border border-border shadow-sm">
          <VillageMap
            villageName={village.name}
            vendors={VENDORS.map(v => ({ ...v, lat: 26.350 + (Math.random() - 0.5) * 0.01, lng: 86.070 + (Math.random() - 0.5) * 0.01 }))}
          />
        </div>

        {/* Village header */}
        <Card className="p-4 border-border">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-primary">{VENDORS.length}</p>
              <p className="text-[10px] text-muted-foreground">Vendors</p>
            </div>
            <div>
              <p className="text-xl font-bold">{RIDERS.length}</p>
              <p className="text-[10px] text-muted-foreground">Riders</p>
            </div>
            <div>
              <p className="text-xl font-bold">{SEVA_PROVIDERS.length}</p>
              <p className="text-[10px] text-muted-foreground">Seva Providers</p>
            </div>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="vendors" className="text-xs">Vendors</TabsTrigger>
            <TabsTrigger value="riders"  className="text-xs">Riders</TabsTrigger>
            <TabsTrigger value="seva"    className="text-xs">Seva</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Vendors */}
        {tab === 'vendors' && (
          <div className="space-y-2">
            {VENDORS.map(v => (
              <Card key={v.id} className="p-3 border-border flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0">
                  <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{v.name}</p>
                    {v.isVerified
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{v.category}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{v.rating}</span>
                    <Badge className={`text-[9px] border-0 ${v.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {v.isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                  <Phone className="w-3.5 h-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* Riders */}
        {tab === 'riders' && (
          <div className="space-y-2">
            {RIDERS.map(r => (
              <Card key={r.id} className="p-3 border-border flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {r.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${r.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.zone} · {r.vehicleType}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{r.rating}</span>
                    <span className="text-xs text-muted-foreground">{r.totalDeliveries} trips</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge className={`text-[9px] border-0 ${r.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.isOnline ? 'Online' : 'Offline'}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-8 w-8 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Seva Providers */}
        {tab === 'seva' && (
          <div className="space-y-2">
            {SEVA_PROVIDERS.map(sp => (
              <Card key={sp.id} className="p-3 border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0">
                  <img src={sp.image} alt={sp.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{sp.name}</p>
                  <p className="text-xs text-muted-foreground">{sp.category} · ₹{sp.hourlyRate}/hr</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{sp.rating}</span>
                    <Badge className={`text-[9px] border-0 ${sp.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {sp.isAvailable ? 'Available' : 'Busy'}
                    </Badge>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                  <Phone className="w-3.5 h-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
