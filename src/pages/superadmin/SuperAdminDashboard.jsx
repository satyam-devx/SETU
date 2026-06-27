// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminDashboard  (v2 — Live DB)
// Fixed: all mock data replaced with real API calls.
// Sources: getLiveAnalytics, getAuditLog, getRevenueAnalytics
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe, IndianRupee, Users, Store, Activity,
  CreditCard, AlertTriangle, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { AdminAPI } from '@/lib/api';

function fmtCurrency(n) {
  n = Number(n ?? 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function SuperAdminDashboard() {
  const [stats,      setStats]      = useState(null);
  const [revenue,    setRevenue]    = useState(null);
  const [auditLog,   setAuditLog]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    const [liveRes, revenueRes, auditRes] = await Promise.all([
      AdminAPI.getLiveAnalytics(),
      AdminAPI.getRevenueAnalytics({ days: 30 }),
      AdminAPI.getAuditLog({ limit: 5 }),
    ]);

    if (liveRes.data)    setStats(liveRes.data);
    if (revenueRes.data) setRevenue(revenueRes.data);
    if (auditRes.data)   setAuditLog(auditRes.data ?? []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Daily GMV trend (pre-aggregated server-side; see migration 047)
  const gmvByDay = React.useMemo(() => {
    return (revenue?.daily ?? []).slice(-14).map(d => ({
      date: new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      gmv:  Number(d.revenue ?? 0),
    }));
  }, [revenue]);

  const totalGMV = Number(revenue?.total_revenue ?? 0);
  const s = stats ?? {};

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-heading">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">SETU Control Center · All blocks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {(s.pendingVendors > 0 || s.pendingAssign > 0) && (
            <Badge className="bg-destructive text-destructive-foreground text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {(s.pendingVendors ?? 0) + (s.pendingAssign ?? 0)} alerts
            </Badge>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => load(true)}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <StatCard
          title="GMV (30 days)"
          value={loading ? '…' : fmtCurrency(totalGMV)}
          icon={IndianRupee}
        />
        <StatCard
          title="Active Orders"
          value={loading ? '…' : String(s.activeOrders ?? 0)}
          subtitle={`${s.todayOrders ?? 0} today`}
          icon={Activity}
        />
        <StatCard
          title="Total Vendors"
          value={loading ? '…' : String(s.totalVendors ?? 0)}
          subtitle={s.pendingVendors > 0 ? `${s.pendingVendors} pending` : 'verified'}
          icon={Store}
        />
        <StatCard
          title="Online Riders"
          value={loading ? '…' : String(s.onlineRiders ?? 0)}
          subtitle={`of ${s.totalRiders ?? 0} total`}
          icon={Users}
        />
      </div>

      {/* GMV Chart */}
      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-primary" /> GMV Trend (30 days)
        </h3>
        {loading ? (
          <div className="h-44 bg-muted rounded animate-pulse" />
        ) : gmvByDay.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
            No revenue data yet
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gmvByDay}>
                <defs>
                  <linearGradient id="saGmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide tickFormatter={v => fmtCurrency(v)} />
                <Tooltip formatter={v => [fmtCurrency(v), 'GMV']} />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke="hsl(var(--primary))"
                  fill="url(#saGmvGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Quick links + Audit log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Quick actions */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Vendor Approvals', path: '/admin/vendor-approval', badge: s.pendingVendors, icon: Store },
              { label: 'KYC Review Queue', path: '/admin/kyc',             badge: s.kycPending,     icon: ShieldAlert },
              { label: 'User Management',  path: '/superadmin/users',      badge: null,             icon: Users },
              { label: 'Platform Config',  path: '/superadmin/config',     badge: null,             icon: Activity },
              { label: 'Fraud & Security', path: '/superadmin/security',   badge: null,             icon: AlertTriangle },
              { label: 'Audit Log',        path: '/superadmin/audit',      badge: null,             icon: CreditCard },
            ].map(item => (
              <Link key={item.path} to={item.path}>
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <item.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <Badge className="text-[9px] bg-destructive text-white border-0 h-4 min-w-4 px-1">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent Audit Log */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Recent Audit Log</h3>
            <Link to="/superadmin/audit" className="text-xs text-primary">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
            </div>
          ) : auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No audit events yet</p>
          ) : (
            <div className="space-y-2">
              {auditLog.slice(0, 5).map((log, i) => (
                <div key={log.id ?? i} className="border-b border-border pb-2 last:border-0">
                  <p className="text-xs font-medium capitalize">
                    {(log.action ?? 'event').replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {log.profiles?.name ?? log.actor ?? 'system'} · {log.target ?? '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {relTime(log.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Platform stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Today Revenue',  value: loading ? '…' : fmtCurrency(s.todayRevenue) },
          { label: 'Pending Assign', value: loading ? '…' : String(s.pendingAssign ?? 0) },
          { label: 'Open Tickets',   value: loading ? '…' : String(s.openTickets   ?? 0) },
          { label: 'KYC Pending',    value: loading ? '…' : String(s.kycPending    ?? 0) },
        ].map(item => (
          <Card key={item.label} className="p-3 border-border text-center">
            <p className="text-lg font-bold">{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
