import React, { useState } from 'react';
import { IndianRupee, TrendingUp, Bike, Star, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { RIDERS } from '@/lib/mockData';

const rider = RIDERS[0];

const weekData = [
  { day: 'Mon', earnings: 320, deliveries: 4 },
  { day: 'Tue', earnings: 480, deliveries: 6 },
  { day: 'Wed', earnings: 240, deliveries: 3 },
  { day: 'Thu', earnings: 560, deliveries: 7 },
  { day: 'Fri', earnings: 400, deliveries: 5 },
  { day: 'Sat', earnings: 640, deliveries: 8 },
  { day: 'Sun', earnings: 280, deliveries: 3 },
];

const PAYOUT_HISTORY = [
  { date: 'Jun 1, 2025', amount: 2840, status: 'paid',    method: 'UPI' },
  { date: 'May 25, 2025', amount: 3120, status: 'paid',   method: 'UPI' },
  { date: 'May 18, 2025', amount: 2650, status: 'paid',   method: 'UPI' },
];

export default function RiderEarnings() {
  const [period, setPeriod] = useState('week');

  const weekTotal   = weekData.reduce((s, d) => s + d.earnings, 0);
  const delivTotal  = weekData.reduce((s, d) => s + d.deliveries, 0);

  return (
    <div className="pb-20">
      <AppHeader title="Earnings" />
      <div className="px-4 py-4 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Today" value={`₹${rider.todayEarnings}`} icon={IndianRupee}
            subtitle={`${rider.todayDeliveries} deliveries`} />
          <StatCard title="This Week" value={`₹${weekTotal.toLocaleString()}`} icon={TrendingUp}
            subtitle={`${delivTotal} deliveries`} trend="↑12% vs last week" trendUp />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="This Month" value={`₹${rider.totalEarnings.toLocaleString()}`} icon={IndianRupee} />
          <StatCard title="Rating" value={`${rider.rating} ★`} icon={Star}
            subtitle={`${rider.totalDeliveries} total trips`} trend="Top 15%" trendUp />
        </div>

        {/* Earnings chart */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Daily Earnings</h3>
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList className="h-7">
                <TabsTrigger value="week"  className="text-xs h-6 px-2">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs h-6 px-2">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} barSize={20}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earnings']} />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Earnings breakdown */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">This Week Breakdown</h3>
          <div className="space-y-2">
            {[
              { label: 'Base earnings (₹80/delivery)', value: `₹${delivTotal * 80}` },
              { label: 'Peak hour bonus',               value: '₹120' },
              { label: 'Incentive bonus',               value: '₹200' },
              { label: 'Fuel deduction',                value: '-₹0' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-medium ${row.value.startsWith('-') ? 'text-red-500' : ''}`}>{row.value}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>Total</span><span>₹{weekTotal.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Payout history */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Payout History</h3>
          <div className="space-y-2">
            {PAYOUT_HISTORY.map((p, i) => (
              <Card key={i} className="p-3 border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">₹{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{p.date} · {p.method}</p>
                </div>
                <Badge className="text-[9px] bg-green-100 text-green-700 border-0">{p.status}</Badge>
              </Card>
            ))}
          </div>
        </div>

        <Button variant="outline" className="w-full gap-2">
          <IndianRupee className="w-4 h-4" /> Withdraw Earnings
        </Button>
      </div>
    </div>
  );
}
