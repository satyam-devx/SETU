import React, { useState } from 'react';
import { DollarSign, TrendingUp, Download, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const weeklyData = [
  { day: 'Mon', earnings: 2400 }, { day: 'Tue', earnings: 3200 }, { day: 'Wed', earnings: 2800 },
  { day: 'Thu', earnings: 4100 }, { day: 'Fri', earnings: 3700 }, { day: 'Sat', earnings: 5200 }, { day: 'Sun', earnings: 4600 },
];

const transactions = [
  { id: 'ORD-1042', customer: 'Priya Devi', amount: 485, time: '2:30 PM', status: 'settled' },
  { id: 'ORD-1041', customer: 'Ramesh Kumar', amount: 320, time: '1:15 PM', status: 'settled' },
  { id: 'ORD-1040', customer: 'Sunita Singh', amount: 760, time: '11:50 AM', status: 'pending' },
  { id: 'ORD-1039', customer: 'Mohan Lal', amount: 215, time: '10:30 AM', status: 'settled' },
  { id: 'ORD-1038', customer: 'Geeta Sharma', amount: 540, time: '9:45 AM', status: 'settled' },
];

export default function VendorEarnings() {
  const [tab, setTab] = useState('week');

  return (
    <div className="pb-20">
      <AppHeader title="Earnings" subtitle="Ramesh Kirana Store" showBack />

      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Today's Earnings" value="₹2,320" trend="₹380 more than yesterday" trendUp icon={DollarSign} />
        <StatCard title="This Week" value="₹26,000" trend="12% growth" trendUp icon={TrendingUp} />
      </div>

      <div className="px-4 mb-3">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Earnings Trend</h3>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-7">
                <TabsTrigger value="week" className="text-xs px-2 h-6">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2 h-6">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24,80%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(24,80%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v/1000}k`} />
                <Tooltip formatter={v => [`₹${v}`, 'Earnings']} />
                <Area type="monotone" dataKey="earnings" stroke="hsl(24,80%,50%)" fill="url(#earningsGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Today's Transactions</h3>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
            <Download className="w-3 h-3" /> Export
          </Button>
        </div>
        <div className="space-y-2">
          {transactions.map(tx => (
            <Card key={tx.id} className="p-3 border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{tx.customer}</p>
                  <p className="text-xs text-muted-foreground">{tx.id} · {tx.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">+₹{tx.amount}</p>
                  <Badge variant={tx.status === 'settled' ? 'default' : 'outline'} className="text-[10px] h-4 mt-0.5">
                    {tx.status}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
