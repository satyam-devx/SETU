/**
 * _shared/cors.ts
 *
 * Centralised CORS handling for SETU Edge Functions.
 *
 * SECURITY (audit H5 — was "Access-Control-Allow-Origin: *" on every
 * payment/KYC/FCM function): browsers honour the wildcard, so any
 * website could call our money/identity endpoints from a logged-in
 * user's browser and read the JSON response. We now reflect only an
 * explicitly allow-listed origin.
 *
 * Configure via the Supabase Edge Function secret:
 *   ALLOWED_ORIGINS = "https://setu.app,https://www.setu.app"
 * (comma-separated, no spaces needed). Falls back to the GitHub Pages
 * origin so this still works out of the box; update the secret once
 * you have a production domain.
 *
 * Non-browser callers (Razorpay webhook, server-to-server) don't send
 * an Origin header at all, so this never blocks them — CORS is a
 * browser-enforced concept only.
 */

// ⚠️ CONFIGURE ME: set the ALLOWED_ORIGINS secret in Supabase
// (Dashboard → Edge Functions → Secrets) to your real deployed
// domain(s), e.g. "https://your-project.pages.dev,https://setu.app".
// These localhost entries only matter for local `supabase functions serve`.
const FALLBACK_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
];

function allowedOrigins(): string[] {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (!fromEnv) return FALLBACK_ALLOWED_ORIGINS;
  return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Build CORS headers for a given incoming request.
 * Reflects the request's Origin only if it's on the allow-list;
 * otherwise falls back to the first allow-listed origin (so the
 * response still has a valid header, it just won't satisfy the
 * browser's same-origin check for a disallowed site).
 */
export function corsHeaders(
  req: Request,
  extraAllowedHeaders = "authorization, x-client-info, apikey, content-type"
): Record<string, string> {
  const allowed = allowedOrigins();
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": extraAllowedHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
