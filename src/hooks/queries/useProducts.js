// SETU — Product query/mutation boundary (F2 TanStack Query domain).
import { useCallback, useMemo } from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { invalidateProductQueries } from '@/lib/product-query-invalidation';
import { getProductById, getProducts, getProductsByCategory, getProductCategories } from '@/lib/api';
export { useProductMutations } from '@/hooks/mutations/useProductMutations';
import { useQuery } from '@/hooks/useQuery';

export function useProducts(filters = {}, options = {}) {
  const normalized = useMemo(() => ({
    vendorId: filters.vendorId,
    category: filters.category,
    search: filters.search,
    page: filters.page ?? 0,
    limit: filters.limit ?? 30,
    includeUnavailable: !!filters.includeUnavailable,
  }), [filters.vendorId, filters.category, filters.search, filters.page, filters.limit, filters.includeUnavailable]);

  const key = useMemo(() => queryKeys.products.list(normalized), [normalized]);
  const queryFn = useCallback(({ signal } = {}) => getProducts(normalized, signal), [normalized]);
  return useQuery(key, queryFn, options);
}

export function useProduct(productId, options = {}) {
  const key = useMemo(() => queryKeys.products.detail(productId), [productId]);
  const queryFn = useCallback(({ signal } = {}) => getProductById(productId, {}, signal), [productId]);
  return useQuery(key, queryFn, { ...options, enabled: options.enabled !== false && !!productId });
}

export function fetchProductsByCategoryPage(categoryId, page = 0, limit = 20, options = {}) {
  const key = queryKeys.products.byCategory(categoryId, page, limit);
  return queryClientInstance.fetchQuery(key, () => getProductsByCategory(categoryId, { page, limit }), options);
}

export function useProductCategories(productId, options = {}) {
  const queryFn = useCallback(({ signal } = {}) => getProductCategories(productId, signal), [productId]);
  return useQuery(queryKeys.products.categories(productId), queryFn, {
    ...options,
    enabled: Boolean(productId) && options.enabled !== false,
  });
}

export function useProductsByCategory(categoryId, options = {}) {
  const page = options.page ?? 0;
  const limit = options.limit ?? 20;
  const key = useMemo(() => queryKeys.products.byCategory(categoryId, page, limit), [categoryId, page, limit]);
  const queryFn = useCallback(({ signal } = {}) => getProductsByCategory(categoryId, { page, limit }, signal), [categoryId, page, limit]);
  return useQuery(key, queryFn, { ...options, enabled: options.enabled !== false && !!categoryId });
}


