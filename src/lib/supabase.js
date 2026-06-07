// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — SUPABASE CLIENT  (production-hardened)
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[SETU] Missing Supabase env vars. Running in demo mode.'
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
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

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
 * Fetches the profile row for a given userId.
 *
 * ROOT CAUSE FIX:
 * With RLS enabled, both "row does not exist" AND "RLS blocked the row"
 * return the exact same error: PGRST116 ("no rows returned").
 * The old code treated PGRST116 as notFound:true immediately, which meant
 * that any timing issue (JWT not yet propagated, session not attached) looked
 * identical to a missing row — causing loadProfile to give up and set
 * profile=null, which ProtectedRoute then showed as a loading spinner forever
 * or an error screen.
 *
 * Fix: PGRST116 is treated as a RETRYABLE error, not an immediate notFound.
 * Before marking notFound, we verify auth.uid() is actually set by calling
 * getUser(). Only if auth is confirmed valid AND the row is still not found
 * do we treat it as a genuinely new user with no profile row.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!error) {
    return { data, notFound: false, error: null };
  }

  if (error.code === 'PGRST116') {
    // Could be: (a) row genuinely doesn't exist, or (b) RLS blocked it.
    // Verify auth is valid before concluding notFound.
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId) {
      // Auth is confirmed — row genuinely does not exist (new user).
      return { data: null, notFound: true, error: null };
    }
    // Auth not confirmed — treat as a retryable error so loadProfile retries.
    return { data: null, notFound: false, error: { ...error, message: 'Auth not ready, will retry' } };
  }

  console.error('[SETU] getProfile error:', error.message, error.code);
  return { data: null, notFound: false, error };
}

/**
 * Maps a profile role to the correct portal path.
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
