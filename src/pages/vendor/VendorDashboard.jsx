import React from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Package, TrendingUp, Users, ShoppingBag, Star, BarChart3, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { ORDERS, ANALYTICS_DATA } from '@/lib/mockData';

const vendorOrders = ORDERS.filter(o => o.vendorId === 'vn1');

export default function VendorDashboard() {
  return (
    <div className="pb-20">
      <AppHeader title="Ramesh Kirana Store" subtitle="Madhepur · Pro Vendor" notificationCount={4} rightAction={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Open</span>
          <Switch defaultChecked />
        </div>
      } />

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Today's Revenue" value="₹4,850" trend="12% vs yesterday" trendUp icon={IndianRupee} />
        <StatCard title="Today's Orders" value="18" trend="3 more than avg" trendUp icon={ShoppingBag} />
        <StatCard title="Avg Rating" value="4.5" subtitle="128 reviews" icon={Star} />
        <StatCard title="Active Products" value="24" subtitle="3 out of stock" icon={Package} />
      </div>

      {/* Revenue chart */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Weekly Revenue</h3>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ANALYTICS_DATA.daily}>
                <defs>
                  <linearGradient id="vendorRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(24, 80%, 50%)" fill="url(#vendorRevGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent orders */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Recent Orders</h3>
          <Link to="/vendor/orders" className="text-xs text-primary font-medium">View All</Link>
        </div>
        <div className="space-y-2">
          {vendorOrders.slice(0, 3).map(order => (
            <Card key={order.id} className="p-3 border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-muted-foreground">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm font-medium">{order.customerName}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{order.items.map(i => i.name).join(', ')}</span>
                <span className="text-sm font-bold">₹{order.total}</span>
              </div>
              {order.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="flex-1 h-7 text-xs">Accept</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-destructive">Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="px-4">
        <Card className="p-4 border-border bg-accent/5">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> AI Insights
          </h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>📈 <strong>Demand forecast:</strong> Rice orders expected to increase 20% next week due to festival season.</p>
            <p>⚠️ <strong>Stock alert:</strong> Mustard Oil running low. Consider restocking by Thursday.</p>
            <p>💡 <strong>Pricing tip:</strong> Your atta price is 8% below market avg. Consider adjusting.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}