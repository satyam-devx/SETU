import React from 'react';
import { IndianRupee, TrendingUp, Briefcase, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SEVA_PROVIDERS } from '@/lib/mockData';

const provider = SEVA_PROVIDERS[0];

const weekData = [
  { day: 'Mon', earned: 0   }, { day: 'Tue', earned: 450 },
  { day: 'Wed', earned: 800 }, { day: 'Thu', earned: 0   },
  { day: 'Fri', earned: 650 }, { day: 'Sat', earned: 1200},
  { day: 'Sun', earned: 300 },
];

const PAYOUTS = [
  { period: 'May 25 – Jun 1', amount: 4200, status: 'paid',    jobs: 7 },
  { period: 'May 18 – May 24', amount: 3600, status: 'paid',   jobs: 6 },
  { period: 'May 11 – May 17', amount: 2800, status: 'paid',   jobs: 5 },
];

export default function SevaEarnings() {
  const weekTotal = weekData.reduce((s, d) => s + d.earned, 0);

  return (
    <div className="pb-6">
      <AppHeader title="Earnings" />
      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="This Month"  value={`₹${provider.monthlyEarnings.toLocaleString()}`} icon={IndianRupee} trend="↑22%" trendUp />
          <StatCard title="This Week"   value={`₹${weekTotal.toLocaleString()}`}                  icon={TrendingUp} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Jobs Completed" value={String(provider.completedJobs)} icon={Briefcase} />
          <StatCard title="Avg per Job"    value={`₹${Math.round(provider.monthlyEarnings / provider.completedJobs)}`} icon={IndianRupee} />
        </div>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">This Week's Earnings</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} barSize={20}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => [`₹${v}`, 'Earned']} />
                <Bar dataKey="earned" fill="hsl(var(--accent))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div>
          <h3 className="font-semibold text-sm mb-2">Payout History</h3>
          <div className="space-y-2">
            {PAYOUTS.map((p, i) => (
              <Card key={i} className="p-3 border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">₹{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{p.period} · {p.jobs} jobs</p>
                </div>
                <Badge className="text-[9px] bg-green-100 text-green-700 border-0">{p.status}</Badge>
              </Card>
            ))}
          </div>
        </div>

        <Button variant="outline" className="w-full gap-2">
          <IndianRupee className="w-4 h-4" /> Withdraw to Bank
        </Button>
      </div>
    </div>
  );
}
