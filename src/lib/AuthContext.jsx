// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — AUTH CONTEXT
// Full Supabase phone OTP authentication with:
//   - Session persistence across page refreshes
//   - Profile loading from 'profiles' table
//   - Role-based portal routing
//   - Demo mode fallback when Supabase not configured
// ═══════════════════════════════════════════════════════════

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getProfile, getPortalPath, isSupabaseConfigured } from './supabase';

// ── CONTEXT ───────────────────────────────────────────────
const AuthContext = createContext(null);

// ── DEMO MODE PROFILE ─────────────────────────────────────
// Used when Supabase is not configured (prototype / demo)
const DEMO_PROFILE = {
  id:          'u1',
  phone:       '+91 98765 43200',
  name:        'Anita Devi',
  role:        'customer',
  village_id:  'v1',
  is_verified: true,
  setu_score:  720,
};

// ── PROVIDER ──────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = !!user && !!profile;

  // ── Load profile for a given user ──
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    // Demo mode: skip Supabase profile fetch
    if (!isSupabaseConfigured) {
      setProfile(DEMO_PROFILE);
      return;
    }

    // Retry mechanism to handle database trigger race conditions
    let p = null;
    let retries = 3;

    while (retries > 0) {
      const data = await getProfile(authUser.id);
      if (data) {
        p = data;
        break; // Success, exit the loop
      }
      
      // Wait 500ms before retrying
      await new Promise(res => setTimeout(res, 500));
      retries--;
    }

    if (p) {
      setProfile(p);
    } else {
      console.warn('[SETU Auth] Profile not found after retries. User may be stuck in onboarding.');
      setProfile(null);
    }
  }, []);


  // ── Bootstrap: check for existing session ──
  useEffect(() => {
    let mounted = true;

    // Demo mode: auto-authenticate with demo profile
    if (!isSupabaseConfigured) {
      setUser({ id: DEMO_PROFILE.id, phone: DEMO_PROFILE.phone });
      setProfile(DEMO_PROFILE);
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      loadProfile(s?.user ?? null).finally(() => {
        if (mounted) setIsLoading(false);
      });
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        setAuthError(null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
        } else if (s?.user) {
          await loadProfile(s.user);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ── Sign Out ──
  const signOut = useCallback(async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsLoading(false);
    // Navigate to root — ProtectedRoute will redirect to /login
    window.location.href = '/';
  }, []);

  // ── Send OTP ──
  const sendOTP = useCallback(async (phone) => {
    if (!isSupabaseConfigured) {
      // Demo mode: simulate OTP sent
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms' },
    });
    return { error };
  }, []);

  // ── Verify OTP ──
  const verifyOTP = useCallback(async (phone, token) => {
    if (!isSupabaseConfigured) {
      // Demo mode: accept any 4-digit token
      if (token.length === 4) {
        setUser({ id: DEMO_PROFILE.id, phone });
        setProfile({ ...DEMO_PROFILE, phone });
        return { error: null, profile: DEMO_PROFILE };
      }
      return { error: { message: 'Invalid OTP' } };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) return { error };

    const p = await getProfile(data.user?.id);
    return { error: null, profile: p };
  }, []);

  // ── Create profile (called after first OTP verify) ──
  const createProfile = useCallback(async (userId, profileData) => {
    if (!isSupabaseConfigured) return { error: null };

    const { error } = await supabase.from('profiles').insert({
      id:    userId,
      phone: profileData.phone,
      name:  profileData.name  || null,
      role:  profileData.role  || 'customer',
    });
    if (!error) {
      const p = await getProfile(userId);
      setProfile(p);
    }
    return { error };
  }, []);

    const signInWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }

    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  }, []);

  const signUpWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not configured' } };
    }

    return await supabase.auth.signUp({
      email,
      password,
    });
  }, []);
  
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase not   configured' } };
    }

    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
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
      setProfile(prev => ({ ...prev, ...updates }));
    }
    return { error };
  }, [user]);

  const value = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated,
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
    userRole:   profile?.role    ?? null,
    userName:   profile?.name    ?? null,
    userPhone:  profile?.phone   ?? user?.phone ?? null,
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

// ── HOOK ──────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
