import { useCallback } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useQuery } from '@/hooks/useQuery';
import { getRiderByUserId, getAvailableOrders, getRiderEarnings, getActiveSOSAlert } from '@/lib/api';

export function useRiderByUser(userId, options = {}) {
  const queryFn = useCallback(() => getRiderByUserId(userId), [userId]);
  return useQuery(queryKeys.rider.byUser(userId), queryFn, { ...options, enabled: Boolean(userId) && options.enabled !== false });
}

export function useRiderOffers(riderId, options = {}) {
  const queryFn = useCallback(() => getAvailableOrders(riderId), [riderId]);
  return useQuery(queryKeys.rider.offers(riderId), queryFn, { staleTime: 10_000, ...options, enabled: Boolean(riderId) && options.enabled !== false });
}

export function useRiderEarningsQuery(userId, period = 'month', options = {}) {
  const queryFn = useCallback(() => getRiderEarnings(userId, { period }), [userId, period]);
  return useQuery(queryKeys.rider.earnings(userId, period), queryFn, { ...options, enabled: Boolean(userId) && options.enabled !== false });
}

export function useActiveSOSAlert(riderId, options = {}) {
  const queryFn = useCallback(() => getActiveSOSAlert(riderId), [riderId]);
  return useQuery(queryKeys.rider.sos(riderId), queryFn, { ...options, enabled: Boolean(riderId) && options.enabled !== false });
}
