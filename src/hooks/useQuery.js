// SETU — F2 query hook backed by TanStack Query.
import { useQuery as useTanStackQuery } from '@tanstack/react-query';
import { QUERY_DEFAULTS } from '@/lib/query-client';

export function useQuery(queryKey, queryFn, options = {}) {
  const {
    enabled = true,
    staleTime = QUERY_DEFAULTS.staleTime,
    retries = QUERY_DEFAULTS.retries,
    retryDelay = QUERY_DEFAULTS.retryDelay,
    gcTime = QUERY_DEFAULTS.gcTime,
    ...rest
  } = options;

  const query = useTanStackQuery({
    queryKey,
    enabled,
    staleTime,
    gcTime,
    retry: (failureCount, error) => {
      if (error?.name === 'AbortError' || error?.code === 'OFFLINE') return false;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
      const status = Number(error?.status || error?.statusCode || error?.code);
      if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
      return failureCount < retries;
    },
    retryDelay,
    networkMode: 'online',
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const request = Promise.resolve().then(() => queryFn({ signal }));
      let result;
      if (!signal) {
        result = await request;
      } else {
        const abortPromise = new Promise((_, reject) => {
          if (signal.aborted) {
            const error = new Error('Query cancelled');
            error.name = 'AbortError';
            reject(error);
            return;
          }
          signal.addEventListener('abort', () => {
            const error = new Error('Query cancelled');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        });
        result = await Promise.race([request, abortPromise]);
      }
      if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'error') && Object.prototype.hasOwnProperty.call(result, 'data')) {
        if (result.error) {
          const error = result.error instanceof Error ? result.error : new Error(result.error.message || String(result.error));
          error.status = result.error.status ?? result.error.statusCode ?? error.status;
          throw error;
        }
        return result.data;
      }
      return result;
    },
    ...rest,
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isStale: query.isStale,
    refetch: query.refetch,
  };
}
