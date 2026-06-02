import React from 'react';
import { ShoppingBag, Store, Bike, Users, IndianRupee, Clock, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { ADMIN_STATS, ANALYTICS_DATA, ORDERS } from '@/lib/mockData';

const liveOrders = ORDERS.filter(o => !['delivered', 'cancelled'].includes(o.status));

export default function AdminDashboard() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Madhepur Block · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {ADMIN_STATS.criticalAlerts > 0 && (
          <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {ADMIN_STATS.criticalAlerts} Critical Alerts
          </Badge>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Today's Orders" value={ADMIN_STATS.todayOrders} trend="12% vs yesterday" trendUp icon={ShoppingBag} />
        <StatCard title="Today's Revenue" value={`₹${(ADMIN_STATS.todayRevenue/1000).toFixed(1)}K`} trend="8% growth" trendUp icon={IndianRupee} />
        <StatCard title="Active Riders" value={`${ADMIN_STATS.activeRiders}/${ADMIN_STATS.totalRiders}`} subtitle="12 online now" icon={Bike} />
        <StatCard title="Delivery Rate" value={`${ADMIN_STATS.deliverySuccessRate}%`} trend="0.5% improvement" trendUp icon={CheckCircle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Revenue chart */}
        <Card className="col-span-2 p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Weekly Revenue Trend</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ANALYTICS_DATA.daily}>
                <defs>
                  <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(24, 80%, 50%)" fill="url(#adminRevGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category breakdown */}
        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Category Split</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ANALYTICS_DATA.categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={40} paddingAngle={2}>
                  {ANALYTICS_DATA.categoryBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {ANALYTICS_DATA.categoryBreakdown.slice(0, 4).map(cat => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.fill }} />
                  <span>{cat.name}</span>
                </div>
                <span className="font-medium">{cat.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Live orders */}
        <Card className="p-5 border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Live Orders ({liveOrders.length})</h3>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {liveOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                  <p className="text-sm font-medium">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.vendorName}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={order.status} />
                  <p className="text-xs font-bold mt-1">₹{order.total}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick stats */}
        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Operations Overview</h3>
          <div className="space-y-3">
            {[
              { label: 'Avg Delivery Time', value: `${ADMIN_STATS.avgDeliveryTime} min`, color: 'text-accent' },
              { label: 'COD Collected Today', value: `₹${ADMIN_STATS.codCollected.toLocaleString()}`, color: 'text-primary' },
              { label: 'COD Pending', value: `₹${ADMIN_STATS.codPending.toLocaleString()}`, color: 'text-amber-600' },
              { label: 'Vendor Approvals Pending', value: ADMIN_STATS.pendingVendorApprovals, color: 'text-blue-600' },
              { label: 'Open Support Tickets', value: ADMIN_STATS.openTickets, color: 'text-destructive' },
              { label: 'New Customers Today', value: ADMIN_STATS.newCustomersToday, color: 'text-accent' },
              { label: 'Active Vendors', value: `${ADMIN_STATS.activeVendors}/${ADMIN_STATS.totalVendors}`, color: 'text-foreground' },
              { label: 'SETU Score (Block)', value: ADMIN_STATS.setuScore, color: 'text-primary' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top vendors */}
      <Card className="p-5 border-border">
        <h3 className="font-semibold text-sm mb-4">Top Vendors This Week</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ANALYTICS_DATA.vendorPerformance} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="hsl(24, 80%, 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}