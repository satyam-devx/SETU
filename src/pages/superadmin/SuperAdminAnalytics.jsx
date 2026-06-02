import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Card } from '@/components/ui/card';
import { ANALYTICS_DATA } from '@/lib/mockData';

const paymentMix = [
  { name: 'COD', value: 62, fill: 'hsl(24, 80%, 50%)' },
  { name: 'UPI', value: 33, fill: 'hsl(150, 40%, 40%)' },
  { name: 'SETU Credit', value: 5, fill: 'hsl(220, 60%, 50%)' },
];

const retentionData = [
  { month: 'M1', rate: 45 }, { month: 'M2', rate: 38 }, { month: 'M3', rate: 35 },
  { month: 'M4', rate: 42 }, { month: 'M5', rate: 48 },
];

const hourlyOrders = [
  {hour:'6',orders:2},{hour:'7',orders:5},{hour:'8',orders:9},{hour:'9',orders:14},
  {hour:'10',orders:18},{hour:'11',orders:22},{hour:'12',orders:20},{hour:'13',orders:17},
  {hour:'14',orders:15},{hour:'15',orders:12},{hour:'16',orders:14},{hour:'17',orders:19},
  {hour:'18',orders:25},{hour:'19',orders:30},{hour:'20',orders:28},{hour:'21',orders:22},
  {hour:'22',orders:12},{hour:'23',orders:4},
];

export default function SuperAdminAnalytics() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">Analytics</h1>
      <p className="text-sm text-muted-foreground mb-6">Platform-wide analytics and business intelligence</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Orders by Day of Week</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ANALYTICS_DATA.daily}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(24, 80%, 50%)" radius={[4,4,0,0]} name="Orders" />
                <Bar dataKey="cancelled" fill="hsl(0, 72%, 51%)" radius={[4,4,0,0]} name="Cancelled" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Payment Method Mix</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={45} paddingAngle={3}>
                  {paymentMix.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {paymentMix.map(p => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }} />
                <span>{p.name} ({p.value}%)</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Customer Retention (Monthly Cohort)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 60]} />
                <Tooltip formatter={(v) => [`${v}%`, 'Retention']} />
                <Line type="monotone" dataKey="rate" stroke="hsl(150, 40%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Order Volume by Hour</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyOrders}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(220, 60%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(220, 60%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={h => `${h}:00`} />
                <Area type="monotone" dataKey="orders" stroke="hsl(220, 60%, 50%)" fill="url(#hourlyGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5 border-border">
        <h3 className="font-semibold text-sm mb-4">Vendor Performance Rankings</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ANALYTICS_DATA.vendorPerformance} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip />
              <Bar dataKey="orders" fill="hsl(24, 80%, 50%)" radius={[0,4,4,0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}