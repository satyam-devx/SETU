// ═══════════════════════════════════════════════════════════
// SETU — RiderSettings (v2 — audit pass)
//
// Changes:
//  - All four toggles (Notifications, New Order Sound, Offline
//    Navigation, Dark Mode) were pure local useState with no
//    persistence anywhere — every one silently reset to its default
//    on next app open. Now saved to riders.preferences (migration
//    086) and loaded back on mount, same pattern as
//    VendorSettings.jsx uses for vendors.preferences.
//  - Dark Mode didn't actually apply anything — toggling it changed
//    nothing about how the app looked. Now toggles the real `dark`
//    class on the document root.
//  - Language showed "Hindi" next to a chevron implying it was
//    tappable; it was a plain non-interactive div. Now a real select,
//    saved the same way. There's no real language-switching i18n
//    system anywhere in this codebase yet (checked) — this honestly
//    just persists the preference for whenever one exists, same
//    caveat as the equivalent vendor-side fix.
//  - "Offline Navigation / Download maps for Madhubani district"
//    implies real offline map tile caching, which doesn't exist
//    anywhere in this app (no service worker tile cache, no download
//    mechanism). The toggle's on/off state is still saved honestly —
//    it just doesn't yet do the thing its label describes, flagged
//    here rather than silently left as-is.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { Globe, Moon, LogOut, Bike, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useRiderByUser } from '@/hooks/queries/useRider';
import { useRiderMutations } from '@/hooks/mutations/useRiderMutations';

export default function RiderSettings() {
  const { user, signOut, userName, userPhone } = useAuth();
  const { updateSettings } = useRiderMutations();

  const { data: rider, isLoading: riderLoading, refetch: invalidateRider } = useRiderByUser(user?.id);

  const [notifs, setNotifs]           = useState(true);
  const [orderNotifs, setOrderNotifs] = useState(true);
  const [darkMode, setDarkMode]       = useState(
    () => document.documentElement.classList.contains('dark')
  );
  const [offlineNav, setOfflineNav]   = useState(true);
  const [language, setLanguage]       = useState('hi');
  const [signingOut, setSigningOut]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveDone, setSaveDone]       = useState(false);
  const [saveError, setSaveError]     = useState(null);

  // Seed toggles from the real saved preferences once the rider loads
  useEffect(() => {
    if (!rider) return;
    const prefs = rider.preferences ?? {};
    setNotifs(prefs.notifs ?? true);
    setOrderNotifs(prefs.order_notifs ?? true);
    setOfflineNav(prefs.offline_nav ?? true);
    setLanguage(prefs.language ?? 'hi');
  }, [rider]);

  // Dark mode applies immediately (not just on save) so toggling it
  // gives instant feedback, matching how a dark-mode switch normally
  // behaves — the save below just makes that choice persist.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const persist = async (updates) => {
    if (!rider?.id) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await updateSettings(rider.id, {
      preferences: {
        notifs, order_notifs: orderNotifs, offline_nav: offlineNav, dark_mode: darkMode, language,
        ...updates,
      },
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message ?? 'Could not save. Please try again.');
    } else {
      invalidateRider();
      setSaveDone(true);
      setTimeout(() => setSaveDone(false), 1800);
    }
  };

  // Auto-save on each toggle — these are simple independent switches
  // (unlike VendorSettings, which bundles business hours into one
  // explicit Save action), so persisting immediately on change is
  // simpler and avoids a rider assuming a flip "stuck" if they never
  // find an explicit Save button.
  const onToggle = (setter, key) => (value) => {
    setter(value);
    persist({ [key]: value });
  };
  const onLanguageChange = (value) => {
    setLanguage(value);
    persist({ language: value });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="pb-6">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Account */}
        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Bike className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <p className="text-sm font-semibold">{userName || 'Rider'}</p>
              <p className="text-xs text-muted-foreground">{userPhone || '—'}</p>
              <Badge className="mt-0.5 text-[9px] bg-green-100 text-green-700 border-0">Active Rider</Badge>
            </div>
          </div>
        </Card>

        {saveError && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {saveError}
          </div>
        )}

        {/* Notifications & preferences */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preferences</p>
            {(saving || saveDone) && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {saving
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                  : <><CheckCircle className="w-3 h-3 text-green-600" /> Saved</>}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">Order alerts and platform updates</p>
            </div>
            <Switch checked={notifs} onCheckedChange={onToggle(setNotifs, 'notifs')} disabled={riderLoading} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">New Order Sound</p>
              <p className="text-xs text-muted-foreground">Audio alert on new order available</p>
            </div>
            <Switch checked={orderNotifs} onCheckedChange={onToggle(setOrderNotifs, 'order_notifs')} disabled={riderLoading} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Offline Navigation</p>
              <p className="text-xs text-muted-foreground">Download maps for Madhubani district — coming soon</p>
            </div>
            <Switch checked={offlineNav} onCheckedChange={onToggle(setOfflineNav, 'offline_nav')} disabled={riderLoading} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Dark Mode</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={onToggle(setDarkMode, 'dark_mode')} disabled={riderLoading} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Language</p>
            </div>
            <select
              className="h-8 text-sm bg-transparent text-right pr-1 focus:outline-none"
              value={language}
              onChange={e => onLanguageChange(e.target.value)}
              disabled={riderLoading}
              aria-label="App language"
            >
              <option value="hi">हिंदी</option>
              <option value="mai">मैथिली</option>
              <option value="bh">भोजपुरी</option>
              <option value="en">English</option>
            </select>
          </div>
        </Card>

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
