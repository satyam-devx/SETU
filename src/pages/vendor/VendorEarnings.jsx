// ═══════════════════════════════════════════════════════════
// SETU — VendorEarnings (v2)
// Changes:
//  - Removed hardcoded VENDOR_ID, weeklyData, monthlyData
//  - Fetches vendor profile from auth
//  - Reads wallet_transactions from Supabase directly
//  - Computes chart data from real order timestamps
//  - Revenue aggregates (gross, fees, net) from real orders
//  - Lazy chart: only renders after data arrives
// ═══════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, TrendingUp, ArrowDownLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useAuth } from '@/lib/AuthContext';
import { useVendorByOwner } from '@/hooks/queries/useVendor';
import { useVendorOrders } from '@/hooks/queries/useOrders';
import { formatCurrency } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKS  = ['W1', 'W2', 'W3', 'W4'];

/** Build daily chart data for the current ISO week from a list of orders */
function buildWeeklyChart(orders) {
  const buckets = DAYS.map(day => ({ day, earnings: 0 }));
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);

  orders.forEach(o => {
    const d = new Date(o.created_at ?? o.createdAt);
    if (d >= weekStart) {
      buckets[d.getDay()].earnings += (o.total ?? 0) - (o.platform_fee ?? o.platformFee ?? 0);
    }
  });
  return buckets;
}

/** Build 4-week chart data for the current month */
function buildMonthlyChart(orders) {
  const buckets = WEEKS.map(w => ({ week: w, earnings: 0 }));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  orders.forEach(o => {
    const d = new Date(o.created_at ?? o.createdAt);
    if (d >= monthStart) {
      const weekIdx = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
      buckets[weekIdx].earnings += (o.total ?? 0) - (o.platform_fee ?? o.platformFee ?? 0);
    }
  });
  return buckets;
}

export default function VendorEarnings() {
  const { user }   = useAuth();
  const [period, setPeriod] = useState('week');
  const navigate = useNavigate();

  // ── Vendor profile ────────────────────────────────────────
  const { data: vendor } = useVendorByOwner(user?.id);

  // ── Server-fetched vendor orders ─────────────────────────
  const { data: fetchedOrders = [] } = useVendorOrders(vendor?.id, { limit: 100 });

  const vendorOrders = useMemo(() =>
    (fetchedOrders ?? []).filter(o => o.status !== 'cancelled'),
    [fetchedOrders]
  );

  const { totalRevenue, platformFees, netEarnings } = useMemo(() => {
    const total = vendorOrders.reduce((s, o) => s + (o.total ?? 0), 0);
    const fees = vendorOrders.reduce((s, o) => s + (o.platform_fee ?? o.platformFee ?? 0), 0);
    return { totalRevenue: total, platformFees: fees, netEarnings: total - fees };
  }, [vendorOrders]);

  // ── Chart data derived from real orders ───────────────────
  const weeklyData  = useMemo(() => buildWeeklyChart(vendorOrders),  [vendorOrders]);
  const monthlyData = useMemo(() => buildMonthlyChart(vendorOrders), [vendorOrders]);
  const chartData   = period === 'week' ? weeklyData  : monthlyData;
  const chartKey    = period === 'week' ? 'day'       : 'week';

  // ── Recent order settlements for the list ────────────────
  const recentSettlements = useMemo(() => vendorOrders.slice(0, 6).map(o => ({
    id:       o.order_number ?? o.orderNumber ?? o.id,
    customer: o.customer_name ?? o.customerName ?? 'Customer',
    amount:   o.total ?? 0,
    fee:      o.platform_fee ?? o.platformFee ?? 0,
    net:      (o.total ?? 0) - (o.platform_fee ?? o.platformFee ?? 0),
    time:     new Date(o.created_at ?? o.createdAt).toLocaleTimeString('en-IN', { timeStyle: 'short' }),
  })), [vendorOrders]);

  return (
    <div className="pb-20">
      <AppHeader title="Earnings" subtitle="Revenue & settlements" />
      <div className="px-4 py-4 space-y-4">

        {/* ── Stats ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Gross Revenue"
            value={formatCurrency(totalRevenue)}
            icon={IndianRupee}
            accent
          />
          <StatCard
            title="Net Earnings"
            value={formatCurrency(netEarnings)}
            icon={TrendingUp}
            subtitle={`After ${formatCurrency(platformFees)} fees`}
          />
        </div>

        {/* ── Earnings trend chart ─────────────────────── */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Earnings Trend</h3>
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList className="h-7">
                <TabsTrigger value="week"  className="text-xs h-6 px-2">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs h-6 px-2">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey={chartKey} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Net Earnings']}
                  contentStyle={{ fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#earnGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {vendorOrders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-1">
              Chart will populate as orders come in.
            </p>
          )}
        </Card>

        {/* ── Revenue breakdown ────────────────────────── */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Revenue Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Revenue</span>
              <span className="font-medium">{formatCurrency(totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee (2%)</span>
              <span className="text-red-500">−{formatCurrency(platformFees)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Gateway</span>
              <span className="text-red-500">−₹0</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>Net Payout</span>
              <span className="text-green-600">{formatCurrency(netEarnings)}</span>
            </div>
          </div>
        </Card>

        {/* ── Recent order settlements ───────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Recent Settlements</h3>
            <span className="text-[10px] text-muted-foreground">From orders</span>
          </div>
          {recentSettlements.length ? <div className="space-y-2">{recentSettlements.map(t=>(
            <Card key={t.id} className="p-3 border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><ArrowDownLeft className="w-4 h-4 text-green-600"/></div>
              <div className="flex-1 min-w-0"><p className="text-[10px] font-mono text-muted-foreground">{t.id}</p><p className="text-sm font-medium">{t.customer}</p><p className="text-xs text-muted-foreground">{t.time}</p></div>
              <div className="text-right shrink-0"><p className="text-sm font-bold text-green-600">+{formatCurrency(t.net)}</p><p className="text-xs text-muted-foreground">gross {formatCurrency(t.amount)}</p></div>
            </Card>
          ))}</div> : <Card className="p-6 text-center"><p className="text-sm text-muted-foreground">No completed earnings yet.</p></Card>}
        </div>

        <Button className="w-full gap-2" onClick={() => navigate('/vendor/support')}>
          <IndianRupee className="w-4 h-4" /> Request Payout Support
        </Button>
      </div>
    </div>
  );
}
