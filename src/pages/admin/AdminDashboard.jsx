import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, Store, Bike, IndianRupee, AlertTriangle,
  Activity, ChevronRight, RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { AdminAPI } from '@/lib/api';

function relDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { timeStyle: 'short' });
}

export default function AdminDashboard() {
  const [stats,      setStats]      = useState(null);
  const [hourly,     setHourly]     = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const [statsRes, hourlyRes, ordersRes, liveRes] = await Promise.all([
      AdminAPI.getStats(),
      AdminAPI.getHourlyOrders(),
      AdminAPI.getOrders({ limit: 5 }),
      AdminAPI.getLiveAnalytics(),
    ]);

    if (statsRes.data)  setStats({ ...statsRes.data, ...(liveRes.data ?? {}) });
    if (hourlyRes.data) setHourly(hourlyRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = stats ?? {};

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Admin Dashboard"
        subtitle="Madhepur Block"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => load(true)}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        {/* Unassigned orders alert */}
        {!loading && (s.pendingAssign ?? 0) > 0 && (
          <Link to="/admin/orders">
            <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm font-medium text-amber-800 flex-1">
                {s.pendingAssign} order{s.pendingAssign > 1 ? 's' : ''} waiting for rider assignment
              </p>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
            </Card>
          </Link>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Active Orders"
            value={loading ? '…' : String(s.activeOrders ?? 0)}
            icon={ShoppingBag}
            subtitle={`${s.todayOrders ?? 0} new today`}
          />
          <StatCard
            title="Today Revenue"
            value={loading ? '…' : `₹${(s.todayRevenue ?? 0).toLocaleString()}`}
            icon={IndianRupee}
          />
          <StatCard
            title="Online Riders"
            value={loading ? '…' : String(s.onlineRiders ?? 0)}
            icon={Bike}
            subtitle={`of ${s.totalRiders ?? 0} total`}
          />
          <StatCard
            title="Total Vendors"
            value={loading ? '…' : String(s.totalVendors ?? 0)}
            icon={Store}
            subtitle={s.pendingVendors > 0 ? `${s.pendingVendors} pending approval` : undefined}
          />
        </div>

        {/* Hourly orders chart */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Orders Today (by Hour)
          </h3>
          {loading ? (
            <div className="h-36 bg-muted rounded animate-pulse" />
          ) : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} barSize={14}>
                  <XAxis dataKey="hr" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={v => [v, 'Orders']} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Recent Orders</h3>
            <Link to="/admin/orders" className="text-xs text-primary font-medium">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 4).map(o => (
                <Card key={o.id} className="p-3 border-border flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{o.order_number}</p>
                    <p className="text-sm font-medium">{o.customer_name || 'Customer'} · {o.village || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">₹{o.total}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Vendor Approvals', path: '/admin/vendor-approval', icon: Store,          badge: s.pendingVendors },
            { label: 'Live Monitoring',  path: '/admin/monitoring',      icon: Activity,       badge: null },
            { label: 'COD & Cash',       path: '/admin/cash',            icon: IndianRupee,    badge: null },
            { label: 'Support',          path: '/admin/support',         icon: AlertTriangle,  badge: s.openTickets },
          ].map(item => (
            <Link key={item.path} to={item.path}>
              <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
                <item.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <Badge className="text-[9px] bg-destructive text-white border-0 h-4 min-w-4 px-1">
                    {item.badge}
                  </Badge>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
