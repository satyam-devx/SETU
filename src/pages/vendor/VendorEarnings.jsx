import React, { useState } from 'react';
import { IndianRupee, TrendingUp, Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useStore } from '@/lib/store';

const VENDOR_ID = 'vn1';

const weeklyData = [
  { day: 'Mon', earnings: 2400 }, { day: 'Tue', earnings: 3200 },
  { day: 'Wed', earnings: 2800 }, { day: 'Thu', earnings: 4100 },
  { day: 'Fri', earnings: 3700 }, { day: 'Sat', earnings: 5200 },
  { day: 'Sun', earnings: 4600 },
];

const monthlyData = [
  { week: 'W1', earnings: 18000 }, { week: 'W2', earnings: 22000 },
  { week: 'W3', earnings: 19500 }, { week: 'W4', earnings: 26000 },
];

export default function VendorEarnings() {
  const { state } = useStore();
  const [period, setPeriod] = useState('week');

  const vendorOrders  = state.orders.filter(o => o.vendorId === VENDOR_ID && o.status !== 'cancelled');
  const totalRevenue  = vendorOrders.reduce((s, o) => s + (o.total || 0), 0);
  const platformFees  = vendorOrders.reduce((s, o) => s + (o.platformFee || 0), 0);
  const netEarnings   = totalRevenue - platformFees;
  const chartData     = period === 'week' ? weeklyData : monthlyData;
  const chartKey      = period === 'week' ? 'day' : 'week';

  const transactions = vendorOrders.slice(0, 6).map(o => ({
    id: o.orderNumber,
    customer: o.customerName || 'Customer',
    amount: o.total,
    fee: o.platformFee || 0,
    net: (o.total || 0) - (o.platformFee || 0),
    time: new Date(o.createdAt).toLocaleTimeString('en-IN', { timeStyle: 'short' }),
    status: 'settled',
  }));

  return (
    <div className="pb-20">
      <AppHeader title="Earnings" subtitle="Revenue & settlements" />
      <div className="px-4 py-4 space-y-4">

        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Gross Revenue" value={`₹${totalRevenue.toLocaleString()}`}  icon={IndianRupee} trend="↑18% vs last week" trendUp />
          <StatCard title="Net Earnings"  value={`₹${netEarnings.toLocaleString()}`}   icon={TrendingUp}  subtitle={`After ₹${platformFees} fees`} />
        </div>

        {/* Chart */}
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
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey={chartKey} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => [`₹${v.toLocaleString()}`, 'Earnings']} />
                <Area type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#earningsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Fee breakdown */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Revenue Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross Revenue</span><span className="font-medium">₹{totalRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Platform Fee (2%)</span><span className="text-red-500">-₹{platformFees.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Gateway</span><span className="text-red-500">-₹0</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>Net Payout</span><span className="text-green-600">₹{netEarnings.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Recent transactions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Recent Transactions</h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Download className="w-3 h-3" /> Export
            </Button>
          </div>
          {transactions.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.map((t, i) => (
                <Card key={i} className="p-3 border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{t.id}</p>
                    <p className="text-sm font-medium">{t.customer}</p>
                    <p className="text-xs text-muted-foreground">{t.time}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-green-600">+₹{t.net}</p>
                    <p className="text-xs text-muted-foreground">gross ₹{t.amount}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Button className="w-full gap-2">
          <IndianRupee className="w-4 h-4" /> Request Payout
        </Button>
      </div>
    </div>
  );
}
