// ═══════════════════════════════════════════════════════════
// SETU — AdminSettings (v2 — DB-persisted)
// Loads from platform_config table on mount.
// Saves via upsert_platform_config_bulk RPC.
// All values persisted across sessions.
// Route: /admin/settings
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import {
  Bell, Shield, Sliders, Save, RefreshCw,
  Loader2, CheckCircle2, IndianRupee, Clock, Package
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

// ── Config key definitions ───────────────────────────────
const PLATFORM_FIELDS = [
  {
    key:         'platform_commission_pct',
    label:       'Platform commission (%)',
    desc:        'Percentage fee added to every order',
    type:        'number',
    suffix:      '%',
    min:         0, max: 20,
  },
  {
    key:         'rider_earning_per_delivery',
    label:       'Rider earning per delivery (₹)',
    desc:        'Fixed amount paid to rider per completed delivery',
    type:        'number',
    prefix:      '₹',
    min:         0,
  },
  {
    key:         'delivery_fee_default',
    label:       'Default delivery fee (₹)',
    desc:        'Applied to orders below the free-delivery threshold',
    type:        'number',
    prefix:      '₹',
  },
  {
    key:         'delivery_fee_free_above',
    label:       'Free delivery above (₹)',
    desc:        'Orders above this amount get free delivery (0 = always charge)',
    type:        'number',
    prefix:      '₹',
  },
  {
    key:         'max_cod_balance_rider',
    label:       'Max COD balance per rider (₹)',
    desc:        'Rider must deposit cash once they exceed this limit',
    type:        'number',
    prefix:      '₹',
  },
  {
    key:         'default_credit_limit',
    label:       'Default customer credit limit (₹)',
    desc:        'Starting SETU Credit available to new customers',
    type:        'number',
    prefix:      '₹',
  },
  {
    key:         'order_cancel_window_min',
    label:       'Order cancel window (minutes)',
    desc:        'Customer can cancel free within this many minutes of placing',
    type:        'number',
    suffix:      'min',
  },
  {
    key:         'vendor_approval_sla_hours',
    label:       'Vendor approval SLA (hours)',
    desc:        'Target time for admin to approve/reject new vendor',
    type:        'number',
    suffix:      'hrs',
  },
];

const ALERT_FIELDS = [
  { key: 'alert_new_vendor',  label: 'New vendor registration', desc: 'Push notification on new vendor sign-up' },
  { key: 'alert_fraud_flag',  label: 'Fraud flag raised',       desc: 'Alert when a fraud report is filed' },
  { key: 'alert_cod_overdue', label: 'COD overdue',             desc: 'Rider COD not deposited within 24 hours' },
];

const SECURITY_FIELDS = [
  { key: 'require_2fa_admin',    label: 'Require 2FA for admins',    desc: 'Two-factor authentication on admin login' },
  { key: 'auto_suspend_fraud',   label: 'Auto-suspend on fraud',     desc: 'Suspend accounts with 3 or more fraud flags' },
  { key: 'new_registrations_enabled', label: 'Allow new registrations', desc: 'New users can sign up to the platform' },
  { key: 'maintenance_mode',     label: 'Maintenance mode',          desc: 'Shows maintenance banner to all users' },
];

// Convert flat array from DB to object map
function configToMap(rows) {
  return Object.fromEntries((rows ?? []).map(r => [r.key, r.value]));
}

export default function AdminSettings() {
  const [values,     setValues]     = useState({});
  const [dirty,      setDirty]      = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [savedOk,    setSavedOk]    = useState(false);
  const [saveErr,    setSaveErr]    = useState(null);

  const { data, isLoading, refetch } = useDataFetch(
    () => AdminAPI.getConfig(),
    [],
    { cacheKey: 'platform-config', staleTime: 60_000 }
  );

  // When DB data arrives, populate form
  useEffect(() => {
    if (data) {
      setValues(configToMap(data));
      setDirty(false);
    }
  }, [data]);

  const set = (key, value) => {
    setValues(v => ({ ...v, [key]: String(value) }));
    setDirty(true);
    setSavedOk(false);
    setSaveErr(null);
  };

  const getBool = (key, fallback = false) => {
    if (!(key in values)) return fallback;
    return values[key] === 'true';
  };

  const getNum = (key, fallback = 0) => {
    if (!(key in values)) return String(fallback);
    return values[key];
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
    const { error } = await AdminAPI.saveConfig(entries);
    if (error) {
      setSaveErr(error.message ?? 'Save failed');
    } else {
      setSavedOk(true);
      setDirty(false);
      refetch();
      setTimeout(() => setSavedOk(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Settings"
        subtitle="Platform configuration — all values are saved to the database"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-5 space-y-5 max-w-2xl">

        {saveErr && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {saveErr}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* ── Platform Limits ─────────────────────── */}
            <Card className="p-4 border-border space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" /> Platform Limits
              </h3>
              {PLATFORM_FIELDS.map((f, i) => (
                <div key={f.key}>
                  {i > 0 && <Separator className="mb-4" />}
                  <Label className="text-xs mb-1 block">{f.label}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{f.desc}</p>
                  <div className="flex items-center gap-2">
                    {f.prefix && (
                      <span className="text-sm text-muted-foreground">{f.prefix}</span>
                    )}
                    <Input
                      type={f.type}
                      min={f.min}
                      max={f.max}
                      value={getNum(f.key)}
                      onChange={e => set(f.key, e.target.value)}
                      className="w-32 h-8 text-sm"
                    />
                    {f.suffix && (
                      <span className="text-xs text-muted-foreground">{f.suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </Card>

            {/* ── Alert Settings ───────────────────────── */}
            <Card className="p-4 border-border space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Alert Settings
              </h3>
              {ALERT_FIELDS.map((f, i) => (
                <div key={f.key}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                    <Switch
                      checked={getBool(f.key, true)}
                      onCheckedChange={v => set(f.key, v)}
                    />
                  </div>
                </div>
              ))}
            </Card>

            {/* ── Security & Access ────────────────────── */}
            <Card className="p-4 border-border space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Security & Access
              </h3>
              {SECURITY_FIELDS.map((f, i) => (
                <div key={f.key}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                    <Switch
                      checked={getBool(f.key, true)}
                      onCheckedChange={v => set(f.key, v)}
                    />
                  </div>
                </div>
              ))}
            </Card>

            {/* ── Save button ──────────────────────────── */}
            <div className="flex items-center gap-3">
              <Button
                className="flex-1 gap-2"
                disabled={saving || !dirty}
                onClick={handleSave}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                ) : savedOk ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-400" />Saved!</>
                ) : (
                  <><Save className="w-4 h-4" />Save Settings</>
                )}
              </Button>
              {dirty && !saving && (
                <p className="text-xs text-amber-600 font-medium">Unsaved changes</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Last updated by: {data?.find(r => r.updated_by)?.updated_by
                ? 'Admin'
                : 'Not yet saved'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
