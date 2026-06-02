import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Star, Package, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const hourlyData = [
  { hour: '8am', orders: 4 }, { hour: '9am', orders: 7 }, { hour: '10am', orders: 9 },
  { hour: '11am', orders: 12 }, { hour: '12pm', orders: 18 }, { hour: '1pm', orders: 15 },
  { hour: '2pm', orders: 11 }, { hour: '3pm', orders: 8 }, { hour: '4pm', orders: 14 },
  { hour: '5pm', orders: 16 }, { hour: '6pm', orders: 20 }, { hour: '7pm', orders: 13 },
];

const topProducts = [
  { name: 'Basmati Rice (5kg)', orders: 48, revenue: 21600, trend: 'up' },
  { name: 'Mustard Oil (1L)', orders: 62, revenue: 11160, trend: 'up' },
  { name: 'Atta Flour (10kg)', orders: 35, revenue: 13300, trend: 'down' },
  { name: 'Sugar (2kg)', orders: 29, revenue: 2610, trend: 'up' },
];

const categoryData = [
  { name: 'Grocery', value: 65, fill: 'hsl(24, 80%, 50%)' },
  { name: 'Oils', value: 20, fill: 'hsl(45, 80%, 55%)' },
  { name: 'Flour', value: 15, fill: 'hsl(220, 60%, 50%)' },
];

const repeatData = [
  { week: 'W1', new: 18, repeat: 24 }, { week: 'W2', new: 22, repeat: 33 },
  { week: 'W3', new: 15, repeat: 33 }, { week: 'W4', new: 19, repeat: 42 },
];

export default function VendorAnalytics() {
  const [tab, setTab] = useState('sales');

  return (
    <div className="pb-20">
      <AppHeader title="Analytics" subtitle="Ramesh Kirana Store" showBack />

      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Conversion Rate" value="78%" trend="4% improvement" trendUp icon={TrendingUp} />
        <StatCard title="Avg Order Value" value="₹335" trend="₹28 higher" trendUp icon={Package} />
      </div>

      <div className="px-4 mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-muted grid grid-cols-3">
            <TabsTrigger value="sales" className="text-xs">Sales</TabsTrigger>
            <TabsTrigger value="products" className="text-xs">Products</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs">Customers</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'sales' && (
        <div className="px-4 space-y-4">
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-1">Peak Hours Today</h3>
            <p className="text-xs text-muted-foreground mb-3">Highest demand: 12–1pm & 6–7pm</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(24, 80%, 50%)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3">Revenue by Category</h3>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={25} outerRadius={50} dataKey="value">
                      {categoryData.map((c, i) => <Cell key={i} fill={c.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1">
                {categoryData.map(c => (
                  <div key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: c.fill }} />
                      <span className="text-xs">{c.name}</span>
                    </div>
                    <span className="text-xs font-bold">{c.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'products' && (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-1">Top performing products this month</p>
          {topProducts.map((p, i) => (
            <Card key={p.name} className="p-3 border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">#{i+1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.orders} orders · ₹{p.revenue.toLocaleString()}</p>
                  </div>
                </div>
                {p.trend === 'up'
                  ? <TrendingUp className="w-4 h-4 text-green-500" />
                  : <TrendingDown className="w-4 h-4 text-destructive" />}
              </div>
            </Card>
          ))}
          <Card className="p-4 border-border bg-amber-50/50 border-amber-200">
            <h4 className="text-sm font-semibold text-amber-800 mb-1">⚠️ Low Stock Alert</h4>
            <p className="text-xs text-amber-700">Thekua (12 pcs) — only 15 left in stock. Restocking recommended.</p>
          </Card>
        </div>
      )}

      {tab === 'customers' && (
        <div className="px-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard title="Total Customers" value="312" subtitle="This month" icon={Users} />
            <StatCard title="Repeat Rate" value="64%" trend="8% increase" trendUp icon={Star} />
          </div>
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3">New vs Repeat Customers</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repeatData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="new" fill="hsl(220, 60%, 60%)" radius={[3,3,0,0]} name="New" />
                  <Bar dataKey="repeat" fill="hsl(24, 80%, 50%)" radius={[3,3,0,0]} name="Repeat" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-2">Rating Breakdown</h3>
            <div className="flex items-center gap-3 mb-1">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-2xl font-bold">4.5</span>
              <span className="text-xs text-muted-foreground">128 reviews</span>
            </div>
            {[5,4,3,2,1].map(star => (
              <div key={star} className="flex items-center gap-2 mb-1">
                <span className="text-xs w-4">{star}★</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{width: `${[68, 22, 6, 2, 2][5-star]}%`}} />
                </div>
                <span className="text-xs text-muted-foreground w-6">{[68, 22, 6, 2, 2][5-star]}%</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
