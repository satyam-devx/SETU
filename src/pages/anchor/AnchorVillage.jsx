import React, { useState, useEffect } from 'react';
import {
  Users, Store, Bike, TrendingUp, MapPin,
  ChevronRight, ArrowUpRight, Plus, Search, Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import VillageMap from '@/components/maps/VillageMap';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function AnchorVillage() {
  const { profile } = useAuth();
  const villageName = profile?.village || 'Madhepur';

  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [riders, setRiders] = useState([]);
  const [stats, setStats] = useState({ population: 0, activeFamilies: 0, ordersToday: 0 });

  useEffect(() => {
    fetchVillageData();
  }, [villageName]);

  const fetchVillageData = async () => {
    setLoading(true);
    try {
      const [{ data: vData }, { data: rData }, { data: villageInfo }] = await Promise.all([
        supabase.from('vendors').select('*').eq('village', villageName),
        supabase.from('riders').select('*, rider_locations(*)').eq('village', villageName),
        supabase.from('villages').select('*').eq('name', villageName).single()
      ]);

      if (vData) setVendors(vData);
      if (rData) setRiders(rData.map(r => ({ ...r, ...r.rider_locations?.[0] })));
      if (villageInfo) setStats(s => ({ ...s, population: villageInfo.population }));

      // Mock orders today for MVP
      setStats(s => ({ ...s, activeFamilies: 245, ordersToday: 42 }));

    } catch (e) {
      console.error('[AnchorVillage] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      <AppHeader title={villageName} subtitle="Village Overview" />

      <div className="px-4 py-4 space-y-4">

        {/* Real-time Village Map */}
        <div className="space-y-2">
           <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Village Map
              </h3>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-[10px]">Live</Badge>
           </div>
           <VillageMap villageName={villageName} vendors={vendors} riders={riders} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
           <StatCard title="Active Families" value={stats.activeFamilies.toString()} icon={Users} trend="+4 this week" trendUp />
           <StatCard title="Orders Today" value={stats.ordersToday.toString()} icon={TrendingUp} trend="High demand" trendUp />
        </div>

        <Tabs defaultValue="vendors">
          <TabsList className="w-full grid grid-cols-3 h-10 rounded-xl mb-4">
            <TabsTrigger value="vendors" className="text-xs font-bold">Vendors</TabsTrigger>
            <TabsTrigger value="riders" className="text-xs font-bold">Riders</TabsTrigger>
            <TabsTrigger value="notices" className="text-xs font-bold">Notices</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="mt-0 space-y-2">
             <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{vendors.length} Registered Shops</p>
                <Button variant="ghost" className="h-6 text-[10px] gap-1 font-bold text-primary">
                  <Plus className="w-3 h-3" /> Add Vendor
                </Button>
             </div>
             {loading ? (
               <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
             ) : vendors.map(v => (
               <Card key={v.id} className="p-3 border-border flex items-center gap-3 hover:bg-muted/30 cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                    {v.category === 'Grocery' ? '🛒' : '🍰'}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-sm font-bold truncate">{v.name}</p>
                     <p className="text-[10px] text-muted-foreground font-medium uppercase">{v.category} · {v.is_open ? 'Open' : 'Closed'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
               </Card>
             ))}
          </TabsContent>

          <TabsContent value="riders" className="mt-0 space-y-2">
             {riders.map(r => (
               <Card key={r.id} className="p-3 border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
                    <Bike className="w-5 h-5 text-chart-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{r.name}</p>
                        {r.is_online && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                     </div>
                     <p className="text-[10px] text-muted-foreground font-medium">{r.total_deliveries} lifetime deliveries</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold">Track</Button>
               </Card>
             ))}
          </TabsContent>
        </Tabs>

        {/* Announcements */}
        <Card className="p-4 border-primary/20 bg-primary/5">
           <h3 className="font-bold text-sm mb-1">Village Noticeboard</h3>
           <p className="text-xs text-muted-foreground mb-3 leading-relaxed">Broadcast updates to all residents of {villageName}.</p>
           <Button className="w-full h-9 rounded-lg text-xs font-bold gap-2">
              Create Broadcast <ArrowRight className="w-3.5 h-3.5" />
           </Button>
        </Card>
      </div>
    </div>
  );
}
