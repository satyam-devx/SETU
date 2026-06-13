// ═══════════════════════════════════════════════════════════
// SETU — AdminSettings  (v3 — production-grade)
// Dynamic platform settings from platform_settings table.
// All changes logged to audit_log with updated_by.
// Groups: branding · financials · orders · operations ·
//         features · kyc
// Route: /admin/settings
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Save, RefreshCw, Loader2,
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';

const GROUP_LABELS = {
  branding:    { label: 'Branding',       emoji: '🏷️' },
  financials:  { label: 'Financials',     emoji: '💰' },
  orders:      { label: 'Orders',         emoji: '📦' },
  operations:  { label: 'Operations',     emoji: '⚙️' },
  features:    { label: 'Feature Flags',  emoji: '🚩' },
  kyc:         { label: 'KYC & Compliance', emoji: '🪪' },
  general:     { label: 'General',        emoji: '🔧' },
};

async function fetchSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .order('key');
  return { data, error };
}

async function upsertSetting(key, value, updatedBy) {
  const { error } = await supabase
    .from('platform_settings')
    .update({ value: value, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (!error) {
    await supabase.from('audit_log').insert({
      actor_id:    updatedBy,
      actor:       'admin',
      action:      'update_setting',
      target:      key,
      target_type: 'setting',
      detail:      `Set ${key} = ${JSON.stringify(value)}`,
    });
  }
  return { error };
}

function SettingRow({ setting, onSave }) {
  const [localVal, setLocalVal] = useState(setting.value);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [err,      setErr]      = useState(null);

  useEffect(() => { setLocalVal(setting.value); }, [setting.value]);

  const isDirty = JSON.stringify(localVal) !== JSON.stringify(setting.value);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    const { error } = await onSave(setting.key, localVal);
    if (error) {
      setErr(error.message ?? 'Failed to save');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const renderInput = () => {
    if (setting.data_type === 'boolean') {
      return (
        <Switch
          checked={localVal === true || localVal === 'true'}
          onCheckedChange={v => setLocalVal(v)}
        />
      );
    }
    if (setting.data_type === 'number') {
      return (
        <Input
          type="number"
          className="h-8 w-32 text-sm text-right"
          value={typeof localVal === 'object' ? JSON.stringify(localVal) : localVal}
          onChange={e => setLocalVal(Number(e.target.value))}
        />
      );
    }
    // string / json
    return (
      <Input
        className="h-8 w-48 text-sm"
        value={typeof localVal === 'string' ? localVal.replace(/^"|"$/g, '') : String(localVal)}
        onChange={e => setLocalVal(`"${e.target.value}"`)}
      />
    );
  };

  return (
    <div className={`flex items-start justify-between gap-3 py-3 border-b border-border last:border-0 ${
      setting.key === 'maintenance_mode' && (localVal === true || localVal === 'true')
        ? 'bg-destructive/5 -mx-4 px-4 rounded-lg'
        : ''
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{setting.label ?? setting.key}</p>
          {setting.is_public && (
            <Badge variant="outline" className="text-[9px] h-4">Public</Badge>
          )}
          {setting.key === 'maintenance_mode' && (localVal === true || localVal === 'true') && (
            <Badge className="text-[9px] h-4 bg-destructive text-white border-0">ACTIVE</Badge>
          )}
        </div>
        {setting.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
        )}
        {err && (
          <p className="text-xs text-destructive mt-1">{err}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {renderInput()}
        {isDirty && (
          <Button
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={saving}
            onClick={handleSave}
          >
            {saving
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : saved
              ? <CheckCircle className="w-3 h-3 text-green-500" />
              : <Save className="w-3 h-3" />}
            {saved ? 'Saved' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
}

function SettingGroup({ groupKey, settings, onSave }) {
  const [open, setOpen] = useState(true);
  const meta = GROUP_LABELS[groupKey] ?? { label: groupKey, emoji: '⚙️' };

  return (
    <Card className="border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-semibold text-sm flex items-center gap-2">
          <span>{meta.emoji}</span>
          {meta.label}
          <Badge variant="outline" className="text-[9px] h-4">{settings.length}</Badge>
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-2">
          {settings.map(s => (
            <SettingRow key={s.key} setting={s} onSave={onSave} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminSettings() {
  const [settings,  setSettings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [userId,    setUserId]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: userData }, { data, error: err }] = await Promise.all([
      supabase.auth.getUser(),
      fetchSettings(),
    ]);
    setUserId(userData?.user?.id ?? null);
    if (err) setError(err.message);
    else     setSettings(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async (key, value) => {
    const { error } = await upsertSetting(key, value, userId);
    if (!error) {
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    }
    return { error };
  }, [userId]);

  // Group settings
  const groups = settings.reduce((acc, s) => {
    const g = s.group_name ?? 'general';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  const maintenanceOn = settings.find(s => s.key === 'maintenance_mode')?.value;

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Platform Settings"
        subtitle="Live configuration — changes take effect immediately"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* Maintenance mode alert */}
        {(maintenanceOn === true || maintenanceOn === 'true') && (
          <Card className="p-3 border-destructive bg-destructive/10 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm font-medium text-destructive">
              Maintenance mode is ON — all non-admin users see the maintenance screen.
            </p>
          </Card>
        )}

        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={load}>Retry</Button>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          Object.entries(groups).map(([gKey, gSettings]) => (
            <SettingGroup
              key={gKey}
              groupKey={gKey}
              settings={gSettings}
              onSave={handleSave}
            />
          ))
        )}

        <p className="text-xs text-center text-muted-foreground pt-2">
          All setting changes are recorded in the audit log with your user ID and timestamp.
        </p>
      </div>
    </div>
  );
}
