import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { DesignSystemAPI } from '@/lib/design-system';
import { compileDesign } from '@/lib/design/css';
import { DEFAULT_DESIGN, mergeDesign, sanitizeConfig, scopeFromPath } from '@/lib/design/schema';
import {
  clearCache, clearPreview, readCachedConfig, readPreview, safeStorage, writeCache, writePreview,
} from '@/lib/design/cache';

const REFRESH_AFTER_MS = 5 * 60 * 1000;

// Probe browser storage once per page load, not once per render.
const memo = {};
const getStorage = (kind) => {
  if (!(kind in memo)) memo[kind] = safeStorage(kind);
  return memo[kind];
};

const DesignSystemContext = createContext({
  design: DEFAULT_DESIGN, publishedDesign: DEFAULT_DESIGN, status: 'loading', loading: true, scope: 'global',
  reload: async () => {}, preview: null, startPreview: () => {}, stopPreview: () => {},
});

/** Write compiled variables onto an element. Skips values that are already current. */
function applyCompiled(root, compiled, mode) {
  const vars = { ...compiled.common, ...(mode === 'dark' ? compiled.dark : compiled.light) };
  for (const [name, value] of Object.entries(vars)) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  }
  for (const [name, value] of Object.entries(compiled.dataset)) {
    if (root.dataset[name] !== value) root.dataset[name] = value;
  }
}

/**
 * Imperative helper kept for callers outside React. Prefer the provider.
 * options.colorMode forces a palette ('light' | 'dark'); otherwise the current `.dark` class decides.
 */
export function applyDesignTokens(config, options = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const mode = options.colorMode === 'dark' || options.colorMode === 'light'
    ? options.colorMode
    : (root.classList.contains('dark') ? 'dark' : 'light');
  applyCompiled(root, compileDesign(config), mode);
  const themeMode = config?.theme?.defaultMode;
  if (options.applyDefaultTheme && ['light', 'dark'].includes(themeMode)) root.classList.toggle('dark', themeMode === 'dark');
}

function PreviewBanner({ onExit }) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-foreground py-2 pl-4 pr-2 text-sm text-background shadow-float">
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">Previewing an unpublished design</span>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold hover:bg-background/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> Exit preview
        </button>
      </div>
    </div>
  );
}

export function DesignSystemProvider({ children }) {
  const { pathname } = useLocation();
  const scope = scopeFromPath(pathname);
  const local = useRef(getStorage('localStorage'));
  const session = useRef(getStorage('sessionStorage'));

  const [published, setPublished] = useState(() => readCachedConfig(local.current, scope) || DEFAULT_DESIGN);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [preview, setPreview] = useState(() => readPreview(session.current));
  const requestId = useRef(0);
  const lastFetch = useRef(0);

  const reload = useCallback(async () => {
    const current = ++requestId.current;
    const { data, error } = await DesignSystemAPI.getPublished(scope);
    if (current !== requestId.current) return; // a newer request superseded this one
    lastFetch.current = Date.now();
    if (error) {
      // Offline or RPC unavailable: keep the cached/default design rather than
      // snapping to defaults and flashing.
      setStatus('error');
      return;
    }
    if (data?.config) {
      const config = sanitizeConfig(mergeDesign(DEFAULT_DESIGN, data.config));
      setPublished(config);
      writeCache(local.current, scope, config, { version: data.version });
    } else {
      setPublished(DEFAULT_DESIGN);
      clearCache(local.current, scope);
    }
    setStatus('ready');
  }, [scope]);

  // New route scope: show its cached design immediately, then revalidate.
  useEffect(() => {
    const cached = readCachedConfig(local.current, scope);
    if (cached) setPublished(cached);
    reload();
  }, [scope, reload]);

  // Revalidate when the tab regains focus or the device comes back online.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > REFRESH_AFTER_MS) reload();
    };
    const onOnline = () => reload();
    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  const startPreview = useCallback((config) => {
    const clean = sanitizeConfig(config);
    writePreview(session.current, clean);
    setPreview({ config: clean, at: Date.now() });
  }, []);
  const stopPreview = useCallback(() => {
    clearPreview(session.current);
    setPreview(null);
  }, []);

  const effective = preview?.config || published;

  // Apply tokens, and re-apply when the app flips between light and dark.
  useEffect(() => {
    const root = document.documentElement;
    const compiled = compileDesign(effective);
    const apply = () => applyCompiled(root, compiled, root.classList.contains('dark') ? 'dark' : 'light');
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [effective]);

  const value = useMemo(() => ({
    design: effective, publishedDesign: published, status, loading: status === 'loading', scope,
    reload, preview, startPreview, stopPreview,
  }), [effective, published, status, scope, reload, preview, startPreview, stopPreview]);

  return (
    <DesignSystemContext.Provider value={value}>
      {children}
      {preview && <PreviewBanner onExit={stopPreview} />}
    </DesignSystemContext.Provider>
  );
}

export const useDesignSystem = () => useContext(DesignSystemContext);
export { DEFAULT_DESIGN, mergeDesign };
