// ═══════════════════════════════════════════════════════════
// SETU — useFcmToken
//
// Requests browser notification permission, retrieves the FCM
// registration token, and persists it to profiles.fcm_token.
//
// Flow:
//  1. Check if Notification API and FCM are available
//  2. Request permission (first call only — browser caches it)
//  3. getToken() → FCM token string
//  4. Compare to the token already in the profile:
//     if different (or missing), PATCH profiles.fcm_token via api.js
//  5. On focus: refresh the token (tokens can rotate)
//
// Usage: call once inside CustomerLayout (or any portal root).
//   The hook is silent — no UI. Errors are logged, never thrown.
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { updateProfile } from '@/lib/api';

// Firebase config comes from env vars set in .env.local
// All VITE_FIREBASE_* vars are public (client-side) — no secret here.
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ── Lazy Firebase initialiser ─────────────────────────────
let _messagingPromise = null;

async function getFirebaseMessaging() {
  if (_messagingPromise) return _messagingPromise;

  _messagingPromise = (async () => {
    // Bail out in environments where Firebase can't work
    if (!FIREBASE_CONFIG.apiKey || !VAPID_KEY) {
      console.debug('[FCM] Firebase env vars not configured — push disabled');
      return null;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.debug('[FCM] Browser does not support push notifications');
      return null;
    }

    // Dynamic imports — keeps Firebase out of the main bundle entirely
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getMessaging, isSupported }       = await import('firebase/messaging');

    const supported = await isSupported();
    if (!supported) {
      console.debug('[FCM] Firebase Messaging not supported in this browser');
      return null;
    }

    const app       = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);
    return messaging;
  })();

  return _messagingPromise;
}

// ── Hook ──────────────────────────────────────────────────
export function useFcmToken() {
  const { user, profile } = useAuth();
  const tokenSavedRef     = useRef(false);   // avoid re-saving on every render

  const registerToken = useCallback(async () => {
    if (!user) return;

    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      // Request permission — resolves immediately if already granted/denied
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.debug('[FCM] Notification permission not granted:', permission);
        return;
      }

      // Register (or retrieve cached) SW, then get the token
      const swRegistration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { scope: '/' }
      );

      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey:            VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        console.debug('[FCM] getToken returned empty — push not available');
        return;
      }

      // Only save if the token has changed (tokens can rotate)
      const savedToken = profile?.fcm_token;
      if (token === savedToken && tokenSavedRef.current) return;

      await updateProfile(user.id, { fcm_token: token });
      tokenSavedRef.current = true;
      console.debug('[FCM] Token registered:', token.slice(0, 20) + '…');

    } catch (err) {
      // Non-fatal — app works without push notifications
      console.warn('[FCM] Token registration failed:', err?.message ?? err);
    }
  }, [user, profile?.fcm_token]);

  // Register on mount and whenever the tab regains focus
  // (FCM tokens can be refreshed while the tab was in background)
  useEffect(() => {
    registerToken();

    const handleFocus = () => {
      // Reset saved flag so a rotated token gets re-saved
      tokenSavedRef.current = false;
      registerToken();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [registerToken]);
}
