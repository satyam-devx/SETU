// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — OTP VERIFY  (production-hardened)
//
// KEY FIXES APPLIED:
//  1. Navigation after OTP success is now driven by auth state changes
//     (isAuthenticated, isProfileLoaded) rather than the verifyOTP response,
//     eliminating the race between onAuthStateChange and direct profile fetch.
//  2. eslint-disable comment removed from auto-submit useEffect; deps corrected.
//  3. "New user" detection now uses isAuthenticated && !isProfileLoaded,
//     so navigation to onboarding only happens after auth state settles.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { getPortalPath } from '@/lib/supabase';

const OTP_LENGTH      = 4;
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

  // If no phone in query params, back to login
  useEffect(() => {
    if (!phone) navigate('/login', { replace: true });
  }, [phone, navigate]);

  // FIX (Issue 2): Navigation after OTP success is now driven by auth state,
  // not the return value of verifyOTP. This prevents the race condition between
  // onAuthStateChange setting state and the old direct getProfile() call.
  //
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
        // Existing user — go to their portal
        navigate(getPortalPath(profile.role), { replace: true });
      } else {
        // New user — no profile row yet — go to onboarding
        navigate('/onboarding/register', { state: { phone } });
      }
    }
  }, [success, isLoading, isAuthenticated, isProfileLoaded, profile, phone, navigate, portalPath]);

  // If already authenticated before this page loaded, redirect immediately
  useEffect(() => {
    if (!isLoading && isAuthenticated && isProfileLoaded) {
      navigate(portalPath, { replace: true });
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

  // Auto-submit when all digits filled
  // FIX (Issue 16): Removed eslint-disable; corrected dep array.
  useEffect(() => {
    const token = digits.join('');
    if (token.length === OTP_LENGTH && !loading && !success) {
      handleVerify(token);
    }
  }, [digits, loading, success, handleVerify]);

  const handleDigitChange = (index, value) => {
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

  // FIX (Issue 2): handleVerify no longer navigates — it only verifies.
  // Navigation is handled reactively by the useEffect above that watches
  // isAuthenticated / isProfileLoaded after success is set.
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

    // Mark success — the useEffect above will handle navigation
    // once onAuthStateChange fires and auth state settles.
    setSuccess(true);
  }, [digits, phone, verifyOTP]);

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

  // FIX (Issue 13): More robust phone masking that handles variable-length numbers
  const maskedPhone = phone
    ? (() => {
        if (phone.startsWith('+91') && phone.length === 13) {
          // +91XXXXXXXXXX → +91 XXX ****XX
          return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ****${phone.slice(-2)}`;
        }
        // Generic fallback: show first 4 and last 2 chars
        return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
      })()
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">

      <div className="text-center mb-10">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
      </div>

      <Card className="w-full max-w-sm p-6 border-border shadow-xl">

        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 -mt-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="text-center mb-6">
          {success ? (
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📱</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground">
            {success ? 'Verified!' : 'Enter OTP'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {success
              ? 'Logging you in...'
              : <>OTP sent to <span className="font-semibold text-foreground">{maskedPhone}</span></>
            }
          </p>
        </div>

        {!success && (
          <>
            <div className="flex justify-center gap-3 mb-4" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  disabled={loading}
                  className={`
                    w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2
                    bg-background outline-none transition-all
                    focus:border-primary focus:ring-2 focus:ring-primary/20
                    ${digit ? 'border-primary bg-primary/5' : 'border-border'}
                    ${error ? 'border-destructive' : ''}
                    ${loading ? 'opacity-60 cursor-not-allowed' : ''}
                  `}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Verifying...</span>
              </div>
            )}

            {!loading && digits.join('').length === OTP_LENGTH && (
              <Button
                className="w-full h-11 font-semibold mb-4"
                onClick={() => handleVerify()}
              >
                Verify OTP
              </Button>
            )}

            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Resend OTP in <span className="font-semibold text-foreground">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1 mx-auto disabled:opacity-50"
                >
                  {resending ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" /> Resend OTP</>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {success && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Taking you to your portal...</span>
          </div>
        )}
      </Card>

      {!import.meta.env.VITE_SUPABASE_URL && (
        <div className="mt-4 w-full max-w-sm">
          <Card className="p-3 border-amber-200 bg-amber-50/60 text-center">
            <p className="text-xs text-amber-800">
              Demo mode — use OTP <strong>1234</strong> for any number.
            </p>
          </Card>
        </div>
      )}

      <p className="text-muted-foreground/40 text-xs mt-6">SETU v1.0 · बिहार में बना</p>
    </div>
  );
}
