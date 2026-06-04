import React from 'react';
import { MapPin, Users, Store, TrendingUp, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { VILLAGES, VENDORS } from '@/lib/mockData';

export default function AdminVillages() {
  const { state } = useStore();

  const villageStats = VILLAGES.map(v => {
    const vOrders  = state.orders.filter(o => o.village === v.name).length;
    const vVendors = VENDORS.filter(vn => vn.village === v.name).length;
    const health   = v.isActive ? Math.min(100, 40 + vVendors * 8 + vOrders * 2) : 0;
    return { ...v, orders: vOrders, vendors: vVendors, health };
  });

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Villages" subtitle={`${VILLAGES.filter(v => v.isActive).length} active`} />
      <div className="p-4 space-y-3">

        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{VILLAGES.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-600">{VILLAGES.filter(v => v.isActive).length}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-muted-foreground">{VILLAGES.filter(v => !v.isActive).length}</p>
            <p className="text-[10px] text-muted-foreground">Inactive</p>
          </Card>
        </div>

        {villageStats.map(v => (
          <Card key={v.id} className={`p-4 border ${v.isActive ? 'border-border' : 'border-border opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{v.name}</p>
                  <Badge className={`text-[9px] border-0 ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{v.block} Block · {v.district}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{v.health}%</p>
                <p className="text-[10px] text-muted-foreground">health</p>
              </div>
            </div>

            <Progress value={v.health} className="h-1.5 mb-3" />

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-muted/40 rounded-lg p-1.5">
                <p className="font-bold">{(v.population / 1000).toFixed(0)}k</p>
                <p className="text-muted-foreground">People</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-1.5">
                <p className="font-bold">{v.vendors}</p>
                <p className="text-muted-foreground">Vendors</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-1.5">
                <p className="font-bold">{v.orders}</p>
                <p className="text-muted-foreground">Orders</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
