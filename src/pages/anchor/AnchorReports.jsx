import React, { useState } from 'react';
import { BarChart2, Download, TrendingUp, Users, ShoppingBag, IndianRupee } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useStore } from '@/lib/store';

const weekOrders = [
  { day: 'Mon', orders: 12 }, { day: 'Tue', orders: 18 }, { day: 'Wed', orders: 9  },
  { day: 'Thu', orders: 22 }, { day: 'Fri', orders: 16 }, { day: 'Sat', orders: 28 },
  { day: 'Sun', orders: 11 },
];

export default function AnchorReports() {
  const { state } = useStore();
  const [period, setPeriod] = useState('week');

  const totalOrders = state.orders.length;
  const delivered   = state.orders.filter(o => o.status === 'delivered').length;
  const totalGMV    = state.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="pb-6">
      <AppHeader title="Village Reports" showBack={false} />
      <div className="px-4 py-4 space-y-4">

        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="week"  className="text-xs">This Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs">This Month</TabsTrigger>
            <TabsTrigger value="year"  className="text-xs">This Year</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Total Orders" value={String(totalOrders)} icon={ShoppingBag} trend="↑14%" trendUp />
          <StatCard title="Village GMV"  value={`₹${totalGMV.toLocaleString()}`} icon={IndianRupee} trend="↑21%" trendUp />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Active Users" value="284" icon={Users} subtitle="in Madhepur" />
          <StatCard title="Delivery Rate" value={`${totalOrders > 0 ? Math.round(delivered / totalOrders * 100) : 0}%`} icon={TrendingUp} trend="On-time" trendUp />
        </div>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Orders This Week</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekOrders} barSize={18}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => [v, 'Orders']} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Village health */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Madhepur Village Health</h3>
          <div className="space-y-2">
            {[
              { metric: 'Active Vendors',     value: '8/12',  pct: 67, good: true  },
              { metric: 'Active Riders',       value: '3/4',   pct: 75, good: true  },
              { metric: 'KYC Completion',      value: '91%',   pct: 91, good: true  },
              { metric: 'Dispute Resolution',  value: '88%',   pct: 88, good: true  },
              { metric: 'COD Collection Rate', value: '96%',   pct: 96, good: true  },
            ].map(item => (
              <div key={item.metric}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground">{item.metric}</span>
                  <span className={`font-bold ${item.good ? 'text-green-600' : 'text-amber-600'}`}>{item.value}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.good ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2 text-xs">
            <Download className="w-3 h-3" /> Export PDF
          </Button>
          <Button variant="outline" className="flex-1 gap-2 text-xs">
            <Download className="w-3 h-3" /> Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
