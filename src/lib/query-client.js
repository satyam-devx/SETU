// SETU — TanStack Query client adapter (F2)
//
// TanStack Query is the single server-state cache. This small adapter keeps
// the compatibility surface used by older SETU code (realtime + useDataFetch)
// while moving caching, deduplication, stale-time, invalidation, retries,
// garbage collection and query cancellation to TanStack Query itself.

import { QueryClient, onlineManager } from '@tanstack/react-query';
import { isNetworkOnline, subscribeNetwork } from '@/lib/network-state';
import { recordApiRetry } from '@/lib/performance-monitor';

const DEFAULT_STALE_TIME = 30_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 400;
const MAX_RETRY_DELAY = 3_000;
const DEFAULT_GC_TIME = 10 * 60_000;

function toError(error) {
  if (error instanceof Error) return error;
  return new Error(error?.message || String(error || 'Network error'));
}

function isRetryable(error) {
  if (!error) return true;
  if (error.name === 'AbortError' || error.code === 'OFFLINE') return false;
  const status = Number(error.status || error.statusCode || error.code);
  if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
  return true;
}

function retryPolicy(failureCount, error) {
  if (failureCount > 0) recordApiRetry({ failureCount, error });
  if (!isNetworkOnline()) return false;
  if (!isRetryable(error)) return false;
  return failureCount < DEFAULT_RETRIES;
}

function retryDelay(attemptIndex) {
  return Math.min(DEFAULT_RETRY_DELAY * 2 ** attemptIndex, MAX_RETRY_DELAY);
}

function queryKeyMatches(query, targetKey) {
  if (typeof targetKey === 'function') return targetKey(query.queryKey);
  if (!Array.isArray(targetKey)) return true;
  return targetKey.every((part, index) => Object.is(query.queryKey[index], part));
}

// Keep TanStack's online manager synchronized with SETU's centralized network
// state. This prevents queries from consuming retry attempts while offline.
onlineManager.setEventListener(setOnline => subscribeNetwork(setOnline));
onlineManager.setOnline(isNetworkOnline());

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      gcTime: DEFAULT_GC_TIME,
      retry: retryPolicy,
      retryDelay,
      networkMode: 'online',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

class SetuQueryClientAdapter {
  getQueryData(key) {
    return queryClient.getQueryData(key);
  }

  getQueryState(key) {
    const state = queryClient.getQueryState(key);
    if (!state) return null;
    return {
      data: state.data,
      error: state.error,
      updatedAt: state.dataUpdatedAt || 0,
      invalidatedAt: state.isInvalidated ? Date.now() : 0,
      isFetching: state.fetchStatus === 'fetching',
    };
  }

  setQueryData(key, updater) {
    return queryClient.setQueryData(key, updater);
  }

  subscribe(key, listener) {
    if (typeof listener !== 'function') return () => {};
    return queryClient.getQueryCache().subscribe(event => {
      if (event?.query && queryKeyMatches(event.query, key)) listener();
    });
  }

  async fetchQuery(key, fetcher, options = {}) {
    const {
      staleTime = DEFAULT_STALE_TIME,
      retries = DEFAULT_RETRIES,
      retryDelay: customRetryDelay = retryDelay,
      gcTime = DEFAULT_GC_TIME,
      force = false,
      allowOfflineFetch = false,
    } = options;

    if (!isNetworkOnline() && !allowOfflineFetch) {
      const error = new Error('Offline — using cached data');
      error.code = 'OFFLINE';
      throw error;
    }

    return queryClient.fetchQuery({
      queryKey: key,
      staleTime: force ? 0 : staleTime,
      gcTime,
      retry: (failureCount, error) => {
        if (failureCount > 0) recordApiRetry({ failureCount, error, operation: Array.isArray(key) ? key.join(':') : String(key) });
        if (allowOfflineFetch && error?.code === 'OFFLINE') return false;
        if (!isNetworkOnline()) return false;
        if (!isRetryable(error)) return false;
        return failureCount < retries;
      },
      retryDelay: customRetryDelay,
      queryFn: async ({ signal }) => {
        if (signal?.aborted) {
          const error = new Error('Query cancelled');
          error.name = 'AbortError';
          throw error;
        }

        const abortPromise = new Promise((_, reject) => {
          if (!signal) return;
          signal.addEventListener('abort', () => {
            const error = new Error('Query cancelled');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        });

        // Existing SETU API functions ignore arguments, while newer fetchers
        // may accept { signal }. Passing the signal keeps the boundary ready
        // for true transport-level cancellation without breaking old callers.
        const requestPromise = Promise.resolve().then(() => fetcher({ signal }));
        const result = signal ? await Promise.race([requestPromise, abortPromise]) : await requestPromise;

        if (result?.error) throw toError(result.error);
        return result?.data !== undefined ? result.data : result;
      },
    });
  }

  invalidateQueries(keyOrPredicate) {
    if (typeof keyOrPredicate === 'function') {
      let count = 0;
      for (const query of queryClient.getQueryCache().getAll()) {
        if (queryKeyMatches(query, keyOrPredicate)) {
          queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
          count += 1;
        }
      }
      return count;
    }

    queryClient.invalidateQueries({
      queryKey: Array.isArray(keyOrPredicate) ? keyOrPredicate : [keyOrPredicate],
      exact: false,
    });

    return queryClient.getQueryCache().findAll({
      queryKey: Array.isArray(keyOrPredicate) ? keyOrPredicate : [keyOrPredicate],
      exact: false,
    }).length;
  }

  removeQueries(keyOrPredicate = null) {
    if (keyOrPredicate == null) {
      queryClient.clear();
      return;
    }
    queryClient.removeQueries({
      queryKey: Array.isArray(keyOrPredicate) ? keyOrPredicate : [keyOrPredicate],
      exact: false,
    });
  }

  async refetchInvalidated() {
    if (!isNetworkOnline()) return [];
    await queryClient.refetchQueries({ type: 'active', stale: true, throwOnError: false });
    return [];
  }

  clear() {
    queryClient.clear();
  }

  get size() {
    return queryClient.getQueryCache().getAll().length;
  }
}

export const queryClientInstance = new SetuQueryClientAdapter();

export const QUERY_DEFAULTS = {
  staleTime: DEFAULT_STALE_TIME,
  retries: DEFAULT_RETRIES,
  retryDelay: DEFAULT_RETRY_DELAY,
  gcTime: DEFAULT_GC_TIME,
};
