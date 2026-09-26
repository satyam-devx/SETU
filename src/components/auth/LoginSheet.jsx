import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { validators } from '@/lib/form-validation';
import { getPortalPath } from '@/lib/supabase';
import {
  consumeAuthRoleIntent,
  getAuthRoleIntent,
  getRoleEntryPath,
  setAuthRoleIntent,
} from '@/lib/authIntent';
import { consumePostLoginRedirect } from '@/lib/postLoginRedirect';

const OTP_LENGTH = 6;
const OTP_COOLDOWN_SECS = 60;
const RESEND_COOLDOWN_SECS = 30;
const COOLDOWN_KEY = 'setu_otp_cooldown_until';

function getCooldown() {
  try {
    const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function startCooldown(seconds = OTP_COOLDOWN_SECS) {
  try { sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + seconds * 1000)); } catch {}
}

function isCompleteProfile(profile) {
  const name = profile?.name?.trim?.();
  return !!profile && !!name && !['setu user'].includes(name.toLowerCase()) && !!profile.village_id;
}

function isSafeRoleTransition(currentRole, intendedRole) {
  if (!intendedRole) return false;
  if (!currentRole || currentRole === intendedRole) return true;
  // A normal customer may enter a professional onboarding flow. Existing
  // professional/admin roles are never silently converted by a UI choice.
  return currentRole === 'customer' && ['vendor', 'rider', 'seva_provider'].includes(intendedRole);
}

