// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Feature Flags
//
// Enable/disable platform modules instantly and stage rollouts — no
// deploy. All writes go through set_feature_flag / upsert_feature_flag
// (feature_flags.manage, audited server-side). Real data only.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Flag, Loader2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FeatureFlagsAPI } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { useFeatureFlags } from '@/lib/featureFlags';

export default function SuperAdminFeatureFlags() {
  const { can } = usePermissions();
  const { reload: reloadFlags } = useFeatureFlags();
  const allowed = can('feature_flags.manage');

  const [flags, setFlags]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(null);   // key currently saving
  const [saveError, setSaveError] = useState(null);
  const [rollouts, setRollouts]   = useState({}); // local edits before save

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
    });
    if (e) setSaveError(e.message ?? 'Failed to update rollout');
    else { setFlags(fs => fs.map(f => f.key === flag.key ? { ...f, rollout_percent: rollout } : f)); reloadFlags(); }
    setSaving(null);
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto" role="main">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Feature Flags</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Turn modules on/off instantly and stage rollouts. Changes apply platform-wide and are audit-logged.
        </p>
      </div>

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
      ) : flags.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">No feature flags configured.</div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {saveError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{saveError}</p>
            </div>
          )}

          {flags.map(flag => {
            const rolloutVal = rollouts[flag.key] ?? flag.rollout_percent;
            const rolloutDirty = Number(rolloutVal) !== flag.rollout_percent;
            const audienceRoles = flag.audience?.roles;
            return (
              <Card key={flag.key} className="p-4 border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{flag.name}</p>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
