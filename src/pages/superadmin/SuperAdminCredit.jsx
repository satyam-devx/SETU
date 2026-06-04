import React, { useState } from 'react';
import { CreditCard, TrendingUp, Users, AlertTriangle, Search, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const CREDIT_TREND = [
  { month: 'Jan', disbursed: 180000, repaid: 120000 },
  { month: 'Feb', disbursed: 240000, repaid: 195000 },
  { month: 'Mar', disbursed: 310000, repaid: 280000 },
  { month: 'Apr', disbursed: 420000, repaid: 365000 },
  { month: 'May', disbursed: 580000, repaid: 490000 },
];

const ACCOUNTS = [
  { id: 'ca1', name: 'Meena Devi',   type: 'Customer', limit: 5000,  outstanding: 1200, score: 760, status: 'healthy',  repayRate: 100, village: 'Madhepur'  },
  { id: 'ca2', name: 'Ramesh Store', type: 'Vendor',   limit: 25000, outstanding: 12000,score: 720, status: 'healthy',  repayRate: 98,  village: 'Madhepur'  },
  { id: 'ca3', name: 'Suraj Kumar',  type: 'Rider',    limit: 3000,  outstanding: 2800, score: 580, status: 'at_risk',  repayRate: 72,  village: 'Laxmipur'  },
  { id: 'ca4', name: 'Priya Kumari', type: 'Customer', limit: 3000,  outstanding: 3000, score: 490, status: 'defaulted',repayRate: 45,  village: 'Parsad'    },
  { id: 'ca5', name: 'Bihar Fish Mkt',type:'Vendor',   limit: 15000, outstanding: 4500, score: 695, status: 'healthy',  repayRate: 97,  village: 'Jhanjharpur'},
];

const STATUS_STYLE = {
  healthy:   'bg-green-100 text-green-700',
  at_risk:   'bg-amber-100 text-amber-700',
  defaulted: 'bg-red-100 text-red-700',
};

export default function SuperAdminCredit() {
  const [tab, setTab]     = useState('all');
  const [query, setQuery] = useState('');

  const filtered = ACCOUNTS.filter(a => {
    const matchQ = !query || a.name.toLowerCase().includes(query.toLowerCase());
    if (tab === 'at_risk')   return matchQ && (a.status === 'at_risk' || a.status === 'defaulted');
    if (tab === 'healthy')   return matchQ && a.status === 'healthy';
    return matchQ;
  });

  const totalDisbursed   = ACCOUNTS.reduce((s, a) => s + a.outstanding, 0);
  const totalLimit       = ACCOUNTS.reduce((s, a) => s + a.limit, 0);
  const atRiskCount      = ACCOUNTS.filter(a => a.status !== 'healthy').length;
  const avgScore         = Math.round(ACCOUNTS.reduce((s, a) => s + a.score, 0) / ACCOUNTS.length);

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Credit Management" />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Total Outstanding" value={`₹${(totalDisbursed/1000).toFixed(0)}k`} icon={CreditCard} />
          <StatCard title="At Risk Accounts"  value={String(atRiskCount)} icon={AlertTriangle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Avg Credit Score" value={String(avgScore)} icon={TrendingUp} trend="↑12pts" trendUp />
          <StatCard title="Portfolio Health"  value={`${Math.round((totalDisbursed/totalLimit)*100)}%`} icon={CheckCircle} subtitle="utilization" />
        </div>

        {/* Trend chart */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Disbursement vs Repayment</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CREDIT_TREND}>
                <defs>
                  <linearGradient id="disbGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="repaidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v, k) => [`₹${(v/1000).toFixed(0)}k`, k === 'disbursed' ? 'Disbursed' : 'Repaid']} />
                <Area type="monotone" dataKey="disbursed" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#disbGrad)" />
                <Area type="monotone" dataKey="repaid"    stroke="hsl(var(--accent))"  strokeWidth={2} fill="url(#repaidGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs mt-2">
            <span className="flex items-center gap-1"><div className="w-3 h-1.5 rounded bg-primary" /> Disbursed</span>
            <span className="flex items-center gap-1"><div className="w-3 h-1.5 rounded bg-accent" /> Repaid</span>
          </div>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search accounts..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"     className="text-xs">All</TabsTrigger>
            <TabsTrigger value="healthy" className="text-xs">Healthy</TabsTrigger>
            <TabsTrigger value="at_risk" className="text-xs">At Risk</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {filtered.map(a => {
            const utilPct = Math.round((a.outstanding / a.limit) * 100);
            return (
              <Card key={a.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.type} · {a.village}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold">₹{a.outstanding.toLocaleString()}</p>
                    <Badge className={`text-[9px] border-0 ${STATUS_STYLE[a.status]}`}>{a.status}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Utilization: {utilPct}%</span>
                    <span>Limit: ₹{a.limit.toLocaleString()}</span>
                  </div>
                  <Progress value={utilPct} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-muted-foreground">Score: <span className="font-bold text-foreground">{a.score}</span></span>
                  <span className="text-muted-foreground">Repay rate: <span className={`font-bold ${a.repayRate >= 90 ? 'text-green-600' : 'text-amber-600'}`}>{a.repayRate}%</span></span>
                  {a.status !== 'healthy' && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px]">Review</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
