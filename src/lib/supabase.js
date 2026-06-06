// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — SUPABASE CLIENT  (production-hardened)
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[SETU] Missing Supabase environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.\n' +
    'The app will run in demo mode with mock data.'
  );
}

export const supabase = createClient(
  SUPABASE_URL  || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: true,
      // FIX (Issue 11): guard against SSR / test environments where window is undefined
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

// ── HELPERS ───────────────────────────────────────────────

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Fetches the profile row for a given user id.
 *
 * FIX (Issue 4): Returns a typed result object so callers can distinguish
 * between "row not found" (new user) and "real DB/network error".
 *
 * @returns {{ data: object|null, notFound: boolean, error: object|null }}
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116 = "no rows returned" — this is normal for new users, not an error
    if (error.code === 'PGRST116') {
      return { data: null, notFound: true, error: null };
    }
    console.error('[SETU Auth] Error fetching profile:', error.message, error.details);
    return { data: null, notFound: false, error };
  }

  return { data, notFound: false, error: null };
}

/**
 * Maps a profile role to the correct portal path.
 * FIX (Issue 17): Returns a dedicated error path for unknown roles instead of '/',
 * which caused an infinite redirect loop.
 */
export function getPortalPath(role) {
  const MAP = {
    customer:      '/customer',
    vendor:        '/vendor',
    rider:         '/rider',
    seva_provider: '/seva',
    anchor:        '/anchor',
    admin:         '/admin',
    super_admin:   '/superadmin',
  };
  const path = MAP[role];
  if (!path) {
    console.error(`[SETU] Unknown role: "${role}". Redirecting to /role-error.`);
    return '/role-error';
  }
  return path;
}

export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY;
