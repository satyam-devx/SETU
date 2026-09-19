// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — NATIVE GOOGLE SIGN-IN (Android)
//
// WHY THIS FILE EXISTS:
//
//  On native (Capacitor), Google login used to go through Supabase's
//  browser-based OAuth flow (signInWithOAuth): the app opened Chrome,
//  Chrome asked the user to pick a Google account, then tried to
//  redirect back to `redirectTo` (an origin that only exists inside
//  the app's own WebView, not as a real network host Chrome can
//  reach) — which is why it hard-failed with ERR_CONNECTION_REFUSED.
//
//  This replaces that with a fully native flow via
//  @capawesome/capacitor-google-sign-in: the OS's own account picker
//  (Android Credential Manager) returns a Google ID token directly,
//  in-app, with NO browser involved at any point. That ID token is
//  then handed to Supabase via signInWithIdToken(), which verifies it
//  and returns a real session — same end result as signInWithOAuth(),
//  just without ever leaving the app.
//
//  The web build is untouched: AuthContext.jsx still uses
//  signInWithOAuth() there, which works fine in a real browser tab.
//
// ONE-TIME SETUP REQUIRED (Google Cloud Console + Supabase + GitHub
// secrets) — see ANDROID_APP.md → "Native Google Sign-In setup".
// Without that setup, signIn() below will fail with a clear error
// (ProviderConfigurationError / UNREGISTERED_ON_API_CONSOLE), not a
// silent crash.
// ═══════════════════════════════════════════════════════════

import { GoogleSignIn, ErrorCode } from '@capawesome/capacitor-google-sign-in';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_WEB_CLIENT_ID is not set in the build environment — ' +
      'native Google Sign-In cannot start. See .env.example / ANDROID_APP.md.'
    );
  }

  // NOTE: this must be the WEB client ID on every platform, Android
  // included — the plugin passes it as the server client ID to
  // Android's Credential Manager. The separate Android OAuth client
  // (package name + SHA-1, registered in Google Cloud Console) has to
  // exist too, but its ID is never referenced in code.
  GoogleSignIn.initialize({ clientId });
  initialized = true;
}

// SHA-256, hex-encoded. Web Crypto (crypto.subtle) is available here
// because capacitor.config.json sets androidScheme: "https", so the
// WebView's origin (https://localhost) counts as a secure context.
async function sha256Hex(message) {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Runs the native Google Sign-In flow (OS account picker, no browser)
 * and returns { idToken, nonce } ready to pass straight to
 * supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce }).
 *
 * Nonce handling: Google embeds a HASHED nonce inside the ID token we
 * get back, so we hash before sending it to Google — but Supabase
 * hashes the raw nonce itself server-side to compare against that
 * claim, so Supabase needs the RAW version. Two different values, on
 * purpose; mixing them up is the #1 cause of a "Nonces mismatch" error.
 *
 * Throws a plain Error with a user-friendly message on cancel/failure
 * — callers should catch it and show `error.message` as-is.
 */
export async function signInWithGoogleNative() {
  ensureInitialized();

  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  try {
    const result = await GoogleSignIn.signIn({ nonce: hashedNonce });
    return { idToken: result.idToken, nonce: rawNonce };
  } catch (error) {
    // TEMPORARY (remove once sign-in is confirmed working end-to-end,
    // and restore the plain friendly SignInCanceled message that used
    // to be the first branch here): Google Play services reports
    // almost ANY native-side failure — including config problems that
    // have nothing to do with the user actually tapping cancel — as
    // SIGN_IN_CANCELED (see Capawesome's own troubleshooting FAQ). The
    // real cause lives in error.message / error.code, which we can't
    // read via logcat without root, so every branch below appends it
    // to the on-screen message instead of hiding it. A real end user
    // build should never ship with this debug suffix visible.
    const debug = ` [DEBUG code=${error?.code ?? 'none'} message="${error?.message ?? 'none'}"]`;

    if (error?.code === ErrorCode.NoCredentialAvailable) {
      throw new Error('No Google account found on this device. Add one in Settings and try again.' + debug);
    }
    if (error?.code === ErrorCode.ProviderConfigurationError) {
      throw new Error('Google Play services is missing or out of date on this device.' + debug);
    }
    // Covers SignInCanceled and anything else, including cases where
    // it's genuinely a user cancelling — that's fine, we'll drop the
    // debug suffix once we've seen what a real failure looks like here.
    throw new Error('Google sign-in failed.' + debug);
  }
}
