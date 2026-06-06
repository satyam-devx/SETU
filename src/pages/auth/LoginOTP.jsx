import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

const VALID_INDIAN_PHONE = /^[6-9]\d{9}$/;

export default function LoginOTP() {
  const navigate   = useNavigate();
  const {
    sendOTP,
    signInWithEmail,
    signUpWithEmail,
    isAuthenticated,
    portalPath
  } = useAuth();

  const [mode, setMode] = useState('phone');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [rawPhone, setRawPhone]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // If already authenticated, go to their portal
  React.useEffect(() => {
    if (isAuthenticated) navigate(portalPath, { replace: true });
  }, [isAuthenticated, portalPath, navigate]);

  const handlePhoneChange = (e) => {
    // Strip non-digits, max 10 digits
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setRawPhone(digits);
    setError('');
  };

  const handleSendOTP = async () => {
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
      // Surface user-friendly messages
      if (otpError.message?.includes('rate')) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (otpError.message?.includes('invalid')) {
        setError('Invalid phone number. Please check and try again.');
      } else {
        setError(otpError.message || 'Could not send OTP. Please try again.');
      }
      return;
    }

    navigate(`/login/verify?phone=${encodeURIComponent(phone)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSendOTP();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
        <p className="text-muted-foreground/60 text-xs mt-0.5">Madhepur · Madhubani · Bihar · मिथिला</p>
      </div>

      {/* Login card */}
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

        <div className="flex gap-2 mb-5">
          <Button
            type="button"
            variant={mode === 'phone' ? 'default' : 'outline'}
            onClick={() => setMode('phone')}
            className="flex-1"
          >
            Phone
          </Button>

          <Button
            type="button"
            variant={mode === 'email' ? 'default' : 'outline'}
            onClick={() => setMode('email')}
            className="flex-1"
          >
            Email
          </Button>
        </div>

        {mode === 'phone' && (
        <>
        {/* Phone input */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            अपना मोबाइल नंबर डालें
          </p>
          <div className="flex gap-2">
            <div className="flex items-center justify-center bg-muted rounded-lg px-3 border border-border h-10 shrink-0">
              <span className="text-sm font-semibold text-foreground">🇮🇳 +91</span>
            </div>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={rawPhone}
              onChange={handlePhoneChange}
              onKeyDown={handleKeyDown}
              className="flex-1 h-10 text-base tracking-widest"
              maxLength={10}
              autoFocus
              autoComplete="tel-national"
            />
          </div>
          {rawPhone.length > 0 && rawPhone.length < 10 && (
            <p className="text-xs text-muted-foreground mt-1">
              {10 - rawPhone.length} more digits needed
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Send OTP button */}
        <Button
          className="w-full h-11 gap-2 text-sm font-semibold"
          onClick={handleSendOTP}
          disabled={loading || rawPhone.length !== 10}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending OTP...
            </>
          ) : (
            <>
              Send OTP
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          An OTP will be sent to your number via SMS.
          By continuing, you agree to SETU's terms.
        </p>
      </>
    )}

        {mode === 'email' && (
          <>
            <Input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-3"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4"
            />

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button
              className="w-full mb-2"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError('');

                const { error } = await signInWithEmail(
                  email,
                  password
                );

                setLoading(false);

                if (error) {
                  setError(error.message);
                }
              }}
            >
              Login with Email
            </Button>

            <Button
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError('');

                const { error } = await signUpWithEmail(
                  email,
                  password
                );

                setLoading(false);

                if (error) {
                  setError(error.message);
                } else {
                  alert('Account created successfully');
                }
              }}
            >
              Create Account
            </Button>
          </>
        )}

      {/* Demo mode notice */}
      {!import.meta.env.VITE_SUPABASE_URL && (
        <div className="mt-4 w-full max-w-sm">
          <Card className="p-3 border-amber-200 bg-amber-50/60 text-center">
            <p className="text-xs text-amber-800 font-medium mb-1">Demo Mode</p>
            <p className="text-xs text-amber-700">
              Supabase is not configured. Enter any 10-digit number and use OTP <strong>1234</strong>.
            </p>
          </Card>
        </div>
      )}

      <p className="text-muted-foreground/40 text-xs mt-6">
        SETU v1.0 · बिहार में बना
      </p>
    </div>
  );
}
