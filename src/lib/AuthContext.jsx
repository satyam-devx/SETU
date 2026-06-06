// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — AUTH CONTEXT  (production-hardened)
//
// KEY FIXES APPLIED:
//  1. Removed redundant getSession() bootstrap — onAuthStateChange
//     fires INITIAL_SESSION on mount; using it as single source of truth
//     eliminates the dual-call race condition.
//  2. verifyOTP no longer fetches profile directly — state updates flow
//     exclusively through onAuthStateChange to prevent race conditions.
//  3. isAuthenticated is now session-based (!!user) not profile-based,
//     so a profile load failure doesn't silently log the user out.
//  4. loadProfile returns typed results, distinguishing "not found" from
//     real errors, so retries are only performed on transient failures.
//  5. signOut uses onAuthStateChange-driven state clearing, not
//     window.location.href, preserving SPA navigation.
//  6. Removed unused useNavigate import (AuthProvider is outside Router).
//  7. signInWithGoogle whitespace typo fixed.
//  8. Demo OTP strictly validates '1234'.
// ═══════════════════════════════════════════════════════════

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { supabase, getProfile, getPortalPath, isSupabaseConfigured } from './supabase';

const AuthContext = createContext(null);

// ── DEMO MODE PROFILE ─────────────────────────────────────
const DEMO_PROFILE = {
  id:          'u1',
  phone:       '+919876543200',
  name:        'Anita Devi',
  role:        'customer',
  village_id:  'v1',
  is_verified: true,
  setu_score:  720,
};

// ── PROVIDER ──────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [session,  setSession]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // FIX (Issue 3): isAuthenticated is session-based only.
  // Profile availability is tracked separately via isProfileLoaded.
  // This prevents a profile fetch failure from silently logging users out.
  const isAuthenticated  = !!user;
  const isProfileLoaded  = !!profile;

  // ── Load profile for a given user ──
  // FIX (Issue 4): Uses typed getProfile result to distinguish
  // "no row" (new user) from transient network errors.
  // Only retries on real errors; immediately returns null for new users.
  // FIX (Issue 19): Exponential backoff on retries.
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    if (!isSupabaseConfigured) {
      setProfile(DEMO_PROFILE);
      return;
    }

    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data, notFound, error } = await getProfile(authUser.id);

      if (data) {
        setProfile(data);
        return;
      }

      if (notFound) {
        // New user — no profile row yet. This is expected, not an error.
        setProfile(null);
        return;
      }

      if (error) {
        if (attempt < MAX_RETRIES - 1) {
          // Exponential backoff: 600ms, 1200ms, 2400ms
          const delay = 600 * Math.pow(2, attempt);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        // All retries exhausted
        console.error('[SETU Auth] Could not load profile after retries:', error);
        setProfile(null);
        setAuthError('Could not load your profile. Please check your connection and try again.');
        return;
      }
    }
  }, []);

  // ── Bootstrap: subscribe to auth state changes ──
  // FIX (Issue 1): Removed redundant getSession() call.
  // Supabase fires INITIAL_SESSION via onAuthStateChange on mount —
  // using that as the single source of truth eliminates the dual-call
  // race condition where loadProfile was being called twice.
  useEffect(() => {
    let mounted = true;
    let initialised = false; // Guard: setIsLoading(false) only once, after first event

    if (!isSupabaseConfigured) {
      setUser({ id: DEMO_PROFILE.id, phone: DEMO_PROFILE.phone });
      setProfile(DEMO_PROFILE);
      setIsLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;

        setSession(s);
        setUser(s?.user ?? null);
        setAuthError(null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
        } else if (s?.user) {
          // Await profile load before declaring initialisation complete,
          // so ProtectedRoute never flashes "unauthenticated" mid-load.
          await loadProfile(s.user);
        } else {
          setProfile(null);
        }

        // Only set isLoading(false) once — on the very first auth event.
        // Subsequent events (TOKEN_REFRESHED, USER_UPDATED) must not
        // retrigger the loading spinner and risk breaking active sessions.
        if (!initialised) {
          initialised = true;
          if (mounted) setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ── Sign Out ──
  // FIX (Issue 6): Removed window.location.href — Supabase fires SIGNED_OUT
  // on onAuthStateChange which clears state reactively. No full reload needed.
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      // State cleared by SIGNED_OUT event in onAuthStateChange above.
    } else {
      // Demo mode — clear manually since there's no Supabase subscription
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  }, []);

  // ── Send OTP ──
  const sendOTP = useCallback(async (phone) => {
    if (!isSupabaseConfigured) {
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms' },
    });
    return { error };
  }, []);

  // ── Verify OTP ──
  // FIX (Issue 2): No longer fetches profile directly. Supabase will fire
  // SIGNED_IN on onAuthStateChange, which calls loadProfile. OTPVerify.jsx
  // should react to the isAuthenticated / profile state change via useEffect
  // rather than navigating from the response of this function.
  const verifyOTP = useCallback(async (phone, token) => {
    if (!isSupabaseConfigured) {
      // FIX (Issue 12): Demo mode strictly validates '1234', not any 4 digits.
      if (token === '1234') {
        setUser({ id: DEMO_PROFILE.id, phone });
        setProfile({ ...DEMO_PROFILE, phone });
        return { error: null };
      }
      return { error: { message: 'Demo OTP is 1234. Enter 1234 to continue.' } };
    }

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    return { error };
    // State (user, session, profile) is set by onAuthStateChange.
  }, []);

  // ── Create profile (called from onboarding after first OTP verify) ──
  const createProfile = useCallback(async (userId, profileData) => {
    if (!isSupabaseConfigured) return { error: null };

    const { error } = await supabase.from('profiles').insert({
      id:    userId,
      phone: profileData.phone,
      name:  profileData.name || null,
      role:  profileData.role || 'customer',
    });

    if (!error) {
      // Re-fetch to get the full profile row with DB defaults applied
      const { data } = await getProfile(userId);
      if (data) setProfile(data);
    }

    return { error };
  }, []);

  // ── Email / Password sign-in (admin/dev use) ──
  const signInWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }
    return await supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUpWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }
    return await supabase.auth.signUp({ email, password });
  }, []);

  // ── Google OAuth ──
  // FIX (Issue 18): Removed trailing whitespace from error message string.
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  // ── Update profile ──
  const updateProfile = useCallback(async (updates) => {
    if (!user || !isSupabaseConfigured) return { error: null };
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (!error) {
      // Re-fetch to ensure local state matches DB exactly
      const { data } = await getProfile(user.id);
      if (data) setProfile(data);
    }
    return { error };
  }, [user]);

  const value = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated,
    isProfileLoaded,
    authError,
    signOut,
    sendOTP,
    verifyOTP,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    createProfile,
    updateProfile,
    // Convenience getters
    userRole:   profile?.role      ?? null,
    userName:   profile?.name      ?? null,
    userPhone:  profile?.phone     ?? user?.phone ?? null,
    setuScore:  profile?.setu_score ?? 500,
    isVerified: profile?.is_verified ?? false,
    portalPath: profile ? getPortalPath(profile.role) : '/',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
