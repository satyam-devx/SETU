/**
 * _shared/auth.ts
 *
 * Centralised authentication/authorisation helpers for SETU Edge
 * Functions.
 *
 * SECURITY (audit CRITICAL-2): several functions (verify-aadhaar,
 * kyc-verify, send-fcm-notification, ai-assistant) previously did
 * zero authentication and trusted a `userId`/`user_ids` field taken
 * straight from the request body. Combined with `--no-verify-jwt`
 * at the gateway, this meant anyone on the internet could write KYC
 * records, flip verification flags, or mass-spam push notifications
 * for ANY account.
 *
 * Every function that touches user data must now call requireUser()
 * (or requireInternalOrAdmin() for service-to-service endpoints) and
 * derive identity from the verified JWT — never from the body.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

export interface AuthedUser {
  id: string;
  phone?: string | null;
  email?: string | null;
}

/**
 * Verifies the caller's Supabase JWT (from the Authorization header)
 * and returns the authenticated user, or an error.
 */
export async function requireUser(
  req: Request,
  supabase: SupabaseClient
): Promise<{ user: AuthedUser | null; error: string | null }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { user: null, error: "Missing authorization header" };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: "Unauthorized" };
  }

  return { user: data.user, error: null };
}

/**
 * Returns the caller's `profiles.role`, or null if not found.
 */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data as any)?.role ?? null;
}

/**
 * True if the caller authenticated with the project's service-role
 * key directly (i.e. this is a trusted server-to-server call, such
 * as one Edge Function invoking another — e.g. the webhook firing a
 * push notification). The service-role key is never shipped to
 * browsers, so presenting it proves the caller is our own backend.
 */
export function isInternalServiceCall(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!serviceKey && !!token && token === serviceKey;
}

/**
 * For endpoints that should only ever be called by (a) our own
 * backend (service-role key) or (b) an authenticated admin/
 * super_admin user. Returns the admin user if applicable, or null
 * for an internal service call, or an error string if neither.
 */
export async function requireInternalOrAdmin(
  req: Request,
  supabase: SupabaseClient
): Promise<{ ok: boolean; user: AuthedUser | null; error: string | null }> {
  if (isInternalServiceCall(req)) {
    return { ok: true, user: null, error: null };
  }

  const { user, error } = await requireUser(req, supabase);
  if (error || !user) {
    return { ok: false, user: null, error: error ?? "Unauthorized" };
  }

  const role = await getUserRole(supabase, user.id);
  if (!role || !["admin", "super_admin"].includes(role)) {
    return { ok: false, user, error: "Admin role required" };
  }

  return { ok: true, user, error: null };
}