export default function LoginSheet({ open, onClose, role = 'customer' }) {
  const navigate = useNavigate();
  const {
    sendOTP,
    verifyOTP,
    signInWithGoogle,
    isAuthenticated,
    isProfileLoaded,
    isLoading: authLoading,
    profile,
    user,
  } = useAuth();

  const [mode, setMode] = useState('phone');
  const [step, setStep] = useState('phone');
  const [rawPhone, setRawPhone] = useState('');
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(getCooldown());
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef([]);

  const intendedRole = role || getAuthRoleIntent() || 'customer';
  const roleLabel = {
    customer: 'Customer',
    vendor: 'Vendor',
    rider: 'Rider',
    seva_provider: 'Seva Provider',
  }[intendedRole] || 'Customer';

  useEffect(() => {
    if (!open) return;
    setAuthRoleIntent(intendedRole);
    setMode('phone');
    setStep('phone');
    setRawPhone('');
    setDigits(Array(OTP_LENGTH).fill(''));
    setLoading(false);
    setError('');
    setSuccess(false);
    setCooldown(getCooldown());
    setResendCooldown(0);
  }, [open, intendedRole]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // A native Google sign-in completes in-place. Phone OTP does the same.
  // Web Google leaves the app for the provider; AuthCallback owns the return.
  useEffect(() => {
    if (!open || authLoading || !isAuthenticated || !isProfileLoaded) return;
    if (!success && step !== 'phone') return;

    const pending = consumePostLoginRedirect();
    const selected = consumeAuthRoleIntent() || intendedRole;
    const currentRole = profile?.role;

    let destination;
    if (pending) {
      destination = pending;
    } else if (currentRole && currentRole !== selected && !isSafeRoleTransition(currentRole, selected)) {
      destination = getPortalPath(currentRole);
    } else if (selected && currentRole !== selected) {
      destination = getRoleEntryPath(selected);
    } else if (!isCompleteProfile(profile)) {
      destination = getRoleEntryPath(selected);
    } else {
      destination = getPortalPath(currentRole || selected);
    }

    setSuccess(true);
    setLoading(false);
    // Give the success state one paint so the sheet feels deliberate rather
    // than flashing into the portal.
    const timer = setTimeout(() => {
      onClose?.();
      navigate(destination, { replace: true });
    }, 450);
    return () => clearTimeout(timer);
  }, [
    open, authLoading, isAuthenticated, isProfileLoaded, loading, success,
    step, profile, intendedRole, onClose,
  ]);

  // Role-specific auth completion event is handled by RoleSelect.
  // This component only owns authentication UI and state.

  useEffect(() => {
    if (step === 'otp') inputRefs.current[0]?.focus();
  }, [step]);

  if (!open) return null;

  const send = async () => {
    if (cooldown > 0 || loading) return;
    const validationError = validators.indianPhone(rawPhone);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    setAuthRoleIntent(intendedRole);

    const phone = `+91${rawPhone}`;
    const { error: otpError } = await sendOTP(phone);
    setLoading(false);

    if (otpError) {
      if (/rate/i.test(otpError.message || '')) {
        startCooldown();
        setCooldown(OTP_COOLDOWN_SECS);
        setError('Too many attempts. Please wait before requesting another OTP.');
      } else {
        setError(otpError.message || 'Could not send OTP. Please try again.');
      }
      return;
    }

    startCooldown();
    setCooldown(OTP_COOLDOWN_SECS);
    setResendCooldown(RESEND_COOLDOWN_SECS);
    setStep('otp');
  };

  const verify = async (tokenOverride) => {
    const token = tokenOverride ?? digits.join('');
    if (token.length !== OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    setLoading(true);
    setError('');
    const { error: verifyError } = await verifyOTP(`+91${rawPhone}`, token);

    if (verifyError) {
      setLoading(false);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setError(/expired/i.test(verifyError.message || '')
        ? 'This OTP has expired. Request a new one.'
        : /invalid/i.test(verifyError.message || '')
          ? 'Incorrect OTP. Please try again.'
          : verifyError.message || 'Verification failed. Please try again.');
      return;
    }

    setSuccess(true);
    // AuthContext's SIGNED_IN event will resolve profile and trigger the
    // routing effect above.
  };

  const google = async () => {
    setLoading(true);
    setError('');
    setAuthRoleIntent(intendedRole);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setLoading(false);
      setError(googleError.message || 'Google sign-in failed. Please try again.');
    }
    // On native, AuthContext will update in this same view.
    // On web, Google navigates away and AuthCallback consumes the intent.
  };

  const onDigit = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError('');
    if (clean && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  const onPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    if (pasted.length === OTP_LENGTH) verify(pasted);
    else inputRefs.current[pasted.length]?.focus();
  };

  const resend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    const { error: resendError } = await sendOTP(`+91${rawPhone}`);
    setLoading(false);
    if (resendError) {
      setError(resendError.message || 'Could not resend OTP.');
      return;
    }
    startCooldown();
    setCooldown(OTP_COOLDOWN_SECS);
    setResendCooldown(RESEND_COOLDOWN_SECS);
    setDigits(Array(OTP_LENGTH).fill(''));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="presentation">
      <button
        aria-label="Close login"
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="setu-auth-sheet-title"
        className="relative w-full max-w-xl overflow-hidden rounded-t-[32px] border border-border/70 bg-background/95 shadow-[0_-30px_100px_rgba(0,0,0,.24)] backdrop-blur-2xl animate-in slide-in-from-bottom duration-300 sm:max-h-[78vh]"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/25" />

        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Secure SETU access</p>
            <h2 id="setu-auth-sheet-title" className="mt-1 text-xl font-black tracking-[-0.035em]">
              {success ? 'You’re all set' : `${roleLabel} login`}
            </h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 min-h-[40px] min-w-[40px] place-items-center rounded-full border border-border/60 bg-card/70 text-muted-foreground transition hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(78vh-92px)] overflow-y-auto px-5 pb-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mt-5 text-lg font-bold">Authentication successful</h3>
              <p className="mt-1 text-sm text-muted-foreground">Opening your {roleLabel.toLowerCase()} experience…</p>
              <Loader2 className="mt-5 h-5 w-5 animate-spin text-primary" />
            </div>
          ) : step === 'otp' ? (
            <>
              <button onClick={() => { setStep('phone'); setError(''); }} className="mb-5 inline-flex h-10 min-h-[40px] items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <div className="mb-5 rounded-2xl border border-border/60 bg-card/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Verify your mobile</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">OTP sent to +91 {rawPhone}</p>
                  </div>
                </div>
              </div>

              <div className="mb-5 flex justify-center gap-1.5 sm:gap-2" onPaste={onPaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={e => onDigit(index, e.target.value)}
                    disabled={loading}
                    className={`h-12 w-11 rounded-2xl border-2 bg-background/80 text-center text-xl font-bold outline-none transition-all ${digit ? 'border-primary bg-primary/5' : 'border-border/70'} focus:border-primary focus:ring-2 focus:ring-primary/15`}
                  />
                ))}
              </div>

              {error && <ErrorBox message={error} />}
              {loading && <div className="mb-3 flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Verifying securely…</div>}

              <Button className="h-12 w-full rounded-2xl font-bold" disabled={loading || digits.join('').length !== OTP_LENGTH} onClick={() => verify()}>
                Verify OTP <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="mt-4 text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-muted-foreground">Resend available in <span className="font-bold tabular-nums text-foreground">{resendCooldown}s</span></p>
                ) : (
                  <button onClick={resend} disabled={loading} className="inline-flex h-10 min-h-[40px] items-center justify-center text-xs font-bold text-primary disabled:opacity-50">Resend OTP</button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/55 p-1">
                <Button type="button" variant="ghost" onClick={() => { setMode('phone'); setError(''); }} className={`h-11 rounded-xl text-sm font-bold ${mode === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-transparent'}`}>
                  <Phone className="mr-2 h-4 w-4" /> Phone
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setMode('google'); setError(''); }} className={`h-11 rounded-xl text-sm font-bold ${mode === 'google' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-transparent'}`}>
                  <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-black text-[#4285F4]">G</span> Google
                </Button>
              </div>

              {mode === 'phone' ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm font-bold">Mobile number</p>
                    <p className="mt-1 text-xs text-muted-foreground">Login or create your {roleLabel.toLowerCase()} account with OTP.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="flex h-12 shrink-0 items-center rounded-2xl border border-border/70 bg-muted/55 px-3.5 text-sm font-bold">🇮🇳 +91</div>
                    <Input
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={rawPhone}
                      disabled={loading}
                      placeholder="10-digit mobile number"
                      onChange={e => { setRawPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && send()}
                      className="h-12 flex-1 rounded-2xl bg-background/75 text-base font-medium tracking-[0.12em]"
                    />
                  </div>
                  {error && <ErrorBox message={error} />}
                  {cooldown > 0 && !error && <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground"><Clock className="h-4 w-4 text-primary" /> Resend available in <b className="text-foreground">{cooldown}s</b></div>}
                  <Button className="mt-4 h-12 w-full rounded-2xl font-bold shadow-[0_10px_30px_hsl(var(--primary)/0.20)]" disabled={loading || cooldown > 0 || rawPhone.length !== 10} onClick={send}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP…</> : <>Continue with Phone <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-border/60 bg-card/55 p-5 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border/60 bg-background shadow-sm">
                      <span className="text-2xl font-black text-[#4285F4]">G</span>
                    </div>
                    <h3 className="mt-4 text-base font-bold">Continue with Google</h3>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Fast, secure and password-free. Your selected role stays attached to this sign-in.</p>
                  </div>
                  {error && <ErrorBox message={error} />}
                  <Button variant="outline" className="mt-4 h-12 w-full rounded-2xl bg-background font-bold" disabled={loading} onClick={google}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</> : <>Continue with Google</>}
                  </Button>
                </>
              )}

              <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground/70">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>OTP protected · Role-aware routing · Secure session</span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div role="alert" aria-live="polite" className="mt-3 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-xs leading-5 text-destructive">{message}</p>
    </div>
  );
}
