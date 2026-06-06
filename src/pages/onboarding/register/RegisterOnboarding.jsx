// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — REGISTER ONBOARDING
//
// This page is reached after a first-time OTP verification.
// The user has a valid Supabase auth session but no profile row.
// They enter their name and we create their profile as 'customer'.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

export default function RegisterOnboarding() {
  const navigate       = useNavigate();
  const location       = useLocation();
  const phone          = location.state?.phone || '';

  const { user, createProfile, isProfileLoaded, portalPath } = useAuth();

  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // If profile already exists (e.g. back-navigated), go to portal
  useEffect(() => {
    if (isProfileLoaded) {
      navigate(portalPath, { replace: true });
    }
  }, [isProfileLoaded, portalPath, navigate]);

  // If no authenticated user, go back to login
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

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
      setError('Could not create your profile. Please try again.');
      return;
    }

    // Profile created — the useEffect above (isProfileLoaded) will redirect
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
          />
        </div>

        {error && (
          <p className="text-xs text-destructive mb-4">{error}</p>
        )}

        <Button
          className="w-full h-11 gap-2 text-sm font-semibold"
          onClick={handleRegister}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </Card>

      <p className="text-muted-foreground/40 text-xs mt-6">SETU v1.0 · बिहार में बना</p>
    </div>
  );
}
