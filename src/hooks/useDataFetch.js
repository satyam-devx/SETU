// SETU — useDataFetch compatibility adapter (F2)
//
// Existing consumers keep the same API while the implementation runs through
// the TanStack Query-backed SETU query client adapter. This preserves legacy
// callers while sharing the same cache, dedupe, invalidation, retry and GC policy.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { queryClientInstance } from '@/lib/query-client';

let anonymousQueryId = 0;

function toError(error) {
  if (error instanceof Error) return error;
  return new Error(error?.message || String(error || 'Network error'));
}

export function useDataFetch(fetcher, deps = [], opts = {}) {
  const {
    cacheKey = null,
    retries = 2,
    staleTime = 30_000,
    enabled = true,
    onSuccess = null,
    onError = null,
  } = opts;

  const localKeyRef = useRef(null);
  if (!localKeyRef.current) {
    localKeyRef.current = cacheKey ?? `__useDataFetch:${++anonymousQueryId}`;
  }
  const key = cacheKey ?? localKeyRef.current;
  const initial = queryClientInstance.getQueryState(key);
  const [state, setState] = useState(() => ({
    data: initial?.data ?? null,
    error: initial?.error ?? null,
    isFetching: Boolean(initial?.isFetching),
    updatedAt: initial?.updatedAt ?? 0,
  }));
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const staleTimeRef = useRef(staleTime);
  const retriesRef = useRef(retries);
  fetcherRef.current = fetcher;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  staleTimeRef.current = staleTime;
  retriesRef.current = retries;

  const sync = useCallback(() => {
    if (!key) return;
    const next = queryClientInstance.getQueryState(key);
    if (!mountedRef.current || !next) return;
    setState({
      data: next.data ?? null,
      error: next.error ?? null,
      isFetching: next.isFetching,
      updatedAt: next.updatedAt,
    });
  }, [key]);

  const run = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return;
    sync();
    try {
      const data = await queryClientInstance.fetchQuery(key, fetcherRef.current, {
        staleTime: staleTimeRef.current,
        retries: retriesRef.current,
        force,
      });
      if (!mountedRef.current) return data;
      setState(prev => ({ ...prev, data: data ?? null, error: null, isFetching: false, updatedAt: Date.now() }));
      onSuccessRef.current?.(data);
      return data;
    } catch (error) {
      const normalized = toError(error);
      if (!mountedRef.current) return undefined;
      setState(prev => ({ ...prev, error: normalized, isFetching: false }));
      onErrorRef.current?.(normalized);
      return undefined;
    }
  }, [enabled, key, sync]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return () => { mountedRef.current = false; };

    const unsubscribe = queryClientInstance.subscribe(key, sync);
    const cached = queryClientInstance.getQueryState(key);
    if (cached) {
      setState({
        data: cached.data ?? null,
        error: cached.error ?? null,
        isFetching: cached.isFetching,
        updatedAt: cached.updatedAt,
      });
    }

    run();
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  // `deps` are intentionally part of the query identity supplied by callers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, run, ...deps]);

  const refetch = useCallback(() => run({ force: true }), [run]);

  const invalidate = useCallback((targetKey = key) => {
    return queryClientInstance.invalidateQueries(targetKey);
  }, [key]);

  const isStale = !state.updatedAt || Date.now() - state.updatedAt >= staleTime;

  return {
    data: state.data,
    isLoading: state.isFetching && state.data == null,
    isFetching: state.isFetching,
    error: state.error,
    refetch,
    invalidate,
    isStale,
  };
}

export function clearCache(prefix = null) {
  if (!prefix) {
    queryClientInstance.clear();
    return;
  }
  queryClientInstance.removeQueries(prefix);
}

export function invalidateQueries(keyOrPredicate) {
  return queryClientInstance.invalidateQueries(keyOrPredicate);
}
