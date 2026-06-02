import React from 'react';
import { IndianRupee, TrendingUp, Gift, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { RIDERS } from '@/lib/mockData';

const rider = RIDERS[0];
const earningsData = [
  { day: 'Mon', amount: 580 }, { day: 'Tue', amount: 720 }, { day: 'Wed', amount: 640 },
  { day: 'Thu', amount: 850 }, { day: 'Fri', amount: 920 }, { day: 'Sat', amount: 1100 }, { day: 'Sun', amount: 640 },
];

const incentives = [
  { label: 'Complete 15 deliveries today', progress: `${rider.todayDeliveries}/15`, reward: '₹200 bonus', active: true },
  { label: 'Peak hour bonus (12-2 PM)', progress: '3/5 deliveries', reward: '₹150 bonus', active: true },
  { label: 'Weekly streak (7 days)', progress: '5/7 days', reward: '₹500 bonus', active: false },
];

export default function RiderEarnings() {
  return (
    <div className="pb-20">
      <AppHeader title="Earnings" showBack />
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Today" value={`₹${rider.todayEarnings}`} trend="₹80/delivery avg" trendUp icon={IndianRupee} />
        <StatCard title="This Week" value="₹4,450" trend="12% vs last week" trendUp icon={TrendingUp} />
      </div>

      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Weekly Earnings</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earningsData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earned']} />
                <Bar dataKey="amount" fill="hsl(24, 80%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="px-4 mb-4">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /> Incentives & Bonuses</h3>
        <div className="space-y-2">
          {incentives.map((inc, i) => (
            <Card key={i} className={`p-3 border-border ${inc.active ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{inc.label}</p>
                  <p className="text-xs text-muted-foreground">{inc.progress}</p>
                </div>
                <span className="text-xs font-bold text-primary">{inc.reward}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Earnings Summary</h3>
          <div className="space-y-2">
            {[{ label: 'Delivery fees', value: '₹22,400' }, { label: 'Incentives & bonuses', value: '₹4,800' }, { label: 'Tips', value: '₹1,300' }, { label: 'Total lifetime', value: `₹${rider.totalEarnings.toLocaleString()}` }].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}