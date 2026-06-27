// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — REGISTER ONBOARDING  (v2 — Phase 0 hardened)
//
// Changes in this version:
//  1. After saving name + village_id, calls reloadProfile() before
//     navigating. This ensures ProtectedRoute's isProfileLoaded
//     becomes true with the real profile data, not the placeholder.
//     Without this, the user navigates to /customer while profile
//     still has name='SETU User' in AuthContext, causing a redirect
//     loop back to /onboarding/register on the next render.
//
//  2. Added village selection step (Task 6). profile.village_id was
//     always null for new users — now they pick their village here.
//     Villages are fetched from DB (falls back to mockData).
//
//  3. 'SETU User' placeholder detection (Task 5): the skip-to-portal
//     useEffect now explicitly checks for the placeholder name and
//     does NOT skip. The DB trigger creates the row with
//     name = full_name from Google metadata or '' for phone users;
//     only when name is genuinely set by the USER do we skip.
//
//  4. Name saved with village_id in a single DB UPDATE so we never
//     write a partial profile (name without village or vice versa).
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, ArrowRight, MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { getVillages } from '@/lib/api';

// Names that the DB trigger auto-inserts and that mean
// "user has not set their own name yet".
const PLACEHOLDER_NAMES = ['SETU User', 'setu user', '', null, undefined];

function isPlaceholderName(name) {
  return PLACEHOLDER_NAMES.includes(name?.trim?.()) || !name?.trim?.();
}

export default function RegisterOnboarding() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const phone     = location.state?.phone || '';

  const {
    user, isLoading, profile, portalPath,
    reloadProfile,
  } = useAuth();

  const [name,       setName]       = useState('');
  const [villageId,  setVillageId]  = useState('');
  const [villages,   setVillages]   = useState([]);
  const [vilLoading, setVilLoading] = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  // ── Fetch villages for selector ───────────────────────────
  useEffect(() => {
    getVillages({ activeOnly: true }).then(({ data }) => {
      if (data?.length) setVillages(data);
      setVilLoading(false);
    });
  }, []);

  // ── Redirect unauthenticated users ────────────────────────
  useEffect(() => {
    if (!isLoading && !user) navigate('/login', { replace: true });
  }, [user, isLoading, navigate]);

  // ── Skip onboarding if profile already complete ───────────
  // Only skip when:
  //  a) Profile exists
  //  b) Name is NOT a placeholder (user genuinely set it)
  //  c) Village is set
  // This prevents Google OAuth users (name pre-filled from Google)
  // from being stranded here if they completed onboarding before.
  useEffect(() => {
    if (isLoading) return;
    if (!profile) return;

    const hasRealName    = !isPlaceholderName(profile.name);
    const hasVillage     = !!profile.village_id;
    const dest           = portalPath && portalPath !== '/' ? portalPath : '/customer';

    if (hasRealName && hasVillage) {
      navigate(dest, { replace: true });
    }
    // If name is set but village is missing, stay here to collect village.
    // If name is placeholder ('SETU User'), stay here to collect name.
  }, [isLoading, profile, portalPath, navigate]);

  // Pre-fill name from Google profile so the user just needs to confirm
  useEffect(() => {
    if (profile?.name && !isPlaceholderName(profile.name) && !name) {
      setName(profile.name);
    }
  }, [profile]);

  // ── Save name + village → reload profile → navigate ──────
  const handleContinue = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) { setError('Please enter your name.'); return; }
    if (trimmedName.length < 2) { setError('Name must be at least 2 characters.'); return; }
    if (!villageId)   { setError('Please select your village.'); return; }

    setSaving(true);
    setError('');

    // UPSERT (not update): after a DB reset, an existing auth.users
    // account can have NO profiles row (the handle_new_user trigger only
    // fires on NEW signups). A plain UPDATE would match 0 rows and
    // silently do nothing, leaving the user with no profile and a blank
    // /customer screen. Upsert creates the row if missing, updates it if
    // present. `role` is intentionally omitted so it defaults to
    // 'customer' on insert and is left untouched on update.
    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id:         user.id,
        name:       trimmedName,
        village_id: villageId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (dbError) {
      console.error('[SETU Onboarding] profile upsert error:', dbError);
      setError('Could not save your profile. Please try again.');
      setSaving(false);
      return;
    }

    // ── CRITICAL: reload profile in AuthContext BEFORE navigating ──
    // Without this, ProtectedRoute still sees the stale profile
    // (name='SETU User', village_id=null) and the skip-to-portal
    // useEffect above fires again, re-routing back to /onboarding.
    await reloadProfile();

    setSaving(false);
    navigate('/customer', { replace: true });
  };

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const selectedVillage = villages.find(v => v.id === villageId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">

      <div className="text-center mb-10">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
      </div>

      <Card className="w-full max-w-sm p-6 border-border shadow-xl space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4 mx-auto">
            <User className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Welcome to SETU!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us your name and village to get started
          </p>
        </div>

        {/* Name field */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Your full name
          </label>
          <Input
            type="text"
            placeholder="e.g. Sunita Devi"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleContinue()}
            className="h-11"
            autoFocus={!name}
            autoComplete="name"
            disabled={saving}
            maxLength={60}
          />
        </div>

        {/* Village selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Your village
          </label>

          {vilLoading ? (
            <div className="h-11 bg-muted rounded-xl flex items-center px-3 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading villages...</span>
            </div>
          ) : (
            <div className="relative">
              <select
                value={villageId}
                onChange={e => { setVillageId(e.target.value); setError(''); }}
                disabled={saving}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 pr-9 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-foreground"
                aria-label="Select your village"
              >
                <option value="">— Select your village —</option>
                {villages.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.block && v.block !== v.name ? `, ${v.block}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
            </div>
          )}

          {selectedVillage && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedVillage.block} Block · {selectedVillage.district} District
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive -mt-2" role="alert">{error}</p>
        )}

        {/* CTA */}
        <Button
          className="w-full h-11 gap-2 text-sm font-semibold"
          onClick={handleContinue}
          disabled={saving || !name.trim() || !villageId}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your account...</>
          ) : (
            <>Enter SETU <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You can update your name and village anytime in your profile settings.
        </p>
      </Card>

      <p className="text-muted-foreground/40 text-xs mt-6">SETU v1.0 · बिहार में बना</p>
    </div>
  );
}
