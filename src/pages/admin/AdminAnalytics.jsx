// ═══════════════════════════════════════════════════════════
// SETU — AdminAnalytics  (new)
// Revenue trends, order volumes, user growth, payment mix,
// top vendors — all from live DB.
// Route: /admin/analytics
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, IndianRupee, ShoppingBag, Users,
  Store, RefreshCw, Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { AdminAPI } from '@/lib/api';

const COLORS = ['#f97316', '#16a34a', '#2563eb', '#7c3aed', '#dc2626'];

function fmt(n) { return Number(n ?? 0).toLocaleString('en-IN'); }
function fmtK(n) {
  n = Number(n ?? 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

export default function AdminAnalytics() {
  const [period,    setPeriod]    = useState('30');
  const [analytics, setAnalytics] = useState(null);
  const [rev,       setRev]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    const [analyticsRes, revRes] = await Promise.all([
      AdminAPI.getLiveAnalytics(),
      AdminAPI.getRevenueAnalytics({ days: Number(period) }),
    ]);

    if (analyticsRes.data) setAnalytics(analyticsRes.data);
    if (revRes.data)       setRev(revRes.data);

    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // ── Derived charts (pre-aggregated server-side; see migration 047) ──
  // Daily revenue + order count
  const dailyData = (rev?.daily ?? []).map(d => ({
    day:     d.date?.slice(5) ?? '',
    revenue: Number(d.revenue ?? 0),
    orders:  d.orders,
  }));

  // Payment mix pie
  const a = analytics ?? {};
  const paymentMix = [
    { name: 'COD',    value: a.cod_orders    ?? 0 },
    { name: 'UPI',    value: a.upi_orders    ?? 0 },
    { name: 'Wallet', value: a.wallet_orders ?? 0 },
    { name: 'Credit', value: a.credit_orders ?? 0 },
  ].filter(p => p.value > 0);

  // Top vendors by revenue (server-aggregated)
  const topVendors = (rev?.top_vendors ?? []).slice(0, 5);

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Analytics"
        subtitle="Platform-wide business metrics"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => load(true)}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-4xl">

        {/* Period selector */}
        <Tabs value={period} onValueChange={v => { setPeriod(v); }}>
          <TabsList className="grid grid-cols-3 w-48">
            <TabsTrigger value="7"  className="text-xs">7 days</TabsTrigger>
            <TabsTrigger value="30" className="text-xs">30 days</TabsTrigger>
            <TabsTrigger value="90" className="text-xs">90 days</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Top KPI cards */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Total GMV"
            value={loading ? '…' : fmtK(a.total_gmv)}
            icon={IndianRupee}
            subtitle={`₹${fmt(a.today_revenue)} today`}
          />
          <StatCard
            title="Total Orders"
            value={loading ? '…' : fmt(a.total_orders)}
            icon={ShoppingBag}
            subtitle={`${a.today_total ?? 0} today`}
          />
          <StatCard
            title="Total Customers"
            value={loading ? '…' : fmt(a.total_customers)}
            icon={Users}
            subtitle={`${a.new_today ?? 0} new today`}
          />
          <StatCard
            title="Active Vendors"
            value={loading ? '…' : fmt(a.verified_vendors)}
            icon={Store}
            subtitle={`${a.open_vendors ?? 0} open now`}
          />
        </div>

        {/* Revenue trend */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Revenue Trend
          </h3>
          {loading ? (
            <div className="h-44 bg-muted rounded animate-pulse" />
          ) : dailyData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No data for this period</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip formatter={v => [`₹${fmt(v)}`, 'Revenue']} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Order volume */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" /> Order Volume
          </h3>
          {loading ? (
            <div className="h-36 bg-muted rounded animate-pulse" />
          ) : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barSize={12}>
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={v => [v, 'Orders']} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Payment mix + top vendors */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Payment mix */}
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3">Payment Mix</h3>
            {loading ? (
              <div className="h-32 bg-muted rounded animate-pulse" />
            ) : paymentMix.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No payment data</p>
            ) : (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                      {paymentMix.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Top vendors */}
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3">Top Vendors (Revenue)</h3>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
              </div>
            ) : topVendors.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No vendor data</p>
            ) : (
              <div className="space-y-2">
                {topVendors.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-2 text-xs">
                    <span className="w-4 font-bold text-muted-foreground shrink-0">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{v.name}</span>
                    <span className="text-muted-foreground shrink-0">{v.orders} orders</span>
                    <span className="font-semibold shrink-0">{fmtK(v.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Platform fee summary */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> Platform Financials
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-green-600">
                {loading ? '…' : fmtK(a.total_gmv)}
              </p>
              <p className="text-muted-foreground">Total GMV</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-blue-600">
                {loading ? '…' : fmtK(a.today_platform_fee)}
              </p>
              <p className="text-muted-foreground">Today's Fee</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-amber-600">
                {loading ? '…' : fmtK(a.total_cod_held)}
              </p>
              <p className="text-muted-foreground">COD Held</p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
