import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Store, Bike, IndianRupee, Users, AlertTriangle, Activity, TrendingUp, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore } from '@/lib/store';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from 'recharts';
import { ADMIN_STATS, ANALYTICS_DATA } from '@/lib/mockData';

const HOUR_DATA = [
  { hr: '6AM', orders: 2 }, { hr: '8AM', orders: 8 }, { hr: '10AM', orders: 14 },
  { hr: '12PM', orders: 22 }, { hr: '2PM', orders: 18 }, { hr: '4PM', orders: 25 },
  { hr: '6PM', orders: 30 }, { hr: '8PM', orders: 19 }, { hr: '10PM', orders: 8 },
];

export default function AdminDashboard() {
  const { state } = useStore();

  const totalOrders   = state.orders.length;
  const activeOrders  = state.orders.filter(o => !['delivered','cancelled'].includes(o.status)).length;
  const pendingAssign = state.orders.filter(o => !o.riderId && !['delivered','cancelled'].includes(o.status)).length;
  const todayRevenue  = state.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Admin Dashboard" subtitle="Madhepur Block" />
      <div className="p-4 space-y-4">

        {/* Alert banner */}
        {pendingAssign > 0 && (
          <Link to="/admin/orders">
            <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm font-medium text-amber-800 flex-1">
                {pendingAssign} order{pendingAssign > 1 ? 's' : ''} waiting for rider assignment
              </p>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
            </Card>
          </Link>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Active Orders"  value={String(activeOrders)}            icon={ShoppingBag} subtitle={`${totalOrders} total today`} />
          <StatCard title="Today Revenue"  value={`₹${todayRevenue.toLocaleString()}`} icon={IndianRupee} trend="↑8% vs yesterday" trendUp />
          <StatCard title="Active Riders"  value={String(ADMIN_STATS.activeRiders)} icon={Bike} subtitle="Online now" />
          <StatCard title="Total Vendors"  value={String(ADMIN_STATS.totalVendors)} icon={Store} subtitle="12 pending approval" />
        </div>

        {/* Live orders by hour */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Orders Today (by Hour)
          </h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HOUR_DATA} barSize={14}>
                <XAxis dataKey="hr" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => [v, 'Orders']} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Recent Orders</h3>
            <Link to="/admin/orders" className="text-xs text-primary font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {state.orders.slice(0, 4).map(o => (
              <Card key={o.id} className="p-3 border-border flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground">{o.orderNumber}</p>
                  <p className="text-sm font-medium">{o.customerName || 'Customer'} · {o.village}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">₹{o.total}</p>
                  <StatusBadge status={o.status} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Vendor Approvals', path: '/admin/vendor-approval', icon: Store, badge: ADMIN_STATS.pendingVendors },
            { label: 'Live Monitoring',  path: '/admin/monitoring',      icon: Activity },
            { label: 'COD & Cash',       path: '/admin/cash',            icon: IndianRupee },
            { label: 'Incidents',        path: '/admin/incidents',       icon: AlertTriangle, badge: 2 },
          ].map(item => (
            <Link key={item.path} to={item.path}>
              <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
                <item.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <Badge className="text-[9px] bg-destructive text-white border-0 h-4 min-w-4 px-1">{item.badge}</Badge>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
