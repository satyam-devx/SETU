// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminAnalytics  (v2 — Live DB)
// Fixed: all mock data replaced with real API calls.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';
import { IndianRupee, ShoppingBag, Store } from 'lucide-react';

const COLORS = ['hsl(24, 80%, 50%)', 'hsl(150, 40%, 40%)', 'hsl(220, 60%, 50%)', 'hsl(280, 60%, 50%)'];

function fmtK(n) {
  n = Number(n ?? 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

export default function SuperAdminAnalytics() {
  const [period,    setPeriod]    = useState('30');
  const [orders,    setOrders]    = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    const [ordersRes, statsRes] = await Promise.all([
      AdminAPI.getRevenueAnalytics({ days: Number(period) }),
      AdminAPI.getLiveAnalytics(),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data ?? []);
    if (statsRes.data)  setStats(statsRes.data);

    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // ── Derived charts ──────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      map[day] = map[day] ?? { date: day, orders: 0, revenue: 0, cancelled: 0 };
      map[day].orders++;
      map[day].revenue += Number(o.total ?? 0);
      if (o.status === 'cancelled') map[day].cancelled++;
    });
    return Object.values(map);
  }, [orders]);

  const paymentMix = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const method = o.payment_method ?? 'unknown';
      map[method] = (map[method] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const vendorPerformance = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!o.vendor_name) return;
      map[o.vendor_name] = map[o.vendor_name] ?? { name: o.vendor_name, orders: 0, revenue: 0 };
      map[o.vendor_name].orders++;
      map[o.vendor_name].revenue += Number(o.total ?? 0);
    });
    return Object.values(map).sort((a, b) => b.orders - a.orders).slice(0, 8);
  }, [orders]);

  const villageData = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!o.village) return;
      map[o.village] = (map[o.village] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, orders]) => ({ name, orders }));
  }, [orders]);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const s = stats ?? {};

  return (
    <div className="flex-1 overflow-auto pb-6">
      <AppHeader
        title="Analytics"
        subtitle="Platform-wide business intelligence"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => load(true)}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Period selector */}
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="7"  className="text-xs">7 days</TabsTrigger>
            <TabsTrigger value="30" className="text-xs">30 days</TabsTrigger>
            <TabsTrigger value="90" className="text-xs">90 days</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatCard title="Total Revenue"  value={loading ? '…' : fmtK(totalRevenue)} icon={IndianRupee} />
          <StatCard title="Total Orders"   value={loading ? '…' : String(orders.length)} icon={ShoppingBag} />
          <StatCard title="Active Vendors" value={loading ? '…' : String(s.totalVendors ?? 0)} icon={Store} />
          <StatCard title="Online Riders"  value={loading ? '…' : String(s.onlineRiders ?? 0)} icon={Store} />
        </div>

        {/* Revenue trend */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-4">Revenue & Orders by Day</h3>
          {loading ? (
            <div className="h-48 bg-muted rounded animate-pulse" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS[0]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v, k) => [k === 'revenue' ? fmtK(v) : v, k === 'revenue' ? 'Revenue' : 'Orders']} />
                  <Area type="monotone" dataKey="revenue" stroke={COLORS[0]} fill="url(#revGrad)" strokeWidth={2} name="revenue" />
                  <Area type="monotone" dataKey="orders"  stroke={COLORS[1]} fill="none"           strokeWidth={1.5} name="orders" strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Payment mix + Village breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-4">Payment Method Mix</h3>
            {loading ? (
              <div className="h-40 bg-muted rounded animate-pulse" />
            ) : paymentMix.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No data</p>
            ) : (
              <>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={38} paddingAngle={3}>
                        {paymentMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, _, p) => [`${v} orders`, p.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-1">
                  {paymentMix.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{p.name} ({p.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-4">Orders by Village</h3>
            {loading ? (
              <div className="h-44 bg-muted rounded animate-pulse" />
            ) : villageData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No village data</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={villageData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip />
                    <Bar dataKey="orders" fill={COLORS[0]} radius={[0,4,4,0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Vendor Performance */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-4">Top Vendor Performance</h3>
          {loading ? (
            <div className="h-44 bg-muted rounded animate-pulse" />
          ) : vendorPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No vendor data</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorPerformance} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip />
                  <Bar dataKey="orders" fill={COLORS[0]} radius={[0,4,4,0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
