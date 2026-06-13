// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminConfig  (v2 — Live DB)
// Fixed: loads real platform_config from DB, saves via RPC.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Sliders, Percent, Clock, Globe, Save, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';

// Default config keys with labels, groups and types
const CONFIG_SCHEMA = [
  // Fees
  { key: 'platform_commission_pct',     label: 'Platform commission (%)',          group: 'fees',   type: 'number', defaultValue: '8'    },
  { key: 'rider_earning_per_delivery',  label: 'Rider earning per delivery (₹)',   group: 'fees',   type: 'number', defaultValue: '25'   },
  { key: 'seva_platform_fee_pct',       label: 'Seva provider platform fee (%)',   group: 'fees',   type: 'number', defaultValue: '10'   },
  { key: 'default_credit_limit',        label: 'Default customer credit limit (₹)',group: 'fees',   type: 'number', defaultValue: '500'  },
  // Limits
  { key: 'max_cod_balance_per_rider',   label: 'Max COD balance per rider (₹)',    group: 'limits', type: 'number', defaultValue: '1000' },
  { key: 'order_cancel_window_min',     label: 'Order cancellation window (min)',   group: 'limits', type: 'number', defaultValue: '10'   },
  { key: 'vendor_approval_sla_hrs',     label: 'Vendor approval SLA (hours)',       group: 'limits', type: 'number', defaultValue: '48'   },
  // Toggles
  { key: 'maintenance_mode',            label: 'Maintenance Mode',                 group: 'flags',  type: 'bool',   defaultValue: 'false', description: 'Disable all user-facing features' },
  { key: 'new_registrations_enabled',   label: 'New Registrations',                group: 'flags',  type: 'bool',   defaultValue: 'true',  description: 'Allow new vendors/riders to register' },
  { key: 'voice_orders_enabled',        label: 'Voice Orders',                     group: 'flags',  type: 'bool',   defaultValue: 'true',  description: 'Enable voice-based ordering for customers' },
];

const GROUP_LABELS = {
  fees:   { label: 'Fee Configuration',   icon: Percent },
  limits: { label: 'Operational Limits',  icon: Clock   },
  flags:  { label: 'Platform Controls',   icon: Globe   },
};

export default function SuperAdminConfig() {
  const [values,   setValues]   = useState({});    // key → string value
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [saveErr,  setSaveErr]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await AdminAPI.getConfig();
    if (err) { setError(err.message ?? 'Failed to load config'); setLoading(false); return; }

    // Map DB rows (key, value) into local state
    const map = {};
    (data ?? []).forEach(row => { map[row.key] = String(row.value); });

    // Fill missing keys with schema defaults
    CONFIG_SCHEMA.forEach(s => {
      if (!(s.key in map)) map[s.key] = s.defaultValue;
    });

    setValues(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);

    const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
    const { error: err } = await AdminAPI.saveConfig(entries);

    if (err) {
      setSaveErr(err.message ?? 'Save failed');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const set = (key, val) => setValues(v => ({ ...v, [key]: String(val) }));

  const groups = CONFIG_SCHEMA.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="pb-6">
      <AppHeader
        title="Platform Config"
        subtitle="Global settings — changes affect all users"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-lg">

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{error}</p>
            <Button size="sm" variant="ghost" onClick={load}>Retry</Button>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
          </div>
        ) : (
          Object.entries(groups).map(([groupKey, items]) => {
            const { label: groupLabel, icon: Icon } = GROUP_LABELS[groupKey];
            return (
              <Card key={groupKey} className="p-4 border-border">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" /> {groupLabel}
                </h3>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <React.Fragment key={item.key}>
                      {idx > 0 && item.type === 'bool' && <Separator />}
                      {item.type === 'bool' ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                          <Switch
                            checked={values[item.key] === 'true'}
                            onCheckedChange={v => set(item.key, v ? 'true' : 'false')}
                          />
                        </div>
                      ) : (
                        <div>
                          <Label className="text-xs mb-1 block">{item.label}</Label>
                          <Input
                            type="number"
                            value={values[item.key] ?? item.defaultValue}
                            onChange={e => set(item.key, e.target.value)}
                            className="w-32"
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </Card>
            );
          })
        )}

        {/* Maintenance warning */}
        {values['maintenance_mode'] === 'true' && (
          <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Maintenance mode is ON</p>
              <p className="text-xs text-amber-700">All customer-facing features are disabled.</p>
            </div>
          </Card>
        )}

        {saveErr && (
          <p className="text-xs text-destructive text-center">{saveErr}</p>
        )}

        {!loading && (
          <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> {saved ? '✓ Saved!' : 'Save Configuration'}</>
            }
          </Button>
        )}
      </div>
    </div>
  );
}
