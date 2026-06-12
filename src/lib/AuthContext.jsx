// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — AUTH CONTEXT  (v3 — production hardened)
//
// Fixes over v2:
//  1. GitHub Pages base path: redirectTo now uses BASE_URL env var
//     so /SETU/auth/callback works on GitHub Pages.
//  2. authError exposed in context (was internal-only before).
//  3. Retry jitter — prevents thundering herd on server restart.
//  4. Profile cache invalidation on updateProfile.
//  5. clearError helper for consuming UI.
//  6. reloadProfile() is now async/awaitable — onboarding flows
//     await it before navigating so ProtectedRoute sees updated role.
// ═══════════════════════════════════════════════════════════

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { supabase, getProfile, getPortalPath, isSupabaseConfigured } from './supabase';
import { clearCache } from '@/hooks/useDataFetch';

const AuthContext = createContext(null);

const DEMO_PROFILE = {
  id:          'u1',
  phone:       '+919876543200',
  name:        'Anita Devi',
  role:        'customer',
  village_id:  'v1',
  is_verified: true,
  setu_score:  720,
};

// ── GitHub Pages / Vite base-path aware callback URL ─────
function getCallbackUrl() {
  const base = import.meta.env.BASE_URL || '/';
  // Remove trailing slash, add /auth/callback
  const basePath = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${window.location.origin}${basePath}/auth/callback`;
}

// ── Retry with jitter ────────────────────────────────────
function retryDelay(attempt) {
  const base  = 800 * Math.pow(2, attempt);     // exponential: 800, 1600, 3200
  const jitter = Math.random() * 200;           // 0–200ms jitter
  return Math.min(base + jitter, 5000);         // cap at 5s
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [session,   setSession]   = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = !!user;
  const isProfileLoaded = !!profile;

  const clearError = useCallback(() => setAuthError(null), []);

  // ── Load profile ──────────────────────────────────────
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser)          { setProfile(null); return; }
    if (!isSupabaseConfigured) { setProfile(DEMO_PROFILE); return; }

    // 300ms initial delay — lets JWT propagate through RLS
    await new Promise(res => setTimeout(res, 300));

    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data, notFound, error } = await getProfile(authUser.id);

      if (data)     { setProfile(data);  return; }
      if (notFound) { setProfile(null);  return; }

      if (error) {
        if (attempt < MAX_RETRIES - 1) {
          const delay = retryDelay(attempt);
          console.warn(`[SETU Auth] Profile fetch attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        console.error('[SETU Auth] Could not load profile after retries:', error);
        setProfile(null);
        setAuthError('Could not load your profile. Please check your connection and try again.');
        return;
      }
    }
  }, []);

  // ── Auth state subscription ───────────────────────────
  useEffect(() => {
    let mounted    = true;
    let initialised = false;

    if (!isSupabaseConfigured) {
      // For E2E tests, we might want to start as unauthenticated even in demo mode
      const skipDemoLogin = typeof window !== 'undefined' && 
                            window.localStorage.getItem('setu_test_unauth') === 'true';
      
      if (!skipDemoLogin) {
        setUser({ id: DEMO_PROFILE.id, phone: DEMO_PROFILE.phone });
        setProfile(DEMO_PROFILE);
      }
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
          clearCache(); // invalidate all data-fetch caches on sign out
        } else if (s?.user) {
          await loadProfile(s.user);
        } else {
          setProfile(null);
        }

        if (!initialised) {
          initialised = true;
          if (mounted) setIsLoading(false);
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  // ── signOut ───────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      setUser(null); setSession(null); setProfile(null);
    }
  }, []);

  // ── sendOTP ───────────────────────────────────────────
  const sendOTP = useCallback(async (phone) => {
    if (!isSupabaseConfigured) return { error: null };
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms' },
    });
    return { error };
  }, []);

  // ── verifyOTP ─────────────────────────────────────────
  const verifyOTP = useCallback(async (phone, token) => {
    if (!isSupabaseConfigured) {
      if (token === '1234') {
        setUser({ id: DEMO_PROFILE.id, phone });
        setProfile({ ...DEMO_PROFILE, phone });
        return { error: null };
      }
      return { error: { message: 'Demo OTP is 1234.' } };
    }
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    return { error };
  }, []);

  // ── createProfile (onboarding) ────────────────────────
  const createProfile = useCallback(async (userId, profileData) => {
    if (!isSupabaseConfigured) return { error: null };

    const payload = {
      name:       profileData.name  || null,
      phone:      profileData.phone || null,
      role:       profileData.role  || 'customer',
      updated_at: new Date().toISOString(),
    };

    // UPDATE first (trigger row already exists)
    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (updateError) {
      // Fallback: INSERT if row doesn't exist
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ id: userId, ...payload });
      if (insertError) return { error: insertError };
    }

    const { data } = await getProfile(userId);
    if (data) setProfile(data);
    return { error: null };
  }, []);

  // ── updateProfile ─────────────────────────────────────
  const updateProfile = useCallback(async (updates) => {
    if (!user || !isSupabaseConfigured) return { error: null };
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (!error) {
      const { data } = await getProfile(user.id);
      if (data) {
        setProfile(data);
        clearCache(`orders-customer-${user.id}`); // bust order cache on profile change
      }
    }
    return { error };
  }, [user]);

  // ── signInWithGoogle ──────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: getCallbackUrl() },
    });
  }, []);

  // ── signInWithEmail (admin/dev) ───────────────────────
  const signInWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    return await supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUpWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    return await supabase.auth.signUp({ email, password });
  }, []);

  const value = {
    user, session, profile,
    isLoading, isAuthenticated, isProfileLoaded,
    authError, clearError,
    signOut, sendOTP, verifyOTP,
    signInWithEmail, signUpWithEmail, signInWithGoogle,
    createProfile, updateProfile,
    // Convenience
    userRole:   profile?.role       ?? null,
    userName:   profile?.name       ?? null,
    userPhone:  profile?.phone      ?? user?.phone ?? null,
    setuScore:  profile?.setu_score ?? 500,
    isVerified: profile?.is_verified ?? false,
    portalPath: profile ? getPortalPath(profile.role) : '/',
    // async so callers (RegisterOnboarding, VendorOnboarding, RiderOnboarding)
    // can await it before navigating — ensures ProtectedRoute sees the updated profile
    reloadProfile: async () => {
      if (user) await loadProfile(user);
    },
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
