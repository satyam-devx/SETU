// F9 — Mobile/Android runtime bootstrap.
// Keeps native lifecycle work centralized and deliberately lazy so web builds
// pay almost no startup cost. The native shell remains responsible for the
// WebView/splash seam; this module handles JS-side lifecycle coordination.
import { Capacitor } from '@capacitor/core';

let initialized = false;
let cleanup = null;

export async function initializeMobileRuntime() {
  if (initialized || !Capacitor.isNativePlatform()) return cleanup;
  initialized = true;

  const [{ App }] = await Promise.all([import('@capacitor/app')]);
  const listeners = [];

  const add = async (promise) => {
    try {
      const handle = await promise;
      listeners.push(handle);
    } catch (error) {
      console.warn('[mobile-runtime] listener registration failed:', error?.message ?? error);
    }
  };

  await add(App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('setu:app-state', { detail: { isActive } }));
  }));

  await add(App.addListener('appUrlOpen', ({ url }) => {
    window.dispatchEvent(new CustomEvent('setu:app-url-open', { detail: { url } }));
  }));

  await add(App.addListener('backButton', async ({ canGoBack }) => {
    const detail = { canGoBack };
    window.dispatchEvent(new CustomEvent('setu:back-button', { detail }));
    if (canGoBack && typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      try {
        await App.exitApp();
      } catch {
        // WebView/browser fallback: keep the dispatched event observable
        // rather than throwing from the native back-button listener.
      }
    }
  }));

  cleanup = async () => {
    await Promise.allSettled(listeners.map(handle => handle?.remove?.()));
    listeners.length = 0;
    initialized = false;
    cleanup = null;
  };

  return cleanup;
}
