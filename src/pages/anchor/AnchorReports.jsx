import React from 'react';
import { TrendingUp, IndianRupee, Users, Package, Star, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const weeklyData = [
  { week: 'W1', orders: 42, commission: 840 },
  { week: 'W2', orders: 58, commission: 1160 },
  { week: 'W3', orders: 71, commission: 1420 },
  { week: 'W4', orders: 88, commission: 1760 },
];

const commissionBreakdown = [
  { source: 'Order commissions (1%)', amount: 3240, desc: '324 orders × avg ₹10' },
  { source: 'Onboarding bonus (3 users)', amount: 300, desc: '₹100 per new verified user' },
  { source: 'Dispute resolution bonus', amount: 120, desc: '4 disputes resolved ×₹30' },
  { source: 'Village score bonus', amount: 200, desc: 'Score >80 milestone bonus' },
];

export default function AnchorReports() {
  const totalMonthly = commissionBreakdown.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="pb-24">
      <AppHeader title="My Reports" subtitle="May 2025" showBack backTo="/anchor" rightAction={
        <Button size="sm" variant="outline" className="text-xs h-8"><Download className="w-3 h-3 mr-1" /> Export</Button>
      } />

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard title="This Month" value={`₹${totalMonthly.toLocaleString()}`} subtitle="Commission earned" icon={IndianRupee} />
          <StatCard title="Village Orders" value="325" subtitle="↑ 24% vs last month" icon={Package} trendUp trend="24%" />
          <StatCard title="Active Members" value="38/47" subtitle="Members ordering" icon={Users} />
          <StatCard title="Anchor Rating" value="4.9" subtitle="By village members" icon={Star} />
        </div>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Weekly Orders from My Village</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(24, 80%, 50%)" radius={[4, 4, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Weekly Commission Earned</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={v => [`₹${v}`, 'Commission']} />
                <Line type="monotone" dataKey="commission" stroke="hsl(150, 40%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Commission Breakdown</h3>
          <div className="space-y-3">
            {commissionBreakdown.map((item, i) => (
              <div key={i} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.source}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="font-bold text-accent">₹{item.amount}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-bold">
              <span>Total This Month</span>
              <span className="text-primary">₹{totalMonthly.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-primary/5 border-primary/20">
          <h3 className="font-semibold text-sm mb-2">Payment Schedule</h3>
          <p className="text-xs text-muted-foreground mb-3">Commission paid monthly on 1st. UPI or bank transfer.</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Next Payment: 1 June 2025</p>
              <p className="text-xs text-muted-foreground">₹{totalMonthly.toLocaleString()} → SBI ****3421</p>
            </div>
            <Button size="sm" variant="outline" className="text-xs">Change Account</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
