// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — OTP VERIFY  (production-hardened)
//
// BUGS FIXED IN THIS VERSION:
//
//  BUG 1 — WHITE SCREEN (Critical):
//    handleVerify was declared with useCallback AFTER the useEffect
//    that listed it in its dependency array. A `const` declared with
//    useCallback is in the temporal dead zone at the point the useEffect
//    closure is created — this causes a ReferenceError which React
//    catches as a render error, producing a completely blank page.
//    Fix: handleVerify useCallback is now declared BEFORE any useEffect
//    that references it.
//
//  BUG 2 — Redirect after auth state change:
//    Navigation after OTP success is driven by auth state changes
//    (isAuthenticated, isProfileLoaded) rather than the verifyOTP
//    return value, eliminating the race condition.
//
//  BUG 3 — New user detection:
//    isAuthenticated && !isProfileLoaded correctly routes new users
//    (no profile row) to onboarding instead of crashing.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, RefreshCw, MapPin, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { getPortalPath } from '@/lib/supabase';
import { consumePostLoginRedirect } from '@/lib/postLoginRedirect';

const OTP_LENGTH      = 6; // Supabase default OTP length is 6 digits
const RESEND_COOLDOWN = 30; // seconds

export default function OTPVerify() {
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();
  const phone            = searchParams.get('phone') || '';

  const {
    verifyOTP,
    sendOTP,
    isAuthenticated,
    isProfileLoaded,
    isLoading,
    profile,
    portalPath,
  } = useAuth();

  const [digits, setDigits]               = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending]         = useState(false);
  const inputRefs = useRef([]);

  // ─────────────────────────────────────────────────────────
  // handleVerify MUST be declared before any useEffect that
  // references it in a dependency array. Declaring it after
  // (as was the case before) puts it in the temporal dead zone
  // at the time the useEffect closure is created, causing a
  // ReferenceError → blank white screen.
  // ─────────────────────────────────────────────────────────
  const handleVerify = useCallback(async (tokenOverride) => {
    const token = tokenOverride ?? digits.join('');
    if (token.length !== OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    setLoading(true);
    setError('');

    const { error: verifyError } = await verifyOTP(phone, token);
    setLoading(false);

    if (verifyError) {
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      if (verifyError.message?.includes('expired')) {
        setError('OTP has expired. Please request a new one.');
      } else if (verifyError.message?.includes('invalid') || verifyError.message?.includes('Invalid')) {
        setError('Incorrect OTP. Please try again.');
      } else {
        setError(verifyError.message || 'Verification failed. Please try again.');
      }
      return;
    }

    // Mark success — the useEffect below will handle navigation
    // once onAuthStateChange fires and auth state settles.
    setSuccess(true);
  }, [digits, phone, verifyOTP]);

  // If no phone in query params, back to login
  useEffect(() => {
    if (!phone) navigate('/login', { replace: true });
  }, [phone, navigate]);

  // Navigation after OTP success is driven by auth state changes.
  // Flow:
  //  - User enters OTP → handleVerify calls verifyOTP (no profile fetch)
  //  - Supabase fires SIGNED_IN → onAuthStateChange → loadProfile → sets profile
  //  - This effect fires → navigates to correct destination
  //  - If profile is null after auth resolves → new user → go to onboarding
  useEffect(() => {
    if (!success) return;         // Only redirect after successful OTP entry
    if (isLoading) return;        // Wait for auth state to fully resolve

    if (isAuthenticated) {
      if (isProfileLoaded) {
        // Existing user — go back wherever they were headed, if anywhere
        const pending = consumePostLoginRedirect();
        navigate(pending || getPortalPath(profile.role), { replace: true });
      } else {
        // New user — no profile row yet — go to onboarding first (the
        // pending redirect, if any, stays in sessionStorage for
        // RegisterOnboarding to pick up once the basic profile is set)
        navigate('/onboarding/register', { state: { phone } });
      }
    }
  }, [success, isLoading, isAuthenticated, isProfileLoaded, profile, phone, navigate]);

  // If already authenticated before this page loaded, redirect immediately
  useEffect(() => {
    if (!isLoading && isAuthenticated && isProfileLoaded) {
      const pending = consumePostLoginRedirect();
      navigate(pending || portalPath, { replace: true });
    }
  }, [isLoading, isAuthenticated, isProfileLoaded, portalPath, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-submit when all digits filled.
  // handleVerify is declared above this useEffect, so it is safe
  // to include in the dependency array.
  useEffect(() => {
    const token = digits.join('');
    if (token.length === OTP_LENGTH && !loading && !success) {
      handleVerify(token);
    }
  }, [digits, loading, success, handleVerify]);

  const handleDigitChange = (index, value) => {
    // Accept pasted multi-char input per-cell (take last char only)
    const digit = value.replace(/\D/g, '').slice(-1);
    setError('');
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { newDigits[i] = d; });
    setDigits(newDigits);
    const nextEmpty = newDigits.findIndex(d => !d);
    const focusIdx  = nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty;
    inputRefs.current[focusIdx]?.focus();
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();

    const { error: resendError } = await sendOTP(phone);
    setResending(false);

    if (resendError) {
      setError('Could not resend OTP. Please wait and try again.');
    } else {
      setResendCooldown(RESEND_COOLDOWN);
    }
  };

  // Robust phone masking
  const maskedPhone = phone
    ? (() => {
        if (phone.startsWith('+91') && phone.length === 13) {
          return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ****${phone.slice(-2)}`;
        }
        return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
      })()
    : '';


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
        <header className="flex items-center justify-between">
          <button onClick={() => navigate('/login')} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3.5 py-2 text-[11px] font-bold text-muted-foreground shadow-sm backdrop-blur-xl transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-card/75 px-3.5 py-2 shadow-[0_8px_28px_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
            <MapPin className="h-4 w-4 text-primary" strokeWidth={2.5} />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-foreground/85">Serving Madhubani</span>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="w-full max-w-md">
            <div className="mb-7 text-center">
              <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center overflow-hidden rounded-[21px] border border-primary/15 bg-card/80 shadow-[0_14px_34px_hsl(var(--foreground)/0.08)] backdrop-blur-xl">
                <span className="absolute inset-0 rounded-[21px] bg-primary/[0.06]" />
                <img src={new URL('../../setu-icon.png', import.meta.url).href} alt="SETU" className="relative block h-full w-full object-contain" />
              </div>
              <h1 className="font-heading text-[26px] font-black tracking-[-0.04em] text-foreground">{success ? 'All set' : 'Enter your OTP'}</h1>
              <p className="mx-auto mt-2 max-w-[300px] text-sm leading-6 text-muted-foreground">
                {success ? 'Logging you in and taking you to your SETU portal.' : <>OTP sent to <span className="font-bold text-foreground">{maskedPhone}</span></>}
              </p>
            </div>

            <Card className="overflow-hidden rounded-[28px] border border-border/60 bg-card/80 p-2 shadow-[0_24px_70px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
              <div className="rounded-[22px] bg-background/55 p-4 sm:p-5">
                {!success && (
                  <>
                    <div className="mb-5 rounded-2xl border border-border/60 bg-muted/35 p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10"><span className="text-base">✦</span></div>
                        <div><p className="text-sm font-bold text-foreground">Secure verification</p><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">Enter the 6-digit code sent to your mobile.</p></div>
                      </div>
                    </div>

                    <div className="mb-5 flex justify-center gap-1.5 sm:gap-2" onPaste={handlePaste}>
                      {digits.map((digit, index) => (
                        <input key={index} ref={el => { inputRefs.current[index] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={e => handleDigitChange(index, e.target.value)} onKeyDown={e => handleKeyDown(index, e)} disabled={loading}
                          className={`h-12 w-11 rounded-2xl border-2 bg-background/80 text-center text-xl font-bold outline-none transition-all ${digit ? 'border-primary bg-primary/5 shadow-[0_0_0_3px_hsl(var(--primary)/0.07)]' : 'border-border/70'} focus:border-primary focus:ring-2 focus:ring-primary/15 ${error ? 'border-destructive' : ''} ${loading ? 'cursor-not-allowed opacity-60' : ''}`}
                        />
                      ))}
                    </div>

                    {error && <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p className="text-xs leading-5 text-destructive">{error}</p></div>}
                    {loading && <div className="mb-3 flex items-center justify-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-xs font-medium text-muted-foreground">Verifying...</span></div>}

                    {!loading && digits.join('').length === OTP_LENGTH && <Button className="mb-4 h-12 w-full rounded-2xl font-bold shadow-[0_10px_30px_hsl(var(--primary)/0.20)]" onClick={() => handleVerify()}>Verify OTP</Button>}

                    <div className="text-center">
                      {resendCooldown > 0 ? <p className="text-xs text-muted-foreground">Resend OTP in <span className="font-bold tabular-nums text-foreground">{resendCooldown}s</span></p> : (
                        <button onClick={handleResend} disabled={resending} className="mx-auto inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-opacity hover:opacity-80 disabled:opacity-50">
                          {resending ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</> : <><RefreshCw className="h-3 w-3" /> Resend OTP</>}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {success && (
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10"><CheckCircle className="h-7 w-7 text-primary" /></div>
                    <p className="text-sm font-bold text-foreground">Phone verified successfully</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Taking you to your portal...</div>
                  </div>
                )}
              </div>
            </Card>

            {!import.meta.env.VITE_SUPABASE_URL && <div className="mt-4"><Card className="rounded-2xl border-amber-200 bg-amber-50/60 p-3 text-center"><p className="text-xs text-amber-800">Demo mode — use OTP <strong>1234</strong> for any number.</p></Card></div>}
          </div>
        </main>

        <footer className="flex items-center justify-center gap-2 pb-1 pt-4 text-[10px] font-medium text-muted-foreground/60">
          <span>Built for Madhubani, with</span><Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
        </footer>
      </div>
    </div>
  );
}
