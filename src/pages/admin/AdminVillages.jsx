import React, { useState } from 'react';
import { MapPin, Users, TrendingUp, Search, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const villages = [
  { name: 'Rampur', block: 'Block A', households: 240, activeUsers: 180, orders: 312, revenue: 48000, anchor: 'Meera Devi', health: 92 },
  { name: 'Bhojpur', block: 'Block A', households: 185, activeUsers: 120, orders: 198, revenue: 31200, anchor: 'Ravi Kumar', health: 78 },
  { name: 'Madhopur', block: 'Block B', households: 310, activeUsers: 85, orders: 104, revenue: 15600, anchor: 'None', health: 45 },
  { name: 'Sitapur', block: 'Block B', households: 150, activeUsers: 98, orders: 176, revenue: 28800, anchor: 'Asha Singh', health: 85 },
];

export default function AdminVillages() {
  const [search, setSearch] = useState('');
  const filtered = villages.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.block.toLowerCase().includes(search.toLowerCase()));

  const healthColor = (h) => h >= 80 ? 'text-green-600' : h >= 60 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="pb-6">
      <AppHeader title="Villages" subtitle="Village health & activity" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Total Villages" value="4" icon={MapPin} />
          <StatCard title="Active Users" value="483" trend="14% growth" trendUp icon={Users} />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search villages..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="space-y-3">
          {filtered.map(v => (
            <Card key={v.name} className="p-4 border-border">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.block} · {v.households} households</p>
                </div>
                <span className={`text-sm font-bold ${healthColor(v.health)}`}>{v.health}%</span>
              </div>
              <Progress value={v.health} className="h-1.5 mb-3" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs font-bold">{v.activeUsers}</p>
                  <p className="text-[10px] text-muted-foreground">Active Users</p>
                </div>
                <div>
                  <p className="text-xs font-bold">{v.orders}</p>
                  <p className="text-[10px] text-muted-foreground">Orders</p>
                </div>
                <div>
                  <p className="text-xs font-bold">₹{(v.revenue/1000).toFixed(0)}k</p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Anchor: <span className="text-foreground font-medium">{v.anchor}</span></p>
                {v.anchor === 'None' && (
                  <Badge className="text-[10px] bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> No Anchor
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
