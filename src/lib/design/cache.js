/**
 * Offline-first cache for the published design.
 *
 *  - Per-scope config: lets the provider paint the last known design instantly
 *    on a cold start (and while offline, which matters on rural networks).
 *  - Boot payload: pre-compiled CSS variables read by public/design-boot.js
 *    before first paint, so there is no flash of the default theme.
 *  - Preview session: the Studio's "Preview in app" draft lives in
 *    sessionStorage so a reload keeps previewing, and closing the tab ends it.
 *
 * Storage is injected so this file runs under plain Node in tests.
 */
import { compileDesign } from './css.js';
import { sanitizeConfig } from './schema.js';

export const CACHE_VERSION = 1;
export const BOOT_KEY = `setu:design:v${CACHE_VERSION}:boot`;
export const PREVIEW_KEY = `setu:design:preview:v${CACHE_VERSION}`;
const cfgKey = (scope) => `setu:design:v${CACHE_VERSION}:cfg:${scope}`;

export function safeStorage(kind = 'localStorage') {
  try {
    const s = typeof window !== 'undefined' ? window[kind] : null;
    if (!s) return null;
    const probe = '__setu_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const readJson = (storage, key) => {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJson = (storage, key, value) => {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota / private mode: caching is best-effort
  }
};

export function buildBootPayload(config) {
  const { common, light, dark, dataset } = compileDesign(config);
  return { v: CACHE_VERSION, common, light, dark, dataset };
}

export function readCachedConfig(storage, scope) {
  const entry = readJson(storage, cfgKey(scope));
  if (!entry || entry.v !== CACHE_VERSION || !entry.config) return null;
  return sanitizeConfig(entry.config);
}

export function writeCache(storage, scope, config, meta = {}) {
  const clean = sanitizeConfig(config);
  writeJson(storage, cfgKey(scope), { v: CACHE_VERSION, config: clean, version: meta.version ?? null, at: Date.now() });
  writeJson(storage, BOOT_KEY, buildBootPayload(clean));
}

/** Server says nothing is published for this scope: forget stale cache. */
export function clearCache(storage, scope) {
  try {
    storage?.removeItem(cfgKey(scope));
    storage?.removeItem(BOOT_KEY);
  } catch { /* ignore */ }
}

export function readPreview(storage) {
  const entry = readJson(storage, PREVIEW_KEY);
  if (!entry || entry.v !== CACHE_VERSION || !entry.config) return null;
  return { config: sanitizeConfig(entry.config), at: entry.at || 0 };
}
export const writePreview = (storage, config) => writeJson(storage, PREVIEW_KEY, { v: CACHE_VERSION, config: sanitizeConfig(config), at: Date.now() });
export const clearPreview = (storage) => { try { storage?.removeItem(PREVIEW_KEY); } catch { /* ignore */ } };
