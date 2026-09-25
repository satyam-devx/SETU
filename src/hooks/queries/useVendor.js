import { useCallback } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { queryKeys } from '@/lib/query-keys';
import { getVendorById, getVendorByOwnerId, getVendorCategories, getVendorHours, getVendorPaymentInfo, getKycRecords } from '@/lib/api';
import { useProducts } from '@/hooks/queries/useProducts';

export function useVendor(vendorId, options = {}) {
  const queryFn = useCallback(({ signal } = {}) => getVendorById(vendorId, signal), [vendorId]);
  return useQuery(queryKeys.vendors.detail(vendorId), queryFn, { ...options, enabled: Boolean(vendorId) && options.enabled !== false });
}

export function useVendorByOwner(ownerId, options = {}) {
  const queryFn = useCallback(({ signal } = {}) => getVendorByOwnerId(ownerId, signal), [ownerId]);
  return useQuery(queryKeys.vendors.byOwner(ownerId), queryFn, { ...options, enabled: Boolean(ownerId) && options.enabled !== false });
}

export function useVendorCategories(vendorId, options = {}) {
  const queryFn = useCallback(() => getVendorCategories(vendorId), [vendorId]);
  return useQuery(['vendor-categories', vendorId], queryFn, { ...options, enabled: Boolean(vendorId) && options.enabled !== false });
}

export function useVendorHours(vendorId, options = {}) {
  const queryFn = useCallback(() => getVendorHours(vendorId), [vendorId]);
  return useQuery(['vendor-hours', vendorId], queryFn, { ...options, enabled: Boolean(vendorId) && options.enabled !== false });
}

export function useVendorPaymentInfo(vendorId, options = {}) {
  const queryFn = useCallback(() => getVendorPaymentInfo(vendorId), [vendorId]);
  return useQuery(['vendor-payment-info', vendorId], queryFn, { ...options, enabled: Boolean(vendorId) && options.enabled !== false });
}

export function useVendorProducts(vendorId, options = {}) {
  return useProducts({ vendorId, limit: options.limit ?? 20, includeUnavailable: false }, { ...options, enabled: Boolean(vendorId) && options.enabled !== false });
}

export function useKycRecords(userId, options = {}) {
  const queryFn = useCallback(({ signal } = {}) => getKycRecords(userId, signal), [userId]);
  return useQuery(queryKeys.kyc.byUser(userId), queryFn, { ...options, enabled: Boolean(userId) && options.enabled !== false });
}
