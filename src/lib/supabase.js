// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — SUPABASE CLIENT
//
// Environment variables required in .env:
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key
//
// Supabase SQL — run this in your Supabase SQL editor:
//
// create table profiles (
//   id uuid references auth.users primary key,
//   phone text unique not null,
//   name text,
//   role text not null default 'customer',
//   village_id text,
//   is_verified boolean default false,
//   setu_score integer default 500,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
// alter table profiles enable row level security;
// create policy "Users can read own profile"
//   on profiles for select using (auth.uid() = id);
// create policy "Users can update own profile"
//   on profiles for update using (auth.uid() = id);
// create policy "Users can insert own profile"
//   on profiles for insert with check (auth.uid() = id);
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate env vars at startup
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
      autoRefreshToken:    true,
      persistSession:      true,
      detectSessionInUrl:  true,
      storage:             window?.localStorage,
    },
  }
);

// ── HELPERS ───────────────────────────────────────────────

/**
 * Returns the currently authenticated user, or null.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

/**
 * Returns the current session, or null.
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Fetches the profile row for a given user id.
 * Returns null if not found or on error.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[SETU Auth] Error fetching profile:', error.message, error.details);
    return null;
  }
  
  return data;
}

/**
 * Maps a profile role to the correct portal path.
 */
export function getPortalPath(role) {
  const MAP = {
    customer:       '/customer',
    vendor:         '/vendor',
    rider:          '/rider',
    seva_provider:  '/seva',
    anchor:         '/anchor',
    admin:          '/admin',
    super_admin:    '/superadmin',
  };
  return MAP[role] ?? '/';
}

/**
 * True if the app has valid Supabase credentials configured.
 */
export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY;
