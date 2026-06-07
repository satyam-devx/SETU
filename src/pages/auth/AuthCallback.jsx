// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — AUTH CALLBACK
//
// WHY THIS FILE EXISTS:
//
//  Google OAuth (and any Supabase OAuth provider) works by redirecting
//  the browser to an external provider, which then redirects BACK to
//  your app at a specific URL with the access token in the URL hash:
//
//    http://localhost:5173/auth/callback#access_token=...&refresh_token=...
//
//  Without a dedicated /auth/callback route:
//    1. Vite's SPA router renders whatever component handles '/' or a 404.
//    2. That component immediately navigates away (e.g. to /login or /).
//    3. The navigation strips the hash from the URL.
//    4. The Supabase client never sees the token → session is lost.
//    5. Result: OAuth loop — user lands back at login, never authenticated.
//
//  With this component:
//    1. /auth/callback renders this page BEFORE any navigation.
//    2. supabase.auth.getSession() exchanges the hash token for a real
//       session (Supabase JS does this automatically on detectSessionInUrl).
//    3. onAuthStateChange in AuthContext fires SIGNED_IN.
//    4. loadProfile runs → profile is loaded.
//    5. This component waits for isAuthenticated + isProfileLoaded,
//       then navigates to the correct portal.
//
//  CONFIGURATION REQUIRED in Supabase Dashboard:
//    Authentication → URL Configuration → Redirect URLs:
//    Add: http://localhost:5173/auth/callback
//    Add: https://your-production-domain.com/auth/callback
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated, isProfileLoaded, isLoading, portalPath, profile } = useAuth();
  const [error, setError] = useState('');

  // Step 1: On mount, check if there's an error in the hash/query params
  // (e.g. user denied Google permission)
  useEffect(() => {
    const hash   = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // OAuth error returned by provider
    const oauthError       = params.get('error');
    const oauthErrorDesc   = params.get('error_description');

    if (oauthError) {
      setError(oauthErrorDesc || oauthError || 'OAuth sign-in was cancelled or failed.');
      return;
    }

    // Supabase puts the tokens in the hash for implicit flow.
    // supabase-js detectSessionInUrl:true handles extraction automatically.
    // We just need to let the client process it — getSession() triggers that.
    if (hash.includes('access_token') || hash.includes('error')) {
      supabase.auth.getSession().catch(err => {
        console.error('[SETU AuthCallback] getSession error:', err);
        setError('Authentication failed. Please try again.');
      });
    }
  }, []);

  // Step 2: Once AuthContext resolves the session + profile, redirect
  useEffect(() => {
    if (error) return;           // Don't redirect if there's an error
    if (isLoading) return;       // Still resolving session

    if (isAuthenticated) {
      if (isProfileLoaded && portalPath && portalPath !== '/') {
        // Existing user — go to their portal
        navigate(portalPath, { replace: true });
      } else if (!isProfileLoaded) {
        // New user — profile row doesn't exist yet — go to onboarding
        // (For Google OAuth users, the DB trigger auto-creates a basic profile,
        // so this branch mainly handles edge cases where the trigger failed)
        navigate('/onboarding/register', { replace: true });
      }
    } else {
      // Not authenticated after callback — something went wrong
      // (e.g. token expired before exchange, or callback URL mismatch)
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isProfileLoaded, isLoading, portalPath, error, navigate]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        </div>
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Sign-in failed</h2>
          <p className="text-sm text-muted-foreground mb-5">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-10 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Loading state (normal — waiting for Supabase to exchange token)
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="font-heading text-primary font-bold text-lg">S</span>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Completing sign-in...</p>
      </div>
    </div>
  );
}
