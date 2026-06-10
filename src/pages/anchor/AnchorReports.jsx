import React, { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, Users, ShoppingBag, IndianRupee, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useVillage } from '@/lib/village';
import { supabase } from '@/lib/supabase';

// Bucket delivered orders by day-of-week for the current week
function buildWeekChart(orders) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now   = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const buckets = Object.fromEntries(days.map(d => [d, 0]));
  orders.forEach(o => {
    const d = new Date(o.created_at);
    if (d >= startOfWeek) buckets[days[d.getDay()]]++;
  });
  return days.map(day => ({ day, orders: buckets[day] }));
}

// Fetch village-scoped order stats from Supabase
async function fetchReportData(villageId, period) {
  const now = new Date();
  let from;
  if (period === 'week') {
    from = new Date(now);
    from.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    from = new Date(now.getFullYear(), 0, 1);
  }

  const [ordersRes, vendorsRes, ridersRes, profilesRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total, created_at')
      .eq('village_id', villageId)
      .gte('created_at', from.toISOString()),
    supabase
      .from('vendors')
      .select('id, is_open')
      .eq('village_id', villageId),
    supabase
      .from('riders')
      .select('id, is_online')
      .eq('village_id', villageId),
    supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('village_id', villageId)
      .eq('role', 'customer'),
  ]);

  const orders  = ordersRes.data  ?? [];
  const vendors = vendorsRes.data ?? [];
  const riders  = ridersRes.data  ?? [];

  const delivered   = orders.filter(o => o.status === 'delivered').length;
  const totalOrders = orders.length;
  const gmv         = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  const activeVendors = vendors.filter(v => v.is_open).length;
  const totalVendors  = vendors.length;
  const onlineRiders  = riders.filter(r => r.is_online).length;
  const totalRiders   = riders.length;
  const activeUsers   = profilesRes.count ?? 0;
  const deliveryRate  = totalOrders > 0 ? Math.round(delivered / totalOrders * 100) : 0;

  return {
    totalOrders,
    gmv,
    activeUsers,
    deliveryRate,
    activeVendors,
    totalVendors,
    onlineRiders,
    totalRiders,
    orders,        // for chart
    error: ordersRes.error || vendorsRes.error,
  };
}

export default function AnchorReports() {
  const { village, villageId } = useVillage();
  const [period,   setPeriod]  = useState('week');
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    if (!villageId) return;
    setLoading(true);
    setLoadError(null);
    const result = await fetchReportData(villageId, period);
    if (result.error) setLoadError('Some data failed to load.');
    setData(result);
    setLoading(false);
  }, [villageId, period]);

  useEffect(() => { load(); }, [load]);

  const weekChart = data ? buildWeekChart(data.orders) : [];
  const villageName = village?.name ?? 'Village';

  const statsRows = data
    ? [
        { metric: 'Active Vendors',     value: `${data.activeVendors}/${data.totalVendors}`, pct: data.totalVendors > 0 ? Math.round(data.activeVendors / data.totalVendors * 100) : 0, good: true },
        { metric: 'Active Riders',      value: `${data.onlineRiders}/${data.totalRiders}`,  pct: data.totalRiders  > 0 ? Math.round(data.onlineRiders / data.totalRiders * 100)   : 0, good: true },
        { metric: 'Delivery Rate',      value: `${data.deliveryRate}%`, pct: data.deliveryRate, good: data.deliveryRate >= 80 },
      ]
    : [];

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

        {/* Error banner */}
        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={load}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Total Orders"
            value={loading ? '…' : String(data?.totalOrders ?? 0)}
            icon={ShoppingBag}
          />
          <StatCard
            title="Village GMV"
            value={loading ? '…' : `₹${(data?.gmv ?? 0).toLocaleString()}`}
            icon={IndianRupee}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Active Users"
            value={loading ? '…' : String(data?.activeUsers ?? 0)}
            icon={Users}
            subtitle={`in ${villageName}`}
          />
          <StatCard
            title="Delivery Rate"
            value={loading ? '…' : `${data?.deliveryRate ?? 0}%`}
            icon={TrendingUp}
          />
        </div>

        {/* Orders bar chart */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Orders This Week</h3>
          {loading ? (
            <div className="h-36 bg-muted rounded animate-pulse" />
          ) : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekChart} barSize={18}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={v => [v, 'Orders']} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Village health */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">{villageName} Village Health</h3>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-6 bg-muted rounded" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {statsRows.map(item => (
                <div key={item.metric}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{item.metric}</span>
                    <span className={`font-bold ${item.good ? 'text-green-600' : 'text-amber-600'}`}>
                      {item.value}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${item.good ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
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
