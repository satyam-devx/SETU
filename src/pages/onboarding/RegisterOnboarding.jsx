// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — REGISTER ONBOARDING  (production-hardened)
//
// BUGS FIXED IN THIS VERSION:
//
//  BUG 1 — Premature auto-redirect (skips name entry entirely):
//    The DB trigger handle_new_user fires the moment a user signs up
//    and immediately inserts a skeleton profile row (name="SETU User").
//    The old code had:
//      useEffect(() => { if (isProfileLoaded) navigate(portalPath) }, [...])
//    Because the trigger already created the row, isProfileLoaded is TRUE
//    on mount. The page redirected away instantly — the user never saw
//    the name input and was stuck with the name "SETU User".
//
//    Fix: Removed the auto-redirect-on-mount useEffect entirely.
//    Redirect is now only triggered AFTER the user has clicked Continue
//    and the upsert has completed successfully (tracked by `submitted` state).
//
//  BUG 2 — Plain INSERT fails when trigger row already exists:
//    createProfile() called supabase.from('profiles').insert() which hits
//    the PRIMARY KEY unique constraint when the trigger row exists.
//    Fix is in AuthContext.jsx → createProfile() changed to upsert().
//    This onboarding page calls createProfile() the same way — the fix
//    is transparent here once AuthContext is updated.
//
//  PRESERVED:
//    - If no authenticated user, redirect to /login.
//    - After successful submit, navigate to the correct portal.
//    - All UI, copy, and layout unchanged.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

export default function RegisterOnboarding() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const phone     = location.state?.phone || '';

  const { user, createProfile, isProfileLoaded, portalPath } = useAuth();

  const [name,      setName]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [submitted, setSubmitted] = useState(false); // true only after user clicks Continue

  // If no authenticated user, go back to login
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Redirect to portal ONLY after the user has submitted the form.
  // We must NOT redirect on mount even if isProfileLoaded is already true,
  // because the DB trigger creates a skeleton profile row ("SETU User")
  // the moment the user signs up — before they've had a chance to enter
  // their real name. Auto-redirecting on mount would skip name entry entirely.
  useEffect(() => {
    if (submitted && isProfileLoaded && portalPath && portalPath !== '/') {
      navigate(portalPath, { replace: true });
    }
  }, [submitted, isProfileLoaded, portalPath, navigate]);

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!user) {
      setError('Session expired. Please log in again.');
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    setError('');

    const { error: createError } = await createProfile(user.id, {
      phone,
      name: name.trim(),
      role: 'customer',
    });

    setLoading(false);

    if (createError) {
      console.error('[SETU Onboarding] createProfile error:', createError);
      setError('Could not save your profile. Please try again.');
      return;
    }

    // Mark as submitted — the useEffect above will redirect once
    // AuthContext confirms the profile is loaded.
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
      </div>

      <Card className="w-full max-w-sm p-6 border-border shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-5 mx-auto">
          <User className="w-6 h-6 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-center text-foreground mb-1">
          Welcome to SETU!
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Let's set up your account. What's your name?
        </p>

        <div className="mb-4">
          <Input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            className="h-11"
            autoFocus
            autoComplete="name"
            disabled={loading || submitted}
          />
        </div>

        {error && (
          <p className="text-xs text-destructive mb-4">{error}</p>
        )}

        <Button
          className="w-full h-11 gap-2 text-sm font-semibold"
          onClick={handleRegister}
          disabled={loading || submitted || !name.trim()}
        >
          {loading || submitted ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {submitted ? 'Entering SETU...' : 'Saving...'}</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </Card>

      <p className="text-muted-foreground/40 text-xs mt-6">SETU v1.0 · बिहार में बना</p>
    </div>
  );
}
