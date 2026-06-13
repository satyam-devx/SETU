// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — LOGIN OTP  (v2 — Phase 0 hardened)
//
// Changes in this version:
//  1. OTP send cooldown (60s) — prevents SMS cost explosion.
//     State persists across hot-reloads via sessionStorage so
//     refreshing the page mid-cooldown doesn't reset the timer.
//  2. Cooldown timer counts down and disables the Send button.
//  3. Cooldown expiry time stored in sessionStorage (not just
//     a counter) so it survives refreshes correctly.
//  4. All previous fixes preserved (redirect guard, Google fix).
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, AlertCircle, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

const VALID_INDIAN_PHONE = /^[6-9]\d{9}$/;
const OTP_COOLDOWN_SECS  = 60;
const COOLDOWN_KEY       = 'setu_otp_cooldown_until'; // sessionStorage key

// Returns seconds remaining on an existing cooldown, or 0 if expired/absent.
function getRemainingCooldown() {
  try {
    const until = parseInt(sessionStorage.getItem(COOLDOWN_KEY) || '0', 10);
    const remaining = Math.ceil((until - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

function startCooldown() {
  try {
    sessionStorage.setItem(
      COOLDOWN_KEY,
      String(Date.now() + OTP_COOLDOWN_SECS * 1000)
    );
  } catch {}
}

export default function LoginOTP() {
  const navigate = useNavigate();
  const {
    sendOTP, signInWithGoogle,
    isAuthenticated, isProfileLoaded, isLoading, portalPath,
  } = useAuth();

  const [mode, setMode]         = useState('phone');
  const [rawPhone, setRawPhone] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── OTP send cooldown ────────────────────────────────────
  // Initialise from sessionStorage so a page refresh mid-cooldown
  // still shows the correct remaining seconds.
  const [cooldown, setCooldown] = useState(() => getRemainingCooldown());
  const timerRef = useRef(null);

  // Tick the cooldown down every second while active.
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown]);

  // ── Redirect already-authed users ────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!isProfileLoaded) return;
    if (portalPath && portalPath !== '/') {
      navigate(portalPath, { replace: true });
    }
  }, [isAuthenticated, isProfileLoaded, isLoading, portalPath, navigate]);

  // ── Phone input ──────────────────────────────────────────
  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setRawPhone(digits);
    setError('');
  };

  // ── Send OTP ─────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (cooldown > 0) return; // Guard — button should already be disabled

    if (!VALID_INDIAN_PHONE.test(rawPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    setError('');

    const phone = `+91${rawPhone}`;
    const { error: otpError } = await sendOTP(phone);

    setLoading(false);

    if (otpError) {
      if (otpError.message?.includes('rate')) {
        // Supabase already rate-limited — start the cooldown on our side too
        startCooldown();
        setCooldown(OTP_COOLDOWN_SECS);
        setError('Too many attempts. Please wait 60 seconds and try again.');
      } else if (otpError.message?.includes('invalid')) {
        setError('Invalid phone number. Please check and try again.');
      } else {
        setError(otpError.message || 'Could not send OTP. Please try again.');
      }
      return;
    }

    // Success — start cooldown and navigate to verify page
    startCooldown();
    setCooldown(OTP_COOLDOWN_SECS);
    navigate(`/login/verify?phone=${encodeURIComponent(phone)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSendOTP();
  };

  // ── Google sign-in ────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setLoading(false);
      setError(googleError.message || 'Could not connect to Google. Please try again.');
    }
    // On success the page redirects; don't reset loading.
  };

  const canSend = rawPhone.length === 10 && cooldown === 0 && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
        <p className="text-muted-foreground/60 text-xs mt-0.5">Madhepur · Madhubani · Bihar · मिथिला</p>
      </div>

      <Card className="w-full max-w-sm p-6 border-border shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-5 mx-auto">
          <Phone className="w-6 h-6 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-center text-foreground mb-1">
          स्वागत है SETU पर
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Login or create your account
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5">
          <Button
            type="button"
            variant={mode === 'phone' ? 'default' : 'outline'}
            onClick={() => { setMode('phone'); setError(''); }}
            className="flex-1 h-11 min-h-[44px] shrink-0"
          >
            Phone
          </Button>
          <Button
            type="button"
            variant={mode === 'google' ? 'default' : 'outline'}
            onClick={() => { setMode('google'); setError(''); }}
            className="flex-1 h-11 min-h-[44px] gap-2 shrink-0"
          >
            <Mail className="w-4 h-4" />
            Google
          </Button>
        </div>

        {/* ── Phone OTP mode ── */}
        {mode === 'phone' && (
          <>
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                अपना मोबाइल नंबर डालें
              </p>
              <div className="flex gap-2">
                <div className="flex items-center justify-center bg-muted rounded-lg px-3 border border-border h-11 shrink-0">
                  <span className="text-sm font-semibold text-foreground">🇮🇳 +91</span>
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={rawPhone}
                  onChange={handlePhoneChange}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-11 text-base tracking-widest"
                  maxLength={10}
                  autoFocus
                  autoComplete="tel-national"
                  disabled={loading}
                />
              </div>
              {rawPhone.length > 0 && rawPhone.length < 10 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {10 - rawPhone.length} more digits needed
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Cooldown notice */}
            {cooldown > 0 && !error && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl mb-4">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  OTP sent. You can resend in{' '}
                  <span className="font-semibold text-foreground tabular-nums">{cooldown}s</span>
                </p>
              </div>
            )}

            <Button
              className="w-full h-11 min-h-[44px] gap-2 text-sm font-semibold"
              onClick={handleSendOTP}
              disabled={!canSend}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  Resend in {cooldown}s
                </>
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              An OTP will be sent via SMS. By continuing you agree to SETU's terms.
            </p>
          </>
        )}

        {/* ── Google OAuth mode ── */}
        {mode === 'google' && (
          <>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Continue with Google</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Fast, secure and password-free sign in.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full h-11 min-h-[44px] text-sm font-semibold gap-3"
              disabled={loading}
              onClick={handleGoogleSignIn}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.4 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2c-2.1 1.6-4.7 2.4-7.3 2.4-5.3 0-9.7-3.3-11.3-8H6.4C9.6 39.5 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.3 5.5-6.2 7.1l6.2 5.2C39.7 36.4 44 30.8 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Your Google account will be used to securely sign in to SETU.
            </p>
          </>
        )}
      </Card>

      {/* Demo mode notice */}
      {!import.meta.env.VITE_SUPABASE_URL && (
        <div className="mt-4 w-full max-w-sm">
          <Card className="p-3 border-amber-200 bg-amber-50/60 text-center">
            <p className="text-xs text-amber-800 font-medium mb-1">Demo Mode</p>
            <p className="text-xs text-amber-700">
              No Supabase configured. Enter any 10-digit number — OTP cooldown is disabled in demo mode.
            </p>
          </Card>
        </div>
      )}

      <p className="text-muted-foreground/40 text-xs mt-6">SETU v1.0 · बिहार में बना</p>
    </div>
  );
}
