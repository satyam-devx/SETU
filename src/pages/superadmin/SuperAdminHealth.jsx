// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminHealth  (v3 — Live DB, honest status)
// Real platform stats from getLiveAnalytics + measured DB round-trip
// and real connectivity checks for Auth & Database. Services whose
// health the client SDK genuinely cannot probe (Edge Functions,
// Storage, Realtime) are shown as "n/a" rather than a fake "up".
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { Activity, Server, Database, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Platform components. `key` identifies the ones we can actually
// probe from the browser SDK; the rest are shown as "n/a".
const SERVICES = [
  { name: 'Supabase Auth',     key: 'auth' },
  { name: 'Supabase Database', key: 'db'   },
  { name: 'Edge Functions',    key: null   },
  { name: 'Supabase Storage',  key: null   },
  { name: 'Realtime',          key: null   },
];

const STATUS_DOT = { up: 'bg-green-500', down: 'bg-red-500', na: 'bg-muted-foreground/40' };
const STATUS_BADGE = {
  up:   'bg-green-100 text-green-700',
  down: 'bg-red-100 text-red-700',
  na:   'bg-muted text-muted-foreground',
};
const STATUS_LABEL = { up: 'up', down: 'down', na: 'n/a' };

export default function SuperAdminHealth() {
  const [stats,      setStats]      = useState(null);
  const [dbHealth,   setDbHealth]   = useState(null); // ms for a simple DB round-trip
  const [services,   setServices]   = useState({ auth: 'na', db: 'na' });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    const t0 = Date.now();
    const [statsRes, pingRes, sessionRes] = await Promise.all([
      AdminAPI.getStats(),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.auth.getSession(),
    ]);
    const pingMs = Date.now() - t0;

    if (statsRes.data) setStats(statsRes.data);
    setError(statsRes.error ?? pingRes.error ?? null);
    setDbHealth(pingRes.error ? null : pingMs);
    setServices({
      db:   pingRes.error    ? 'down' : 'up',
      auth: sessionRes.error ? 'down' : 'up',
    });

    setLoading(false);
    setRefreshing(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const s = stats ?? {};

  // Derived health score from real signals
  const healthScore = (() => {
    let score = 100;
    if (services.db === 'down')       score -= 50;
    if (services.auth === 'down')     score -= 20;
    if ((s.pendingAssign ?? 0) > 10)  score -= 10;
    if ((s.pendingVendors ?? 0) > 20) score -= 10;
    if ((dbHealth ?? 0) > 500)        score -= 15;
    else if ((dbHealth ?? 0) > 200)   score -= 5;
    return Math.max(0, score);
  })();

  return (
    <div className="pb-6">
      <AppHeader
        title="Platform Health"
        subtitle="Live infrastructure status"
        rightAction={
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load(true)} aria-label="Refresh platform health">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-lg">

        {/* Error */}
        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load platform metrics.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => load(true)}>Retry</Button>
          </Card>
        )}

        {/* Top stats */}
        <div className="grid grid-cols-2 gap-2">
          <Card className={`p-3 border text-center ${healthScore >= 90 ? 'border-green-200 bg-green-50/40' : healthScore >= 70 ? 'border-amber-200 bg-amber-50/40' : 'border-red-200 bg-red-50/40'}`}>
            {loading
              ? <div className="h-8 bg-muted rounded animate-pulse mb-1" />
              : <p className={`text-2xl font-bold ${healthScore >= 90 ? 'text-green-600' : healthScore >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{healthScore}</p>
            }
            <p className="text-xs text-muted-foreground">Health Score</p>
          </Card>
          <Card className="p-3 border-border text-center">
            {loading
              ? <div className="h-8 bg-muted rounded animate-pulse mb-1" />
              : <p className="text-2xl font-bold">{dbHealth != null ? `${dbHealth}ms` : '—'}</p>
            }
            <p className="text-xs text-muted-foreground">DB Round-trip</p>
          </Card>
        </div>

        {/* Live platform metrics */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Live Platform Metrics
          </h3>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Active Orders',    value: s.activeOrders   ?? 0 },
                { label: 'Today Orders',     value: s.todayOrders    ?? 0 },
                { label: 'Today Revenue',    value: `₹${Number(s.todayRevenue ?? 0).toLocaleString('en-IN')}` },
                { label: 'Online Riders',    value: s.onlineRiders   ?? 0 },
                { label: 'Total Vendors',    value: s.totalVendors   ?? 0 },
                { label: 'Pending Assign',   value: s.pendingAssign  ?? 0 },
                { label: 'Open Tickets',     value: s.openTickets    ?? 0 },
                { label: 'KYC Queue',        value: s.kycPending     ?? 0 },
              ].map(item => (
                <div key={item.label} className="p-2.5 bg-muted/40 rounded-lg">
                  <p className="text-muted-foreground text-[10px]">{item.label}</p>
                  <p className="font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Services — real connectivity where probeable */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> Supabase Services
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">
            Auth & Database reflect live connectivity. Edge Functions, Storage and
            Realtime can't be probed from the browser SDK and are shown as n/a.
          </p>
          <div className="space-y-2">
            {SERVICES.map(svc => {
              const status = loading ? 'na' : (svc.key ? services[svc.key] : 'na');
              return (
                <div key={svc.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${loading ? 'bg-muted animate-pulse' : STATUS_DOT[status]}`} />
                  <span className="text-sm flex-1">{svc.name}</span>
                  {!loading && (
                    <Badge className={`text-[9px] border-0 ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* DB metrics */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Database
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-muted/40 rounded-lg">
              <p className="text-muted-foreground text-[10px]">Round-trip latency</p>
              <p className="font-semibold text-sm">{loading ? '…' : dbHealth != null ? `${dbHealth}ms` : '—'}</p>
            </div>
            <div className="p-2.5 bg-muted/40 rounded-lg">
              <p className="text-muted-foreground text-[10px]">Status</p>
              <p className={`font-semibold text-sm ${services.db === 'down' ? 'text-red-600' : 'text-green-600'}`}>
                {loading ? '…' : services.db === 'down' ? 'Disconnected' : 'Connected'}
              </p>
            </div>
            <div className="p-2.5 bg-muted/40 rounded-lg col-span-2">
              <p className="text-muted-foreground text-[10px] mb-1">
                DB Latency — {loading ? 'measuring…' : dbHealth != null ? `${dbHealth}ms round-trip` : 'unavailable'}
              </p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (dbHealth ?? 0) < 100 ? 'bg-green-500' :
                    (dbHealth ?? 0) < 300 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, ((dbHealth ?? 0) / 500) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Alert thresholds */}
        {!loading && (
          <>
            {(s.pendingAssign ?? 0) > 5 && (
              <Card className="p-3 border-amber-200 bg-amber-50/40 text-sm text-amber-800">
                ⚠️ {s.pendingAssign} orders waiting for rider assignment
              </Card>
            )}
            {(s.pendingVendors ?? 0) > 0 && (
              <Card className="p-3 border-blue-200 bg-blue-50/40 text-sm text-blue-800">
                ℹ️ {s.pendingVendors} vendors pending approval
              </Card>
            )}
            {(dbHealth ?? 0) > 300 && (
              <Card className="p-3 border-red-200 bg-red-50/40 text-sm text-red-800">
                🔴 High DB latency ({dbHealth}ms) — check Supabase dashboard
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
