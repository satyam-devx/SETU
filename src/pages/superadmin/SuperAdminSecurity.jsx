// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Security Center
//
// Real, audited security operations:
//   • Overview: blocked users, security events, payment mismatches,
//     role changes (last 24h) — get_security_overview()
//   • Blocked Users: list_blocked_users() + unban (users.update)
//   • Security Events: get_security_events() — immutable audit feed of
//     bans, role/permission changes, config changes, payment anomalies
// All data is live from the database; no mock content.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Ban, AlertTriangle, KeyRound, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatCard from '@/components/shared/StatCard';
import { SecurityAPI } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

const ACTION_LABELS = {
  ban_user: 'User banned', unban_user: 'User unbanned',
  assign_role: 'Role changed', role_created: 'Role created',
  permission_granted: 'Permission granted', permission_revoked: 'Permission revoked',
  permission_created: 'Permission created', setting_updated: 'Setting changed',
  feature_flag_enabled: 'Feature enabled', feature_flag_disabled: 'Feature disabled',
  feature_flag_upsert: 'Feature flag changed', payment_amount_mismatch: 'Payment mismatch',
  payment_event_stuck: 'Payment stuck',
};
const DANGER_ACTIONS = new Set(['payment_amount_mismatch', 'payment_event_stuck', 'ban_user']);

export default function SuperAdminSecurity() {
  const [tab, setTab]         = useState('blocked');
  const [overview, setOverview] = useState(null);
  const [blocked, setBlocked]   = useState([]);
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [acting, setActing]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ovRes, blkRes, evRes] = await Promise.all([
      SecurityAPI.overview(),
      SecurityAPI.blockedUsers(),
      SecurityAPI.events(50),
    ]);
    if (ovRes.error && blkRes.error && evRes.error) {
      setError('Could not load security data. Tap retry.');
      setLoading(false);
      return;
    }
    setOverview(ovRes.data ?? null);
    setBlocked(blkRes.data ?? []);
    setEvents(Array.isArray(evRes.data) ? evRes.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unban = async (userId) => {
    setActing(userId);
    await SecurityAPI.unban(userId);
    await load();
    setActing(null);
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto" role="main">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Security Center</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Blocked users and the immutable security event log.</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Overview */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Blocked Users"    value={loading ? '…' : String(overview?.blocked_users ?? 0)}          icon={Ban} />
          <StatCard title="Events (24h)"     value={loading ? '…' : String(overview?.security_events_24h ?? 0)}    icon={Shield} />
          <StatCard title="Pay Mismatch 24h" value={loading ? '…' : String(overview?.payment_mismatches_24h ?? 0)} icon={AlertTriangle} />
          <StatCard title="Role Changes 24h" value={loading ? '…' : String(overview?.role_changes_24h ?? 0)}       icon={KeyRound} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="blocked" className="text-xs">Blocked ({blocked.length})</TabsTrigger>
            <TabsTrigger value="events"  className="text-xs">Security Events</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-16" role="status"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center" role="alert">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Retry</Button>
          </div>
        ) : tab === 'blocked' ? (
          blocked.length === 0 ? (
            <Card className="p-6 text-center border-border">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No blocked users — platform is clean.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {blocked.map(u => (
                <Card key={u.id} className="p-3 border-border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.phone || u.role}</p>
                    {u.ban_reason && <p className="text-[10px] text-destructive truncate">Reason: {u.ban_reason}</p>}
                    {u.banned_at && <p className="text-[10px] text-muted-foreground">{timeAgo(u.banned_at)}</p>}
                  </div>
                  <Button size="sm" variant="outline" disabled={acting === u.id} onClick={() => unban(u.id)} className="shrink-0">
                    {acting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Unban'}
                  </Button>
                </Card>
              ))}
            </div>
          )
        ) : (
          events.length === 0 ? (
            <Card className="p-6 text-center border-border">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No security events recorded.</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {events.map(e => (
                <Card key={e.id} className={`p-3 border-border ${DANGER_ACTIONS.has(e.action) ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ACTION_LABELS[e.action] ?? e.action}</p>
                      {e.detail && <p className="text-xs text-muted-foreground break-words">{e.detail}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">by {e.actor} · {timeAgo(e.created_at)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
