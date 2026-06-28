// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Configuration
//
// Fully DATA-DRIVEN settings editor. The form is generated from the
// platform_config metadata (group / data_type / label) — there is NO
// hardcoded schema. Each save goes through set_setting() (validated +
// audited, gated by settings.update). Adding a new setting in the DB
// makes it appear here automatically.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, Check, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { SettingsAPI } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { usePublicSettings } from '@/lib/settings';

const GROUP_LABELS = {
  branding: 'Branding', support: 'Support', social: 'Social Links',
  content: 'Legal & Content', auth: 'Registration & Auth', flags: 'Maintenance',
  fees: 'Fees & Commission', limits: 'Limits', general: 'General',
};

export default function SuperAdminConfig() {
  const { can } = usePermissions();
  const { reload: reloadPublic } = usePublicSettings();
  const allowed = can('settings.update');

  const [rows, setRows]       = useState([]);
  const [draft, setDraft]     = useState({});   // key -> edited value
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [savedKey, setSavedKey]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await SettingsAPI.getAll();
    if (e) { setError('Could not load settings. Tap retry.'); setLoading(false); return; }
    setRows(data ?? []);
    setDraft(Object.fromEntries((data ?? []).map(r => [r.key, r.value])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = {};
    for (const r of rows) (map[r.group_name] ??= []).push(r);
    return Object.entries(map);
  }, [rows]);

  const save = async (row, value) => {
    setSaving(row.key);
    setSaveError(null);
    setSavedKey(null);
    const { error: e } = await SettingsAPI.set(row.key, value);
    if (e) {
      setSaveError(`${row.label || row.key}: ${e.message ?? 'save failed'}`);
    } else {
      setRows(rs => rs.map(r => r.key === row.key ? { ...r, value: String(value) } : r));
      setSavedKey(row.key);
      reloadPublic(); // refresh public settings (branding/maintenance) app-wide
      setTimeout(() => setSavedKey(k => (k === row.key ? null : k)), 1500);
    }
    setSaving(null);
  };

  const renderField = (row) => {
    const value = draft[row.key] ?? '';
    const dirty = String(value) !== String(row.value);

    if (row.data_type === 'boolean') {
      const on = row.value === 'true';
      return (
        <Switch
          checked={on}
          disabled={saving === row.key}
          onCheckedChange={(v) => save(row, v ? 'true' : 'false')}
          aria-label={row.label || row.key}
        />
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Input
          type={row.data_type === 'number' ? 'number' : 'text'}
          value={value}
          disabled={saving === row.key}
          onChange={e => setDraft(d => ({ ...d, [row.key]: e.target.value }))}
          placeholder={row.data_type === 'color' ? '#RRGGBB' : row.data_type === 'url' ? 'https://…' : ''}
          className="h-9 w-44"
        />
        {row.data_type === 'color' && /^#[0-9a-fA-F]{6}$/.test(value) && (
          <span className="w-6 h-6 rounded border border-border shrink-0" style={{ background: value }} />
        )}
        {saving === row.key
          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          : dirty && <Button size="sm" className="h-9 text-xs" onClick={() => save(row, value)}>Save</Button>}
        {savedKey === row.key && <Check className="w-4 h-4 text-green-600" aria-label="saved" />}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-auto pb-24" role="main">
      <AppHeader
        title="Configuration"
        subtitle="Platform settings · applied without redeploy, audit-logged"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load} aria-label="Refresh settings">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="max-w-2xl mx-auto">
      {!allowed ? (
        <div className="flex flex-col items-center gap-3 py-20 px-6 text-center" role="alert">
          <Lock className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You don’t have permission to edit settings.</p>
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
      ) : rows.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">No settings configured.</div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {saveError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{saveError}</p>
            </div>
          )}
          {groups.map(([group, list]) => (
            <Card key={group} className="p-4 border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {GROUP_LABELS[group] ?? group}
              </p>
              <div className="space-y-3">
                {list.map(row => (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.label || row.key}</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">
                        {row.key}{row.is_public ? '' : ' · admin-only'}
                      </p>
                    </div>
                    <div className="shrink-0">{renderField(row)}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
