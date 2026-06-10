import React, { useState, useEffect, useMemo } from 'react';
import { IndianRupee, TrendingUp, Star, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { RiderAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Helpers ──────────────────────────────────────────────
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function startOfMonth() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function RiderEarnings() {
  const { user } = useAuth();

  const [rider,        setRider]        = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [period,       setPeriod]       = useState('week');

  // ── Load rider + wallet transactions ────────────────────
  useEffect(() => {
    if (!user?.id) return;

    async function load() {
      setLoading(true);

      // 1. Rider row (stats)
      const { data: riderRow } = await RiderAPI.getProfile(user.id);
      if (riderRow) setRider(riderRow);

      // 2. Wallet transactions tagged to this rider's user_id
      //    We fetch last 90 days to support week/month views.
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);

      const { data: txns } = await supabase
        .from('wallet_transactions')
        .select('id, amount, type, description, created_at')
        .eq('user_id', user.id)
        .gte('created_at', since90.toISOString())
        .order('created_at', { ascending: false });

      setTransactions(txns ?? []);
      setLoading(false);
    }

    load();
  }, [user?.id]);

  // ── Aggregations ─────────────────────────────────────────
  const { todayTotal, weekTotal, monthTotal, weekDeliveries, chartData, payoutHistory } = useMemo(() => {
    const credits = transactions.filter(t => t.amount > 0);

    const todayCutoff = startOfToday();
    const weekCutoff  = startOfWeek();
    const monthCutoff = startOfMonth();

    const todayTotal  = credits
      .filter(t => new Date(t.created_at) >= todayCutoff)
      .reduce((s, t) => s + t.amount, 0);

    const weekTotal = credits
      .filter(t => new Date(t.created_at) >= weekCutoff)
      .reduce((s, t) => s + t.amount, 0);

    const monthTotal = credits
      .filter(t => new Date(t.created_at) >= monthCutoff)
      .reduce((s, t) => s + t.amount, 0);

    // Approximate deliveries this week as number of earning transactions
    const weekDeliveries = credits.filter(t => new Date(t.created_at) >= weekCutoff).length;

    // Chart: group by day of week for current week
    const dayMap = DAY_LABELS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {});
    credits
      .filter(t => new Date(t.created_at) >= weekCutoff)
      .forEach(t => {
        const day = DAY_LABELS[new Date(t.created_at).getDay()];
        dayMap[day] = (dayMap[day] ?? 0) + t.amount;
      });
    const chartData = DAY_LABELS.map(day => ({ day, earnings: dayMap[day] }));

    // Last 10 credit transactions as "payout history"
    const payoutHistory = credits.slice(0, 10).map(t => ({
      date:   new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      amount: t.amount,
      note:   t.description ?? 'Earnings',
    }));

    return { todayTotal, weekTotal, monthTotal, weekDeliveries, chartData, payoutHistory };
  }, [transactions]);

  const displayTotal = period === 'week' ? weekTotal : monthTotal;

  if (loading) {
    return (
      <div className="pb-20">
        <AppHeader title="Earnings" />
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <AppHeader title="Earnings" />
      <div className="px-4 py-4 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Today"     value={`₹${todayTotal.toLocaleString()}`}  icon={IndianRupee} />
          <StatCard title="This Week" value={`₹${weekTotal.toLocaleString()}`}   icon={TrendingUp}
            subtitle={`${weekDeliveries} deliveries`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="This Month" value={`₹${monthTotal.toLocaleString()}`} icon={IndianRupee} />
          <StatCard title="Rating"     value={`${(rider?.rating ?? 0).toFixed(1)} ★`} icon={Star}
            subtitle={`${rider?.total_deliveries ?? 0} total trips`} />
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
              <BarChart data={chartData} barSize={20}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earnings']} />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Breakdown */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">
            {period === 'week' ? 'This Week' : 'This Month'} Summary
          </h3>
          <div className="flex justify-between text-sm py-2 border-t border-border font-bold">
            <span>Total Credited</span>
            <span>₹{displayTotal.toLocaleString()}</span>
          </div>
        </Card>

        {/* Transaction history */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Recent Credits</h3>
          {payoutHistory.length === 0 ? (
            <Card className="p-4 text-center border-border">
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {payoutHistory.map((p, i) => (
                <Card key={i} className="p-3 border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">₹{p.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{p.date} · {p.note}</p>
                  </div>
                  <Badge className="text-[9px] bg-green-100 text-green-700 border-0">credited</Badge>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" className="w-full gap-2">
          <IndianRupee className="w-4 h-4" /> Withdraw Earnings
        </Button>
      </div>
    </div>
  );
}
