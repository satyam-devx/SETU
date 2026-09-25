import { assetUrl } from '@/lib/media';
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
import { Phone, ArrowRight, Loader2, AlertCircle, Mail, Clock, MapPin, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { consumePostLoginRedirect } from '@/lib/postLoginRedirect';
import { validators } from '@/lib/form-validation';

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
    const pending = consumePostLoginRedirect();
    if (pending) { navigate(pending, { replace: true }); return; }
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

    const validationError = validators.indianPhone(rawPhone);
    if (validationError) {
      setError(validationError);
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
      return;
    }
    // Native (Android/iOS): the session is already established in-app
    // at this point (no browser round-trip) — route through
    // AuthCallback's existing new-user / incomplete-profile / portal
    // logic instead of duplicating it here.
    // Web: the browser has already navigated away via the OAuth
    // redirect by the time this line would run, so it's a no-op there.
    navigate('/auth/callback', { replace: true });
  };

  const canSend = rawPhone.length === 10 && cooldown === 0 && !loading;


  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-28 h-[520px] w-[520px] rounded-full bg-primary/[0.11] blur-[115px]" />
        <div className="absolute -right-36 top-[8%] h-[430px] w-[430px] rounded-full bg-setu-earth/[0.085] blur-[115px]" />
        <div className="absolute -bottom-44 left-[18%] h-[520px] w-[520px] rounded-full bg-secondary/[0.055] blur-[125px]" />
        <div className="absolute inset-0 opacity-[0.028]" style={{backgroundImage:'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',backgroundSize:'44px 44px',maskImage:'radial-gradient(ellipse at center, black 0%, transparent 76%)',WebkitMaskImage:'radial-gradient(ellipse at center, black 0%, transparent 76%)'}} />
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse at center, transparent 28%, hsl(var(--background) / 0.10) 68%, hsl(var(--background) / 0.42) 100%)'}} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-6 sm:px-6">
        <header>
          <div className="relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-primary/20 bg-card/75 px-3.5 py-2 shadow-[0_8px_28px_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
            <MapPin className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-foreground/85">Serving Madhubani</span>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="w-full max-w-md">
            <div className="mb-7 text-center">
              <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center overflow-hidden rounded-[21px] border border-primary/15 bg-card/80 shadow-[0_14px_34px_hsl(var(--foreground)/0.08)] backdrop-blur-xl">
                <span className="absolute inset-0 rounded-[21px] bg-primary/[0.06]" />
                <img src={assetUrl('/setu-icon.png')} alt="SETU" className="relative block h-full w-full object-contain" />
              </div>
              <h1 className="font-heading text-[26px] font-black tracking-[-0.04em] text-foreground">स्वागत है SETU पर</h1>
              <p className="mx-auto mt-2 max-w-[290px] text-sm leading-6 text-muted-foreground">Login or create your account to continue.</p>
            </div>

            <Card className="overflow-hidden rounded-[28px] border border-border/60 bg-card/80 p-2 shadow-[0_24px_70px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
              <div className="rounded-[22px] bg-background/55 p-4 sm:p-5">
                <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/55 p-1">
                  <Button type="button" variant="ghost" onClick={() => { setMode('phone'); setError(''); }} className={`h-11 rounded-xl text-sm font-bold ${mode === 'phone' ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground hover:bg-transparent hover:text-foreground'}`}>
                    <Phone className="mr-2 h-4 w-4" /> Phone
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setMode('google'); setError(''); }} className={`h-11 rounded-xl text-sm font-bold ${mode === 'google' ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground hover:bg-transparent hover:text-foreground'}`}>
                    <Mail className="mr-2 h-4 w-4" /> Google
                  </Button>
                </div>

                {mode === 'phone' && (
                  <>
                    <div className="mb-4" aria-describedby={error ? 'login-phone-error' : undefined}>
                      <div className="mb-2.5">
                        <p className="text-sm font-bold text-foreground">Mobile number</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">अपना मोबाइल नंबर डालें</p>
                      </div>
                      <label htmlFor="login-phone" className="sr-only">Mobile number</label>
                      <div className="flex gap-2.5">
                        <div className="flex h-12 shrink-0 items-center rounded-2xl border border-border/70 bg-muted/55 px-3.5">
                          <span className="text-sm font-bold text-foreground">🇮🇳 +91</span>
                        </div>
                        <Input id="login-phone" type="tel" inputMode="numeric" placeholder="10-digit mobile number" value={rawPhone} onChange={handlePhoneChange} onKeyDown={handleKeyDown} className="h-12 flex-1 rounded-2xl border-border/70 bg-background/75 px-4 text-base font-medium tracking-[0.12em] shadow-none focus-visible:ring-2 focus-visible:ring-primary/20" maxLength={10} autoFocus autoComplete="tel-national" disabled={loading} />
                      </div>
                      {rawPhone.length > 0 && rawPhone.length < 10 && <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">{10 - rawPhone.length} more digits needed</p>}
                    </div>

                    {error && <div id="login-phone-error" role="alert" aria-live="polite" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5"><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p className="text-xs leading-5 text-destructive">{error}</p></div>}
                    {cooldown > 0 && !error && <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/50 p-3.5"><Clock className="h-4 w-4 shrink-0 text-primary" /><p className="text-xs text-muted-foreground">OTP sent. Resend in <span className="font-bold tabular-nums text-foreground">{cooldown}s</span></p></div>}

                    <Button className="h-12 w-full rounded-2xl text-sm font-bold shadow-[0_10px_30px_hsl(var(--primary)/0.20)] active:scale-[0.985]" onClick={handleSendOTP} disabled={!canSend}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP...</> : cooldown > 0 ? <><Clock className="mr-2 h-4 w-4" />Resend in {cooldown}s</> : <>Send OTP<ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                    <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground/70">An OTP will be sent via SMS. By continuing you agree to SETU's terms.</p>
                  </>
                )}

                {mode === 'google' && (
                  <>
                    <div className="mb-5 text-center">
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border/60 bg-background shadow-sm">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                      <h2 className="text-base font-bold text-foreground">Continue with Google</h2>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Fast, secure and password-free sign in.</p>
                    </div>
                    {error && <div id="login-google-error" role="alert" aria-live="polite" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5"><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p className="text-xs leading-5 text-destructive">{error}</p></div>}
                    <Button variant="outline" className="h-12 w-full rounded-2xl border-border/70 bg-background text-sm font-bold shadow-sm active:scale-[0.985]" disabled={loading} onClick={handleGoogleSignIn}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</> : <>Continue with Google</>}
                    </Button>
                    <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground/70">Your Google account will be used to securely sign in to SETU.</p>
                  </>
                )}
              </div>
            </Card>

            {!import.meta.env.VITE_SUPABASE_URL && (
              <div className="mt-4"><Card className="rounded-2xl border-amber-200 bg-amber-50/60 p-3 text-center"><p className="mb-1 text-xs font-bold text-amber-800">Demo Mode</p><p className="text-xs leading-5 text-amber-700">No Supabase configured. Enter any 10-digit number — OTP cooldown is disabled in demo mode.</p></Card></div>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-center gap-2 pb-1 pt-4 text-[10px] font-medium text-muted-foreground/60">
          <span>Built for Madhubani, with</span><Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
        </footer>
      </div>
    </div>
  );
}
