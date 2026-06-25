// ═══════════════════════════════════════════════════════════
// SETU — Observability (frontend error capture)
//
// Lightweight, dependency-free error reporting. Every capture is:
//   1. Always console-logged (dev + prod).
//   2. Forwarded to an external sink if one is wired:
//        - window.__SETU_SENTRY__ (if a Sentry SDK was loaded), OR
//        - the Supabase log_client_error() RPC (rate-limited server-side).
//
// Fire-and-forget: reporting never throws and never blocks the UI.
// Client-side throttling caps noise before it even reaches the network.
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from './supabase';

// ── Client-side throttle: max N reports per rolling window ──
const MAX_REPORTS = 20;
const WINDOW_MS    = 60_000;
let _timestamps    = [];
// De-dupe identical messages fired in a tight loop (e.g. render loops).
const _recent      = new Map(); // message -> last sent ms
const DEDUPE_MS    = 5_000;

function throttled(message) {
  const now = Date.now();
  _timestamps = _timestamps.filter((t) => now - t < WINDOW_MS);
  if (_timestamps.length >= MAX_REPORTS) return true;

  const last = _recent.get(message);
  if (last && now - last < DEDUPE_MS) return true;

  _timestamps.push(now);
  _recent.set(message, now);
  return false;
}

function normalizeError(err) {
  if (!err) return { message: 'Unknown error', stack: null };
  if (typeof err === 'string') return { message: err, stack: null };
  return {
    message: err.message || String(err),
    stack:   err.stack || null,
    name:    err.name || undefined,
  };
}

/**
 * Capture an error with optional structured context.
 * @param {Error|string} error
 * @param {object} [context]  extra fields (component, route, ids…)
 * @param {'error'|'fatal'|'warn'} [level]
 */
export function captureError(error, context = {}, level = 'error') {
  const { message, stack, name } = normalizeError(error);

  // 1. Console (kept for local dev + browser devtools in prod).
  // eslint-disable-next-line no-console
  console.error('[SETU]', message, { ...context, stack });

  if (throttled(message)) return;

  const payload = {
    ...context,
    name,
    stack: stack ? String(stack).slice(0, 4000) : undefined,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // 2a. External SDK hook (if present).
  try {
    if (typeof window !== 'undefined' && window.__SETU_SENTRY__) {
      window.__SETU_SENTRY__.captureException(
        error instanceof Error ? error : new Error(message),
        { extra: payload, level }
      );
    }
  } catch {/* never throw from reporting */}

  // 2b. Supabase sink (rate-limited server-side via log_client_error).
  if (isSupabaseConfigured) {
    try {
      const url = typeof window !== 'undefined' ? window.location?.href : null;
      // Fire-and-forget; swallow any error so reporting is invisible to UX.
      supabase
        .rpc('log_client_error', {
          p_level:   level,
          p_message: message,
          p_context: payload,
          p_url:     url,
        })
        .then(() => {})
        .catch(() => {});
    } catch {/* ignore */}
  }
}

/** Capture a non-error message (info/warn breadcrumb). */
export function captureMessage(message, context = {}, level = 'warn') {
  captureError(message, context, level);
}

/**
 * Install global handlers for uncaught errors and unhandled promise
 * rejections. Call once at app startup (main.jsx).
 */
export function initObservability() {
  if (typeof window === 'undefined' || window.__SETU_OBS_INSTALLED__) return;
  window.__SETU_OBS_INSTALLED__ = true;

  window.addEventListener('error', (event) => {
    captureError(event.error || event.message, {
      kind: 'window.onerror',
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason || 'Unhandled promise rejection', {
      kind: 'unhandledrejection',
    });
  });
}
