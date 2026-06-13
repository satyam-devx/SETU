// ═══════════════════════════════════════════════════════════
// SETU — AdminMonitoring  (production — live DB)
// Replaces hardcoded mock data with real Supabase queries.
// Auto-refreshes every 30 s. Realtime subscriptions on orders
// and riders for instant updates.
// Route: /admin/monitoring
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle, AlertCircle, RefreshCw,
  Bike, ShoppingBag, HeadphonesIcon, ShieldAlert,
  TrendingUp, Users, IndianRupee, MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

function StatTile({ label, value, color = 'text-foreground', loading }) {
  return (
    <Card className="p-3 border-border text-center">
      <p className={`text-2xl font-bold ${color}`}>
        {loading ? '…' : value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </Card>
  );
}

export default function AdminMonitoring() {
  const [analytics,   setAnalytics]   = useState(null);
  const [villages,    setVillages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!analytics) setLoading(true);

    const [analyticsRes, villagesRes] = await Promise.all([
      AdminAPI.getLiveAnalytics(),
      AdminAPI.getVillages(),
    ]);

    if (analyticsRes.data)  setAnalytics(analyticsRes.data);
    if (villagesRes.data)   setVillages(villagesRes.data ?? []);
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [analytics]);

  // Initial load + 30 s auto-refresh
  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // Realtime: re-aggregate when orders or riders change
  useEffect(() => {
    const channel = supabase
      .channel('monitoring-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const a = analytics ?? {};

  // Build village network list from village data + analytics
  const villageNetwork = villages.slice(0, 6).map(v => ({
    name:     v.name,
    vendors:  v.activeVendors ?? 0,
    total:    v.totalVendors  ?? 0,
    orders:   v.totalOrders   ?? 0,
    health:   v.health        ?? 0,
    active:   v.is_active,
  }));

  // Simulated service health (can be wired to a health_checks table later)
  const services = [
    { name: 'Order API',            status: 'healthy'  },
    { name: 'Realtime / Websocket', status: 'healthy'  },
    { name: 'Notification Service', status: a.open_tickets > 10 ? 'degraded' : 'healthy' },
    { name: 'KYC Document Store',   status: 'healthy'  },
    { name: 'Payment Gateway',      status: 'healthy'  },
  ];

  return (
    <div className="flex-1 overflow-auto pb-6">
      <AppHeader
        title="Live Monitoring"
        subtitle={lastRefresh
          ? `Last updated ${lastRefresh.toLocaleTimeString('en-IN', { timeStyle: 'short' })}`
          : 'Loading…'}
        rightAction={
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load(true)}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* ── Live stats ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Active Orders"
            value={a.active_orders ?? 0}
            color="text-amber-600"
            loading={loading}
          />
          <StatTile
            label="Online Riders"
            value={a.online_riders ?? 0}
            color="text-green-600"
            loading={loading}
          />
          <StatTile
            label="Open Tickets"
            value={a.open_tickets ?? 0}
            color="text-blue-600"
            loading={loading}
          />
          <StatTile
            label="Pending Assign"
            value={a.pending_assign ?? 0}
            color={(a.pending_assign ?? 0) > 0 ? 'text-red-600' : 'text-foreground'}
            loading={loading}
          />
        </div>

        {/* ── Today summary ───────────────────────────── */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" /> Today's Summary
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold">{loading ? '…' : (a.today_total ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">Orders Placed</p>
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">
                {loading ? '…' : `₹${((a.today_revenue ?? 0)).toLocaleString('en-IN')}`}
              </p>
              <p className="text-[10px] text-muted-foreground">Revenue</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">
                {loading ? '…' : (a.new_today ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">New Users</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-green-600">{a.today_delivered ?? 0}</span> delivered
            </div>
            <div>
              <span className="font-semibold text-red-500">{a.today_cancelled ?? 0}</span> cancelled
            </div>
            <div>
              <span className="font-semibold text-primary">₹{((a.today_platform_fee ?? 0)).toLocaleString('en-IN')}</span> fee earned
            </div>
          </div>
        </Card>

        {/* ── Platform user counts ────────────────────── */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" /> Platform Snapshot
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Total Customers',  value: a.total_customers ?? 0 },
              { label: 'Verified Vendors', value: a.verified_vendors ?? 0 },
              { label: 'Pending Approval', value: a.pending_approval ?? 0, warn: true },
              { label: 'Active Riders',    value: a.active_riders ?? 0 },
              { label: 'Total COD Held',   value: `₹${((a.total_cod_held ?? 0)).toLocaleString('en-IN')}` },
              { label: 'Credit Outstanding', value: `₹${((a.total_outstanding ?? 0)).toLocaleString('en-IN')}` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-2 bg-muted/40 rounded-lg">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-semibold ${item.warn && item.value > 0 ? 'text-amber-600' : ''}`}>
                  {loading ? '…' : item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Service health ──────────────────────────── */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" /> Service Health
          </h3>
          <div className="space-y-2.5">
            {services.map(svc => (
              <div key={svc.name} className="flex items-center gap-3">
                {svc.status === 'healthy'
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                <span className="text-sm flex-1">{svc.name}</span>
                <Badge className={`text-[9px] border-0 ${
                  svc.status === 'healthy'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {svc.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Village network ──────────────────────────── */}
        {villageNetwork.length > 0 && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" /> Village Network Health
            </h3>
            <div className="space-y-3">
              {villageNetwork.map(v => (
                <div key={v.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.vendors}/{v.total} open · {v.orders} orders
                    </span>
                  </div>
                  <Progress value={v.active ? v.health : 0} className="h-1.5" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Payment mix ─────────────────────────────── */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <IndianRupee className="w-4 h-4 text-primary" /> Payment Mix (All Time)
          </h3>
          {loading ? (
            <div className="h-12 bg-muted rounded animate-pulse" />
          ) : (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: 'COD',    value: a.cod_orders    ?? 0 },
                { label: 'UPI',    value: a.upi_orders    ?? 0 },
                { label: 'Wallet', value: a.wallet_orders ?? 0 },
                { label: 'Credit', value: a.credit_orders ?? 0 },
              ].map(p => {
                const total = (a.cod_orders ?? 0) + (a.upi_orders ?? 0) + (a.wallet_orders ?? 0) + (a.credit_orders ?? 0);
                const pct   = total > 0 ? Math.round((p.value / total) * 100) : 0;
                return (
                  <div key={p.label} className="p-2 bg-muted/40 rounded-lg">
                    <p className="text-base font-bold">{pct}%</p>
                    <p className="text-muted-foreground">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground">{p.value} orders</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
