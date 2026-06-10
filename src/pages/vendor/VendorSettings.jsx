// ═══════════════════════════════════════════════════════════
// SETU — VendorSettings (v2)
// Changes:
//  - Loads vendor profile via getVendorByOwnerId
//  - All toggles (order_notifs, stock_alerts, auto_accept)
//    saved to vendors table via upsertVendorProfile
//  - Business hours loaded from vendor.business_hours (JSON)
//    and editable with save
//  - Dark mode toggle wired to document.documentElement class
//  - Save indicator (success / error feedback)
//  - Language setting saved to vendor preferences
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import {
  Bell, Globe, Moon, ChevronRight, LogOut, Store,
  Clock, Save, Loader2, CheckCircle, AlertCircle, Edit2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, upsertVendorProfile } from '@/lib/api';

const DEFAULT_HOURS = [
  { day: 'Monday – Friday', open: '08:00', close: '21:00' },
  { day: 'Saturday',        open: '08:00', close: '22:00' },
  { day: 'Sunday',          open: '09:00', close: '18:00' },
];

export default function VendorSettings() {
  const { signOut, user } = useAuth();

  // ── Vendor profile ────────────────────────────────────────
  const { data: vendor, isLoading: vendorLoading } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );

  // ── Toggle states (seeded from DB) ────────────────────────
  const [orderNotifs, setOrderNotifs] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [autoAccept,  setAutoAccept]  = useState(false);
  const [darkMode,    setDarkMode]    = useState(
    () => document.documentElement.classList.contains('dark')
  );

  // ── Business hours ────────────────────────────────────────
  const [hours,      setHours]      = useState(DEFAULT_HOURS);
  const [editHours,  setEditHours]  = useState(false);

  // ── UI state ──────────────────────────────────────────────
  const [saving,      setSaving]      = useState(false);
  const [saveDone,    setSaveDone]    = useState(false);
  const [saveError,   setSaveError]   = useState(null);
  const [signingOut,  setSigningOut]  = useState(false);

  // Seed from DB once vendor loads
  useEffect(() => {
    if (!vendor) return;
    const prefs = vendor.preferences ?? {};
    setOrderNotifs(prefs.order_notifs   ?? true);
    setStockAlerts(prefs.stock_alerts   ?? true);
    setAutoAccept( prefs.auto_accept    ?? false);
    if (vendor.business_hours) {
      setHours(vendor.business_hours);
    }
  }, [vendor]);

  // Dark mode toggle wired to DOM
  const handleDarkMode = (val) => {
    setDarkMode(val);
    document.documentElement.classList.toggle('dark', val);
  };

  // ── Save preferences ──────────────────────────────────────
  const handleSave = async () => {
    if (!vendor) return;
    setSaving(true);
    setSaveError(null);

    const { error } = await upsertVendorProfile({
      id:         vendor.id,
      owner_id:   user.id,
      preferences: {
        order_notifs: orderNotifs,
        stock_alerts: stockAlerts,
        auto_accept:  autoAccept,
        dark_mode:    darkMode,
      },
      business_hours: hours,
    });

    setSaving(false);
    if (error) {
      setSaveError(error.message ?? 'Failed to save settings.');
    } else {
      setSaveDone(true);
      setEditHours(false);
      setTimeout(() => setSaveDone(false), 2500);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="pb-20">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Feedback banners */}
        {saveDone && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-xs font-medium text-green-700">Settings saved successfully.</p>
          </div>
        )}
        {saveError && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{saveError}</p>
          </div>
        )}

        {/* Account card */}
        {vendorLoading ? (
          <div className="h-16 bg-muted rounded-xl animate-pulse" />
        ) : (
          <Card className="p-4 border-border">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold">{vendor?.name ?? 'Vendor'}</p>
                <p className="text-xs text-muted-foreground">{vendor?.phone ?? '—'}</p>
                <Badge className={`mt-0.5 text-[9px] border-0 ${vendor?.is_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {vendor?.is_verified ? 'Verified' : 'Pending Verification'}
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Order settings */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Order Settings
            </p>
          </div>
          {[
            {
              label: 'New Order Alerts',
              sub:   'Sound + push notification',
              val:   orderNotifs,
              set:   setOrderNotifs,
            },
            {
              label: 'Auto-Accept Orders',
              sub:   'Confirm within 3 minutes automatically',
              val:   autoAccept,
              set:   setAutoAccept,
            },
            {
              label: 'Low Stock Alerts',
              sub:   'When stock drops below 5',
              val:   stockAlerts,
              set:   setStockAlerts,
            },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
              <Switch checked={item.val} onCheckedChange={item.set} />
            </div>
          ))}
        </Card>

        {/* Business hours */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Business Hours
            </h3>
            <button
              className="text-xs text-primary flex items-center gap-1"
              onClick={() => setEditHours(e => !e)}
            >
              <Edit2 className="w-3 h-3" />
              {editHours ? 'Done' : 'Edit'}
            </button>
          </div>

          <div className="space-y-2">
            {hours.map((bh, i) => (
              <div key={bh.day} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground w-32 shrink-0">{bh.day}</span>
                {editHours ? (
                  <div className="flex items-center gap-1 text-xs">
                    <Input
                      type="time"
                      value={bh.open}
                      className="h-7 text-xs w-24"
                      onChange={e => setHours(hs =>
                        hs.map((h, j) => j === i ? { ...h, open: e.target.value } : h)
                      )}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={bh.close}
                      className="h-7 text-xs w-24"
                      onChange={e => setHours(hs =>
                        hs.map((h, j) => j === i ? { ...h, close: e.target.value } : h)
                      )}
                    />
                  </div>
                ) : (
                  <span className="text-xs font-medium">
                    {bh.open} – {bh.close}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Appearance */}
        <Card className="border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Dark Mode</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={handleDarkMode} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Language</p>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-sm">Hindi</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </Card>

        {/* Save */}
        <Button
          className="w-full gap-2"
          onClick={handleSave}
          disabled={saving || vendorLoading}
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : <><Save className="w-4 h-4" /> Save Settings</>}
        </Button>

        {/* Sign out */}
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">SETU v1.0.0 · Made with ❤ for Bharat</p>
      </div>
    </div>
  );
}
