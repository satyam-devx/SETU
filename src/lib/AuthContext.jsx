// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — AUTH CONTEXT  (production-hardened)
//
// BUGS FIXED IN THIS VERSION:
//
//  BUG — Google OAuth drops session after redirect:
//    redirectTo was set to window.location.origin (e.g. http://localhost:5173).
//    Supabase appends the token to the hash: http://localhost:5173/#access_token=...
//    When the SPA router loads '/', the RoleSelect component immediately
//    calls navigate() which strips the hash. The Supabase client never sees
//    the token → session is lost → user is redirected back to /login.
//
//    Fix: redirectTo now points to `${window.location.origin}/auth/callback`.
//    The new AuthCallback.jsx component renders at /auth/callback and waits
//    for Supabase to exchange the hash token BEFORE any navigation occurs.
//
//    REQUIRED ACTION: Add the callback URL to Supabase Dashboard →
//    Authentication → URL Configuration → Redirect URLs:
//      http://localhost:5173/auth/callback
//      https://your-production-domain.com/auth/callback
//
// All other fixes from previous version are preserved:
//  1. onAuthStateChange as single source of truth (no dual getSession race).
//  2. verifyOTP does not fetch profile — state flows through onAuthStateChange.
//  3. isAuthenticated is session-based (!!user), not profile-based.
//  4. loadProfile distinguishes "not found" from real DB errors.
//  5. signOut uses reactive state clearing, not window.location.href.
//  6. No useNavigate in AuthProvider (AuthProvider is outside Router).
//  7. Demo OTP strictly validates '1234'.
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

  // isAuthenticated is session-based only.
  // Profile availability is tracked separately via isProfileLoaded.
  // This prevents a profile fetch failure from silently logging users out.
  const isAuthenticated  = !!user;
  const isProfileLoaded  = !!profile;

  // ── Load profile for a given user ──
  // Uses typed getProfile result to distinguish "no row" (new user)
  // from transient network errors. Only retries on real errors.
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
        // New user — no profile row yet. Expected for first-time logins.
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
  // Supabase fires INITIAL_SESSION via onAuthStateChange on mount —
  // this is the single source of truth, eliminating the dual-call
  // race condition that caused duplicate loadProfile calls.
  useEffect(() => {
    let mounted = true;
    let initialised = false; // Guard: setIsLoading(false) only once

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
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      // State cleared by SIGNED_OUT event in onAuthStateChange above.
    } else {
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
  // Does NOT fetch profile directly. Supabase fires SIGNED_IN on
  // onAuthStateChange, which calls loadProfile. Navigation is handled
  // reactively in OTPVerify.jsx after auth state resolves.
  const verifyOTP = useCallback(async (phone, token) => {
    if (!isSupabaseConfigured) {
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
  // ── Create / complete profile (called from onboarding) ──
  //
  // WHY UPSERT, NOT INSERT:
  // The handle_new_user trigger on auth.users fires immediately when a
  // user signs up (phone OTP or Google OAuth) and inserts a skeleton
  // profile row with a generated name ("SETU User" / Google display name).
  // By the time the user reaches /onboarding/register and clicks Continue,
  // that row ALREADY EXISTS. A plain INSERT hits the PRIMARY KEY unique
  // constraint → "duplicate key value violates unique constraint profiles_pkey"
  // → Supabase returns an error → frontend shows "Could not create your profile."
  //
  // Fix: use upsert() which maps to INSERT ... ON CONFLICT (id) DO UPDATE.
  // When the trigger row exists → we UPDATE name, phone, role with real values.
  // When no row exists (e.g. trigger failed) → we INSERT a fresh row.
  // Either way the operation succeeds and the profile reflects what the user entered.
  const createProfile = useCallback(async (userId, profileData) => {
    if (!isSupabaseConfigured) return { error: null };

    const { error } = await supabase.from('profiles').upsert(
      {
        id:    userId,
        phone: profileData.phone || '',
        name:  profileData.name || null,
        role:  profileData.role || 'customer',
      },
      {
        onConflict: 'id',          // conflict target = primary key
        ignoreDuplicates: false,   // DO UPDATE (not DO NOTHING) so name gets saved
      }
    );

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
  // FIX: redirectTo now points to /auth/callback instead of origin root.
  //
  // BEFORE (broken):
  //   redirectTo: window.location.origin
  //   → Supabase redirects to http://localhost:5173/#access_token=...
  //   → RoleSelect renders, calls navigate('/')
  //   → Hash is stripped → Supabase never sees token → session lost
  //
  // AFTER (fixed):
  //   redirectTo: window.location.origin + '/auth/callback'
  //   → Supabase redirects to http://localhost:5173/auth/callback#access_token=...
  //   → AuthCallback.jsx renders, does NOT navigate before token exchange
  //   → Supabase client exchanges token → SIGNED_IN fires → session saved
  //
  // REQUIRED: Add to Supabase Dashboard → Auth → URL Configuration → Redirect URLs:
  //   http://localhost:5173/auth/callback
  //   https://your-production-domain.com/auth/callback
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
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
