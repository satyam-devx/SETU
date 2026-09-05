// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Feature Flags
//
// Enable/disable platform modules instantly and stage rollouts — no
// deploy. All writes go through set_feature_flag / upsert_feature_flag /
// kill_switch (feature_flags.manage, audited server-side). Real data only.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, Lock, Siren, History, Plus, ChevronDown, ChevronUp, WifiOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { FeatureFlagsAPI } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { useFeatureFlags } from '@/lib/featureFlags';

const EMPTY_NEW_FLAG = { key: '', name: '', description: '', rollout: 100, isKillSwitch: false };

export default function SuperAdminFeatureFlags() {
  const { can } = usePermissions();
  const { reload: reloadFlags, isStale } = useFeatureFlags();
  const allowed = can('feature_flags.manage');

  const [flags, setFlags]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(null);   // key currently saving
  const [saveError, setSaveError] = useState(null);
  const [rollouts, setRollouts]   = useState({}); // local edits before save

  // Kill switch — reason prompt state
  const [killSwitchKey, setKillSwitchKey] = useState(null);
  const [killSwitchReason, setKillSwitchReason] = useState('');

  // Audit history — expand-per-flag state
  const [historyOpenKey, setHistoryOpenKey] = useState(null);
  const [historyByKey, setHistoryByKey] = useState({});
  const [historyLoading, setHistoryLoading] = useState(null);

  // Create-new-flag form
  const [showCreate, setShowCreate] = useState(false);
  const [newFlag, setNewFlag] = useState(EMPTY_NEW_FLAG);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await FeatureFlagsAPI.list();
    if (e) { setError('Could not load feature flags. Tap retry.'); setLoading(false); return; }
    setFlags(data ?? []);
    setRollouts(Object.fromEntries((data ?? []).map(f => [f.key, f.rollout_percent])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (flag, next) => {
    setSaving(flag.key);
    setSaveError(null);
    setFlags(fs => fs.map(f => f.key === flag.key ? { ...f, enabled: next } : f)); // optimistic
    const { error: e } = await FeatureFlagsAPI.set(flag.key, next);
    if (e) {
      setFlags(fs => fs.map(f => f.key === flag.key ? { ...f, enabled: !next } : f)); // revert
      setSaveError(e.message ?? 'Failed to update flag');
    } else {
      reloadFlags(); // refresh app-wide evaluated set
    }
    setSaving(null);
  };

  const saveRollout = async (flag) => {
    const rollout = Math.max(0, Math.min(100, Number(rollouts[flag.key] ?? flag.rollout_percent)));
    setSaving(flag.key);
    setSaveError(null);
    const { error: e } = await FeatureFlagsAPI.upsert({
      key: flag.key, name: flag.name, description: flag.description,
      enabled: flag.enabled, rollout, audience: flag.audience ?? null,
      isKillSwitch: flag.is_kill_switch ?? false,
    });
    if (e) setSaveError(e.message ?? 'Failed to update rollout');
    else { setFlags(fs => fs.map(f => f.key === flag.key ? { ...f, rollout_percent: rollout } : f)); reloadFlags(); }
    setSaving(null);
  };

  const confirmKillSwitch = async (flag) => {
    if (!killSwitchReason.trim()) return;
    setSaving(flag.key);
    setSaveError(null);
    const { error: e } = await FeatureFlagsAPI.killSwitch(flag.key, killSwitchReason.trim());
    if (e) {
      setSaveError(e.message ?? 'Kill switch failed');
    } else {
      setFlags(fs => fs.map(f => f.key === flag.key ? { ...f, enabled: false } : f));
      reloadFlags();
      setKillSwitchKey(null);
      setKillSwitchReason('');
    }
    setSaving(null);
  };

  const toggleHistory = async (key) => {
    if (historyOpenKey === key) { setHistoryOpenKey(null); return; }
    setHistoryOpenKey(key);
    if (!historyByKey[key]) {
      setHistoryLoading(key);
      const { data } = await FeatureFlagsAPI.history(key, 15);
      setHistoryByKey(h => ({ ...h, [key]: Array.isArray(data) ? data : [] }));
      setHistoryLoading(null);
    }
  };

  const createFlag = async () => {
    const key = newFlag.key.trim().toLowerCase();
    if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) {
      setSaveError('Flag key must be lowercase snake_case (e.g. new_checkout_flow)');
      return;
    }
    setSaving('__create__');
    setSaveError(null);
    const { error: e } = await FeatureFlagsAPI.upsert({
      key, name: newFlag.name.trim() || key, description: newFlag.description.trim() || null,
      enabled: true, rollout: Math.max(0, Math.min(100, Number(newFlag.rollout) || 0)),
      isKillSwitch: newFlag.isKillSwitch, reason: 'created via admin UI',
    });
    if (e) {
      setSaveError(e.message ?? 'Failed to create flag');
    } else {
      setNewFlag(EMPTY_NEW_FLAG);
      setShowCreate(false);
      reloadFlags();
      load();
    }
    setSaving(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-24" role="main">
      <AppHeader
        title="Feature Flags"
        subtitle="Toggle modules & stage rollouts · applied platform-wide, audit-logged"
        rightAction={
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowCreate(s => !s)} aria-label="New feature flag">
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load} aria-label="Refresh feature flags">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      <div className="max-w-2xl mx-auto">
      {isStale && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            Showing the last known configuration — couldn't reach the server for a fresh copy just now.
          </p>
        </div>
      )}

      {!allowed ? (
        <div className="flex flex-col items-center gap-3 py-20 px-6 text-center" role="alert">
          <Lock className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You don’t have permission to manage feature flags.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 px-6 text-center" role="alert">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {saveError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{saveError}</p>
            </div>
          )}

          {showCreate && (
            <Card className="p-4 border-primary/30 bg-primary/[0.03] space-y-3">
              <p className="text-sm font-semibold">New feature flag</p>
              <Input
                placeholder="key_in_snake_case"
                value={newFlag.key}
                onChange={e => setNewFlag(f => ({ ...f, key: e.target.value }))}
                className="h-9 font-mono text-xs"
              />
              <Input
                placeholder="Display name"
                value={newFlag.name}
                onChange={e => setNewFlag(f => ({ ...f, name: e.target.value }))}
                className="h-9"
              />
              <Textarea
                placeholder="Description (optional)"
                value={newFlag.description}
                onChange={e => setNewFlag(f => ({ ...f, description: e.target.value }))}
                className="min-h-16 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-20 shrink-0">Rollout %</label>
                <Input
                  type="number" min={0} max={100}
                  value={newFlag.rollout}
                  onChange={e => setNewFlag(f => ({ ...f, rollout: e.target.value }))}
                  className="h-9 w-24"
                />
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Kill-switch critical
                  <Switch checked={newFlag.isKillSwitch} onCheckedChange={v => setNewFlag(f => ({ ...f, isKillSwitch: v }))} />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setNewFlag(EMPTY_NEW_FLAG); }}>Cancel</Button>
                <Button size="sm" disabled={saving === '__create__'} onClick={createFlag} className="gap-2">
                  {saving === '__create__' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create flag
                </Button>
              </div>
            </Card>
          )}

          {flags.length === 0 && !showCreate && (
            <div className="py-20 text-center text-sm text-muted-foreground">No feature flags configured.</div>
          )}

          {flags.map(flag => {
            const rolloutVal = rollouts[flag.key] ?? flag.rollout_percent;
            const rolloutDirty = Number(rolloutVal) !== flag.rollout_percent;
            const audienceRoles = flag.audience?.roles;
            const isKillPromptOpen = killSwitchKey === flag.key;
            const isHistoryOpen = historyOpenKey === flag.key;

            return (
              <Card key={flag.key} className={`p-4 ${flag.is_kill_switch ? 'border-destructive/30' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold">{flag.name}</p>
                      {flag.is_kill_switch && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive">
                          <Siren className="h-2.5 w-2.5" /> Critical
                        </span>
                      )}
                      {!flag.enabled && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          Off
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">{flag.key}</p>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {saving === flag.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={flag.enabled}
                      disabled={saving === flag.key}
                      onCheckedChange={(v) => toggle(flag, v)}
                      aria-label={`Enable ${flag.name}`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-20 shrink-0">Rollout %</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={rolloutVal}
                    disabled={!flag.enabled || saving === flag.key}
                    onChange={e => setRollouts(r => ({ ...r, [flag.key]: e.target.value }))}
                    className="h-9 w-24"
                  />
                  {rolloutDirty && (
                    <Button size="sm" className="h-9 text-xs" disabled={saving === flag.key} onClick={() => saveRollout(flag)}>
                      Save
                    </Button>
                  )}
                  {Array.isArray(audienceRoles) && audienceRoles.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      Audience: {audienceRoles.join(', ')}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                  {flag.enabled && (
                    <button
                      type="button"
                      onClick={() => { setKillSwitchKey(flag.key); setKillSwitchReason(''); }}
                      disabled={saving === flag.key}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                    >
                      <Siren className="h-3.5 w-3.5" /> Kill switch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleHistory(flag.key)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <History className="h-3.5 w-3.5" /> History
                    {isHistoryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {isKillPromptOpen && (
                  <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive">
                      This immediately disables "{flag.name}" for everyone. Why?
                    </p>
                    <Input
                      autoFocus
                      placeholder="Reason (required) — e.g. checkout errors spiking"
                      value={killSwitchReason}
                      onChange={e => setKillSwitchReason(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setKillSwitchKey(null)}>Cancel</Button>
                      <Button
                        size="sm" variant="destructive"
                        disabled={!killSwitchReason.trim() || saving === flag.key}
                        onClick={() => confirmKillSwitch(flag)}
                      >
                        Disable now
                      </Button>
                    </div>
                  </div>
                )}

                {isHistoryOpen && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                    {historyLoading === flag.key ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                    ) : (historyByKey[flag.key] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No history yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {(historyByKey[flag.key] ?? []).map((h, i) => (
                          <li key={i} className="text-xs border-l-2 border-border pl-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-semibold ${h.action === 'kill_switch' ? 'text-destructive' : 'text-foreground'}`}>
                                {h.action === 'kill_switch' ? '🛑 Kill switch' : h.action}
                              </span>
                              <span className="text-muted-foreground">by {h.changed_by_name ?? 'system'}</span>
                              <span className="text-muted-foreground ml-auto">
                                {h.changed_at ? new Date(h.changed_at).toLocaleString() : ''}
                              </span>
                            </div>
                            {h.reason && <p className="text-muted-foreground mt-0.5">"{h.reason}"</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
