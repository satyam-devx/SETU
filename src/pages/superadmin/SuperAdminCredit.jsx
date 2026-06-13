// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminCredit  (v2 — Live DB)
// Fixed: reads real credit_accounts + credit_transactions
// joined with profiles for name/village data.
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback, useMemo } from 'react';
import {
  CreditCard, TrendingUp, AlertTriangle, Search,
  CheckCircle, RefreshCw, User, MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useDataFetch } from '@/hooks/useDataFetch';
import { supabase } from '@/lib/supabase';

function fmtK(n) {
  n = Number(n ?? 0);
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

async function fetchCreditData() {
  const [accountsRes, txnsRes] = await Promise.all([
    supabase
      .from('credit_accounts')
      .select('*, profiles!user_id(name, role, phone, villages(name))')
      .order('outstanding', { ascending: false })
      .limit(100),
    supabase
      .from('credit_transactions')
      .select('type, amount, created_at, status')
      .order('created_at', { ascending: true })
      .limit(500),
  ]);
  return { data: { accounts: accountsRes.data ?? [], txns: txnsRes.data ?? [] } };
}

const STATUS_STYLE = {
  active:    'bg-green-100 text-green-700',
  suspended: 'bg-amber-100 text-amber-700',
  closed:    'bg-gray-100 text-gray-600',
};

export default function SuperAdminCredit() {
  const [tab,   setTab]   = useState('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, error, refetch } = useDataFetch(
    fetchCreditData,
    [],
    { cacheKey: 'superadmin-credit', staleTime: 30_000 }
  );

  const accounts = data?.accounts ?? [];
  const txns     = data?.txns     ?? [];

  // Disbursement vs repayment trend by month
  const trendData = useMemo(() => {
    const map = {};
    txns.forEach(t => {
      const month = new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      map[month] = map[month] ?? { month, disbursed: 0, repaid: 0 };
      if (t.type === 'disbursement') map[month].disbursed += Number(t.amount ?? 0);
      if (t.type === 'repayment')    map[month].repaid    += Number(t.amount ?? 0);
    });
    return Object.values(map);
  }, [txns]);

  const totalOutstanding = accounts.reduce((s, a) => s + Number(a.outstanding ?? 0), 0);
  const totalLimit       = accounts.reduce((s, a) => s + Number(a.credit_limit ?? 0), 0);
  const atRiskCount      = accounts.filter(a => a.status !== 'active').length;
  const avgScore         = accounts.length
    ? Math.round(accounts.reduce((s, a) => s + (a.score ?? 500), 0) / accounts.length)
    : 0;

  const filtered = accounts.filter(a => {
    const name = a.profiles?.name ?? '';
    const matchQ = !query || name.toLowerCase().includes(query.toLowerCase()) ||
      (a.profiles?.phone ?? '').includes(query);
    if (tab === 'at_risk') return matchQ && a.status !== 'active';
    if (tab === 'healthy') return matchQ && a.status === 'active';
    return matchQ;
  });

  return (
    <div className="flex-1 overflow-auto pb-6">
      <AppHeader
        title="Credit Management"
        subtitle="SETU credit accounts"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Total Outstanding" value={isLoading ? '…' : fmtK(totalOutstanding)} icon={CreditCard} />
          <StatCard title="At Risk Accounts"  value={isLoading ? '…' : String(atRiskCount)}    icon={AlertTriangle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Avg Credit Score" value={isLoading ? '…' : String(avgScore)} icon={TrendingUp} />
          <StatCard
            title="Portfolio Utilisation"
            value={isLoading ? '…' : totalLimit > 0 ? `${Math.round((totalOutstanding / totalLimit) * 100)}%` : '0%'}
            icon={CheckCircle}
          />
        </div>

        {/* Trend chart */}
        {!isLoading && trendData.length > 0 && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3">Disbursement vs Repayment</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="disbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="repaidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(150, 40%, 40%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(150, 40%, 40%)" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v, k) => [fmtK(v), k === 'disbursed' ? 'Disbursed' : 'Repaid']} />
                  <Area type="monotone" dataKey="disbursed" stroke="hsl(var(--primary))"  strokeWidth={2} fill="url(#disbGrad)"  />
                  <Area type="monotone" dataKey="repaid"    stroke="hsl(150, 40%, 40%)"  strokeWidth={2} fill="url(#repaidGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 text-xs mt-1">
              <span className="flex items-center gap-1"><div className="w-3 h-1.5 rounded bg-primary" /> Disbursed</span>
              <span className="flex items-center gap-1"><div className="w-3 h-1.5 rounded" style={{background:'hsl(150,40%,40%)'}} /> Repaid</span>
            </div>
          </Card>
        )}

        {/* Search + tabs */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"     className="text-xs">All ({accounts.length})</TabsTrigger>
            <TabsTrigger value="healthy" className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="at_risk" className="text-xs">At Risk</TabsTrigger>
          </TabsList>
        </Tabs>

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message}</p>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="p-6 border-border text-center">
            <p className="text-sm text-muted-foreground">
              {accounts.length === 0 ? 'No credit accounts yet' : 'No accounts match your filter'}
            </p>
          </Card>
        )}

        <div className="space-y-2">
          {filtered.map(a => {
            const utilPct = a.credit_limit > 0
              ? Math.round((a.outstanding / a.credit_limit) * 100)
              : 0;
            const profile = a.profiles ?? {};
            return (
              <Card key={a.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{profile.name ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {profile.role ?? '—'}{profile.villages?.name ? ` · ${profile.villages.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold">{fmtK(a.outstanding)}</p>
                    <Badge className={`text-[9px] border-0 ${STATUS_STYLE[a.status] ?? ''}`}>{a.status}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Utilisation: {utilPct}%</span>
                    <span>Limit: {fmtK(a.credit_limit)}</span>
                  </div>
                  <Progress value={utilPct} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-muted-foreground">Score: <span className="font-bold text-foreground">{a.score}</span></span>
                  <span className="text-muted-foreground">Repay rate: <span className={`font-bold ${a.repayment_rate >= 90 ? 'text-green-600' : 'text-amber-600'}`}>{Number(a.repayment_rate ?? 0).toFixed(0)}%</span></span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
