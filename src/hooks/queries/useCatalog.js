import { useCallback } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { queryKeys } from '@/lib/query-keys';
import {
  getCategories,
  getCategoryPreviews,
  getVendors,
  getSchemes,
  getSevaProviders,
  getFeeConfig,
} from '@/lib/api';

export function useCategories(options = {}) {
  const queryFn = useCallback(() => getCategories(), []);
  return useQuery(queryKeys.categories.all, queryFn, options);
}

export function useCategoryPreviews(options = {}) {
  const queryFn = useCallback(() => getCategoryPreviews(), []);
  return useQuery(queryKeys.categories.previews, queryFn, options);
}


export function useVendors(filters = {}, options = {}) {
  const queryFn = useCallback(() => getVendors(filters), [filters]);
  return useQuery(queryKeys.vendors.list(filters), queryFn, options);
}

export function useVendorsByVillage(villageId, options = {}) {
  const queryFn = useCallback(() => getVendors({ villageId }), [villageId]);
  return useQuery(queryKeys.vendors.byVillage(villageId), queryFn, {
    ...options,
    enabled: Boolean(villageId) && options.enabled !== false,
  });
}

export function useSchemes(params = {}, options = {}) {
  const queryFn = useCallback(() => getSchemes(params), [params]);
  const key = params.category ? ['schemes', params.category] : queryKeys.schemes.all;
  return useQuery(key, queryFn, options);
}

export function useSevaProvidersByVillage(villageId, params = {}, options = {}) {
  const queryFn = useCallback(() => getSevaProviders({ villageId, ...params }), [villageId, params]);
  const key = ['seva-providers', { villageId, ...params }];
  return useQuery(key, queryFn, {
    ...options,
    enabled: Boolean(villageId) && options.enabled !== false,
  });
}

export function useFeeConfig(options = {}) {
  const queryFn = useCallback(({ signal } = {}) => getFeeConfig(signal), []);
  return useQuery(['fee-config'], queryFn, { ...options, staleTime: options.staleTime ?? 300_000 });
}
