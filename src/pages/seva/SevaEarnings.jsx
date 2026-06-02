import React from 'react';
import { IndianRupee, TrendingUp, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const data = [
  { week: 'W1', amount: 4200 }, { week: 'W2', amount: 5800 }, { week: 'W3', amount: 4900 }, { week: 'W4', amount: 6500 },
];

const recentPayments = [
  { id: 1, customer: 'Mohan Lal', service: 'Wiring repair', amount: 600, date: '2025-05-30', method: 'Cash' },
  { id: 2, customer: 'Raj Kumar', service: 'MCB replacement', amount: 350, date: '2025-05-30', method: 'UPI' },
  { id: 3, customer: 'Rekha Kumari', service: 'Full house wiring', amount: 2500, date: '2025-05-28', method: 'Cash' },
];

export default function SevaEarnings() {
  return (
    <div className="pb-20">
      <AppHeader title="Earnings" />
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="This Month" value="₹21,400" trend="18% growth" trendUp icon={IndianRupee} />
        <StatCard title="Total Earned" value="₹1.2L" subtitle="156 jobs completed" icon={TrendingUp} />
      </div>

      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Monthly Trend</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earned']} />
                <Bar dataKey="amount" fill="hsl(150, 40%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Recent Payments</h3>
          <Button variant="ghost" size="sm" className="text-xs h-7"><FileText className="w-3 h-3 mr-1" /> Invoice</Button>
        </div>
        {recentPayments.map(p => (
          <Card key={p.id} className="p-3 border-border mb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{p.service}</p>
                <p className="text-xs text-muted-foreground">{p.customer} · {p.method} · {p.date}</p>
              </div>
              <span className="text-sm font-bold text-accent">₹{p.amount}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}