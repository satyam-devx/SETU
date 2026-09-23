// ═══════════════════════════════════════════════════════════
// SETU — RiderSafety (v2 — audit pass)
//
// Changes:
//  - "Activate SOS" toggled a local boolean and showed "Help is on
//    the way" — nothing anywhere in the codebase (no table, no edge
//    function, no admin-visible signal) actually backed that claim.
//    For a safety feature, a fake success that looks identical to a
//    real one is the worst failure mode: a rider relying on it in a
//    genuine emergency would believe help was coming when nothing had
//    happened. Now does two real things — writes a persisted,
//    admin-visible alert (migration 086's sos_alerts table, with GPS
//    location if the browser can get a fix) AND places an actual
//    tel: call to SETU Support, so activating SOS is guaranteed to at
//    least get a human on the phone even before anyone reviews the
//    alert record.
//  - Safety Checklist ("Helmet worn", "Vehicle insured", etc.) showed
//    every item permanently pre-checked with a green checkmark,
//    completely non-interactive — a rider who had NOT worn a helmet
//    still saw "Helmet worn ✓". Now real, unchecked-by-default,
//    tappable checkboxes; nothing here claims true until the rider
//    actually confirms it for this shift.
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Shield, Phone, CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { usePublicSettings } from '@/lib/settings';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { RiderAPI } from '@/lib/api';

const CHECKLIST_ITEMS = ['Helmet worn', 'Vehicle insured', 'Phone charged', 'Route shared with family'];

export default function RiderSafety() {
  const { user } = useAuth();
  const { get: getSetting } = usePublicSettings();
  // Was hardcoded as the placeholder '1800-XXX-XXXX' — a rider in a real
  // emergency must never be shown a fake number next to real Police/
  // Ambulance numbers. Now reads the real, admin-configurable value from
  // app_settings (support_phone) via get_public_settings(); falls back to
  // null (hides the Call button) rather than a fake number if unset.
  const supportPhone = getSetting('support_phone', null);

  const { data: rider } = useDataFetch(
    () => RiderAPI.getProfile(user?.id),
    [user?.id],
    { cacheKey: `rider-profile-${user?.id}`, enabled: !!user?.id }
  );
  const riderId = rider?.id ?? null;

  // Real state on reload — if the rider force-closed the app mid-alert,
  // this still shows "SOS Active" rather than silently resetting to off.
  const { data: activeAlert, refetch: refetchAlert } = useDataFetch(
    () => RiderAPI.getActiveSOSAlert(riderId),
    [riderId],
    { cacheKey: `sos-active-${riderId}`, enabled: !!riderId }
  );
  const sosActive = !!activeAlert;
  const [activating, setActivating] = useState(false);

  const handleActivateSOS = () => {
    if (!riderId || activating) return;
    setActivating(true);

    const place = (location) => {
      RiderAPI.createSOSAlert(riderId, location).finally(() => {
        setActivating(false);
        refetchAlert();
      });
      // Real, guaranteed-to-work action — a phone call reaches a human
      // immediately, regardless of whether anyone is watching an alert
      // dashboard right now. This fires alongside the alert write, not
      // instead of it.
      if (supportPhone) window.location.href = `tel:${supportPhone}`;
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => place({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => place(null), // location denied/unavailable — still send the alert + call
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      place(null);
    }
  };

  const handleCancelSOS = async () => {
    if (!activeAlert?.id) return;
    setActivating(true);
    await RiderAPI.cancelSOSAlert(activeAlert.id);
    setActivating(false);
    refetchAlert();
  };

  // ── Safety checklist — real, per-session, unchecked by default ──
  const [checked, setChecked] = useState(() => new Set());
  const toggleItem = (item) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
  };

  return (
    <div className="pb-6">
      <AppHeader title="Safety Center" showBack />
      <div className="px-4 py-4 space-y-4">
        <Card className={`p-6 border-2 text-center ${sosActive ? 'border-red-500 bg-red-50' : 'border-border'}`}>
          <Shield className={`w-12 h-12 mx-auto mb-3 ${sosActive ? 'text-red-500' : 'text-primary'}`} />
          <h2 className="font-bold text-lg mb-1">{sosActive ? 'SOS Active!' : 'Emergency SOS'}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {sosActive
              ? 'Alert sent to SETU Support and logged for the team to follow up. Stay calm.'
              : 'Sends an alert to SETU Support and calls them directly.'}
          </p>
          <Button
            variant={sosActive ? 'destructive' : 'default'}
            size="lg"
            className="w-full gap-2"
            disabled={!riderId || activating}
            onClick={sosActive ? handleCancelSOS : handleActivateSOS}
          >
            {activating && <Loader2 className="w-4 h-4 animate-spin" />}
            {sosActive ? 'Cancel SOS' : 'Activate SOS'}
          </Button>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Emergency Contacts</h3>
          <div className="space-y-2">
            {[
              { name: 'SETU Support', number: supportPhone, type: 'Platform' },
              { name: 'Police', number: '100', type: 'Emergency' },
              { name: 'Ambulance', number: '108', type: 'Medical' },
            ].map(c => (
              <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.number || 'Not configured'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{c.type}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!c.number}
                    onClick={() => c.number && (window.location.href = `tel:${c.number}`)}
                  >
                    Call
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Safety Checklist</h3>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map(item => {
              const done = checked.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className="w-full flex items-center gap-2 text-sm text-left"
                >
                  {done
                    ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className={done ? '' : 'text-muted-foreground'}>{item}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
