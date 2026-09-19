// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — NATIVE GOOGLE SIGN-IN (Android)  (v2 — @capgo/capacitor-social-login)
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
//  This replaces that with a fully native flow: the OS's own account
//  picker (Android Credential Manager) returns a Google ID token
//  directly, in-app, with NO browser involved at any point. That ID
//  token is then handed to Supabase via signInWithIdToken(), which
//  verifies it and returns a real session — same end result as
//  signInWithOAuth(), just without ever leaving the app.
//
//  The web build is untouched: AuthContext.jsx still uses
//  signInWithOAuth() there, which works fine in a real browser tab.
//
// WHY THIS PLUGIN (v2, not @capawesome/capacitor-google-sign-in):
//
//  Google Cloud + build config were fully verified correct (SHA-1,
//  package name, project, web client ID, test users all matched) and
//  Capawesome's plugin still failed every attempt with:
//    Google sign-in failed. [DEBUG code=SIGN_IN_CANCELED
//    message="[16] Account reauth failed."]
//  "[16] Account reauth failed" is Android Credential Manager's way of
//  reporting a stuck cached-reauth attempt — well documented as an
//  intermittent Credential Manager issue independent of correct
//  config (see multiple upstream reports:
//  github.com/android/identity-samples/issues/90,
//  github.com/flutter/flutter/issues/184918). Persisted even after
//  revoking the account's access + clearing Play Services/Play Store
//  cache + a device restart, which rules out stale local state too.
//  @capgo/capacitor-social-login documents this EXACT error and ships
//  a built-in recovery: on a [16] failure it clears Credential
//  Manager's credential-selection state and retries once with
//  filterByAuthorizedAccounts: false automatically, no app code
//  needed. If sign-in fails AGAIN after this switch, the cause is
//  something this retry doesn't cover — see the README's "[16]
//  Account reauth failed" section for the next checks (OAuth consent
//  screen must be External, Family Link/supervised accounts, the
//  user's own "Sign in with Google" app setting).
//
// ONE-TIME SETUP: unchanged from before — same Google Cloud Console
// Web + Android OAuth clients, same VITE_GOOGLE_WEB_CLIENT_ID, same
// stable debug keystore. See ANDROID_APP.md → "Native Google Sign-In
// setup". Nothing there needs to change for this plugin swap.
// ═══════════════════════════════════════════════════════════

import { SocialLogin } from '@capgo/capacitor-social-login';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error(
      'VITE_GOOGLE_WEB_CLIENT_ID is not set in the build environment — ' +
      'native Google Sign-In cannot start. See .env.example / ANDROID_APP.md.'
    );
  }

  // webClientId must be the WEB application client ID on every
  // platform, Android included — Credential Manager uses it as the
  // server client ID / ID-token audience. The separate Android OAuth
  // client (package name + SHA-1) also has to exist in Google Cloud
  // Console, but its ID is never referenced here.
  SocialLogin.initialize({ google: { webClientId } });
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
    const login = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
        nonce: hashedNonce,
      },
    });

    // Tokens are nested under `result` for this plugin — not top-level.
    const idToken = login.result?.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token.');
    }
    return { idToken, nonce: rawNonce };
  } catch (error) {
    // TEMPORARY (remove once sign-in is confirmed working end-to-end):
    // surface the raw platform error so we can see exactly what
    // Android/Play Services reported, since it's not always what the
    // friendly message below would suggest, and we don't have
    // logcat/root access to read it another way.
    const debug = ` [DEBUG code=${error?.code ?? 'none'} message="${error?.message ?? 'none'}"]`;
    throw new Error('Google sign-in failed.' + debug);
  }
}
