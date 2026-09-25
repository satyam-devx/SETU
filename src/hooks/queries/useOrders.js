// SETU — Order query boundary (F2 TanStack Query domain).
import { useCallback, useMemo } from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { getOrdersByCustomer, getOrdersByVendor, getOrdersByRider, getOrderById } from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';

const pageValue = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function scopedKey(factory, id, page, limit, status) {
  return [...factory(id), page, limit, status ?? null];
}

export function useCustomerOrders(customerId, options = {}) {
  const page = pageValue(options.page, 0), limit = pageValue(options.limit, 20), status = options.status;
  const key = useMemo(() => scopedKey(queryKeys.orders.customer, customerId, page, limit, status), [customerId, page, limit, status]);
  const queryFn = useCallback(({ signal } = {}) => getOrdersByCustomer(customerId, { page, limit, status }, signal), [customerId, page, limit, status]);
  return useQuery(key, queryFn, { ...options, enabled: options.enabled !== false && !!customerId });
}

export function useVendorOrders(vendorId, options = {}) {
  const page = pageValue(options.page, 0), limit = pageValue(options.limit, 20), status = options.status;
  const key = useMemo(() => scopedKey(queryKeys.orders.vendor, vendorId, page, limit, status), [vendorId, page, limit, status]);
  const queryFn = useCallback(({ signal } = {}) => getOrdersByVendor(vendorId, { page, limit, status }, signal), [vendorId, page, limit, status]);
  return useQuery(key, queryFn, { ...options, enabled: options.enabled !== false && !!vendorId });
}

export function useRiderOrders(riderId, options = {}) {
  const page = pageValue(options.page, 0), limit = pageValue(options.limit, 20), status = options.status;
  const key = useMemo(() => scopedKey(queryKeys.orders.rider, riderId, page, limit, status), [riderId, page, limit, status]);
  const queryFn = useCallback(({ signal } = {}) => getOrdersByRider(riderId, { page, limit, status }, signal), [riderId, page, limit, status]);
  return useQuery(key, queryFn, { ...options, enabled: options.enabled !== false && !!riderId });
}

export function useOrder(orderId, options = {}) {
  const key = useMemo(() => queryKeys.orders.detail(orderId), [orderId]);
  const queryFn = useCallback(({ signal } = {}) => getOrderById(orderId, signal), [orderId]);
  return useQuery(key, queryFn, { ...options, enabled: options.enabled !== false && !!orderId });
}

export function fetchOrderPage(type, id, page = 0, limit = 20, status) {
  const factories = { customer: queryKeys.orders.customer, vendor: queryKeys.orders.vendor, rider: queryKeys.orders.rider };
  const fetchers = { customer: getOrdersByCustomer, vendor: getOrdersByVendor, rider: getOrdersByRider };
  if (!factories[type] || !fetchers[type] || !id) return Promise.resolve({ data: [], error: null });
  const key = scopedKey(factories[type], id, page, limit, status);
  return queryClientInstance.fetchQuery(key, () => fetchers[type](id, { page, limit, status }));
}

export function invalidateOrderQueries({ customerId, vendorId, riderId, orderId } = {}) {
  let count = queryClientInstance.invalidateQueries(queryKeys.orders.all);
  if (customerId) count += queryClientInstance.invalidateQueries(queryKeys.orders.customer(customerId));
  if (vendorId) count += queryClientInstance.invalidateQueries(queryKeys.orders.vendor(vendorId));
  if (riderId) count += queryClientInstance.invalidateQueries(queryKeys.orders.rider(riderId));
  if (orderId) count += queryClientInstance.invalidateQueries(queryKeys.orders.detail(orderId));
  return count;
}
