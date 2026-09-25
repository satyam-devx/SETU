// ═══════════════════════════════════════════════════════════
// SETU — post-login redirect
//
// A few flows (right now: vendor/rider/seva onboarding's Step 1)
// send a not-yet-logged-in visitor to /login and want them back on
// the exact page they left once they're authenticated — instead of
// wherever the default post-login routing would send them.
//
// React Router's navigate(..., { state }) doesn't survive Google's
// OAuth redirect (a real full-page navigation to accounts.google.com
// and back), so this uses sessionStorage instead — one mechanism
// that works for both the phone-OTP flow and Google sign-in.
// ═══════════════════════════════════════════════════════════
import { safeInternalRedirect } from './url-security';

const KEY = 'setu_post_login_redirect';

/** Call before sending someone to /login: remember where to send them back. */
export function setPostLoginRedirect(path) {
  try { const safePath = safeInternalRedirect(path, null); if (!safePath) return; sessionStorage.setItem(KEY, safePath); } catch { /* storage unavailable — fine, just skip the resume */ }
}

/** Call once, at whichever point you're about to make the "where next?" decision. Clears it either way. */
export function consumePostLoginRedirect() {
  try {
    const path = sessionStorage.getItem(KEY);
    if (path) sessionStorage.removeItem(KEY);
    return safeInternalRedirect(path, null);
  } catch {
    return null;
  }
}
