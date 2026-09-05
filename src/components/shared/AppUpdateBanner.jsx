// ═══════════════════════════════════════════════════════════
// SETU — AppUpdateBanner
//
// Native-only. Checks for a published OTA update on mount and
// whenever the app comes back to the foreground, then offers it
// as a dismissible bottom card. Renders nothing on web.
// ═══════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Loader2, Sparkles, X } from 'lucide-react';
import { checkForUpdate, applyUpdate, checkForRevocation } from '@/lib/appUpdater';

export default function AppUpdateBanner() {
  const [update, setUpdate] = useState(null); // { version, bundleUrl, notes }
  const [status, setStatus] = useState('idle'); // idle | applying | error
  const [dismissedVersion, setDismissedVersion] = useState(null);
  const appStateListenerRef = useRef(null);

  const runCheck = useCallback(async () => {
    // Revocation is checked first — if the currently-running bundle gets
    // pulled, that takes priority over (and will race-condition-free
    // supersede) offering the device anything new.
    await checkForRevocation();
    const result = await checkForUpdate();
    if (result) setUpdate(result);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    runCheck();

    // Re-check whenever the app is foregrounded — this is when a
    // freshly-published OTA update (or a revocation) is most useful to catch.
    (async () => {
      const { App } = await import('@capacitor/app');
      if (cancelled) return;
      const handle = await App.addListener('appStateChange', (state) => {
        if (state.isActive) runCheck();
      });
      appStateListenerRef.current = handle;
    })();

    return () => {
      cancelled = true;
      appStateListenerRef.current?.remove?.();
    };
  }, [runCheck]);

  if (!update || update.version === dismissedVersion) return null;

  async function handleUpdate() {
    setStatus('applying');
    try {
      await applyUpdate(update);
      // applyUpdate reloads the webview on success — nothing more to do.
    } catch (err) {
      console.warn('[AppUpdateBanner] update failed:', err?.message);
      setStatus('error');
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      role="status"
    >
      <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-float">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">A new update is ready</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {update.notes || 'New features and fixes are ready to install.'}
          </p>
          {status === 'error' && (
            <p className="mt-1 text-xs font-medium text-destructive">Update failed — try again shortly.</p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={status === 'applying'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {status === 'applying' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {status === 'applying' ? 'Updating…' : 'Update now'}
            </button>
            <button
              type="button"
              onClick={() => setDismissedVersion(update.version)}
              disabled={status === 'applying'}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              Later
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissedVersion(update.version)}
          disabled={status === 'applying'}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
