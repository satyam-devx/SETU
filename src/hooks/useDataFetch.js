// ═══════════════════════════════════════════════════════════
// SETU — useDataFetch
// Unified data-fetching hook with:
//   - Loading / error / data states
//   - Automatic retry on network errors (up to 3x)
//   - Stale-while-revalidate pattern (SWR-lite)
//   - Abort on unmount to prevent state updates after unmount
//   - Ready for React Query migration (same interface)
//
// Constitution: "Backend-first mindset. Every hook designed
// so future backend implementation requires minimal frontend changes."
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';

const cache = new Map(); // in-memory SWR cache (per session)

/**
 * @param {Function} fetcher - async function returning { data, error }
 * @param {Array}    deps    - re-fetch when these change
 * @param {Object}   opts    - { cacheKey, retries, staleTime, enabled }
 */
export function useDataFetch(fetcher, deps = [], opts = {}) {
  const {
    cacheKey   = null,
    retries    = 2,
    staleTime  = 30_000,   // 30s
    enabled    = true,
    onSuccess  = null,
    onError    = null,
  } = opts;

  const [data,      setData]      = useState(() => cacheKey ? cache.get(cacheKey)?.data ?? null : null);
  const [isLoading, setIsLoading] = useState(enabled && !data);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(0);
  const abortRef  = useRef(null);
  const mountedRef = useRef(true);

  const run = useCallback(async (attempt = 0) => {
    if (!enabled) return;

    // SWR: if cache fresh, skip refetch but still return cached data
    if (cacheKey && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.ts < staleTime) {
        setData(cached.data);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      if (!mountedRef.current) return;

      if (result.error) {
        if (attempt < retries) {
          const delay = Math.min(400 * 2 ** attempt, 3000);
          setTimeout(() => mountedRef.current && run(attempt + 1), delay);
          return;
        }
        setError(result.error);
        onError?.(result.error);
      } else {
        setData(result.data);
        setLastFetch(Date.now());
        if (cacheKey) cache.set(cacheKey, { data: result.data, ts: Date.now() });
        onSuccess?.(result.data);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      if (attempt < retries) {
        setTimeout(() => mountedRef.current && run(attempt + 1), 600);
        return;
      }
      const err = { message: e.message || 'Network error' };
      setError(err);
      onError?.(err);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cacheKey, staleTime, retries, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const refetch = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey); // bust cache
    run();
  }, [run, cacheKey]);

  const invalidate = useCallback((key) => {
    cache.delete(key || cacheKey);
  }, [cacheKey]);

  return {
    data,
    isLoading,
    error,
    refetch,
    invalidate,
    isStale: Date.now() - lastFetch > staleTime,
  };
}

// Utility: clear all or prefix-matched cache entries
export function clearCache(prefix = null) {
  if (!prefix) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
